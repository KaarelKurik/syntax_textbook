# Syntax textbook: proposed direction

Working title: **Reading and Rewriting Mathematics** (placeholder).

## What the post asks for

The post argues that many students who struggle in algebra and calculus are missing one mechanical skill: treating
expressions as structured objects. Concretely, they cannot reliably

- parse a compound expression into its syntax tree,
- replace every occurrence of a symbol consistently,
- apply a meaning-preserving rewrite to the right subexpression,
- tell what part of an expression a symbol's scope covers,
- tell bound variables from free ones.

The chain rule, botched substitution, illegal cancellation, bad distribution and equation-rearranging errors are all
symptoms. The post explicitly does *not* want a logic or set-theory course, and suggests discovery-style puzzles
(in the spirit of *The Witness*). So the book should be short, concrete, exercise-heavy, and use only school
mathematics as its material.

## Audience (decided)

The readership is mixed. The baseline is that readers know fraction arithmetic exists but aren't comfortable with it,
and they have no algebra. Exercises and asides can assume more than that, and they're marked with a badge such as
"uses calculus" when they do. Material is allowed to overlap the prerequisites. In practice the book rebuilds
algebra from scratch, as a system of rewriting expressions.

## Proposed contents

Each part depends on the one before it. Trees come before rewriting, rewriting with numbers comes before letters,
and letters come before binders.

**Part I. Reading (numbers only)**

1. **Expressions have shape.** Syntax trees of arithmetic expressions. Evaluating an expression by collapsing its
   tree from the leaves up.
2. **The rules nobody wrote down.** Precedence, parentheses, the fraction bar and radicals as grouping, and unary
   minus. Traps such as mixed numbers ($2\tfrac12$) and $-3^2$.

**Part II. Rewriting arithmetic**

3. **Same value, different shape.** What it means for two expressions to be equal. The commutative, associative and
   distributive laws as moves on trees, all checked with numbers.
4. **Fractions as rewriting.** Equivalent fractions, common denominators, and when cancelling is legal (a factor of
   the whole numerator versus a piece of a sum). This is where fraction arithmetic becomes comfortable.

**Part III. Letters (algebra, rebuilt)**

5. **Placeholders.** A letter as a hole in a tree. The laws from Part II restated as patterns, and matching a
   pattern against a tree.
6. **Substitution.** Filling every hole consistently. Grafting trees rather than copying letters.
7. **Simplifying and expanding.** Like terms, distributing and factoring, all as chains of legal rewrites.
8. **Equations.** Statements and their solution sets. Doing the same thing to both sides, and which moves can
   lose or gain solutions (dividing by zero, squaring).

**Part IV. Names and scope**

9. **Naming things.** Giving quantities names in word problems. Functions, and $f$ versus $f(x)$.
10. **Bound and free variables.** Sums, set-builder notation and function definitions. Renaming a bound variable,
    the scope of a binder, and what goes wrong when a name is reused (the post's tangent-line example, badged for
    calculus).

**Part V. Further on (badged prerequisites)**

11. **Differentiation is a tree algorithm.** The derivative rules as one recursive procedure, with the chain rule as
    the composition case.

**Coda.** Computing by hand in a tiny lambda calculus, as a puzzle chapter.

Each chapter opens with puzzles that let the reader find the rule before it is named, then states the rule, then
drills it with exercises the widgets can check.

## How to build it in HTML

- **Static site, no framework.** One HTML file per chapter, hostable anywhere (GitHub Pages is the easy option).
- **Math: KaTeX, vendored locally.** Fast, renders the same everywhere, and its `\htmlClass` lets widgets highlight
  parts of a formula. MathJax would be the pick if screen-reader support became a priority.
- **Widgets: small vanilla JS modules** sharing one expression library (parser, printer, substitution, tree
  layout). Planned widgets: tree explorer, substitution grafter, rewrite stepper (pick a subtree, pick a rule),
  scope highlighter (hover a variable to see its binder), and puzzle sequences.
- **Cross-links and numbering: a small build script.** Hand-numbering definitions across chapters breaks quickly.
  A Node script would number definitions, exercises and figures, resolve references like `[[def:syntax-tree]]`,
  build the table of contents and a glossary, and pre-render math so pages don't flash.
- **Source format: Markdown with custom blocks**, which the build script turns into HTML.

The prototype in `prototype/` tests all of this on two widgets: a tree explorer and a "replacing letters vs.
grafting trees" substitution demo.

## Decided so far

- Audience: mixed, with the baseline described above.
- Source format: Markdown with custom blocks. The build is set up and documented in `README.md`.

## Still open

- Should this become a GitHub repo now, or stay in project files for a while?
