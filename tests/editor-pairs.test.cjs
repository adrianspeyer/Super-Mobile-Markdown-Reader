const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Exercise the handler shipped by the app, without a second implementation.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf("$('editorTextarea').addEventListener('keydown',");
assert.notEqual(start, -1, 'The editor keydown handler must exist');
const end = html.indexOf('\n});', start) + '\n});'.length;
let onKeydown;
vm.runInNewContext(html.slice(start, end), {
  $(id) {
    assert.equal(id, 'editorTextarea');
    return { addEventListener(event, callback) {
      assert.equal(event, 'keydown');
      onKeydown = callback;
    } };
  },
});

function textarea(value = '', selectionStart = value.length, selectionEnd = selectionStart) {
  return {
    value, selectionStart, selectionEnd,
    setRangeText(replacement, start, end, mode) {
      this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
      this.selectionStart = mode === 'select' ? start : start + replacement.length;
      this.selectionEnd = start + replacement.length;
    },
  };
}

function press(ta, key, options = {}) {
  let prevented = false;
  onKeydown({ key, target: ta, ...options, preventDefault() { prevented = true; } });
  return prevented;
}

function type(text) {
  const ta = textarea();
  for (const key of text) {
    if (!press(ta, key)) ta.setRangeText(key, ta.selectionStart, ta.selectionEnd, 'end');
  }
  return ta;
}

test('typing a Markdown link skips both inserted closing brackets', () => {
  const ta = type('[text](url)');
  assert.equal(ta.value, '[text](url)');
  assert.equal(ta.selectionStart, ta.value.length);
  assert.equal(ta.selectionEnd, ta.value.length);
});

test('symmetric delimiters produce the intended Markdown without duplicates', () => {
  for (const text of ['*italic*', '**bold**', '_italic_', '`code`', '"quoted"']) {
    const ta = type(text);
    assert.equal(ta.value, text);
    assert.equal(ta.selectionStart, text.length);
  }
});

test('an opening delimiter wraps the selection and keeps its content selected', () => {
  for (const [open, close] of [['[', ']'], ['(', ')'], ['*', '*'], ['`', '`']]) {
    const ta = textarea('before text after', 7, 11);
    assert.equal(press(ta, open), true);
    assert.equal(ta.value, `before ${open}text${close} after`);
    assert.equal(ta.value.slice(ta.selectionStart, ta.selectionEnd), 'text');
  }
});

test('closing brackets do not swallow a selection or an unmatched closing key', () => {
  const selected = textarea('[text]', 1, 5);
  assert.equal(press(selected, ']'), false);
  assert.equal(selected.value, '[text]');
  const unmatched = textarea('text');
  assert.equal(press(unmatched, ')'), false);
});

test('shortcuts, AltGr and IME composition pass through unchanged', () => {
  for (const options of [
    { ctrlKey: true }, { metaKey: true }, { altKey: true },
    { isComposing: true }, { keyCode: 229 },
  ]) {
    const ta = textarea('text');
    assert.equal(press(ta, '[', options), false);
    assert.equal(ta.value, 'text');
    assert.equal(ta.selectionStart, 4);
  }
});
