import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const handler = async (event: any) => {
  // Only trigger on compaction-before events
  if (event.type !== 'session' || event.action !== 'compact:before') {
    return;
  }

  const workspaceDir = event.context?.workspaceDir || process.env.HOME + '/.openclaw/workspace';
  const sessionKey = event.sessionKey || 'unknown';
  const timestamp = event.timestamp || new Date();

  const dateStr = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = timestamp.toISOString().slice(11, 16); // HH:MM (UTC)
  const memDir = join(workspaceDir, 'memory');
  const memFile = join(memDir, `${dateStr}.md`);

  // Ensure memory directory exists
  if (!existsSync(memDir)) {
    mkdirSync(memDir, { recursive: true });
  }

  const line = `\n[⚡压缩前持久化 ${timeStr}UTC] session=${sessionKey.split(':').pop()}\n`;

  try {
    appendFileSync(memFile, line, 'utf-8');
    console.log(`[pre-compact-memory] Wrote checkpoint to ${memFile}`);
  } catch (err) {
    console.error(`[pre-compact-memory] Failed to write: ${err}`);
  }
};

export default handler;
