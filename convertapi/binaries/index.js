const path = require('path');
const fs = require('fs');

function findExecutable(candidates) {
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (_) { }
  }
  const pythonBases = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python'),
    path.join(process.env.APPDATA || '', 'Python')
  ];
  for (const pyBase of pythonBases) {
    try {
      if (fs.existsSync(pyBase)) {
        const dirs = fs.readdirSync(pyBase);
        for (const d of dirs) {
          for (const cand of candidates) {
            const name = path.basename(cand);
            const scriptPath = path.join(pyBase, d, 'Scripts', name);
            if (fs.existsSync(scriptPath)) return scriptPath;
          }
        }
      }
    } catch (_) { }
  }
  for (const c of candidates) {
    if (c && !c.includes(path.sep) && !c.includes('/')) return c;
  }
  return null;
}

const YTDLP_BIN = findExecutable([
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
  path.join(process.env.APPDATA || '', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
  'yt-dlp.exe',
  'yt-dlp'
]);

const FFMPEG_BIN = findExecutable([
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'ffmpeg.exe'),
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', 'ffmpeg.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe'),
  'ffmpeg.exe',
  'ffmpeg'
]);

const NODE_BIN = findExecutable([
  'C:\\Program Files\\nodejs\\node.exe',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
  path.join(process.env.APPDATA || '', 'npm', 'node.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'node', 'node.exe'),
  'node.exe',
  'node'
]);

module.exports = {
  findExecutable,
  YTDLP_BIN,
  FFMPEG_BIN,
  NODE_BIN
};
