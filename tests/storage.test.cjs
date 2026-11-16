const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const storageSource = html.slice(html.indexOf('function documentError('), html.indexOf('// MARKDOWN\n'));
function functionSource(name) {
  const match = html.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}
function handlerSource(id) {
  const start = html.indexOf(`$('${id}').addEventListener('click', async () => {`);
  assert.notEqual(start, -1);
  return html.slice(start, html.indexOf('\n});', start) + 4);
}

// A small transactional IndexedDB double: requests run asynchronously, a
// readwrite transaction holds the store lock, and aborted writes never commit.
function memoryDb(initial) {
  let records = new Map(initial.map(doc => [doc.id, structuredClone(doc)]));
  const waiting = [], commits = [];
  let running = false, abortNextWrite = false;
  function next() {
    if (running || !waiting.length) return;
    running = true;
    waiting.shift()();
  }
  const db = { transaction(_storeName, mode) {
    let local, aborted = false;
    const operations = [];
    const tx = { error: null, abort() { aborted = true; }, objectStore() { return store; } };
    function request(operation) {
      const req = {};
      operations.push(() => { req.result = structuredClone(operation()); req.onsuccess?.(); });
      return req;
    }
    const store = {
      get: id => request(() => local.get(id)),
      getAll: () => request(() => [...local.values()]),
      put: doc => {
        const copy = structuredClone(doc);
        return request(() => { local.set(copy.id, copy); return copy.id; });
      },
      add: doc => {
        const copy = structuredClone(doc);
        return request(() => {
          if (local.has(copy.id)) throw Object.assign(new Error('Duplicate'), { name: 'ConstraintError' });
          local.set(copy.id, copy); return copy.id;
        });
      },
      delete: id => request(() => { local.delete(id); }),
    };
    function finish(callback) {
      callback?.();
      running = false;
      queueMicrotask(next);
    }
    function pump() {
      if (aborted) { finish(tx.onabort); return; }
      const operation = operations.shift();
      if (operation) {
        try { operation(); }
        catch (error) { tx.error = error; aborted = true; tx.onerror?.(); }
        setImmediate(pump);
      } else if (mode === 'readwrite' && abortNextWrite) {
        abortNextWrite = false;
        tx.error = Object.assign(new Error('Quota exhausted'), { name: 'QuotaExceededError' });
        // Some IndexedDB failures surface on abort without an error event.
        finish(tx.onabort);
      } else {
        if (mode === 'readwrite') { records = local; commits.push(structuredClone([...records.values()])); }
        finish(tx.oncomplete);
      }
    }
    waiting.push(() => { local = new Map(structuredClone([...records])); setImmediate(pump); });
    queueMicrotask(next);
    return tx;
  } };
  return {
    db, commits,
    get: id => structuredClone(records.get(id)),
    abortNextWrite() { abortNextWrite = true; },
  };
}

