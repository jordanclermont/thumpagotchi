# Thumpagotchi — working agreement

## Devlog: keep the worklog current (required)

This project is also a **record of how AI-assisted development works**, so the process is a
deliverable, not an afterthought. Whenever we make a **major change** — a shipped feature, a visual/art
pass, a gameplay/balance change, a notable bug fix or decision — **add an entry to
`thumpagotchi-devlog/worklog.md`** before considering the work done.

- **When:** at the end of a session, or after a meaningful chunk of committed work. Don't let it lapse.
- **Where:** top of `worklog.md` (reverse-chronological). The devlog folder is gitignored — it's the
  notebook, not the shipped product, so no commit is needed for it.
- **Voice:** favour the *decision / why* over the diff (the code is already in git). Dated header
  (`## YYYY-MM-DD — title`), bold inline labels, cite commit short-hashes, and include
  **Content hooks** and **Still needs human playtesting** sub-sections where relevant.
- **Honesty:** don't reconstruct reasoning for commits you didn't make — flag those as a gap for Jo.
- A `Stop` hook in `.claude/settings.local.json` reminds us when the current HEAD commit isn't yet
  referenced in the worklog; treat that reminder as a prompt to write the entry.

## Tests (run before every commit that touches game.js)

- `python3 tests/run_tests.py` runs the whole suite in headless Chrome (about 10 seconds); name groups
  to run just those, e.g. `python3 tests/run_tests.py health hay`. It exits 1 if anything fails.
- The tests live in `tests/tests.js` and are spliced into a temp copy of game.js's closure, so they can
  reach the game's internals; the shipped files are never modified. Each group is its own page load
  starting from a fresh adoption.
- When fixing a bug, add a check that fails without the fix. When adding a system, add a group.

## Art / prop iteration

- Iterate visuals in the gitignored labs (`rabbit-lab.html`, `props-lab.html`) — never edit both the
  V1 and V2 factories in parallel. Port the converged V2 function bodies into `game.js` in one block.
- Every art change should be judged against a **real render**, not a guess: screenshot the lab
  (headless Chrome), review, adjust, repeat, and get Jo's sign-off at each round.
- Review screenshots go in the gitignored `lab-shots/` folder.

## About Jo

Jo directs development and is a non-coder — explain decisions practically, state costs before
implementing, surface real forks as choices, and declare failures/omissions plainly.
