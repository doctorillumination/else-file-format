// This sandbox receives a public post ID only, never the archive or a file bridge.
const params = new URLSearchParams(location.hash.slice(1));
const postID = params.get('id'), nonce = params.get('nonce');
const send = (type, extra = {}) => parent.postMessage({ type, nonce, ...extra }, '*');
if (/^\d{1,25}$/.test(postID || '') && /^[a-f0-9-]{36}$/.test(nonce || '')) {
  const host = document.getElementById('tweet'), quote = document.createElement('blockquote'), link = document.createElement('a');
  quote.className = 'twitter-tweet'; quote.dataset.dnt = 'true'; quote.dataset.conversation = 'none';
  link.href = 'https://x.com/i/status/' + postID; quote.append(link); host.append(quote);
  const script = document.createElement('script'); script.src = 'https://platform.twitter.com/widgets.js';
  script.onload = () => {
    try {
      twttr.ready(twitter => {
        const report = () => {
          const frame = host.querySelector('iframe');
          if (frame && frame.getBoundingClientRect().height >= 100) send('ready');
          send('height', { height: document.body.scrollHeight });
        };
        twitter.events.bind('rendered', report);
        new ResizeObserver(report).observe(document.body);
        new MutationObserver(report).observe(host, { subtree: true, attributes: true, childList: true });
        report();
      });
    } catch { send('unavailable'); }
  };
  script.onerror = () => send('unavailable'); document.head.append(script);
}