const original = { id: 'doc-1', title: 'Original', markdown: '# Original\nbody', favorite: false, lastScrollY: 0 };
function app(database, overrides = {}) {
  const elements = new Map();
  const callbacks = new Map();
  const notices = [];
  const context = {
    db: database.db, currentDoc: structuredClone(original), allDocs: [structuredClone(original)],
    isEditing: true, isSavePending: false, editSnapshot: original.markdown,
    documentOpenRequest: 0, scrollTimer: null,
    console: { error() {} }, clearTimeout,
    $(id) {
      if (!elements.has(id)) elements.set(id, {
        value: '', disabled: false, readOnly: false, scrollTop: 0,
        addEventListener(_event, callback) { callbacks.set(id, callback); },
      });
      return elements.get(id);
    },
    toast(message) { notices.push(message); },
    extractTitle: markdown => markdown.split('\n')[0].replace(/^#+\s*/, ''),
    extractPreview: markdown => markdown.slice(0, 150),
    renderDoc() {}, showScreen() {},
    requestAnimationFrame(callback) { callback(); },
    SUI: { sheet: { close() {} } },
    buildSectionMarkdown: (section, draft) => section.sourceMarkdown.slice(0, section.startOffset) + draft + section.sourceMarkdown.slice(section.endOffset),
    ...overrides,
  };
  context.exitEditMode = () => { context.isEditing = false; };
  vm.createContext(context);
  vm.runInContext(storageSource + '\nObject.assign(globalThis, { dbCreate, dbGet, dbDelete, dbDeleteMany, dbGetAll });', context);
  vm.runInContext(functionSource('rememberDoc'), context);
  return { context, elements, callbacks, notices };
}

test('metadata updates from a stale tab retain another tab\'s latest content', async () => {
  const database = memoryDb([original]);
  const tabA = app(database).context, tabB = app(database).context;
  const newer = '# Updated\nnew content';
  await tabA.dbSaveMarkdown(original.id, original.markdown, newer);
  await tabB.dbUpdate(original.id, latest => ({ ...latest, favorite: !latest.favorite }));
  await tabB.dbUpdate(original.id, latest => ({ ...latest, lastScrollY: 300 }));
  assert.equal(database.get(original.id).markdown, newer);
  assert.equal(database.get(original.id).favorite, true);
  assert.equal(database.get(original.id).lastScrollY, 300);
});

test('opening a cached document reads the latest record without overwriting it', async () => {
  const newer = { ...original, markdown: '# Updated\nnew content', lastScrollY: 222 };
  const database = memoryDb([newer]);
  const { context } = app(database);
  vm.runInContext(functionSource('openDocument'), context);
  await context.openDocument(original.id);
  assert.equal(database.get(original.id).markdown, newer.markdown);
  assert.equal(context.currentDoc.markdown, newer.markdown);
  assert.equal(context.$('readerBody').scrollTop, 222);
});

test('simultaneous content saves conflict atomically and retain metadata', async () => {
  const database = memoryDb([{ ...original, favorite: true }]);
  const first = app(database).context, second = app(database).context;
  const results = await Promise.allSettled([
    first.dbSaveMarkdown(original.id, original.markdown, 'first draft'),
    second.dbSaveMarkdown(original.id, original.markdown, 'second draft'),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[1].reason.name, 'DocumentConflict');
  assert.equal(database.get(original.id).markdown, 'first draft');
  assert.equal(database.get(original.id).favorite, true);
});

test('metadata and content saves never recreate a removed document', async () => {
  const database = memoryDb([original]);
  const { context } = app(database);
  await context.dbDelete(original.id);
  await assert.rejects(context.dbUpdate(original.id, latest => ({ ...latest, lastScrollY: 400 })), { name: 'DocumentMissing' });
  await assert.rejects(context.dbSaveMarkdown(original.id, original.markdown, 'draft'), { name: 'DocumentMissing' });
  assert.equal(database.get(original.id), undefined);
});

test('aborted writes reject and leave the persisted record unchanged', async () => {
  const database = memoryDb([original]);
  const { context } = app(database);
  database.abortNextWrite();
  await assert.rejects(context.dbSaveMarkdown(original.id, original.markdown, 'draft'), { name: 'QuotaExceededError' });
  assert.deepEqual(database.get(original.id), original);
});

test('bulk removal commits atomically and leaves documents outside its snapshot intact', async () => {
  const second = { ...original, id: 'doc-2' }, third = { ...original, id: 'doc-3' };
  const database = memoryDb([original, second, third]);
  const { context } = app(database);
  database.abortNextWrite();
  await assert.rejects(context.dbDeleteMany([original.id, second.id]), { name: 'QuotaExceededError' });
  assert.deepEqual(database.get(original.id), original);
  assert.deepEqual(database.get(second.id), second);
  await context.dbDeleteMany([original.id, second.id]);
  assert.equal(database.get(original.id), undefined);
  assert.equal(database.get(second.id), undefined);
  assert.deepEqual(database.get(third.id), third);
});

test('overlapping section saves perform one splice and keep the next section', async () => {
  const markdown = '# A\none\ntwo\n\n# B\nkeep';
  const doc = { ...original, markdown };
  const database = memoryDb([doc]);
  const section = { docId: doc.id, sourceMarkdown: markdown, startOffset: 0, endOffset: markdown.indexOf('# B') };
  const { context, callbacks } = app(database, { currentDoc: structuredClone(doc), activeSectionEdit: section });
  context.$('sectionTextarea').value = '# A\nshort\n\n';
  vm.runInContext(handlerSource('sectionSaveBtn'), context);
  const first = callbacks.get('sectionSaveBtn')();
  assert.equal(context.isSavePending, true);
  await callbacks.get('sectionSaveBtn')();
  await first;
  assert.equal(database.commits.length, 1);
  assert.equal(database.get(doc.id).markdown, '# A\nshort\n\n# B\nkeep');
  assert.equal(context.activeSectionEdit, null);
  assert.equal(context.isSavePending, false);
});

test('failed section saves preserve the source snapshot, draft and current document', async () => {
  const database = memoryDb([original]);
  const section = { docId: original.id, sourceMarkdown: original.markdown, startOffset: 0, endOffset: original.markdown.length };
  const { context, callbacks } = app(database, { activeSectionEdit: section });
  context.$('sectionTextarea').value = '# Unsaved section';
  vm.runInContext(handlerSource('sectionSaveBtn'), context);
  database.abortNextWrite();
  await callbacks.get('sectionSaveBtn')();
  assert.equal(context.currentDoc.markdown, original.markdown);
  assert.equal(context.activeSectionEdit, section);
  assert.equal(context.$('sectionTextarea').value, '# Unsaved section');
  assert.equal(context.$('sectionTextarea').readOnly, false);
  assert.equal(context.$('sectionSaveBtn').disabled, false);
  assert.equal(context.isSavePending, false);
});

test('a conflicting full-editor save retains the unsaved draft and editor mode', async () => {
  const newer = { ...original, markdown: 'saved by another tab' };
  const database = memoryDb([newer]);
  const { context, callbacks, notices } = app(database);
  context.$('editorTextarea').value = 'my unsaved draft';
  vm.runInContext(handlerSource('editorSaveBtn'), context);
  await callbacks.get('editorSaveBtn')();
  assert.equal(database.get(original.id).markdown, newer.markdown);
  assert.equal(context.currentDoc.markdown, original.markdown);
  assert.equal(context.$('editorTextarea').value, 'my unsaved draft');
  assert.equal(context.isEditing, true);
  assert.equal(context.isSavePending, false);
  assert.match(notices.at(-1), /Changed in another tab/);
});

test('newer edits typed during a full-editor save remain as an unsaved draft', async () => {
  const database = memoryDb([original]);
  const { context, callbacks } = app(database);
  context.$('editorTextarea').value = 'first draft';
  vm.runInContext(handlerSource('editorSaveBtn'), context);
  const saving = callbacks.get('editorSaveBtn')();
  context.$('editorTextarea').value = 'newer draft';
  await saving;
  assert.equal(database.get(original.id).markdown, 'first draft');
  assert.equal(context.editSnapshot, 'first draft');
  assert.equal(context.$('editorTextarea').value, 'newer draft');
  assert.equal(context.isEditing, true);
});

test('failed paste imports retain the pasted text and keep the dialog open', async () => {
  const database = memoryDb([]);
  let closed = false;
  const { context, callbacks } = app(database, {
    saveDoc: async () => { throw new Error('No space'); },
    closeImportModal() { closed = true; },
  });
  context.$('pasteTextarea').value = '# Keep this draft';
  vm.runInContext(handlerSource('pasteSaveBtn'), context);
  await callbacks.get('pasteSaveBtn')();
  assert.equal(closed, false);
  assert.equal(context.$('pasteTextarea').value, '# Keep this draft');
  assert.equal(context.$('pasteSaveBtn').disabled, false);
  assert.equal(context.isSavePending, false);
});
