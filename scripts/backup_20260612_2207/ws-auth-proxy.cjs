// ws-auth-proxy.cjs — WebSocket 认证代理
// 监听原 Gateway 端口，帮每个新连接完成设备认证后转发到新 Gateway 端口
//
// 使用：
//   1. 改 openclaw.json: gateway.port = 22880
//   2. restart Gateway
//   3. 启动此代理: node ws-auth-proxy.cjs
//   4. sessions_spawn 连 22881（代理），代理帮它认证后转发到 22880（真实 Gateway）

const crypto = require('crypto');
const fs = require('fs');
const net = require('net');

const PROXY_PORT = 22881;
const GATEWAY_PORT = 22880;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || 'cd2bd65e6d8d4d11a30123ed45d2ae25';
const IDENTITY_PATH = process.env.OPENCLAW_IDENTITY_PATH ||
  require('os').homedir() + '/.openclaw/identity/device.json';

// Load device identity
let deviceId = 'openclaw-control-ui';
let pubB64 = 'disabled';
let privateKey = null;

if (fs.existsSync(IDENTITY_PATH)) {
  try {
    const id = JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf-8'));
    deviceId = id.deviceId;
    privateKey = crypto.createPrivateKey(id.privateKeyPem);
    const pubKey = crypto.createPublicKey(id.publicKeyPem);
    const der = pubKey.export({ type: 'spki', format: 'der' });
    const SPKI_PREFIX = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
    const raw = (der.length === 44 && der.subarray(0, 12).equals(SPKI_PREFIX)) ? der.subarray(12) : der;
    pubB64 = raw.toString('base64url');
    console.log('[Proxy] Device identity loaded:', deviceId.slice(0, 16) + '...');
  } catch (e) {
    console.error('[Proxy] Failed to load identity:', e.message);
  }
}

// WebSocket frame helpers
function createFrame(data, mask) {
  const p = Buffer.from(data, 'utf-8');
  const masked = mask || crypto.randomBytes(4);
  const m = Buffer.alloc(p.length);
  for (let i = 0; i < p.length; i++) m[i] = p[i] ^ masked[i % 4];
  let hdr;
  if (p.length < 126) {
    hdr = Buffer.alloc(2);
    hdr[1] = 0x80 | p.length;
  } else if (p.length < 65536) {
    hdr = Buffer.alloc(4);
    hdr[1] = 0x80 | 126;
    hdr.writeUInt16BE(p.length, 2);
  } else {
    hdr = Buffer.alloc(10);
    hdr[1] = 0x80 | 127;
    hdr.writeBigUInt64BE(BigInt(p.length), 2);
  }
  hdr[0] = 0x81;
  return Buffer.concat([hdr, masked, m]);
}

function parseFrames(buf) {
  const frames = [];
  let offset = 0;
  while (buf.length - offset >= 2) {
    const op = buf[offset] & 0x0f;
    const masked = (buf[offset + 1] & 0x80) !== 0;
    let len = buf[offset + 1] & 0x7f;
    let h = 2;
    if (len === 126) { if (buf.length - offset < 4) break; len = buf.readUInt16BE(offset + 2); h = 4; }
    else if (len === 127) { if (buf.length - offset < 10) break; len = Number(buf.readBigUInt64BE(offset + 2)); h = 10; }
    const ms = masked ? 4 : 0;
    const total = h + ms + len;
    if (buf.length - offset < total) break;
    let p = buf.subarray(offset + h + ms, offset + total);
    if (masked) {
      const mk = buf.subarray(offset + h, offset + h + 4);
      const u = Buffer.alloc(len);
      for (let i = 0; i < len; i++) u[i] = p[i] ^ mk[i % 4];
      p = u;
    }
    frames.push({ op, data: p.toString(), raw: p });
    offset += total;
  }
  return { frames, remaining: buf.subarray(offset) };
}

