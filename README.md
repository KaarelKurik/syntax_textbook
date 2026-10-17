# Reading and Rewriting Mathematics

This is the source for the syntax textbook. Chapters are written in Markdown in `src/chapters/`, and `build.mjs` turns them into static HTML in `dist/`.

## Previewing while you write

    npm install --no-bin-links   # --no-bin-links is only needed on the shared project folder
    npm run dev

Open http://localhost:8000. The book rebuilds every time you save a file in `src/` and the open page reloads by itself.
The preview includes `todo` blocks; the published book does not.

## Building

    npm run build            # what GitHub Pages publishes; todo blocks are left out
    node build.mjs --drafts  # the same, with todo blocks shown

To read the book, serve the folder (`python3 -m http.server -d dist`) and open `index.html`. Pages with widgets load ES modules, and those won't run if you open the files directly.

## Writing a chapter

Name each file `NN-short-name.md`. The number is the chapter number, and the first `# Heading` is the chapter title.

| Write | Get |
| --- | --- |
| `$x^2$`, `$$\sum_i a_i$$` | Inline and display math, rendered at build time. `\$` gives a literal dollar sign. |
| `## Heading {#sec-label}` | A numbered section (1.2) with a label you can refer to. The `{#...}` part is optional. |
| `::: definition label "name"` … `:::` | A numbered block. The kinds are `definition`, `example`, `exercise`, `puzzle` and `remark`. The name is optional. |
| `::: exercise label "name" needs="calculus"` | The same block with a small "uses calculus" badge, for material that relies on knowledge beyond the book's baseline. |
| `[[label]]` | A link that reads "Definition 1.1", "Section 1.2" and so on. `[[ch-2]]` links to a chapter. |
| `[[label\|custom text]]` | A link with your own wording. |
| `::: todo` … `:::` | A note about work still to do, such as a widget or exercise you want built. It shows as a red box in the preview, is left out of the published book, and every build lists the open todos with their file and line. Text after `todo` on the first line becomes part of the note. |
| `::: widget tree expr="x^2 + 1"` … `:::` | An interactive widget. The block's body becomes the note under it. |

There are two widgets so far: `tree` (attribute `expr`) and `subst` (attributes `expr`, `var` and `by`). They live in `src/assets/widgets.js` and share the expression library in `src/assets/expr.js`.

The build lists any unknown references, duplicate labels and KaTeX errors, and exits non-zero if it finds any.
