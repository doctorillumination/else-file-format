// This view uses YouTube's official player API and receives public passage coordinates only.
const params = new URLSearchParams(location.hash.slice(1));
const id = params.get('id'), nonce = params.get('nonce'), start = Number(params.get('start')), end = Number(params.get('end'));
const send = (type, extra = {}) => parent.postMessage({type, nonce, ...extra}, '*');
let player, ready = false;
const parents = new Set(['https://dotelse.app','https://doctorillumination.github.io','app://else']);
window.addEventListener('message', event => {
  if (event.source === parent && parents.has(event.origin) && event.data?.nonce === nonce && event.data.type === 'pause' && ready) player.pauseVideo();
});
if (/^[\w-]{11}$/.test(id || '') && /^[a-f0-9-]{36}$/.test(nonce || '') && Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= 86400) {
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', { host:'https://www.youtube-nocookie.com', videoId:id,
      playerVars:{playsinline:1,fs:1,start,end,rel:0,origin:location.origin},
      events:{onReady:()=>{ready=true;send('ready');},onError:()=>send('unavailable'),onStateChange:event=>send('state',{state:event.data})}
    });
  };
  const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.onerror = () => send('unavailable'); document.head.append(script);
}
