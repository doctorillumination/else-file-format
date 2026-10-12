'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, protocol, session, shell } = require('electron');
const path = require('node:path');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { ORIGIN, HOME, POLICY, assetName, externalLink, openedFile, exportedBytes, readFile } = require('./boundary.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.isPackaged && process.env.ELSE_TEST_USER_DATA) app.setPath('userData', process.env.ELSE_TEST_USER_DATA);
app.setName('Dotelse');
let window;
let pending = null;
let rendererReady = false;
let exportDirectory = null;
const assets = path.join(__dirname, 'app');

function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== HOME) throw new Error('Unavailable outside the .else reader.');
}

async function openFile(filename) {
  try {
    const value = await openedFile(filename);
    if (rendererReady && window) window.webContents.send('else:file', value);
    else pending = value;
  } catch (error) {
    if (window) window.webContents.send('else:file', { error: error.message });
    else pending = { error: error.message };
  }
}

async function chooseFile(pdfOnly = false) {
  const result = await dialog.showOpenDialog(window, { title: pdfOnly ? 'Create .else from a PDF' : 'Open PDF or .else', properties: ['openFile'],
    filters: [{ name: pdfOnly ? 'PDF' : 'PDF or .else', extensions: pdfOnly ? ['pdf'] : ['pdf', 'else'] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  return openedFile(result.filePaths[0]);
}

async function saveFile(value) {
  const bytes = exportedBytes(value);
  if (value.kind === 'else') {
    const { readPackage } = await import(pathToFileURL(path.join(assets, 'format.mjs')).href);
    await readPackage(new Uint8Array(bytes));
  }
  const result = await dialog.showSaveDialog(window, { title: value.kind === 'else' ? 'Save .else copy' : value.kind === 'pdf' ? 'Save original PDF' : 'Save AI-readable context',
    defaultPath: value.name, filters: [{ name: value.kind === 'md' ? 'Markdown' : value.kind.toUpperCase(), extensions: [value.kind] }] });
  if (result.canceled || !result.filePath) return { saved: false };
  await writeFile(result.filePath, bytes);
  return { saved: true, name: path.basename(result.filePath) };
}

function requestedFile(argv) {
  return argv.slice(1).find((value) => !value.startsWith('-') && /\.(else|pdf)$/i.test(value));
}

function projectLink(address) { if (externalLink(address)) void shell.openExternal(address); }

async function menuOpen(pdfOnly = false) {
  try { const value = await chooseFile(pdfOnly); if (value) window?.webContents.send('else:file', value); }
  catch (error) { window?.webContents.send('else:file', { error: error.message }); }
}

async function createWindow() {
  rendererReady = false;
  window = new BrowserWindow({ width: 1220, height: 860, minWidth: 640, minHeight: 540, title: '.else', backgroundColor: '#eeece4', show: false,
    icon: path.join(assets, 'ElseIcon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, partition: 'else-local' } });
  window.webContents.on('will-navigate', (event, address) => {
    if (address.split('#')[0] === HOME) return;
    event.preventDefault(); projectLink(address);
  });
  window.webContents.setWindowOpenHandler(({ url }) => { projectLink(url); return { action: 'deny' }; });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, { type: 'question', buttons: ['Keep working', 'Discard and close'], defaultId: 0, cancelId: 0,
      title: 'Unsaved .else', message: 'Save a .else copy before closing to keep your work.' });
    if (choice === 1) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; rendererReady = false; });
  await window.loadURL(HOME);
}

const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
    const filename = requestedFile(argv);
    if (filename) void openFile(filename);
  });
  app.on('open-file', (event, filename) => { event.preventDefault(); void openFile(filename); });
  app.whenReady().then(async () => {
    const allowed = new Set(JSON.parse(await readFile(path.join(assets, 'manifest.json'), 'utf8')));
    const local = session.fromPartition('else-local');
    local.protocol.handle('app', async (request) => {
      try {
        const name = assetName(request.url, allowed);
        if (!name || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
        const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        return new Response(request.method === 'HEAD' ? null : await readFile(path.join(assets, name)), { headers: {
          'Content-Type': types[path.extname(name)] || 'text/plain', 'Content-Security-Policy': POLICY, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    local.webRequest.onBeforeRequest((details, callback) => {
      let permitted = false;
      try { permitted = !!assetName(details.url, allowed) || details.url.startsWith('blob:' + ORIGIN + '/') || details.url.startsWith('data:'); } catch {}
      callback({ cancel: !permitted });
    });
    local.setPermissionRequestHandler((contents, permission, callback) => callback(contents === window?.webContents && permission === 'clipboard-sanitized-write'));
    local.setPermissionCheckHandler((contents, permission) => contents === window?.webContents && permission === 'clipboard-sanitized-write');
    local.on('will-download', (event) => event.preventDefault());
    ipcMain.handle('else:choose', async (event) => { trusted(event); return chooseFile(); });
    ipcMain.handle('else:confirm-discard', async (event) => {
      trusted(event);
      const result = await dialog.showMessageBox(window, { type: 'question', buttons: ['Keep working', 'Discard changes'], defaultId: 0, cancelId: 0,
        title: 'Unsaved .else', message: 'Save a .else copy first if you want to keep these changes.' });
      return result.response === 1;
    });
    ipcMain.handle('else:save', async (event, value) => { trusted(event); return saveFile(value); });
    ipcMain.handle('else:pending', (event) => { trusted(event); rendererReady = true; const value = pending; pending = null; return value; });
    ipcMain.handle('else:drag-pdf', async (event, value) => {
      trusted(event);
      if (value?.kind !== 'pdf') throw new Error('Only the original PDF can be dragged out.');
      const bytes = exportedBytes(value);
      exportDirectory ??= await mkdtemp(path.join(app.getPath('temp'), 'dotelse-export-'));
      const filename = path.join(exportDirectory, createHash('sha256').update(bytes).digest('hex').slice(0, 16) + '-' + value.name);
      await writeFile(filename, bytes);
      event.sender.startDrag({ file: filename, icon: nativeImage.createFromPath(path.join(assets, 'ElseIcon.png')).resize({ width: 64, height: 64 }) });
      return true;
    });
    const action = (name) => window?.webContents.send('else:action', name);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'File', submenu: [
        { label: 'Open PDF or .else…', accelerator: 'CmdOrCtrl+O', click: () => void menuOpen() },
        { label: 'Create from PDF…', click: () => void menuOpen(true) },
        { label: 'Save .else copy…', accelerator: 'CmdOrCtrl+S', click: () => action('save') },
        { label: 'Edit context', accelerator: 'CmdOrCtrl+E', click: () => action('edit') },
        { type: 'separator' }, { role: 'close' }, ...(process.platform === 'darwin' ? [] : [{ role: 'quit' }])
      ] },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
      { label: 'Help', submenu: [{ label: '.else website', click: () => projectLink('https://dotelse.app/') }] }
    ]));
    const filename = requestedFile(process.argv);
    if (filename) await openFile(filename);
    await createWindow();
    app.on('activate', () => { if (!window) void createWindow(); });
  }).catch((error) => { dialog.showErrorBox('Could not open .else', error.message); app.quit(); });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { if (exportDirectory) void rm(exportDirectory, { recursive: true, force: true }); });

module.exports = { openFile, chooseFile, saveFile, getWindow: () => window };
