// Builds src/chapters/*.md into dist/*.html.
//
// Source conventions (see README.md for the full list):
//   $...$, $$...$$                 math, pre-rendered with KaTeX
//   ::: definition syntax-tree "syntax tree"     numbered block with a label and optional name
//   [[syntax-tree]] / [[syntax-tree|syntax trees]] cross-reference to any label
//   ## Heading {#label}            numbered section, referable like any other label
//   ::: widget tree expr="x^2"     interactive widget, mounted by assets/widgets.js
//   ::: todo                       note for later work; shown only with --drafts, always listed by the build
//
// Usage: node build.mjs [--drafts]

import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import katex from 'katex';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const BOOK_TITLE = 'Reading and Rewriting Mathematics';
const DRAFTS = process.argv.includes('--drafts');

const KINDS = { definition: 'Definition', example: 'Example', exercise: 'Exercise', puzzle: 'Puzzle', remark: 'Remark' };

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const parseAttrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

// ---------- load chapters ----------

const chapters = fs.readdirSync(path.join(SRC, 'chapters'))
  .filter((f) => /^\d+-.*\.md$/.test(f)).sort()
  .map((file) => {
    const src = fs.readFileSync(path.join(SRC, 'chapters', file), 'utf8');
    const num = parseInt(file, 10);
    const title = (src.match(/^# (.+)$/m) || [, file])[1].trim();
    return { file, num, title, src, out: file.replace(/\.md$/, '.html') };
  });

// ---------- pass 1: collect labels ----------
// Walk the raw source in order so numbering matches what pass 2 emits.

const labels = new Map(); // label -> { href, text, name }
const errors = [];
const todos = []; // { where, text }

for (const ch of chapters) {
  ch.sections = [];
  const counters = {};
  let sec = 0;
  const lines = ch.src.split('\n');
  lines.forEach((line, i) => {
    let m;
    if (/^::: todo\b/.test(line)) {
      const body = [];
      for (let j = i + 1; j < lines.length && !/^:::\s*$/.test(lines[j]); j++) body.push(lines[j].trim());
      const text = [line.replace(/^::: todo\s*/, ''), ...body].filter(Boolean).join(' ');
      todos.push({ where: `src/chapters/${ch.file}:${i + 1}`, text });
    } else if ((m = line.match(/^## (.+?)(?:\s*\{#([\w-]+)\})?\s*$/))) {
      sec++;
      const id = m[2] || slug(m[1]);
      const entry = { href: `${ch.out}#${id}`, text: `Section ${ch.num}.${sec}`, name: m[1] };
      ch.sections.push({ ...entry, id, num: `${ch.num}.${sec}` });
      if (m[2]) addLabel(m[2], entry, ch);
    } else if ((m = line.match(/^::: (\w+) ([\w-]+)/)) && KINDS[m[1]]) {
      counters[m[1]] = (counters[m[1]] || 0) + 1;
      addLabel(m[2], { href: `${ch.out}#${m[2]}`, text: `${KINDS[m[1]]} ${ch.num}.${counters[m[1]]}` }, ch);
    }
  });
  labels.set(`ch-${ch.num}`, { href: ch.out, text: `Chapter ${ch.num}` });
}

function addLabel(label, entry, ch) {
  if (labels.has(label)) errors.push(`${ch.file}: duplicate label "${label}"`);
  labels.set(label, entry);
}

// ---------- markdown setup ----------

function renderMath(tex, displayMode, where) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: true, trust: true, strict: false });
  } catch (e) {
    errors.push(`${where}: KaTeX error in "${tex}": ${e.message}`);
    return `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
}

function makeRenderer(ch) {
  const md = new MarkdownIt({ html: true, typographer: true });
  const counters = {};

  for (const kind of Object.keys(KINDS)) {
    md.use(container, kind, {
      validate: (params) => params.trim().split(/\s+/)[0] === kind,
      render(tokens, idx) {
        if (tokens[idx].nesting !== 1) return '</div>\n';
        const [, label, rest = ''] = tokens[idx].info.trim().match(/^\w+\s+([\w-]+)?\s*(.*)$/) || [];
        counters[kind] = (counters[kind] || 0) + 1;
        const name = (rest.match(/^"([^"]*)"/) || [])[1];
        // needs="calculus" marks material that leans on knowledge outside the book's baseline
        const needs = parseAttrs(rest).needs;
        const badge = needs ? ` <span class="needs" title="Assumes outside knowledge">uses ${escapeHtml(needs)}</span>` : '';
        const head = `<b>${KINDS[kind]} ${ch.num}.${counters[kind]}</b>${name ? ` (${md.renderInline(name)})` : ''}.${badge}`;
        return `<div class="block ${kind}"${label ? ` id="${label}"` : ''}><span class="block-head">${head}</span>\n`;
      },
    });
  }

  md.use(container, 'todo', {
    validate: (params) => /^todo\b/.test(params.trim()),
    render(tokens, idx) {
      // Without --drafts the todo is wrapped in a marker that renderChapter strips out entirely.
      if (!DRAFTS) return tokens[idx].nesting === 1 ? '<template class="todo">' : '</template>\n';
      if (tokens[idx].nesting !== 1) return '</div>\n';
      const inline = tokens[idx].info.trim().replace(/^todo\s*/, '');
      return `<div class="block todo"><span class="block-head"><b>To do</b>${inline ? ` ${md.renderInline(inline)}` : ''}</span>\n`;
    },
  });

  md.use(container, 'widget', {
    validate: (params) => /^widget\s+\w+/.test(params.trim()),
    render(tokens, idx) {
      if (tokens[idx].nesting !== 1) return '</div></div>\n';
      const [, type, rest] = tokens[idx].info.trim().match(/^widget\s+(\w+)\s*(.*)$/);
      const data = Object.entries(parseAttrs(rest)).map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`).join('');
      return `<div class="widget" data-widget="${type}"${data}><div class="widget-note">\n`;
    },
  });

  // ## Heading {#label} -> numbered heading with that id
  md.core.ruler.push('section_numbers', (state) => {
    let sec = 0;
    state.tokens.forEach((tok, i) => {
      if (tok.type !== 'heading_open' || tok.tag !== 'h2') return;
      const inline = state.tokens[i + 1];
      const m = inline.content.match(/^(.*?)\s*\{#([\w-]+)\}$/);
      const text = m ? m[1] : inline.content;
      inline.content = text;
      inline.children = [];
      state.md.inline.parse(text, state.md, state.env, inline.children);
      tok.attrSet('id', m ? m[2] : slug(text));
      sec++;
      inline.children.unshift(Object.assign(new state.Token('html_inline', '', 0), { content: `<span class="secnum">${ch.num}.${sec}</span> ` }));
    });
  });

  return md;
}

// Math and cross-refs are swapped for placeholders before markdown-it sees them,
// so underscores and asterisks inside formulas are left alone.
function renderChapter(ch) {
  const stash = [];
  const hold = (html) => `@@HOLD${stash.push(html) - 1}@@`;
  let src = ch.src.replace(/^# .+$/m, ''); // the title is rendered by the page template

  src = src.replace(/\\\$/g, () => hold('$'));
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => hold(renderMath(tex.trim(), true, ch.file)));
  src = src.replace(/\$([^$\n]+?)\$/g, (_, tex) => hold(renderMath(tex, false, ch.file)));
  src = src.replace(/\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g, (_, label, text) => {
    const l = labels.get(label);
    if (!l) { errors.push(`${ch.file}: unknown reference [[${label}]]`); return `<span class="bad-ref">[[${label}]]</span>`; }
    const href = l.href.startsWith(ch.out + '#') ? l.href.slice(ch.out.length) : l.href;
    return hold(`<a class="ref" href="${href}">${text ? escapeHtml(text) : l.text}</a>`);
  });

  let html = makeRenderer(ch).render(src);
  html = html.replace(/<p>(@@HOLD\d+@@)<\/p>/g, '$1');
  html = html.replace(/<template class="todo">[\s\S]*?<\/template>\n?/g, '');
  return html.replace(/@@HOLD(\d+)@@/g, (_, i) => stash[+i]);
}

// ---------- page template ----------

function page({ title, body, prev, next, isIndex }) {
  const nav = (prev || next) ? `<nav class="pager">
  ${prev ? `<a href="${prev.out}">← ${prev.num}. ${escapeHtml(prev.title)}</a>` : '<span></span>'}
  ${next ? `<a href="${next.out}">${next.num}. ${escapeHtml(next.title)} →</a>` : '<span></span>'}
</nav>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="vendor/katex/katex.min.css">
<link rel="stylesheet" href="assets/style.css">
<script defer src="vendor/katex/katex.min.js"></script>
<script type="module" src="assets/widgets.js"></script>
</head>
<body>
<header class="bookbar">${isIndex ? '' : `<a href="index.html">${BOOK_TITLE}</a>`}</header>
<main>
${body}
</main>
${nav}
</body>
</html>
`;
}

// ---------- write output ----------

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
for (const f of fs.readdirSync(path.join(SRC, 'assets'))) fs.copyFileSync(path.join(SRC, 'assets', f), path.join(DIST, 'assets', f));

const katexDist = path.join(ROOT, 'node_modules', 'katex', 'dist');
fs.mkdirSync(path.join(DIST, 'vendor', 'katex', 'fonts'), { recursive: true });
for (const f of ['katex.min.js', 'katex.min.css']) fs.copyFileSync(path.join(katexDist, f), path.join(DIST, 'vendor', 'katex', f));
for (const f of fs.readdirSync(path.join(katexDist, 'fonts')).filter((f) => f.endsWith('.woff2')))
  fs.copyFileSync(path.join(katexDist, 'fonts', f), path.join(DIST, 'vendor', 'katex', 'fonts', f));

chapters.forEach((ch, i) => {
  const body = `<h1><span class="chnum">Chapter ${ch.num}</span>${escapeHtml(ch.title)}</h1>\n${renderChapter(ch)}`;
  fs.writeFileSync(path.join(DIST, ch.out), page({ title: `${ch.num}. ${ch.title}`, body, prev: chapters[i - 1], next: chapters[i + 1] }));
});

const toc = chapters.map((ch) => `<li><a href="${ch.out}"><span class="chnum">${ch.num}</span> ${escapeHtml(ch.title)}</a>
  <ol>${ch.sections.map((s) => `<li><a href="${s.href}"><span class="secnum">${s.num}</span> ${escapeHtml(s.name)}</a></li>`).join('')}</ol></li>`).join('\n');
fs.writeFileSync(path.join(DIST, 'index.html'), page({
  title: BOOK_TITLE, isIndex: true,
  body: `<h1>${BOOK_TITLE}</h1>\n<p class="sub">A book about the grammar of mathematical notation.</p>\n<ol class="toc">\n${toc}\n</ol>`,
}));

if (todos.length) console.log(`${todos.length} open todo(s):\n${todos.map((t) => `  ${t.where}  ${t.text}`).join('\n')}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
console.log(`Built ${chapters.length} chapter(s) into dist/${errors.length ? ` with ${errors.length} problem(s)` : ''}.`);
