# Process overview

## What I built

I built Learn Go, a static interactive teaching book for beginners learning Go. My
point of view is that the game is easier to understand by placing stones and
seeing consequences than by reading a rule list: liberties, capture, suicide,
ko, endgame, scoring, and free play all have to feel like one connected system.

## The moments that mattered

### Making lessons additive

The first serious process failure was not visual: adding the liberties and
capture material damaged the earlier placing-stones lesson. The tempting fix
was to repair the lost HTML and keep moving. Instead I changed the shape of the
project so a lesson became a separate `LessonDefinition` with its own id, title,
initial board, and completion logic. `lessons.test.ts` then checked that loading
one lesson left the others intact
([`89d8a8a...3ff5337`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-lyclccylcq/compare/89d8a8a...3ff5337)).
That told me the fix had landed in the architecture, not just in the broken
page: the next lesson could be added without silently rewriting the previous
one.

### Moving legality out of page logic

Lesson 3 also showed that lesson-level assumptions could still substitute for
shared rule behaviour. The rules engine already existed, so the problem was not
inventing `go-rules.ts`; it was stopping pages from drifting back toward local
coordinate allow-lists or UI shortcuts. I made the shared `placeStone` path the
authority that lesson interactions had to use: occupied points fail, suicide
leaves the board unchanged, and captures resolve before the suicide check. The
middle commit
`6a3f939` tightened the connected-groups interaction, and the range through the
Illegal Moves lesson added regression coverage for the capture exception and
rejected moves
([`e2565ac...1e7fb90`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-lyclccylcq/compare/e2565ac...1e7fb90)).
I trusted this because the same rules contract now generalised beyond Lesson 3
instead of depending on one page remembering its own special cases.

### Testing the page readers could actually reach

Contents Page 2 existed in the source, but that was not the same as being part
of the reading flow. The obvious repair was to fix the current link and click
through once. I instead added built-site regression coverage in
`spec/contents-pages.test.ts`: it reads `dist/`, verifies two distinct Contents
pages, checks their chapter lists, and asserts the corner controls move from
Contents 1 to Contents 2 and onward to the Prologue
([`cfd86c8`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-lyclccylcq/commit/cfd86c8)).
That converted a repeated manual discovery into an executable contract without
claiming more than it measured.

### Throwing away clever animation

The book metaphor made an elaborate page-turn simulation tempting. After trying
the more physical animation, the interaction became less stable and visually
busier than the lesson content needed. The easy path was to keep adding folds,
backs, shadows, and rotation until it looked convincing. I chose to simplify:
the rigid cover can still open physically, but interior navigation uses a
directional transition that supports the reading flow instead of competing with
it
([`951714a...23dcedd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-lyclccylcq/compare/951714a...23dcedd)).
The automated check here was that manifest, navigation, and Contents contracts
still held. The judgement about animation quality was manual: the simpler
interior transition was clearer and more stable than the elaborate attempt.

The project-specific `CLAUDE.md` guardrails were formalised late as a
retrospective consolidation of lessons already learned.
