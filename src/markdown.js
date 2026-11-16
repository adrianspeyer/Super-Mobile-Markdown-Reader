/* Markdown source mapping shared by the reader and section editor. */
(function(root) {
  'use strict';

  function render(marked, markdown, marker) {
    const options = { gfm: true, breaks: true };
    // Marked normalizes line endings. Keep offsets into the original document
    // so editing one section preserves the rest byte-for-byte, including CRLF.
    const offsets = [];
    let normalized = '';
    for (let i = 0; i < markdown.length; i++) {
      offsets.push(i);
      if (markdown[i] === '\r') {
        normalized += '\n';
        if (markdown[i + 1] === '\n') i++;
      } else normalized += markdown[i];
    }
    offsets.push(markdown.length);

    const lexer = new marked.Lexer(options);
    const sections = [];
    const sources = new Map();
    let blockDepth = 0;
    const blockTokens = lexer.blockTokens;
    lexer.blockTokens = function(...args) {
      blockDepth++;
      try { return blockTokens.apply(this, args); }
      finally { blockDepth--; }
    };
    // Observe the pinned parser's heading tokens, including Setext headings.
    // Nested list/quote headings remain navigable, but require the full editor:
    // their raw source contains container prefixes the heading token omits.
    for (const name of ['heading', 'lheading']) {
      const tokenize = lexer.tokenizer[name];
      lexer.tokenizer[name] = function(src) {
        const token = tokenize.call(this, src);
        if (token && blockDepth === 1) {
          sources.set(token, sections.length);
          sections.push({
            startOffset: offsets[normalized.length - src.length],
            level: token.depth,
            title: token.text
          });
        }
        return token;
      };
    }
    const tokens = lexer.lex(markdown);
    sections.forEach((section, index) => {
      section.endOffset = sections.slice(index + 1)
        .find(next => next.level <= section.level)?.startOffset ?? markdown.length;
    });
    const renderer = new marked.Renderer(options);
    renderer.heading = function(token) {
      const index = sources.get(token);
      const attr = index === undefined ? '' : ` data-smmr-section="${marker}:${index}"`;
      return `<h${token.depth}${attr}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
    };
    return { html: marked.Parser.parse(tokens, { ...options, renderer }), sections };
  }

  function replaceSection(section, editedText) {
    const before = section.sourceMarkdown.slice(0, section.startOffset);
    const after = section.sourceMarkdown.slice(section.endOffset);
    // Preserve the existing boundary if the editor trims trailing blank lines.
    // Without it the next heading can become ordinary paragraph/code content.
    const newline = section.sourceMarkdown.includes('\r\n') ? '\r\n' : '\n';
    let replacement = editedText.replace(/\r\n|\r|\n/g, newline);
    if (after && !/(?:\r?\n){2}$/.test(replacement)) {
      replacement = replacement.replace(/(?:\r?\n)*$/, '') + newline + newline;
    }
    return before + replacement + after;
  }

  function slug(text, used) {
    const base = text.trim().toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/g, '-') || 'section';
    let id = base;
    let suffix = 0;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id);
    return id;
  }

  const api = { render, replaceSection, slug };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SMMRMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
