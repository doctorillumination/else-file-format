import assert from 'node:assert/strict';
import worker from './_worker.js';
import boundary from '../desktop/boundary.cjs';
const calls = [];
const env = { ASSETS: { async fetch(request) { calls.push(request.url); return new Response('Public asset', { headers: { 'X-Frame-Options': 'DENY' } }); } } };
for (const path of ['/index.html','/mixed.html','/One-file-two-readings.else','/source/live-post.html','/live-post.html?archive=anything']) {
  const response = await worker.fetch(new Request('https://sources.dotelse.app' + path), env);
  assert.equal(response.status, 404);
}
assert.equal(calls.length, 0);
const source = await worker.fetch(new Request('https://sources.dotelse.app/live-post.html'), env);
assert.equal(source.status, 200); assert.equal(source.headers.has('X-Frame-Options'), false);
assert.ok(source.headers.get('Content-Security-Policy').includes('frame-ancestors https://dotelse.app'));
assert.equal(calls[0], 'https://dotelse.app/source/live-post');
assert.equal((await worker.fetch(new Request('https://dotelse.app/mixed.html'), env)).headers.get('X-Frame-Options'), 'DENY');
assert.equal((await worker.fetch(new Request('https://dotelse.app/mixed.html', {method:'POST',body:'PRIVATE_DATA_SENTINEL'}), env)).status,405);
assert.equal((await worker.fetch(new Request('https://sources.dotelse.app/live-video.html'), env)).status,200);
assert.equal(boundary.inlineSourceURL('https://sources.dotelse.app/live-video.html'),true);
const main = {url:'app://else/mixed.html',parent:null}, sourceFrame = {url:'https://sources.dotelse.app/live-post.html#id=20',parent:main};
const descendant = {url:'https://platform.twitter.com/embed/Tweet.html',parent:sourceFrame};
assert.equal(boundary.inlineRequest({url:'https://example.invalid/private',resourceType:'xhr',frame:main}), false);
assert.equal(boundary.inlineRequest({url:'https://sources.dotelse.app/live-post.html',resourceType:'mainFrame',frame:main}), false);
assert.equal(boundary.inlineRequest({url:'https://sources.dotelse.app/live-post.html',resourceType:'subFrame',frame:{url:'about:blank',parent:main}}), true);
assert.equal(boundary.inlineRequest({url:'https://cdn.syndication.twimg.com/embed',resourceType:'xhr',frame:descendant}), true);
assert.equal(boundary.inlineRequest({url:'file:///private-file',resourceType:'xhr',frame:descendant}), false);
assert.equal(boundary.inlineSourceURL('https://sources.dotelse.app/index.html'), false);
console.log('Source hostname rejects reader files and uploads. Desktop root stays offline; only isolated source frames access HTTPS.');
