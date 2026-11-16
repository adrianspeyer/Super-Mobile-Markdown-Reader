const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workerSource = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const cacheVersion = 'smmr-v6.2.5';
const base = 'https://reader.example/project/';
const cacheName = cacheVersion + ':' + base;

function workerHarness({ fetch = async () => { throw new Error('offline'); }, beforePut, appBase = base, stores = new Map() } = {}) {
  const handlers = {};
  const precached = [];
  const key = request => typeof request === 'string' ? request : request.url;
  const open = async name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      match: async request => store.get(key(request))?.clone(),
      put: async (request, response) => {
        if (beforePut) await beforePut();
        store.set(key(request), response.clone());
      },
      addAll: async urls => {
        precached.push(...urls);
        urls.forEach(url => store.set(url, new Response('precache:' + url)));
      }
    };
  };
  const context = vm.createContext({
    URL, Response, console, fetch,
    self: {
      location: new URL('sw.js', appBase),
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (name, fn) => { handlers[name] = fn; }
    },
    caches: {
      open,
      keys: async () => [...stores.keys()],
      delete: async name => stores.delete(name)
    }
  });
  vm.runInContext(workerSource, context);
  return {
    stores, precached,
    seed: async (url, body, name = cacheVersion + ':' + appBase) => {
      const cache = await open(name);
      // Seed directly so tests can deliberately delay later writes.
      stores.get(name).set(url, new Response(body));
      return cache;
    },
    dispatch: (type, request) => {
      const waits = [];
      let response;
      handlers[type]({
        request,
        waitUntil: promise => waits.push(promise),
        respondWith: promise => { response = promise; }
      });
      return { response, finished: Promise.all(waits) };
    }
  };
}

const request = (url, mode = 'cors', cache = 'default') => ({ url, mode, cache, method: 'GET' });

test('precache stays within the project path and includes local tour assets', async () => {
  const harness = workerHarness();
  await harness.dispatch('install').finished;
  const local = harness.precached.filter(url => new URL(url).origin === new URL(base).origin);
  assert.ok(local.length > 0);
  assert.ok(local.every(url => url.startsWith(base)));
  assert.ok(local.includes(base + 'src/markdown.js'));
  assert.ok(local.includes(base + 'src/speyer-tour.js'));
  assert.ok(local.includes(base + 'src/speyer-tour.css'));
  assert.equal(harness.precached.filter(url => url.includes('speyer-ui@3.5.3/')).length, 3);
});

test('root and project installations each serve their shell and Markdown helper offline', async () => {
  const stores = new Map();
  for (const appBase of ['https://reader.example/', base]) {
    const harness = workerHarness({ appBase, stores });
    await harness.dispatch('install').finished;
    await harness.dispatch('activate').finished;
    const shell = harness.dispatch('fetch', request(appBase + '?standalone=1', 'navigate'));
    assert.equal(await (await shell.response).text(), 'precache:' + appBase + 'index.html');
    const helper = harness.dispatch('fetch', request(appBase + 'src/markdown.js'));
    assert.equal(await (await helper.response).text(), 'precache:' + appBase + 'src/markdown.js');
    await helper.finished;
  }
  assert.ok(stores.has(cacheVersion + ':https://reader.example/'));
  assert.ok(stores.has(cacheName));
});

test('app dependencies match the precache and every local asset exists', async () => {
  const harness = workerHarness();
  await harness.dispatch('install').finished;
  const appSui = [...appSource.matchAll(/https:\/\/cdn\.jsdelivr\.net\/gh\/adrianspeyer\/speyer-ui@[^"\s]+/g)]
    .map(match => match[0]).sort();
  const cachedSui = harness.precached.filter(url => url.includes('/speyer-ui@')).sort();
  assert.equal(appSui.length, 3);
  assert.deepEqual(cachedSui, appSui);
  assert.ok(appSui.every(url => url.includes('@3.5.3/')));
  for (const match of appSource.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"\s]+\.(?:js|css))"/g)) {
    assert.ok(harness.precached.includes(new URL(match[1], base).href), 'uncached dependency: ' + match[1]);
  }
  for (const url of harness.precached.filter(url => url.startsWith(base))) {
    const relative = url.slice(base.length) || 'index.html';
    assert.ok(fs.existsSync(path.join(__dirname, '..', relative)), 'missing asset: ' + relative);
  }
});

test('manifest launch, scope, handlers, and icons resolve within each deployment', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  for (const appBase of ['https://reader.example/', base]) {
    const manifestUrl = appBase + 'manifest.json';
    assert.equal(new URL(manifest.start_url, manifestUrl).href, appBase);
    assert.equal(new URL(manifest.scope, manifestUrl).href, appBase);
    for (const handler of manifest.file_handlers) assert.equal(new URL(handler.action, manifestUrl).href, appBase);
    for (const icon of manifest.icons) assert.ok(new URL(icon.src, manifestUrl).href.startsWith(appBase));
  }
});

test('Netlify CSP allows HTTPS Markdown images while retaining its frame restriction', () => {
  const config = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
  const policy = config.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)[1];
  const directives = Object.fromEntries(policy.split(';').map(value => value.trim().split(/\s+/)).filter(parts => parts[0]).map(([name, ...values]) => [name, values]));
  assert.ok(directives['img-src'].includes('https:'));
  assert.ok(directives['img-src'].includes("'self'"));
  assert.ok(directives['frame-src'].includes("'none'"));
});