function performAuth(socket) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    let upgraded = false;
    let authed = false;
    let frameBuffer = Buffer.alloc(0);

    const onData = (data) => {
      buf = Buffer.concat([buf, data]);

      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        upgraded = true;
        buf = buf.subarray(idx + 4);
      }

      frameBuffer = Buffer.concat([frameBuffer, buf]);
      buf = Buffer.alloc(0);
      const { frames, remaining } = parseFrames(frameBuffer);
      frameBuffer = remaining;

      for (const frame of frames) {
        if (frame.op === 0x8) {
          // Close frame
          const code = frame.raw.length >= 2 ? frame.raw.readUInt16BE(0) : 0;
          reject(new Error(`Gateway closed: ${code} ${frame.raw.subarray(2).toString()}`));
          socket.removeListener('data', onData);
          return;
        }
        if (frame.op !== 0x1) continue;

        const msg = JSON.parse(frame.data);

        if (!authed) {
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            // Got challenge — respond with auth
            const nonce = msg.payload.nonce;
            const signedAtMs = Date.now();

            let sig = null;
            if (privateKey) {
              sig = crypto.sign(null, Buffer.from(
                ['v3', deviceId, 'openclaw-control-ui', 'webchat', 'operator',
                 'operator.admin,operator.approvals,operator.pairing,agent.spawn,agent.admin',
                 String(signedAtMs), GATEWAY_TOKEN, nonce, 'node.js', ''].join('|')
              ), privateKey);
            }

            const connectPayload = JSON.stringify({
              type: 'req', id: 'ic', method: 'connect',
              params: {
                auth: { token: GATEWAY_TOKEN },
                minProtocol: 3, maxProtocol: 3,
                client: { id: 'auth-proxy', displayName: 'Auth Proxy', version: '1.0', platform: 'node.js', mode: 'webchat' },
                role: 'operator',
                scopes: ['operator.admin', 'operator.approvals', 'operator.pairing', 'agent.spawn', 'agent.admin'],
                device: { id: deviceId, publicKey: pubB64, signature: sig ? sig.toString('base64url') : 'disabled', signedAt: signedAtMs, nonce },
                caps: ['tool-events'],
                userAgent: 'auth-proxy/1.0', locale: 'zh-CN',
              },
            });
            socket.write(createFrame(connectPayload));
          }
        } else if (msg.type === 'res') {
          if (msg.id === 'ic') {
            if (msg.ok) {
              authed = true;
              resolve();
            } else {
              reject(new Error(`Auth failed: ${msg.error?.message || JSON.stringify(msg)}`));
              socket.removeListener('data', onData);
            }
          }
        }
      }
    };

    socket.on('data', onData);
    socket.on('close', () => { if (!authed) reject(new Error('Gateway closed before auth')); });
    socket.on('error', (e) => { if (!authed) reject(e); });

    // Send WebSocket upgrade
    const wsKey = crypto.randomBytes(16).toString('base64');
    const upgrade = [
      'GET / HTTP/1.1',
      'Host: 127.0.0.1:' + GATEWAY_PORT,
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Key: ' + wsKey,
      'Sec-WebSocket-Version: 13',
      '', ''
    ].join('\r\n');
    socket.write(Buffer.from(upgrade));
  });
}

// ── Proxy ──────────────────────────────────────────────────────────────────
const server = net.createServer((clientConn) => {
  console.log('[Proxy] Client connected');

  const gwConn = new net.Socket();
  gwConn.connect(GATEWAY_PORT, '127.0.0.1', async () => {
    try {
      await performAuth(gwConn);
      console.log('[Proxy] Authenticated to Gateway — piping data');

      // Bidirectional pipe — intercept HTTP upgrade from client
      let clientUpgraded = false;
      let clientBuf = Buffer.alloc(0);

      clientConn.on('data', (data) => {
        if (!clientUpgraded) {
          clientBuf = Buffer.concat([clientBuf, data]);
          const idx = clientBuf.indexOf('\r\n\r\n');
          if (idx === -1) return;
          clientUpgraded = true;

          // Replace the Host header to point to real Gateway port
          let upgrade = clientBuf.subarray(0, idx + 4).toString();
          upgrade = upgrade.replace(
            /Host: 127\.0\.0\.1:\d+/,
            'Host: 127.0.0.1:' + GATEWAY_PORT
          );
          // Forward upgraded headers + remaining data to gateway
          const remaining = clientBuf.subarray(idx + 4);
          gwConn.write(Buffer.from(upgrade));
          if (remaining.length > 0) {
            gwConn.write(remaining);
          }
        } else {
          gwConn.write(data);
        }
      });

      gwConn.on('data', (data) => {
        clientConn.write(data);
      });

      clientConn.on('close', () => gwConn.destroy());
      gwConn.on('close', () => clientConn.destroy());
      clientConn.on('error', () => {});
      gwConn.on('error', () => {});

    } catch (e) {
      console.error('[Proxy] Auth failed:', e.message);
      clientConn.destroy();
      gwConn.destroy();
    }
  });

  gwConn.on('error', (e) => {
    console.error('[Proxy] Gateway connection error:', e.message);
    clientConn.destroy();
  });
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[Proxy] Listening on 127.0.0.1:${PROXY_PORT} → Gateway:${GATEWAY_PORT}`);
  console.log(`[Proxy] Device ID: ${deviceId.slice(0, 16)}...`);
  console.log(`[Proxy] Move Gateway to port ${GATEWAY_PORT} first!`);
});
