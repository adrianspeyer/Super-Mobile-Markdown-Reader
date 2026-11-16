const test = require('node:test');
const assert = require('node:assert/strict');
const marked = require('marked');
const markdown = require('../src/markdown.js');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');

function render(source) { return markdown.render(marked, source, 'test-marker'); }

test('Setext and indented ATX headings map to their original source', () => {
  const source = 'Title\n=====\nintro\n\n  ## Next\nkeep\n\n# End\n';
  const result = render(source);
  assert.deepEqual(result.sections.map(s => s.title), ['Title', 'Next', 'End']);
  assert.equal(result.sections[1].startOffset, source.indexOf('  ## Next'));
  assert.equal(result.sections[1].endOffset, source.indexOf('# End'));
  assert.match(result.html, /<h1 data-smmr-section="test-marker:0">Title<\/h1>/);
  assert.match(result.html, /<h2 data-smmr-section="test-marker:1">Next<\/h2>/);
});

test('fenced code, definitions and nested headings never shift section mapping', () => {
  const source = '[ref]: https://example.com\n\n~~~md\n# Fake\n~~~\n\n````md\n```\n# Also fake\n````\n\n> # Quoted\n\n- # Listed\n\n<h1>HTML heading</h1>\n\n# Real\nBody';
  const result = render(source);
  assert.deepEqual(result.sections.map(s => s.title), ['Real']);
  assert.equal(result.sections[0].startOffset, source.indexOf('# Real'));
  assert.equal((result.html.match(/data-smmr-section=/g) || []).length, 1);
});

test('section replacement preserves following sections and CRLF source offsets', () => {
  const source = '# A\r\none\r\ntwo\r\n\r\n# B\r\nkeep\r\n';
  const section = { ...render(source).sections[0], sourceMarkdown: source };
  const result = markdown.replaceSection(section, '# A\nshort');
  assert.equal(result, '# A\r\nshort\r\n\r\n# B\r\nkeep\r\n');
  assert.deepEqual(render(result).sections.map(s => s.title), ['A', 'B']);
});

test('parent sections include subheadings and stop at the next peer', () => {
  const source = '# Parent\nbody\n\n## Child\nchild body\n\n# Peer\nkeep';
  const sections = render(source).sections;
  assert.equal(sections[0].endOffset, source.indexOf('# Peer'));
  assert.equal(sections[1].endOffset, source.indexOf('# Peer'));
});

test('heading slugs support links, Unicode, punctuation and duplicate names', () => {
  const used = new Set();
  assert.equal(markdown.slug('Introduction', used), 'introduction');
  assert.equal(markdown.slug('Introduction', used), 'introduction-1');
  assert.equal(markdown.slug('Introduction-1', used), 'introduction-1-1');
  assert.equal(markdown.slug('Café & 日本語!', used), 'café--日本語');
  assert.equal(markdown.slug('!!!', used), 'section');
});

test('document titles use real H1 tokens instead of code-block text', () => {
  const source = app.slice(app.indexOf('function extractTitle('), app.indexOf('function extractPreview('));
  const context = { marked };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(context.extractTitle('Real title\n==========\n\n~~~md\n# Fake title\n~~~'), 'Real title');
  assert.equal(context.extractTitle('```md\n# Fake\n```\n\n# Real'), 'Real');
});

test('unchanged CRLF documents are not dirty but full and section drafts are', () => {
  const source = app.slice(app.indexOf('function hasUnsavedChanges('), app.indexOf("window.addEventListener('beforeunload'"));
  const nodes = { editorTextarea: { value: '# Title\nBody' }, sectionTextarea: { value: '' }, importDialog: { open: false } };
  const context = { isEditing: true, editSnapshot: '# Title\r\nBody', activeSectionEdit: null, $: id => nodes[id] };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(!!context.hasUnsavedChanges(), false);
  nodes.editorTextarea.value += '!';
  assert.equal(!!context.hasUnsavedChanges(), true);
  context.isEditing = false;
  context.activeSectionEdit = { originalText: 'old' };
  nodes.sectionTextarea.value = 'new';
  assert.equal(!!context.hasUnsavedChanges(), true);
});
