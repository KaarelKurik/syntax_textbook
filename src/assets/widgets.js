// Mounts every <div class="widget" data-widget="..."> on the page.
// Each widget reads its settings from data-* attributes set in the Markdown source.

import { parse, toTeX, substitute, layout, label, children } from './expr.js';

const tex = (el, s) => katex.render(s, el, { throwOnError: false, trust: true, strict: false });
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

function drawTree(svg, root, { selected, onPick } = {}) {
  const { nodes, width, depth } = layout(root);
  const dx = 46, dy = 56, pad = 24;
  const W = Math.max(width, 1) * dx + pad, H = depth * dy;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.maxWidth = `${W * 1.1}px`;
  const px = (r) => pad / 2 + dx / 2 + r.x * dx, py = (r) => dy / 2 + r.depth * dy - 4;
  let out = '';
  for (const r of nodes) if (r.parent) out += `<line x1="${px(r.parent)}" y1="${py(r.parent)}" x2="${px(r)}" y2="${py(r)}"/>`;
  nodes.forEach((r, i) => {
    const cls = [r.n === selected ? 'on' : '', r.n.inGraft ? 'graft' : ''].join(' ');
    out += `<g class="${cls}" data-i="${i}"><circle cx="${px(r)}" cy="${py(r)}" r="16"/><text x="${px(r)}" y="${py(r)}">${label(r.n)}</text></g>`;
  });
  svg.innerHTML = out;
  if (onPick) svg.querySelectorAll('g').forEach((g) => g.addEventListener('click', () => onPick(nodes[+g.dataset.i].n)));
}

const input = (id, value, labelText) =>
  `<div><label for="${id}">${labelText}</label><input id="${id}" value="${value}" spellcheck="false" autocomplete="off"></div>`;
let uid = 0;

const WIDGETS = {
  // Type an expression, see its syntax tree; click a node to highlight its subexpression.
  tree(w) {
    const id = `w${uid++}`;
    w.prepend(h(`<div class="widget-body">
      ${input(id, w.dataset.expr || 'x + 1', 'Type an expression. Click a node to see which part of the expression it stands for.')}
      <div class="err"></div><div class="render"></div><svg class="tree"></svg></div>`));
    const inp = w.querySelector('input'), err = w.querySelector('.err'), out = w.querySelector('.render'), svg = w.querySelector('svg');
    let ast = null, sel = null;
    const show = () => {
      tex(out, toTeX(ast, (n) => n === sel));
      drawTree(svg, ast, { selected: sel, onPick: (n) => { sel = n === sel ? null : n; show(); } });
    };
    const update = () => {
      try { ast = parse(inp.value); sel = null; err.textContent = ''; show(); }
      catch (e) { err.textContent = e.message; }
    };
    inp.addEventListener('input', update);
    update();
  },

  // Substitute by copying letters versus grafting trees, side by side.
  subst(w) {
    const id = `w${uid++}`;
    w.prepend(h(`<div class="widget-body">
      <div class="row">${input(id + 'e', w.dataset.expr || 'x^2', 'Expression')}${input(id + 'v', w.dataset.var || 'x', 'Replace the variable')}${input(id + 'b', w.dataset.by || 'a + 1', 'with')}</div>
      <div class="err"></div>
      <div class="cmp"><div class="naive"><div class="tag">Replacing letters</div><div class="render"></div></div>
        <div><div class="tag">Grafting trees</div><div class="render"></div></div></div>
      <svg class="tree"></svg></div>`));
    const [e, v, b] = w.querySelectorAll('input');
    const err = w.querySelector('.err'), [naiveOut, graftOut] = w.querySelectorAll('.render');
    const naiveBox = w.querySelector('.naive'), svg = w.querySelector('svg');
    const strip = (n) => ({ ...n, grafted: undefined, inGraft: undefined, a: n.a && strip(n.a), b: n.b && strip(n.b) });
    const same = (p, q) => JSON.stringify(strip(p)) === JSON.stringify(strip(q));
    const markGraft = (n, inside = false) => { const g = inside || !!n.grafted; children(n).forEach((c) => markGraft(c, g)); n.inGraft = g; return n; };
    const update = () => {
      try {
        const name = v.value.trim();
        if (!/^[a-z]$/i.test(name)) throw new Error('the variable should be a single letter');
        const good = markGraft(substitute(parse(e.value), name, parse(b.value)));
        const naive = parse(e.value.split(name).join(b.value));
        err.textContent = '';
        tex(naiveOut, toTeX(naive));
        tex(graftOut, toTeX(good, (n) => n.grafted));
        naiveBox.classList.toggle('bad', !same(naive, good));
        drawTree(svg, good);
      } catch (x) { err.textContent = x.message; }
    };
    [e, v, b].forEach((el) => el.addEventListener('input', update));
    update();
  },
};

function mountAll() {
  for (const w of document.querySelectorAll('[data-widget]')) {
    const make = WIDGETS[w.dataset.widget];
    if (make) make(w);
    else w.prepend(h(`<p class="err">Unknown widget "${w.dataset.widget}".</p>`));
  }
}

// KaTeX loads with defer, which runs before module scripts, but guard anyway.
if (window.katex) mountAll(); else window.addEventListener('load', mountAll);
