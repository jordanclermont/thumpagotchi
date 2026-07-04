# Thumpagotchi v2.0 Brief: The First Ten Minutes

## Context

Thumpagotchi is a browser-based Holland Lop care sim (HTML/CSS/JS, no build step, three files: index.html, style.css, game.js). It deploys to GitHub Pages. This build's goal is a portfolio-ready first session: a stranger clicks the link and experiences the best of the game in roughly ten minutes, which on the current clock is about four in-game days, ending with the Kit-to-Junior growth moment on day 3.

Design decisions that are locked and should not be revisited in this session:

- The session-time model stays. A day remains a fast, in-tab cycle (DAY_LEN based). Do not convert to real-calendar days.
- No death. Consequences are comedic in tone but factually honest about real rabbits.
- Education is delivered through consequence first (fact cards at the moment something happens), told facts second.
- Dreams, dayparts, the trivia minigame, morning memos, and the sound pass are v2.1. Do not build them now.

Styling fixes for the HUD/toolbar overlap and bottom-dock padding are already done in the current style.css and index.html. Do not rework them.

## Scope

### 1. Adoption screen framing line

Add one line of small text to the adoption card, below the logo and above the Continue/Name area: "Rabbits aren't starter pets. Good thing you're not a starter owner." Styled quiet (small, slightly transparent), not a banner. This sets the thesis before any mechanics exist.

### 2. Handcrafted day-1 goals

On a brand-new game (not Continue), day 1 does not roll random goals. It uses a fixed, ordered tutorial set: serve fresh hay, refill the water bowl, give 5 head pets. Same goal UI, same carrot/XP payouts as comparable pool goals. The goals panel is the tutorial; there is no overlay tutorial and no forced clicks. Random goals begin on day 2 via the existing rollGoals path. The existing rule that the Play goal requires an owned toy stays.

### 3. The engineered thump (day-1 bait)

The game is named after the thump; a first session must contain one. Two mechanisms:

a) The bait. At some point during day 1, after the player has armed Petting mode at least once, script a luxurious flop: she stretches out with the back feet prominently exposed and holds the pose for several seconds. The existing flop trick pose can be reused. If the player touches the feet, the normal feet-thump path fires (screen shake, THUMP, happiness hit) and triggers the first fact card (see item 4). No new punishment beyond what exists.

b) The fallback. If the player never takes the bait, guarantee a natural thump by mid day 2 (for example, let a need dip cross the 3-thump threshold once) so the thump meter is demonstrated either way. It must be recoverable within normal play; do not push to cold shoulder.

### 4. Fact card system

A small dismissible card UI (one at a time, tap to dismiss, pauses nothing) that fires at moments of consequence. Each card fires once per save. Cards contain one real rabbit fact tied to what just happened, two or three sentences, warm voice, no vet-pamphlet tone. Canadian spelling. Initial set:

- Feet thump (first time): rabbits thump to warn the warren of danger; feet and hindquarters are off limits for most rabbits.
- Third banana tummy ache: rabbits cannot vomit and sugar disrupts their gut; treats are capped for a reason.
- GI stasis onset: stasis is a genuine emergency for real rabbits and can be fatal within a day or two; hay keeps the gut moving.
- Third pellet scoop: hay should be roughly 80 percent of a rabbit's diet; pellets are a supplement, not the meal.
- First Cold Shoulder: rabbits hold grudges and remember how they're treated; trust is earned back, not assumed.

Store fired-card state in the save. Keep the card copy in one data structure so more cards are easy to add in v2.1.

### 5. Progressive disclosure: Games tab

Hide the Games tab (and its action row) until day 2. On the morning of day 2, reveal it with a one-line toast pointing at it. Persist revelation in the save so Continue players who are past day 1 see it immediately. Care, Play, and Health tabs remain visible from the start.

### 6. Day-1 pacing

Day 1's daylight should run longer than the standard DAY_LEN (suggest roughly 170 seconds versus 130) so the adoption, tutorial goals, bait flop, first shop purchase, and a quiet beat before nightfall all fit without the sun racing. Days 2+ use the normal length. Implement as a per-day length lookup, not a hack on timeOfDay.

### 7. Economy check for the first purchase

Verify that a player who completes the day-1 tutorial goals and does normal care can afford the Treat Ball (18 carrots) by early day 2 without grinding, starting from the default 12. Adjust day-1 goal rewards (not shop prices) if the math falls short. State the final math in a code comment near the goal definitions.

### 8. Save codes (export/import)

Menu panel gains two controls. Export: serializes the current save plus account unlocks to a compact base64 string, shown in a copyable text box. Import: a paste field that validates (parseable, version field present, sane ranges via the existing clamp patterns) and then applies and reloads. Corrupt or hostile input must fail with a toast, never a crash or a wiped save. This is load-bearing: it is the only backup a player has against cleared browser storage.

### 9. Welcome-back catch-up

Add a lastSeen timestamp to the save, written on every save. On Continue, if more than 12 real hours have passed: apply a gentle, capped adjustment (hungrier, thirstier, dirtier box; never sick, never cold shoulder, never below safety floors) and show a short "while you were away" toast with a little colour about what she got up to. One sentence, varied from a small pool. If under 12 hours, no change. This must never punish someone into a crisis they didn't witness.

### 10. Growth-moment exit beat

Immediately after the day-3 Kit-to-Junior growth toast, show one quiet follow-up line (toast or fact card): her progress saves in this browser, and there's a save code in the Menu if she matters to you. Once per save.

## Acceptance

A fresh player, saying nothing to them, should within ten minutes: adopt, complete three tutorial goals, experience one thump (baited or natural), read at least one fact card, buy the Treat Ball and play, see the zoomies cutscene, reach day 2 and discover the Games tab, and if they play to day 3, see her grow and learn the save code exists. Nothing in the flow blocks input or forces clicks. Continue players skip all day-1 scripting.

## Regression notes

- Do not break the existing save format; migrate missing fields with defaults as applySave already does.
- The smoke-test areas from the last session must keep working: minigame open/close/resize, tower-only Play button, hide-and-seek spot gating, takenAway overlay cleanup.
- Keep everything in the existing three files and the existing code style (compact helpers, section banners, inline comments in the current voice).

## Not in this build (v2.1 list, do not start)

Dreams (thought-bubble entry, wake choice with mood cost, dream quality reflecting care), dayparts, sound pass, trivia minigame, morning memos, PWA manifest/service worker, itch.io page assets.
