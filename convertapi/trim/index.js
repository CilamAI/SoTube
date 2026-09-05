const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { FFMPEG_BIN } = require('../binaries');

let electron = {};
try { electron = require('electron'); } catch (_) {}
const BrowserWindow = electron.BrowserWindow;
const dialog = electron.dialog;

const activeTrimJobs = new Map();

async function handleTrimPickFile(event) {
  const win = BrowserWindow && event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
  if (!dialog || !dialog.showOpenDialog) return { canceled: true };
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Video to Trim',
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv', 'ts', 'm4v', '3gp'] },
      { name: 'Audio', extensions: ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  let size = 0;
  try {
    const stat = fs.statSync(filePath);
    size = stat.size;
  } catch (_) { }
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    size
  };
}

async function handleTrimStart(event, payload = {}, globalJobsMap = null) {
  const { inputPath, startTime = 0, endTime, mode = 'fast', customOutputPath } = payload;
  if (!inputPath || !fs.existsSync(inputPath)) {
    return { success: false, error: 'Input file does not exist' };
  }

  const startSec = Math.max(0, parseFloat(startTime) || 0);
  const endSec = parseFloat(endTime);
  if (!Number.isFinite(endSec) || endSec <= startSec) {
    return { success: false, error: 'End time must be greater than start time' };
  }
  const durationSec = Math.max(0.1, endSec - startSec);

  const ffmpegCmd = FFMPEG_BIN || 'ffmpeg';
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const dirName = path.dirname(inputPath);

  let outputPath = customOutputPath;
  if (!outputPath) {
    const timestamp = Math.floor(startSec) + 's_' + Math.floor(endSec) + 's';
    let candidate = path.join(dirName, `${baseName}_trimmed_${timestamp}${ext}`);
    let counter = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(dirName, `${baseName}_trimmed_${timestamp}_${counter}${ext}`);
      counter++;
    }
    outputPath = candidate;
  }

  const jobId = 'trim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  const args = [
    '-y',
    '-ss', String(startSec),
    '-i', inputPath,
    '-t', String(durationSec)
  ];

  if (mode === 'fast') {
    args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k');
  }
  args.push(outputPath);

  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(ffmpegCmd, args, { windowsHide: true });
    } catch (spawnErr) {
      return resolve({ success: false, error: `Failed to launch ffmpeg: ${spawnErr.message}` });
    }

    const job = {
      proc,
      outputPath,
      sender: event.sender,
      resolve,
      cancelled: false
    };
    activeTrimJobs.set(jobId, job);
    if (globalJobsMap) globalJobsMap.set(jobId, job);

    let stderrBuffer = '';

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrBuffer += text;
      const match = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.?\d*)/);
      if (match) {
        const hours = parseFloat(match[1]) || 0;
        const mins = parseFloat(match[2]) || 0;
        const secs = parseFloat(match[3]) || 0;
        const currentTrimSec = (hours * 3600) + (mins * 60) + secs;
        const percent = Math.min(99, Math.max(1, Math.round((currentTrimSec / durationSec) * 100)));
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send('trim:progress', { jobId, percent, currentTrimSec, duration: durationSec });
          }
        } catch (_) { }
      }
    });

    proc.on('error', (err) => {
      activeTrimJobs.delete(jobId);
      if (globalJobsMap) globalJobsMap.delete(jobId);
      if (job.cancelled) return;
      resolve({ success: false, error: `FFmpeg process error: ${err.message}` });
    });

    proc.on('close', (code) => {
      activeTrimJobs.delete(jobId);
      if (globalJobsMap) globalJobsMap.delete(jobId);
      if (job.cancelled) {
        return resolve({ success: false, cancelled: true, message: 'Trim cancelled' });
      }
      if (code === 0 && fs.existsSync(outputPath)) {
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send('trim:progress', { jobId, percent: 100 });
            event.sender.send('trim:completed', { jobId, success: true, outputPath, fileName: path.basename(outputPath) });
          }
        } catch (_) { }
        resolve({ success: true, outputPath, fileName: path.basename(outputPath) });
      } else {
        const errorMsg = stderrBuffer.split('\n').filter(Boolean).slice(-3).join(' ') || `FFmpeg exited with code ${code}`;
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send('trim:error', { jobId, error: errorMsg });
          }
        } catch (_) { }
        resolve({ success: false, error: errorMsg });
      }
    });
  });
}

function handleTrimCancel(_e, jobId, globalJobsMap = null) {
  if (jobId && activeTrimJobs.has(jobId)) {
    const job = activeTrimJobs.get(jobId);
    job.cancelled = true;
    if (job.proc) {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${job.proc.pid} /t /f`);
        } else {
          job.proc.kill('SIGKILL');
        }
      } catch (_) { }
    }
    activeTrimJobs.delete(jobId);
    if (globalJobsMap) globalJobsMap.delete(jobId);
    try {
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
    } catch (_) { }
    try {
      if (job.sender && !job.sender.isDestroyed()) {
        job.sender.send('trim:cancelled', { jobId, cancelled: true });
      }
    } catch (_) { }
    if (job.resolve) job.resolve({ success: false, cancelled: true });
    return { success: true, cancelled: true };
  }
  return { success: false, error: 'Trim job not found' };
}

module.exports = {
  activeTrimJobs,
  handleTrimPickFile,
  handleTrimStart,
  handleTrimCancel
};
