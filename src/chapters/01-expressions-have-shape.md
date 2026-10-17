# Expressions Have Shape

*Draft sketch: this chapter exists to exercise the build pipeline. The prose will be rewritten.*

::: puzzle odd-one-out
Three of these expressions mean the same thing, and one does not. Which is the odd one out?

$$2 + 3 \cdot 4, \qquad 2 + (3 \cdot 4), \qquad (2 + 3) \cdot 4, \qquad 3 \cdot 4 + 2$$
:::

::: todo
Replace this single puzzle with a short sequence that leads up to the idea of a tree.
:::

Every expression you write has a hidden shape. The symbols sit in a row on the page, but what they mean is
a tree: one operation on top, whose inputs are themselves expressions.

## Syntax trees {#sec-trees}

::: definition syntax-tree "syntax tree"
The *syntax tree* of an expression has the expression's last operation at its root, and the syntax trees of
that operation's inputs as its children. Numbers and variables are leaves.
:::

For example, the last operation in $3 \cdot 2^2 + 1$ is the addition, so the root is $+$. Its children are the
trees of $3 \cdot 2^2$ and of $1$.

::: widget tree expr="3*2^2 + 8/(5 - 1)"
Try `-3^2` versus `(-3)^2`, or `12/6/2` versus `12/(6/2)`.
:::

::: exercise draw-trees
Draw the syntax trees of $10 - 4 - 3$ and $10 - (4 - 3)$ by hand, then check them with the widget above.
Which one is $10 - 4 - 3$ actually short for?
:::

## Substitution, first look {#sec-subst-preview}

To substitute an expression for a variable, you replace every occurrence of the variable by a copy of the
expression. In terms of [[syntax-tree|syntax trees]], each leaf labelled with the variable gets the whole tree
of the new expression grafted on in its place. Substituting the *letters* instead is a common source of
mistakes, as [[odd-one-out]] already hinted.

::: widget subst expr="x^2 - 2x" var="x" by="a + 1"
Green nodes are the grafted copies. The left box turns red when copying the letters changes the meaning.
:::

::: remark letters-vs-trees
Grafting a tree is why parentheses sometimes appear after a substitution: they are how a flat line of text
records that the grafted piece is a single subtree. See [[sec-trees]] for the tree picture.
:::

::: exercise chain-rule-tree needs="calculus"
If you have met derivatives: draw the tree of $\sin(x^2)$. Which node does the chain rule treat as the "inside" function?
:::
