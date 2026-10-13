// The source hostname serves public embed code only. It cannot serve the archive reader.
const SOURCE_PATHS = new Set(['/live-post.html', '/live-post.mjs', '/live-video.html', '/live-video.mjs']);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    if (url.hostname === 'sources.dotelse.app') {
      if (!['GET', 'HEAD'].includes(request.method) || !SOURCE_PATHS.has(url.pathname) || url.search) return new Response('Not found', { status: 404 });
      url.hostname = 'dotelse.app'; url.pathname = '/source' + url.pathname.replace(/\.html$/, '');
      const response = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(response.headers);
      headers.delete('X-Frame-Options');
      headers.set('Content-Security-Policy', url.pathname.includes('live-video') ? "default-src 'none'; script-src 'self' https://www.youtube.com; style-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com; base-uri 'none'; form-action 'none'; frame-ancestors https://dotelse.app https://doctorillumination.github.io app://else" : "default-src 'none'; script-src 'self' https://platform.twitter.com https://cdn.syndication.twimg.com; style-src 'unsafe-inline'; img-src https://*.twimg.com data:; frame-src https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://x.com; connect-src https://*.twitter.com https://*.twimg.com; base-uri 'none'; form-action 'none'; frame-ancestors https://dotelse.app https://doctorillumination.github.io app://else");
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      return new Response(response.body, { status: response.status, headers });
    }
    if (url.pathname.startsWith('/source/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