test('offline navigation finds index.html when the root entry is absent', async () => {
  const harness = workerHarness();
  await harness.seed(base + 'index.html', 'offline shell');
  const event = harness.dispatch('fetch', request(base, 'navigate'));
  assert.equal(await (await event.response).text(), 'offline shell');
});

test('failed navigation responses cannot overwrite a working offline shell', async () => {
  const harness = workerHarness({ fetch: async () => new Response('server failure', { status: 503 }) });
  await harness.seed(base + 'index.html', 'working shell');
  const event = harness.dispatch('fetch', request(base + 'index.html', 'navigate'));
  assert.equal(await (await event.response).text(), 'working shell');
  assert.equal(await harness.stores.get(cacheName).get(base + 'index.html').text(), 'working shell');
});

test('online root navigation refreshes the canonical offline shell', async () => {
  const harness = workerHarness({ fetch: async () => new Response('new shell') });
  await harness.seed(base + 'index.html', 'old shell');
  const event = harness.dispatch('fetch', request(base, 'navigate'));
  assert.equal(await (await event.response).text(), 'new shell');
  assert.equal(await harness.stores.get(cacheName).get(base + 'index.html').text(), 'new shell');
});

test('activation removes only older caches for its own SMMR scope', async () => {
  const harness = workerHarness();
  const oldCache = 'smmr-v6.2.4:' + base;
  const otherScopeCache = 'smmr-v6.2.4:https://reader.example/';
  await harness.seed(base, 'old', oldCache);
  await harness.seed('https://reader.example/', 'other SMMR', otherScopeCache);
  await harness.seed('https://reader.example/', 'legacy', 'smmr-v6.2.4');
  await harness.seed('https://reader.example/other/', 'other', 'another-app-v1');
  await harness.seed(base, 'current');
  await harness.dispatch('activate').finished;
  assert.ok(!harness.stores.has(oldCache));
  assert.ok(harness.stores.has(otherScopeCache));
  assert.ok(harness.stores.has('smmr-v6.2.4'));
  assert.ok(harness.stores.has('another-app-v1'));
  assert.ok(harness.stores.has(cacheName));
});

test('lookalike CDN origins and no-store requests bypass the cache', async () => {
  let fetches = 0;
  const harness = workerHarness({ fetch: async () => { fetches++; return new Response('network'); } });
  assert.equal(harness.dispatch('fetch', request('https://cdn.jsdelivr.net.evil.example/data')).response, undefined);
  assert.equal(harness.dispatch('fetch', request(base + 'manifest.json', 'cors', 'no-store')).response, undefined);
  assert.equal(harness.dispatch('fetch', request(base, 'navigate', 'no-store')).response, undefined);
  assert.equal(fetches, 0);
});

test('cached asset responses retain worker lifetime until revalidation writes finish', async () => {
  let releaseWrite;
  const writeGate = new Promise(resolve => { releaseWrite = resolve; });
  const harness = workerHarness({ fetch: async () => new Response('updated'), beforePut: () => writeGate });
  const asset = base + 'src/speyer-tour.js';
  await harness.seed(asset, 'cached');
  const event = harness.dispatch('fetch', request(asset));
  assert.equal(await (await event.response).text(), 'cached');
  let finished = false;
  event.finished.then(() => { finished = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  releaseWrite();
  await event.finished;
  assert.equal(await harness.stores.get(cacheName).get(asset).text(), 'updated');
});

function updateHarness({ controlled = true } = {}) {
  const start = appSource.indexOf('// --- Robust Service Worker Update Flow ---');
  const end = appSource.indexOf('async function init()', start);
  assert.ok(start !== -1 && end > start);
  const handlers = {};
  const button = {};
  const updateToast = { classList: { add: () => {} } };
  let reloads = 0;
  const context = vm.createContext({
    console,
    isSavePending: false,
    dirty: false,
    hasUnsavedChanges: () => context.dirty,
    toast: () => {},
    $: id => id === 'update-btn' ? button : updateToast,
    navigator: { serviceWorker: {
      controller: controlled ? {} : null,
      addEventListener: (name, fn) => { handlers[name] = fn; }
    } },
    window: {
      addEventListener: () => {},
      location: { reload: () => { reloads++; } }
    }
  });
  vm.runInContext(appSource.slice(start, end), context);
  return { context, button, handlers, reloads: () => reloads };
}

test('first service worker control does not reload the active page', () => {
  const harness = updateHarness({ controlled: false });
  harness.handlers.controllerchange();
  assert.equal(harness.reloads(), 0);
});

test('activation preserves a draft and leaves refresh available after saving', () => {
  const harness = updateHarness();
  harness.context.dirty = true;
  harness.handlers.controllerchange();
  assert.equal(harness.reloads(), 0);
  assert.equal(harness.button.disabled, false);
  harness.button.onclick();
  assert.equal(harness.reloads(), 0);
  harness.context.dirty = false;
  harness.button.onclick();
  assert.equal(harness.reloads(), 1);
});

test('refresh waits for pending persistence before activating an update', () => {
  const harness = updateHarness();
  let messages = 0;
  harness.context.worker = { postMessage: () => { messages++; } };
  vm.runInContext('showUpdateToast(worker)', harness.context);
  harness.context.isSavePending = true;
  harness.button.onclick();
  assert.equal(messages, 0);
  harness.context.isSavePending = false;
  harness.button.onclick();
  assert.equal(messages, 1);
});
