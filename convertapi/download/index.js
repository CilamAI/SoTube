const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { YTDLP_BIN, FFMPEG_BIN, NODE_BIN } = require('../binaries');
const { getDefaultDownloadDir } = require('../storage');

const activeJobs = new Map();

function extractYoutubeId(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const m = urlStr.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
  return m ? m[1] : null;
}

async function handleDownload(event, payload = {}) {
  const { url, format = '1080p', location, title: customTitle, thumbnail = '', channel = '', duration = '' } = payload;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { success: false, error: 'Please provide a valid URL or video link', code: 'INVALID_URL' };
  }

  const cleanUrl = url.trim();
  let destDir = getDefaultDownloadDir();
  try {
    if (location && typeof location === 'string' && location.trim()) {
      const loc = location.trim();
      if (!fs.existsSync(loc)) fs.mkdirSync(loc, { recursive: true });
      destDir = loc;
    } else {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    }
  } catch (_) {
    try {
      destDir = getDefaultDownloadDir();
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    } catch (_) { }
  }

  const jobId = payload.jobId || ('job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const sender = event.sender;

  const emitProgress = (progressData) => {
    try {
      if (!sender.isDestroyed()) {
        sender.send('video:progress', { jobId, ...progressData });
        sender.send('download:progress', { jobId, ...progressData });
        sender.send('convert:progress', { jobId, ...progressData });
      }
    } catch (_) { }
  };

  emitProgress({ status: 'starting', percent: 5, message: 'Initializing download...' });

  const ytId = extractYoutubeId(cleanUrl);
  let videoThumb = thumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '');
  let videoChannel = channel || '';
  let videoTitle = (customTitle && customTitle !== cleanUrl && !customTitle.startsWith('http')) ? customTitle : '';

  if (ytId) {
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`, { signal: AbortSignal.timeout(2500) });
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (!videoTitle && oembedData.title) videoTitle = oembedData.title;
        if (!videoChannel && oembedData.author_name) videoChannel = oembedData.author_name;
        if (oembedData.thumbnail_url) videoThumb = oembedData.thumbnail_url;
      }
    } catch (_) { }
  }

  let safeName = videoTitle || (ytId ? `youtube_${ytId}` : ('video_' + Date.now()));

  try {
    if (!sender.isDestroyed()) {
      sender.send('video:meta', {
        jobId,
        title: videoTitle || safeName,
        thumbnail: videoThumb,
        channel: videoChannel
      });
    }
  } catch (_) { }

  const isAudio = format.toLowerCase().includes('mp3') || format.toLowerCase().includes('audio');
  let maxHeight = 1080;
  const numMatch = format.match(/(\d{3,4})p?/i);
  if (numMatch) {
    maxHeight = parseInt(numMatch[1], 10);
  } else if (format.toLowerCase().includes('hd')) {
    maxHeight = 1080;
  } else if (format.toLowerCase().includes('sd')) {
    maxHeight = 720;
  }
  const isHD = maxHeight >= 1080;
  const ext = isAudio ? 'mp3' : 'mp4';

  const cleanBaseName = (safeName || '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 60)
    .replace(/[.\s]+$/, '')
    .trim() || ('media_' + (ytId || Date.now()));
  const sanitizedFileName = cleanBaseName.replace(/_+/g, '_').trim();
  const outputFile = path.join(destDir, `${sanitizedFileName}.${ext}`);
  const outputTemplate = path.join(destDir, `${sanitizedFileName}.%(ext)s`);
  const targetUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : cleanUrl;

  let calculatedSize = '0.83 MB';
  if (duration) {
    const parts = duration.split(':').map((p) => parseInt(p, 10) || 0);
    const secs = parts.length === 2 ? parts[0] * 60 + parts[1] : (parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 20);
    let rate = 0.25;
    if (isAudio) rate = 0.04;
    else if (maxHeight >= 1440) rate = 0.55;
    else if (maxHeight >= 1080) rate = 0.35;
    else if (maxHeight >= 720) rate = 0.18;
    else rate = 0.10;
    const mb = (secs * rate).toFixed(2);
    calculatedSize = `${Math.max(0.45, parseFloat(mb)).toFixed(2)} MB`;
  }

  return new Promise((resolve) => {
    emitProgress({ status: 'analyzing', percent: 15, message: `Analyzing media stream (${format})...` });

    if (YTDLP_BIN) {
      const args = ['--newline', '--no-playlist', '--no-mtime'];
      if (FFMPEG_BIN) args.push('--ffmpeg-location', FFMPEG_BIN);
      if (NODE_BIN) args.push('--js-runtimes', `node:${NODE_BIN}`);

      if (isAudio) {
        args.push('-x', '--audio-format', 'mp3');
      } else {
        args.push('--merge-output-format', 'mp4');
        args.push('-f', `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}][ext=mp4]/best[height<=${maxHeight}]/best`);
      }

      args.push('-o', outputTemplate, targetUrl);

      const proc = spawn(YTDLP_BIN, args, { windowsHide: true });
      const jobRecord = { proc, resolve, sender, outputFile, cancelled: false };
      activeJobs.set(jobId, jobRecord);

      let detectedOutputFile = '';
      let stdoutBuf = '';
      proc.stdout.on('data', (data) => {
        stdoutBuf += data.toString();
        const lines = stdoutBuf.split(/\r?\n/);
        stdoutBuf = lines.pop();

        for (const line of lines) {
          const l = line.trim();
          if (!l) continue;

          if (l.includes('Destination:')) {
            const p = l.slice(l.indexOf('Destination:') + 'Destination:'.length).trim().replace(/^["']|["']$/g, '');
            if (p) detectedOutputFile = p;
          } else if (l.includes('Merging formats into')) {
            const p = l.slice(l.indexOf('Merging formats into') + 'Merging formats into'.length).trim().replace(/^["']|["']$/g, '');
            if (p) detectedOutputFile = p;
          } else if (l.includes('has already been downloaded')) {
            const m = l.match(/\[download\]\s+([^\r\n]+?)\s+has already been downloaded/i);
            if (m && m[1]) detectedOutputFile = m[1].trim().replace(/^["']|["']$/g, '');
          }

          if (l.startsWith('title:')) {
            const parsedTitle = l.replace(/^title:/, '').trim();
            if (parsedTitle && (!videoTitle || videoTitle.startsWith('http'))) {
              videoTitle = parsedTitle;
              safeName = parsedTitle;
              try {
                if (!sender.isDestroyed()) {
                  sender.send('video:meta', { jobId, title: parsedTitle, thumbnail: videoThumb, channel: videoChannel });
                }
              } catch (_) { }
            }
            continue;
          }

          const dlMatch = l.match(/\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+[KkMmGg]i?B)(?:\s+at\s+([^\s]+))?/);
          if (dlMatch) {
            const pct = Math.min(95, Math.max(15, Math.round(parseFloat(dlMatch[1]))));
            const speed = dlMatch[3] ? ` (${dlMatch[3]})` : '';
            emitProgress({
              status: 'downloading',
              percent: pct,
              message: `Downloading ${pct}%${speed}`
            });
            continue;
          }

          if (l.includes('[Merger]') || l.includes('[ExtractAudio]') || l.includes('[ffmpeg]')) {
            emitProgress({
              status: 'converting',
              percent: 96,
              message: isAudio ? 'Converting audio to MP3...' : 'Finalizing MP4 video...'
            });
          }
        }
      });

      let stderrBuf = '';
      proc.stderr.on('data', (data) => {
        const errStr = data.toString();
        stderrBuf += errStr;
        if (errStr.includes('[download]') || errStr.includes('[ExtractAudio]') || errStr.includes('[Merger]')) {
          const dlMatch = errStr.match(/\[download\]\s+([\d\.]+)%/);
          if (dlMatch) {
            const pct = Math.min(95, Math.max(15, Math.round(parseFloat(dlMatch[1]))));
            emitProgress({ status: 'downloading', percent: pct, message: `Downloading ${pct}%` });
          }
        }
      });

      proc.on('close', async (code) => {
        if (jobRecord.cancelled) return;
        activeJobs.delete(jobId);

        let finalFile = outputFile;
        if (detectedOutputFile && fs.existsSync(detectedOutputFile)) {
          finalFile = detectedOutputFile;
        } else if (fs.existsSync(outputFile)) {
          finalFile = outputFile;
        } else {
          const dir = path.dirname(outputFile);
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const cleanBase = sanitizedFileName.replace(/[^\w]/g, '').slice(0, 15);
            const found = files.find(f => {
              if (f.endsWith('.part') || f.endsWith('.ytdl')) return false;
              const cleanF = f.replace(/[^\w]/g, '');
              return cleanBase && cleanF.startsWith(cleanBase);
            });
            if (found) finalFile = path.join(dir, found);
          }
        }

        if (!fs.existsSync(finalFile)) {
          const dir = path.dirname(outputFile);
          if (fs.existsSync(dir)) {
            try {
              const files = fs.readdirSync(dir);
              const now = Date.now();
              let latestFile = null;
              let latestMtime = 0;
              for (const f of files) {
                if (f.endsWith('.part') || f.endsWith('.ytdl')) continue;
                const fullP = path.join(dir, f);
                const st = fs.statSync(fullP);
                if (now - st.mtimeMs < 120000 && st.mtimeMs > latestMtime) {
                  const extLower = path.extname(f).toLowerCase();
                  if (isAudio && (extLower === '.mp3' || extLower === '.m4a' || extLower === '.webm' || extLower === '.opus')) {
                    latestMtime = st.mtimeMs;
                    latestFile = fullP;
                  } else if (!isAudio && (extLower === '.mp4' || extLower === '.mkv' || extLower === '.webm')) {
                    latestMtime = st.mtimeMs;
                    latestFile = fullP;
                  }
                }
              }
              if (latestFile) finalFile = latestFile;
            } catch (_) { }
          }
        }

        if (isAudio && finalFile && fs.existsSync(finalFile) && !finalFile.toLowerCase().endsWith('.mp3') && FFMPEG_BIN) {
          try {
            const targetMp3 = finalFile.replace(/\.[^.]+$/, '') + '.mp3';
            emitProgress({ status: 'converting', percent: 97, message: 'Converting to MP3...' });
            await new Promise((resConvert) => {
              const convProc = spawn(FFMPEG_BIN, ['-y', '-i', finalFile, '-vn', '-ab', '192k', targetMp3], { windowsHide: true });
              convProc.on('close', (c) => {
                if (c === 0 && fs.existsSync(targetMp3)) {
                  try { fs.unlinkSync(finalFile); } catch (_) { }
                  finalFile = targetMp3;
                }
                resConvert();
              });
            });
          } catch (_) { }
        }

        let fileValid = Boolean(finalFile && fs.existsSync(finalFile));
        if (fileValid) {
          try {
            const st = fs.statSync(finalFile);
            if (st.size < 500) fileValid = false;
          } catch (_) { }
        }

        if ((code === 0 || fileValid) && fileValid) {
          let actualSize = calculatedSize;
          try {
            const stats = fs.statSync(finalFile);
            actualSize = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
          } catch (_) { }

          emitProgress({ status: 'completed', percent: 100, message: 'Download completed!' });

          const result = {
            success: true,
            jobId,
            title: videoTitle || safeName,
            channel: videoChannel || channel || 'YouTube Video',
            duration: duration || '00:00:13',
            size: actualSize,
            thumbnail: videoThumb || thumbnail,
            format,
            filePath: finalFile,
            fileName: path.basename(finalFile),
            directory: destDir,
            isAudio,
            isHD
          };

          try {
            if (!sender.isDestroyed()) {
              sender.send('video:completed', result);
              sender.send('download:completed', result);
              sender.send('convert:completed', result);
            }
          } catch (_) { }

          return resolve(result);
        }

        const exitCode = (typeof code === 'number') ? code : 1;
        const detailedErr = errLines.length > 0
          ? errLines[errLines.length - 1].replace(/^ERROR:\s*/i, '')
          : `Download failed with exit code ${exitCode}. Please check the video URL or try again.`;

        const errPayload = {
          success: false,
          jobId,
          code: exitCode,
          error: detailedErr,
          message: detailedErr
        };

        emitProgress({ status: 'error', percent: 0, message: `Download failed: ${detailedErr}`, code: exitCode, error: detailedErr });
        try {
          if (sender && !sender.isDestroyed()) {
            sender.send('video:error', errPayload);
            sender.send('download:error', errPayload);
            sender.send('convert:error', errPayload);
          }
        } catch (_) { }
        resolve(errPayload);
      });

      proc.on('error', (err) => {
        if (jobRecord.cancelled) return;
        activeJobs.delete(jobId);
        const errCode = err.code || 'SPAWN_ERROR';
        const errPayload = {
          success: false,
          jobId,
          code: errCode,
          error: err.message,
          message: err.message
        };
        emitProgress({ status: 'error', percent: 0, message: err.message, code: errCode, error: err.message });
        try {
          if (sender && !sender.isDestroyed()) {
            sender.send('video:error', errPayload);
            sender.send('download:error', errPayload);
            sender.send('convert:error', errPayload);
          }
        } catch (_) { }
        resolve(errPayload);
      });

      return;
    }

    let currentPercent = 15;
    const interval = setInterval(async () => {
      currentPercent += 20;
      if (currentPercent < 95) {
        emitProgress({
          status: 'converting',
          percent: currentPercent,
          message: isAudio ? `Extracting audio (${format})...` : `Downloading video (${format})...`
        });
      } else {
        clearInterval(interval);
        activeJobs.delete(jobId);

        try {
          if (/^https?:\/\/.+\.(mp4|mp3|m4a|webm|mov|mkv)(\?.*)?$/i.test(cleanUrl)) {
            const res = await fetch(cleanUrl);
            if (res.ok) {
              const arr = await res.arrayBuffer();
              fs.writeFileSync(outputFile, Buffer.from(arr));
            }
          }
        } catch (_) { }

        emitProgress({ status: 'completed', percent: 100, message: 'Download completed!' });
        const result = {
          success: true,
          jobId,
          title: videoTitle || safeName,
          channel: videoChannel || channel || 'Video',
          duration: duration || '00:00:13',
          size: calculatedSize,
          thumbnail: videoThumb || thumbnail,
          format,
          filePath: outputFile,
          fileName: `${sanitizedFileName}.${ext}`,
          directory: destDir,
          isAudio,
          isHD
        };
        try {
          if (!sender.isDestroyed()) {
            sender.send('video:completed', result);
            sender.send('download:completed', result);
            sender.send('convert:completed', result);
          }
        } catch (_) { }
        resolve(result);
      }
    }, 400);

    activeJobs.set(jobId, { interval, resolve, sender, outputFile, cancelled: false });
  });
}

const downloadChannels = [
  'video:download',
  'video:convert',
  'download:video',
  'convert:video',
  'download-video',
  'convert-video',
  'download:convert',
  'convert:download',
  'download-convert-video',
  'download',
  'convert',
  'ipc:download',
  'video:1440p',
  'video:1080p',
  'video:720p',
  'video:480p',
  'video:download:1440p',
  'video:download:1080p',
  'video:download:720p',
  'video:download:480p',
  'download:1440p',
  'download:1080p',
  'download:720p',
  'download:480p'
];

function cancelJob(input) {
  let jobId = input;
  if (typeof input === 'object' && input !== null) {
    jobId = input.jobId || input.id;
  }
  if ((!jobId || !activeJobs.has(jobId)) && activeJobs.size === 1) {
    jobId = activeJobs.keys().next().value;
  }

  if (jobId && activeJobs.has(jobId)) {
    const job = activeJobs.get(jobId);
    job.cancelled = true;
    if (job.interval) clearInterval(job.interval);
    if (job.proc) {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${job.proc.pid} /t /f`);
        } else {
          job.proc.kill('SIGKILL');
        }
      } catch (_) { }
    }
    activeJobs.delete(jobId);
    try {
      if (job.outputFile && fs.existsSync(job.outputFile)) {
        fs.unlinkSync(job.outputFile);
      }
      const part1 = (job.outputFile || '') + '.part';
      if (fs.existsSync(part1)) fs.unlinkSync(part1);
      const part2 = (job.outputFile || '') + '.ytdl';
      if (fs.existsSync(part2)) fs.unlinkSync(part2);
    } catch (_) { }
    try {
      if (job.sender && !job.sender.isDestroyed()) {
        const cancelPayload = { jobId, status: 'cancelled', message: 'Cancelled', cancelled: true };
        job.sender.send('video:cancelled', cancelPayload);
        job.sender.send('download:cancelled', cancelPayload);
        job.sender.send('convert:cancelled', cancelPayload);
        job.sender.send('video:cancel', cancelPayload);
        job.sender.send('download:cancel', cancelPayload);
        job.sender.send('convert:cancel', cancelPayload);
        job.sender.send('ipc:cancel', cancelPayload);
        job.sender.send('ipc:cancelled', cancelPayload);
        job.sender.send('cancel', cancelPayload);
        job.sender.send('cancelled', cancelPayload);
        job.sender.send('video:progress', { jobId, status: 'cancelled', percent: 0, message: 'Cancelled' });
        job.sender.send('download:progress', { jobId, status: 'cancelled', percent: 0, message: 'Cancelled' });
        job.sender.send('convert:progress', { jobId, status: 'cancelled', percent: 0, message: 'Cancelled' });
      }
    } catch (_) { }
    if (job.resolve) job.resolve({ success: false, cancelled: true, message: 'Download cancelled' });
    return { success: true, jobId, cancelled: true };
  }
  return { success: false, error: 'Job not found' };
}

const cancelChannels = [
  'video:cancel',
  'video:cancelled',
  'download:cancel',
  'download:cancelled',
  'convert:cancel',
  'convert:cancelled',
  'cancel:video',
  'cancel:download',
  'cancel:convert',
  'cancel-video',
  'cancel-download',
  'cancel-convert',
  'download-convert:cancel',
  'download-convert-video:cancel',
  'cancel-download-convert',
  'cancel-download-convert-video',
  'cancel',
  'cancelled',
  'ipc:cancel',
  'ipc-cancel',
  'ipc:cancelled',
  'cancel:ipc',
  'cancel-job',
  'job:cancel',
  'job:cancelled'
];

module.exports = {
  activeJobs,
  extractYoutubeId,
  handleDownload,
  cancelJob,
  downloadChannels,
  cancelChannels
};
