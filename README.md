# Thumpagotchi 🐰

[![Play the live demo](https://img.shields.io/badge/▶%20Play-Live%20Demo-6fbf73?style=for-the-badge&logo=github)](https://jordanclermont.github.io/thumpagotchi/)

Owning a house rabbit, simulated — because rabbits don't get *sad*, they get
**angry**, and they say it with their feet. Two versions:

- **`index.html`** — a 2D visual game (HTML5 Canvas). A Holland Lop drawn entirely
  in code, in a cozy living room with a day/night cycle. **Just double-click it** to
  play in any browser — no install, no server. Files: `index.html`, `style.css`, `game.js`.
- **`thumpagotchi.py`** — the original text/terminal version (below).

## Run the visual game

Open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge). Works on
desktop and touch. Keep the three files (`index.html`, `style.css`, `game.js`) together.

**Adopt first:** pick your bun's **name**, **sex**, and **coat colour** (Sable Point
Grey by default, plus Sepia, Chestnut, Black, Blue, and Fawn).

The rabbit is drawn with lopped ears, a cobby plush body, a **black V-shaped nose**,
tiny front teeth, and sable points blended in with canvas gradients.

### Actions
- **🌾 Hay** — refreshes the hay in the litter box (main food; lowers hunger a lot).
- **🥣 Pellets** — a scoop of dry food from the bowl (lowers hunger).
- **💧 Water** — refills the water bowl (there's a Water bar now).
- **🍌 Banana** — instant joy + a binky; **max 2/day** (a 3rd = tummy ache). Doubles
  as the **apology treat** that clears the Cold Shoulder.
- **✋ Pet** — toggle on, then drag over her. **Head** = happiness; **feet/tail** = an
  instant angry **THUMP**.
- **🌟 Trick** — she performs an unlocked trick (spin, flop, binky, beg, high-five,
  hurdle) — costs Energy, builds mastery, and pays carrots by skill.
- **🧸 Play** — appears once you own a toy; watch her **chase the treat ball around the
  rug** or **bolt through the play tunnel** (in one end, out the other). Big happiness + Bond.
- **🧹 Clean** — scoops the litter box, restoring Hygiene (extra nice with a Grooming Kit).
- **😴 Rest** — a cozy nap to recover Energy.
- **🩺 Vet** — cures illness (or a cheap wellness checkup when she's healthy).
- **Toolbar (top-right):** 🛒 Shop · 🎯 Daily Goals · ⚙️ Menu (vitals, mastery, save, reset).

The bottom dock is organised into **🧺 Care · 🎾 Play · ❤️ Health** tabs to keep it tidy.

### Living systems
- **Five needs** decay over time: Happiness, Hunger, Water, Hygiene, and **Energy** —
  a dirty box, empty bowl, or neglect all feed the **Thump Meter** (5 paw icons).
- At **3 thumps** she stomps with a screen-shaking "THUMP!"; at **5** she gives the
  **Cold Shoulder** (back turned, sable tail to you) until you offer a banana.
- **Binkies**: she randomly leaps for joy when very happy.
- **Day/night cycle**: the sun arcs across the sky and dims to dusk. When night falls
  you get a **3 A.M. zoomies** cutscene — she tears around the room all night — then a
  new day dawns and she wakes up **starving but binkying** to see you.
- She idles on her own: hopping around the rug, visiting her **bed**, grooming, and
  dozing. The room also has a **play tube**, food & water bowls, and a hay-filled box.

### Progression (it's a real game now)
- **Save & continue** — your rabbit is stored in the browser (`localStorage`); reopen
  and pick up where you left off, or **Rehome** from the ⚙️ Menu to start fresh.
- **Bond levels & XP** — good care raises your Bond; leveling up unlocks new tricks
  (Beg → High-Five → Hurdle) and higher Shop tiers, and slowly earns her trust.
- **Carrots 🥕 + Shop** — earn carrots from care, tricks, and goals; spend them in the
  **🛒 Shop** on healthy foods, a **Treat Ball / Play Tunnel** (unlocks the **Play**
  action), a **Grooming Kit**, **Gut Medicine**, a **Cardboard Castle**, and more.
- **Life stages** — Kit → Junior → Adult → Senior as she ages; she visibly grows.
- **Energy & Rest** — activity tires her; **😴 Rest** naps restore energy (night fully
  recharges her).
- **Illness & the Vet** — sustained neglect or a sugary diet can trigger **GI stasis**.
  Cure it with **🩺 Vet** (25🥕) or free if you keep **Gut Medicine** stocked; ignore it
  and she'll need an emergency vet that costs half your carrots.
- **Diet & weight** — hay keeps her trim, pellets/bananas add weight, activity burns it;
  stay in the healthy band or health suffers. (Bananas are still capped at 2/day.)
- **Trick mastery** — tricks improve with practice and pay more carrots the better she is.
- **Daily goals & achievements** — three 🎯 goals refresh each day for carrots and XP,
  plus one-time 🏆 milestones.

## Run the terminal version

Requires Python 3.7+ (standard library only — no installs).

```bash
python3 thumpagotchi.py
```

Set `NO_COLOR=1` to disable ANSI colors.

## How it works

The rabbit has four needs that drift in real time (and tick forward with each action):

- **Affection** — decays when ignored; raised by head pets, banana, and just being present.
- **Hunger** — rises constantly; lowered by fresh Timothy hay (and a little by banana).
- **Boredom** — rises in the cage; lowered by free-roam time.
- **Litter box** — gets dirty over time; ignoring it stresses him out.

Sustained hunger, boredom, neglect, or a filthy litter box feed **The Thump Meter (0–5)**:

- At **3 thumps** he slams a back foot — a visual warning.
- At **5 thumps** he turns his back and refuses all commands until you offer an
  **apology banana** (action `[2]`), which resets the Thumps and restores the bond.

## Rules that bite

- **Banana:** instant joy, but **max 2/day**. Push past it and you trigger a tummy-ache
  vet event. Banana doubles as the apology treat when he's turned his back.
- **Head Scratches:** pick where you pet. The **head** is bliss; the **nose** is risky;
  the **feet/tail** are sacred — touch them and the Thump Meter jumps.
- **Free-Roam:** great for boredom, but ~30% chance he chews a baseboard or phone
  charger if you glance away.

Keep him fed, entertained, scooped, and scratched (on the head only). Good luck.
