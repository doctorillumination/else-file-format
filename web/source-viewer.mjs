const p = new URLSearchParams(location.hash.slice(1) || location.search), host = document.getElementById('source'), status = document.getElementById('source-status');
try {
  const u = new URL(p.get('url')); if (u.protocol !== 'https:' || u.username || u.password) throw Error('Unsupported source URL.');
  document.getElementById('original').href = u.href;
  if (p.get('kind') === 'youtube') {
    const id = u.searchParams.get('v'), start = Number(p.get('start')), end = Number(p.get('end'));
    if (u.hostname !== 'www.youtube.com' || u.pathname !== '/watch' || (id || '').length !== 11 || !/^[\w-]{11}$/.test(id || '') || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > 86400) throw Error('Invalid passage.');
    const f = document.createElement('iframe'); f.width = '640'; f.height = '360'; f.title = 'YouTube passage'; f.allow = 'fullscreen; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin'; f.src = `https://www.youtube-nocookie.com/embed/${id}?start=${start}&end=${end}&autoplay=0&playsinline=1`; host.append(f); status.textContent = `Selected passage: ${start} to ${end} seconds. Press play when ready.`;
  } else if (p.get('kind') === 'x') {
    const id = /^\/[^/]+\/status\/(\d+)$/.exec(u.pathname)?.[1]; if (!/^(?:www\.)?(?:x|twitter)\.com$/.test(u.hostname) || !id || id.length > 25) throw Error('Invalid X reference.');
    const quote = document.createElement('blockquote'); quote.className = 'twitter-tweet'; quote.dataset.dnt = 'true'; const a = document.createElement('a'); a.href = u.href; a.textContent = 'View referenced post'; quote.append(a); host.append(quote);
    const script = document.createElement('script'); script.src = 'https://platform.twitter.com/widgets.js'; script.async = true; script.onerror = () => { status.textContent = 'The embedded post is unavailable. Use the original source link.'; }; document.body.append(script);
  } else status.textContent = 'This provider is available through its original HTTPS link.';
} catch (e) { status.textContent = e.message; }
