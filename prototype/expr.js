// Tiny expression toolkit for the prototype: parse, print as TeX, substitute, lay out as a tree.
// AST nodes: {t:'num',v} {t:'var',v} {t:'neg',a} {t:'bin',op,a,b} {t:'call',f,a}

const FUNCS = ['sin', 'cos', 'tan', 'exp', 'ln', 'log', 'sqrt'];

export function parse(src) {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const expect = (v) => {
    const t = next();
    if (!t || t.v !== v) throw new Error(`expected "${v}"`);
  };

  // sum := term (('+'|'-') term)*
  function sum() {
    let a = term();
    while (peek() && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      a = { t: 'bin', op, a, b: term() };
    }
    return a;
  }
  // term := unary (('*'|'/') unary | implicit-multiplication unary)*
  function term() {
    let a = unary();
    for (;;) {
      const p = peek();
      if (p && (p.v === '*' || p.v === '/')) {
        const op = next().v;
        a = { t: 'bin', op, a, b: unary() };
      } else if (p && (p.k === 'num' || p.k === 'id' || p.v === '(')) {
        a = { t: 'bin', op: '*', a, b: power() };
      } else return a;
    }
  }
  function unary() {
    if (peek() && peek().v === '-') { next(); return { t: 'neg', a: unary() }; }
    return power();
  }
  // power := atom ('^' unary)?   (right-associative)
  function power() {
    const a = atom();
    if (peek() && peek().v === '^') { next(); return { t: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function atom() {
    const t = next();
    if (!t) throw new Error('unexpected end of input');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      if (FUNCS.includes(t.v)) {
        // sin x and sin(x) both parse; the bare form takes one power-level operand
        if (peek() && peek().v === '(') { next(); const a = sum(); expect(')'); return { t: 'call', f: t.v, a }; }
        return { t: 'call', f: t.v, a: power() };
      }
      if (peek() && peek().v === '(' && /^[fgh]$/.test(t.v)) {
        next(); const a = sum(); expect(')'); return { t: 'call', f: t.v, a };
      }
      return { t: 'var', v: t.v };
    }
    if (t.v === '(') { const a = sum(); expect(')'); return a; }
    throw new Error(`unexpected "${t.v}"`);
  }

  const ast = sum();
  if (i < toks.length) throw new Error(`unexpected "${toks[i].v}"`);
  return ast;
}

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ k: 'num', v: src.slice(i, j) }); i = j; continue;
    }
    if (/[a-z]/i.test(c)) {
      const fn = FUNCS.find((f) => src.startsWith(f, i));
      if (fn) { toks.push({ k: 'id', v: fn }); i += fn.length; continue; }
      toks.push({ k: 'id', v: c }); i++; continue; // single-letter variables: "xy" is x·y
    }
    if ('+-*/^()'.includes(c)) { toks.push({ k: 'op', v: c }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return toks;
}

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, neg: 3, '^': 4 };
const prec = (n) => (n.t === 'bin' ? PREC[n.op] : n.t === 'neg' ? PREC.neg : 9);

// mark: optional predicate; matching subtrees are wrapped in \htmlClass{hl}{...}
export function toTeX(n, mark) {
  const inner = texInner(n, mark);
  return mark && mark(n) ? `\\htmlClass{hl}{${inner}}` : inner;
}
function texInner(n, mark) {
  const r = (m) => toTeX(m, mark);
  const paren = (m, need) => (need ? `\\left(${r(m)}\\right)` : r(m));
  switch (n.t) {
    case 'num': return n.v;
    case 'var': return n.v;
    case 'neg': return `-${paren(n.a, prec(n.a) <= PREC.neg && n.a.t !== 'num' && n.a.t !== 'var' && n.a.t !== 'call')}`;
    case 'call':
      if (n.f === 'sqrt') return `\\sqrt{${r(n.a)}}`;
      return `${FUNCS.includes(n.f) ? '\\' + n.f : n.f}\\left(${r(n.a)}\\right)`;
    case 'bin': {
      const p = PREC[n.op];
      if (n.op === '/') return `\\frac{${r(n.a)}}{${r(n.b)}}`;
      if (n.op === '^') return `{${paren(n.a, prec(n.a) <= p || n.a.t === 'call')}}^{${r(n.b)}}`;
      const left = paren(n.a, prec(n.a) < p);
      const right = paren(n.b, prec(n.b) < p || (prec(n.b) === p && n.op !== '+' && n.op !== '*') || (n.op === '*' && n.b.t === 'neg'));
      if (n.op === '*') return n.a.t === 'num' && startsWithLetter(n.b) ? `${left}${right}` : `${left} \\cdot ${right}`;
      return `${left} ${n.op} ${right}`;
    }
  }
}

// 3x and 3sin(x) can be written without a dot; 3 · 2^2 cannot, or it would read as 32^2.
const startsWithLetter = (n) =>
  n.t === 'var' || n.t === 'call' || (n.t === 'bin' && n.op === '^' && n.a.t === 'var');

// Replace every free occurrence of variable v by a copy of `by`, tagging the grafted copies.
export function substitute(n, v, by) {
  switch (n.t) {
    case 'var': return n.v === v ? { ...structuredClone(by), grafted: true } : n;
    case 'num': return n;
    case 'neg': return { ...n, a: substitute(n.a, v, by) };
    case 'call': return { ...n, a: substitute(n.a, v, by) };
    case 'bin': return { ...n, a: substitute(n.a, v, by), b: substitute(n.b, v, by) };
  }
}

export const label = (n) =>
  n.t === 'num' || n.t === 'var' ? n.v : n.t === 'neg' ? '−' : n.t === 'call' ? n.f :
  n.op === '*' ? '×' : n.op === '-' ? '−' : n.op === '/' ? '÷' : n.op;

export const children = (n) =>
  n.t === 'bin' ? [n.a, n.b] : n.t === 'neg' || n.t === 'call' ? [n.a] : [];

// Tidy-ish layout: leaves get consecutive x slots, parents sit over their children.
export function layout(root) {
  const nodes = [];
  let slot = 0;
  (function walk(n, depth, parent) {
    const rec = { n, depth, parent, x: 0 };
    nodes.push(rec);
    const cs = children(n).map((c) => walk(c, depth + 1, rec));
    rec.x = cs.length ? (cs[0].x + cs[cs.length - 1].x) / 2 : slot++;
    return rec;
  })(root, 0, null);
  return { nodes, width: slot, depth: Math.max(...nodes.map((r) => r.depth)) + 1 };
}
