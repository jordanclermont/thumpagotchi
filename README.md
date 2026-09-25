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

**Adopt first:** pick your bun's **name**, **breed**, **sex**, and **coat colour**. Coats are
real varieties for each breed, using their official ARBA names:

- **Holland Lop:** Sable Point (the default), Siamese Sable, Tortoise, Chestnut, Black,
  Blue, Orange
- **Netherland Dwarf:** Black Tan, Blue Otter, Chestnut Agouti, Tortoise Shell, Blue
- **Lionhead** (unlocks at Bond 5): Broken Chestnut, Tortoise, Ruby-Eyed White, Black,
  Chocolate, Siamese Sable, Smoke Pearl. All but Broken Chestnut are ARBA show colours;
  Broken Chestnut is a real pet colour.

In rabbits, "Blue" means a slate blue-grey, not a neutral grey.

The rabbit is drawn with lopped ears, a cobby plush body, a **black V-shaped nose**,
tiny front teeth, and sable points blended in with canvas gradients.

### Actions
- **🌾 Hay** — refreshes the hay in the litter box (main food; lowers hunger a lot).
- **🥣 Pellets** — a scoop of dry food from the bowl (lowers hunger).
- **💧 Water** — refills the water bowl (there's a Water bar now).
- **🍌 Banana** — instant joy + a binky; **max 2/day** (a 3rd = tummy ache).
- **✋ Pet** — toggle on, then drag over your rabbit. **Head** = happiness; **feet/tail** = an
  instant angry **THUMP**.
- **🌟 Trick** — your rabbit performs an unlocked trick. Only tricks real rabbits are
  clicker-trained to do: **Spin**, **Stand Up**, **Nose Boop**, **Come**, and **Hop Over**. Costs
  Energy, builds mastery, and pays carrots by skill. (Flops and binkies aren't tricks — rabbits
  do them on their own.)
- **🧸 Play** — appears once you own a toy; watch your rabbit **chase the treat ball around
  the rug** or **bolt through the play tunnel** (in one end, out the other). Big happiness + Bond.
- **🧹 Clean** — scoops the litter box, restoring Hygiene (extra nice with a Grooming Kit).
- **😴 Rest** — a cozy nap to recover Energy.
- **🩺 Vet** — cures illness (or a cheap wellness checkup when your rabbit is healthy).
- **Toolbar (top-right):** 🛒 Shop · 🎯 Daily Goals · 📖 Notebook (About your rabbit + Rabbit
  Notes) · ⚙️ Menu (vitals, personality, favourite treat, mastery, save, reset).

The bottom dock is organised into **🧺 Care · 🎾 Play · ❤️ Health** tabs to keep it tidy.

### Living systems
- **Five needs** decay over time: Happiness, Hunger, Water, Hygiene, and **Energy** —
  a dirty box, empty bowl, or neglect all feed the **Thump Meter** (5 paw icons).
- At **3 thumps** your rabbit stomps with a screen-shaking "THUMP!"; at **5** they give the
  **Cold Shoulder** (back turned, sable tail to you) until you offer their **favourite
  treat**, whichever that is for your rabbit.
- **Binkies**: your rabbit leaps for joy when very happy. **Flops**: once they trust you
  enough, they drop onto their side on their own.
- **Real rabbit body language**: a soft tooth **purr** during head pets; **chinning** new
  furniture to claim it; **digging** the rug or **chewing** the baseboard when bored and
  ignored (pets or play stop it).
- **Dawn and dusk**: like real rabbits, they're busiest in the early morning and evening and
  doze at midday.
- **Day/night cycle**: the sun arcs across the sky and dims to dusk. When night falls
  you get a **3 A.M. zoomies** cutscene — your rabbit tears around the room all night — then
  a new day dawns and they wake up **starving but binkying** to see you.
- Your rabbit idles on their own: hopping around the rug, visiting their **bed**, grooming,
  and dozing. The room also has a **play tube**, food & water bowls, and a hay-filled box.

### Progression (it's a real game now)
- **Save & continue** — your rabbit is stored in the browser (`localStorage`); reopen
  and pick up where you left off, or **Rehome** from the ⚙️ Menu to start fresh.
- **Bond levels & XP** — good care raises your Bond; leveling up unlocks new tricks
  (Nose Boop → Come → Hop Over) and higher Shop tiers, and slowly earns their trust.
- **Carrots 🥕 + Shop** — earn carrots from care, tricks, and goals; spend them in the
  **🛒 Shop** on healthy foods, a **Treat Ball / Play Tunnel** (unlocks the **Play**
  action), a **Grooming Kit**, **Gut Medicine**, a **Cardboard Castle**, and more.
- **Life stages** — Kit → Junior → Adult → Senior as your rabbit ages; they visibly grow.
- **Personality** — how you raise your rabbit as a Kit and Junior quietly decides who they
  become at Adult: **Cuddly** (lots of affection), **Bold** (lots of play) or **Skittish** (too
  many care mistakes). There's no score — you find out when they grow up, and it changes how
  they behave from then on.
- **Likes and dislikes** — every rabbit is different, and you have to find out how:
  - **Favourite treat** (banana, leafy greens or apple chews): try them, watch what they beg
    for, or see which one ends a sulk.
  - **Favourite place for a rub** (forehead, cheeks or behind the ears): extra hearts and purrs.
  - **Favourite toy** and **favourite nap spot**: bigger reactions and deeper naps there.
  - **One dislike** (nose touches, being brushed on the haunches, or a toy): found by accident.
  Everything you've learned collects on the **About** tab of 📖, and knowing it pays off: once
  you know a dislike you stop offering it, and you reach for the favourite toy more often.
- **Hay by age** — young rabbits start on **alfalfa**. At Adult, buy **Timothy Hay** in the
  Shop to switch; it mixes in over 2 days. An adult left on alfalfa gains weight.
- **Energy & Rest** — activity tires your rabbit; **😴 Rest** naps restore energy (night fully
  recharges them).
- **Spotting illness** — like real rabbits, they hide it. There's no warning chip: an
  unwell bun refuses treats (above all their favourite), only nibbles their food, leaves fewer
  and smaller droppings, sits hunched with half-closed eyes, and grinds their teeth loudly.
  Take them to the **🩺 Vet** then and it's caught early at checkup price.
- **Rabbit Notes 📖** — 21 real rabbit-care notes that unlock when you see the behaviour
  yourself. Notes carry over when you rehome.
- **Illness & the Vet** — sustained neglect or a sugary diet can trigger **GI stasis**.
  Cure it with **🩺 Vet** (25🥕) or free if you keep **Gut Medicine** stocked; ignore it
  and your rabbit will need an emergency vet that costs half your carrots.
- **Diet & weight** — hay keeps your rabbit trim, pellets/bananas add weight, activity burns
  it. Too much weight brings vet welfare warnings (it doesn't make them ill). Being
  underweight does hurt their health. (Bananas are still capped at 2/day.)
- **Trick mastery** — tricks improve with practice and pay more carrots the better your
  rabbit gets.
- **🎮 Games** — the Games tab (from day 2) opens a menu of eight minigames that unlock over
  the first days:
  - Day 2: **Bunny Snake**, **Guess My Number**, **🥣 Forage** (follow the treat under three
    shuffling cups; 3 rounds, each faster)
  - Day 3: **Bunny Tic-Tac-Toe**, **📦 Dig Box** (dig a 4×4 box of shredded paper for 5
    buried treats in 20 seconds; empty spots show 👃 how many treats are next to them)
  - Day 4: **Carrot Catch**, **🥬 Safe or Not?** (is this food OK for rabbits? each answer
    explains why; food list checked against RSPCA, PDSA, House Rabbit Society and RWAF)
  - Day 5: **🧠 How well do you know me?** Your rabbit asks about their likes and dislikes
    and the Rabbit Notes you've unlocked. Wrong answers show the right one and why.

  The Quiz and Safe or Not? pay carrots on the first round each day; the rest pay every time.
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
- **Litter box** — gets dirty over time; ignoring it stresses your rabbit out.

Sustained hunger, boredom, neglect, or a filthy litter box feed **The Thump Meter (0–5)**:

- At **3 thumps** your rabbit slams a back foot — a visual warning.
- At **5 thumps** they turn their back and refuse all commands until you offer an
  **apology banana** (action `[2]`), which resets the Thumps and restores the bond.

## Rules that bite

- **Banana:** instant joy, but **max 2/day**. Push past it and you trigger a tummy-ache
  vet event. Banana doubles as the apology treat when your rabbit has turned their back.
- **Head Scratches:** pick where you pet. The **head** is bliss; the **nose** is risky;
  the **feet/tail** are sacred — touch them and the Thump Meter jumps.
- **Free-Roam:** great for boredom, but ~30% chance your rabbit chews a baseboard or phone
  charger if you glance away.

Keep them fed, entertained, scooped, and scratched (on the head only). Good luck.
