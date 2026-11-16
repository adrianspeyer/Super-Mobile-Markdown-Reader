const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const escapeSource = html.match(/function escapeHtml\(s\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(escapeSource, 'The shared HTML escaping helper must exist');
const escapeHtml = vm.runInNewContext(`(${escapeSource})`);

test('HTML escaping protects text and both attribute quote styles', () => {
  assert.equal(escapeHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escapeHtml(null), '');
});

test('hostile document titles remain label text without creating attributes or markup', () => {
  const title = '" autofocus onfocus="alert(1)\' ><img src=x onerror=alert(1)> & notes';
  const encodedTitle = '&quot; autofocus onfocus=&quot;alert(1)&#39; &gt;&lt;img src=x onerror=alert(1)&gt; &amp; notes';
  const start = html.indexOf('  list.innerHTML = docs.map(doc => {');
  assert.notEqual(start, -1, 'The library card renderer must exist');
  const terminator = "  }).join('');";
  const end = html.indexOf(terminator, start) + terminator.length;
  const list = { innerHTML: '' };
  vm.runInNewContext(html.slice(start, end), {
    list, docs: [{ id: 'document-1', title, markdown: '', preview: title }],
    currentTab: 'all', escapeHtml,
    icon: () => '', wordCount: () => 0, timeAgo: () => 'Just now',
  });
  const openButton = list.innerHTML.match(/<button\b[^>]*\bdata-open="document-1"[^>]*>/)?.[0];
  assert.ok(openButton, 'Document opening is a native button');
  assert.ok(openButton.includes(`aria-label="Open ${encodedTitle}"`));
  const attributes = Object.fromEntries([...openButton.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  assert.deepEqual(Object.keys(attributes).sort(), ['aria-label', 'class', 'data-open', 'type']);
  assert.equal(attributes['aria-label'], `Open ${encodedTitle}`);
  assert.equal(list.innerHTML.includes('<img'), false);
  assert.match(list.innerHTML, /<\/button>\s*<div class="doc-preview">/);
  let buttonDepth = 0;
  for (const [tag] of list.innerHTML.matchAll(/<\/?button\b[^>]*>/g)) {
    buttonDepth += tag.startsWith('</') ? -1 : 1;
    assert.ok(buttonDepth === 0 || buttonDepth === 1, 'Buttons must not be nested');
  }
  assert.equal(buttonDepth, 0);
});
