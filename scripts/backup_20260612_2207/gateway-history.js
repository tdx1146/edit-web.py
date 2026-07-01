#!/usr/bin/env node
// gateway-history.js — Get session history via Gateway RPC
// Robust single-frame-at-a-time recv
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');

const GATEWAY_TOKEN = 'cd2bd65e6d8d4d11a30123ed45d2ae25';
const PORT = 22881;
const sessionKey = process.env.SESSION_KEY || 'main';

const wsKey = crypto.randomBytes(16).toString('base64');
const socket = net.connect(PORT, '127.0.0.1');
socket.setNoDelay();

const upgrade = [
  'GET / HTTP/1.1', 'Host: 127.0.0.1:' + PORT,
  'Upgrade: websocket', 'Connection: Upgrade',
  'Sec-WebSocket-Key: ' + wsKey, 'Sec-WebSocket-Version: 13',
  'Origin: http://127.0.0.1:' + PORT, '', ''
];
socket.write(Buffer.from(upgrade.join('\r\n')));

let buf = Buffer.alloc(0);
let upgraded = false;
let pendingRecv = null;

function sendFrame(data) {
  const p = Buffer.from(data, 'utf-8');
  const mk = crypto.randomBytes(4);
  const masked = Buffer.alloc(p.length);
  for (let i = 0; i < p.length; i++) masked[i] = p[i] ^ mk[i % 4];
  let hdr;
  if (p.length < 126) { hdr = Buffer.alloc(2); hdr[1] = 0x80 | p.length; }
  else { hdr = Buffer.alloc(4); hdr[1] = 0x80 | 126; hdr.writeUInt16BE(p.length, 2); }
  hdr[0] = 0x81;
  socket.write(Buffer.concat([hdr, mk, masked]));
}

function tryExtract() {
  if (buf.length < 2) return null;
  const len2 = buf[1] & 0x7f;
  let hdrsz = 2, payloadLen = len2;
  if (len2 === 126) { if (buf.length < 4) return null; payloadLen = buf.readUInt16BE(2); hdrsz = 4; }
  else if (len2 === 127) { if (buf.length < 10) return null; payloadLen = Number(buf.readBigUInt64BE(2)); hdrsz = 10; }
  const masked = (buf[1] & 0x80) !== 0;
  const maskSize = masked ? 4 : 0;
  const total = hdrsz + maskSize + payloadLen;
  if (buf.length < total) return null;
  let payload = buf.subarray(hdrsz + maskSize, hdrsz + maskSize + payloadLen);
  if (masked) { const mk2 = buf.subarray(hdrsz, hdrsz + 4); payload = Buffer.from(payload.map((b, i) => b ^ mk2[i % 4])); }
  buf = buf.subarray(total);
  return payload.toString('utf-8');
}

socket.on('data', (data) => {
  buf = Buffer.concat([buf, data]);
  if (!upgraded) {
    const idx = buf.indexOf('\r\n\r\n');
    if (idx === -1) return;
    upgraded = true;
    buf = buf.subarray(idx + 4);
  }
  // Extract as many complete frames as possible
  while (pendingRecv) {
    const frame = tryExtract();
    if (frame === null) break;
    const p = pendingRecv;
    pendingRecv = null;
    clearTimeout(p.timer);
    p.resolve(frame);
  }
});

function recv(timeoutMs) {
  return new Promise((resolve, reject) => {
    // Check if there's already a complete frame in the buffer
    if (upgraded) {
      const frame = tryExtract();
      if (frame !== null) { resolve(frame); return; }
    }
    const timer = setTimeout(() => {
      pendingRecv = null;
      reject(new Error('timeout'));
    }, timeoutMs);
    pendingRecv = { resolve, reject, timer };
  });
}

async function main() {
  try {
    // Receieve challenge
    const chalText = await recv(5000);
    const chal = JSON.parse(chalText);
    const nonce = chal.payload.nonce;
    const signedAtMs = Date.now();

    // Connect
    sendFrame(JSON.stringify({
      type: 'req', id: 'ic', method: 'connect',
      params: {
        auth: { token: GATEWAY_TOKEN },
        minProtocol: 3, maxProtocol: 3,
        client: { id: 'openclaw-control-ui', displayName: 'history', version: '1.0', platform: 'node.js', mode: 'webchat' },
        role: 'operator',
        scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
        device: { id: 'openclaw-control-ui', publicKey: 'disabled', signature: 'disabled', signedAt: signedAtMs, nonce },
        caps: ['tool-events'], userAgent: 'gw-history', locale: 'zh-CN'
      }
    }));

    // Receive connect response (may need to skip health events)
    let connResp = null;
    while (true) {
      const text = await recv(5000);
      const d = JSON.parse(text);
      if (d.type === 'res' && d.id === 'ic') { connResp = d; break; }
      // else it's an event, skip it
    }
    if (!connResp.ok) {
      process.stdout.write(JSON.stringify({ ok: false, error: 'connect: ' + (connResp.error?.message || JSON.stringify(connResp)) }) + '\n');
      socket.end(); return;
    }

    // Call chat.history
    sendFrame(JSON.stringify({
      type: 'req', id: 'h1', method: 'chat.history',
      params: { sessionKey, limit: 500 }
    }));

    // Receive history response (may need to skip intermediate events)
    let histResp = null;
    while (true) {
      const text = await recv(5000);
      const d = JSON.parse(text);
      if (d.type === 'res' && d.id === 'h1') { histResp = d; break; }
      // else event, skip it
    }

    if (!histResp.ok) {
      process.stdout.write(JSON.stringify({ ok: false, error: 'chat.history: ' + (histResp.error?.message || JSON.stringify(histResp)) }) + '\n');
      socket.end(); return;
    }

    const messages = histResp.payload?.messages || histResp.messages || [];
    process.stdout.write(JSON.stringify({ ok: true, messages }) + '\n');
    socket.end();

  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
    try { socket.end(); } catch (_) {}
  }
}

main();
