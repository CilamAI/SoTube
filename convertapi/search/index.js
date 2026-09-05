function extractInitialData(html) {
  const patterns = [
    /ytInitialData\s*=\s*({.+?});<\/script>/,
    /window\["ytInitialData"\]\s*=\s*({.+?});<\/script>/,
    /var\s+ytInitialData\s*=\s*({.+?});<\/script>/
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try {
        const json = JSON.parse(m[1]);
        if (json && typeof json === 'object') return json;
      } catch (_) { }
    }
  }
  return null;
}

async function handleVideoSearch(_event, query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: false, results: [] };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch (_) { } }, 10000);
    let html = '';
    try {
      const res = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(query.trim()), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+999;'
        },
        signal: ctrl.signal
      });
      if (!res.ok) return { success: false, error: 'YouTube responded with status ' + res.status, results: [] };
      html = await res.text();
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || /aborted/i.test(err.message || ''));
      return { success: false, error: aborted ? 'Search timed out. Check your connection and retry.' : ('Search failed: ' + (err.message || 'network error')), results: [] };
    } finally {
      clearTimeout(timer);
    }
    const json = extractInitialData(html);
    if (!json) return { success: false, error: 'Could not read YouTube results. Please retry.', results: [] };
    const sections = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const videos = [];

    for (const sec of sections) {
      const items = sec.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item.videoRenderer;
        if (v && v.videoId) {
          const thumbs = v.thumbnail?.thumbnails || [];
          const thumb = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '';
          videos.push({
            id: v.videoId,
            url: 'https://www.youtube.com/watch?v=' + v.videoId,
            title: v.title?.runs?.map((r) => r.text).join('') || v.title?.simpleText || '',
            channel: v.ownerText?.runs?.[0]?.text || '',
            duration: v.lengthText?.simpleText || '',
            thumbnail: thumb,
            description: v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r) => r.text).join('') || ''
          });
        }
      }
    }

    return { success: true, results: videos };
  } catch (err) {
    return { success: false, error: err.message, results: [] };
  }
}

module.exports = {
  extractInitialData,
  handleVideoSearch
};
