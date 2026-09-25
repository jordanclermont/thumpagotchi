"use strict";
(() => {
/* ============================================================================ *
 *  THUMPAGOTCHI  —  a Holland Lop life sim
 *  A cozy 2D-canvas digital pet, now with real progression:
 *    · Bond levels & XP        · Carrots economy + Shop
 *    · Life stages (she grows) · Energy + Rest, Illness + Vet, Diet + Weight
 *    · Daily goals & Achievements   · localStorage save/continue
 *  The rendering is the original hand-drawn canvas art; systems are layered on.
 * ============================================================================ */

const canvas  = document.getElementById('c');     // the single game canvas (room, props, rabbit, FX)
const bgCtx = canvas.getContext('2d');
let ctx = bgCtx;   // active drawing context
let W = 0, H = 0, DPR = 1;

/* ---------------- Utility ---------------- */
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt));
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
const now=()=>performance.now()/1000;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const ord=n=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');
const mix=(a,b,t)=>[Math.round(lerp(a[0],b[0],t)),Math.round(lerp(a[1],b[1],t)),Math.round(lerp(a[2],b[2],t))];
const rgb=a=>`rgb(${a[0]},${a[1]},${a[2]})`;
const $=id=>document.getElementById(id);
// Escape any user- or save-controlled string before it reaches innerHTML — a hostile
// save code could otherwise smuggle markup (e.g. a rabbit named "<b>test</b>").
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function roundRect(x,y,w,h,r){
  r=Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,   x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x,  y+h, r);
  ctx.arcTo(x,  y+h, x,  y,   r);
  ctx.arcTo(x,  y,   x+w,y,   r);
  ctx.closePath();
}

/* ---------------- Coat colours ---------------- */
/* Coat colours are real breed varieties (ARBA names; checked 25 Sep 2026 against ARBA's variety
   lists and the breed clubs). Hex values are sampled from labelled photos of real rabbits,
   exposure-corrected (Green Barn Farm's colour guides and a Wikimedia Commons tort); Sable Point is
   sampled from Jo's own rabbit. Chestnut uses the lighter golden adult tone Jo picked over the
   greyer junior photos.
   Rabbit "Blue" is a slate blue-grey (a dilute of black), never neutral grey. Keys are kept stable
   so saved rabbits keep their coat; retired coats stay defined but leave the adoption lists. */
const COATS = {
  // Sable Point matched to Jo's own Holland Lop (sampled from a photo): taupe-beige body,
  // charcoal-brown points. Key stays 'sableGrey' so existing saves keep it.
  sableGrey:  {name:'Sable Point',         body:'#d3c4b0', bodySh:'#b3a18b', hi:'#e6dccd', point:'#463a33', pointMid:'#6f5d50', sable:true },
  sableSepia: {name:'Sable Point',         body:'#f6efdd', bodySh:'#e6d8b8', hi:'#fffdf4', point:'#3f2a1e', pointMid:'#6b4a34', sable:true },   // retired: old saves only
  hlSiameseSable:{name:'Siamese Sable',    body:'#948781', bodySh:'#71615b', hi:'#b7aeaa', point:'#2f2825', pointMid:'#5a4b44', sable:true  },
  chestnut:   {name:'Chestnut',            body:'#b09274', bodySh:'#86694e', hi:'#cdb193', point:'#5c4a3a', pointMid:'#8a735c', sable:false},
  black:      {name:'Black',               body:'#2f2e34', bodySh:'#1c1b20', hi:'#51545f', point:'#141417', pointMid:'#2e2d33', sable:false},
  blue:       {name:'Blue',                body:'#6f737c', bodySh:'#555960', hi:'#9a9ea8', point:'#4c5058', pointMid:'#62666e', sable:false, eye:'#5f6f80'},
  fawn:       {name:'Orange',              body:'#e0a068', bodySh:'#c28350', hi:'#f5bf8a', point:'#c98c56', pointMid:'#d99c63', sable:false},   // key kept from "Fawn / Orange"
  hlTort:     {name:'Tortoise',            body:'#b59176', bodySh:'#7c6e62', hi:'#caa582', point:'#4e4434', pointMid:'#84756a', sable:true  },
  // ---- Netherland Dwarf coats ----
  ndBlackTan: {name:'Black Tan',           body:'#2c2825', bodySh:'#1a1613', hi:'#463d36', point:'#100d0b', pointMid:'#2b2622', sable:false, tan:true, tanCol:'#c68a3e', belly:'#f2ece0'},   // Elvis — colours unchanged
  ndBlueOtter:{name:'Blue Otter',          body:'#6f737c', bodySh:'#555960', hi:'#9a9ea8', point:'#4c5058', pointMid:'#62666e', sable:false, tan:true, tanCol:'#e6d6b8', eye:'#5f6f80'},
  ndChestnut: {name:'Chestnut Agouti',     body:'#b09274', bodySh:'#86694e', hi:'#cdb193', point:'#5c4a3a', pointMid:'#8a735c', sable:false},
  ndTort:     {name:'Tortoise Shell',      body:'#b59176', bodySh:'#7c6e62', hi:'#caa582', point:'#4e4434', pointMid:'#84756a', sable:true  },
  ndBlue:     {name:'Blue',                body:'#6f737c', bodySh:'#555960', hi:'#9a9ea8', point:'#4c5058', pointMid:'#62666e', sable:false, eye:'#5f6f80'},
  // ---- Lionhead coats: the ARBA-accepted varieties (Seal omitted), plus Tywin's Broken Chestnut,
  //      a real pet colour that isn't show-recognised ----
  lhTort:     {name:'Tortoise',            body:'#b59176', bodySh:'#7c6e62', hi:'#caa582', point:'#4e4434', pointMid:'#84756a', sable:true  },
  lhREW:      {name:'Ruby-Eyed White',     body:'#f7f5f0', bodySh:'#dedad2', hi:'#ffffff', point:'#d6d0c4', pointMid:'#e8e3d8', sable:false, eye:'#b81c36'},
  lhBlack:    {name:'Black',               body:'#2f2e34', bodySh:'#1c1b20', hi:'#51545f', point:'#141417', pointMid:'#2e2d33', sable:false},
  lhChocolate:{name:'Chocolate',           body:'#654e46', bodySh:'#574037', hi:'#79625a', point:'#442e28', pointMid:'#5a423a', sable:false},
  lhSiameseSable:{name:'Siamese Sable',    body:'#948781', bodySh:'#71615b', hi:'#b7aeaa', point:'#2f2825', pointMid:'#5a4b44', sable:true  },
  lhSmokePearl:{name:'Smoke Pearl',        body:'#aeaaae', bodySh:'#858187', hi:'#cdc9cc', point:'#6d676b', pointMid:'#8f898d', sable:true, eye:'#5f6f80'},
  lhChestnut: {name:'Chestnut',            body:'#b47c44', bodySh:'#8f5f30', hi:'#d6a066', point:'#5a3a20', pointMid:'#7a4f2c', sable:false},   // retired: not show-recognised; old saves only
  // Broken (white base + brown patches) — Tywin's default. `broken` drives a patch layer over
  // the white body/head + brown ears & mane; patch* are the brown, body* stay near-white.
  lhBroken:   {name:'Broken Chestnut',     body:'#f5f1e6', bodySh:'#e4dccb', hi:'#ffffff', point:'#cfc6b2', pointMid:'#e4dccb', sable:false,
               broken:true, patch:'#b07444', patchSh:'#8a5730', patchHi:'#cf9459'},
};
let coat = COATS.sableGrey;
let coatKey = 'sableGrey';

/* ---------------- Breeds ----------------
   Each breed has its own silhouette: lop vs. upright ears, an optional mane,
   and body/head proportions. Lionhead unlocks account-wide at Bond level 5. */
const BREEDS = {
  holland:    {name:'Holland Lop',      ears:'lop', mane:false, scale:1.0,  headScale:1.0,               idealLbs:3.5, emoji:'🐰', desc:'Floppy lop ears, cobby & chill.'},
  netherland: {name:'Netherland Dwarf', ears:'up',  mane:false, scale:0.72, headScale:1.16, earLen:0.95, idealLbs:2.2, emoji:'🐇', desc:'Tiny body, big head, upright ears.'},   // a dwarf stays visibly small, even grown
  lionhead:   {name:'Lionhead',         ears:'up',  mane:true,  scale:0.94, headScale:1.06, earLen:1.2,  idealLbs:3.0, emoji:'🦁', desc:'A majestic fluffy mane.', unlock:'bond5'},
};
const BREED_COATS = {
  holland:    ['sableGrey','hlSiameseSable','hlTort','chestnut','black','blue','fawn'],
  netherland: ['ndBlackTan','ndBlueOtter','ndChestnut','ndTort','ndBlue'],
  lionhead:   ['lhBroken','lhTort','lhREW','lhBlack','lhChocolate','lhSiameseSable','lhSmokePearl'],
};
const BREED_DEFAULT_COAT = { holland:'sableGrey', netherland:'ndBlackTan', lionhead:'lhBroken' };

/* Account-wide unlocks (persist across pets, e.g. the Lionhead breed) */
const UNLOCK_KEY = 'thumpagotchi.unlocks';
let unlocks = {};
function loadUnlocks(){ try{ unlocks = JSON.parse(localStorage.getItem(UNLOCK_KEY)) || {}; }catch(e){ unlocks = {}; } }
function saveUnlocks(){ try{ localStorage.setItem(UNLOCK_KEY, JSON.stringify(unlocks)); }catch(e){} }
function unlockBreed(id){ if(!unlocks[id]){ unlocks[id]=true; saveUnlocks(); return true; } return false; }

/* ============================================================================ *
 *  CONTENT DATA  (progression / economy definitions)
 * ============================================================================ */
const STAGES = [   // life stages unlock as she ages (days lived)
  {key:'kit',    name:'Kit',    minDay:0,  scale:0.74, hunger:1.05, energy:0.95, label:'👶'},
  {key:'junior', name:'Junior', minDay:3,  scale:0.88, hunger:0.98, energy:0.85, label:'🐇'},
  {key:'adult',  name:'Adult',  minDay:7,  scale:1.0,  hunger:0.9,  energy:0.78, label:'🐰'},
  {key:'senior', name:'Senior', minDay:18, scale:0.97, hunger:0.78, energy:0.68, label:'🎗️'},
];
const stageFor = d => STAGES.reduce((s,st)=> d>=st.minDay ? st : s, STAGES[0]);

// Only tricks real rabbits are clicker-trained to do. Flop and binky are NOT tricks — they're
// spontaneous signs of trust and joy (see idleBrain). Keys 'beg'/'jump' kept so old mastery carries over.
const TRICKS = {   // unlock gates by Bond level; energy is the cost to perform
  spin:    {name:'Spin',      emoji:'🌀', unlock:1, energy:9,  dur:1.0},
  beg:     {name:'Stand Up',  emoji:'🙏', unlock:1, energy:6,  dur:1.4},
  boop:    {name:'Nose Boop', emoji:'👃', unlock:2, energy:4,  dur:1.2},
  come:    {name:'Come',      emoji:'📣', unlock:3, energy:6,  dur:1.0},
  jump:    {name:'Hop Over',  emoji:'⤴️', unlock:5, energy:15, dur:1.1},
};

/* Temperament — decided once, when she grows into an Adult, from a hidden tally of how she was
   raised as a Kit/Junior (rab.upbringing). Never shown as a number: care shows up as who she is. */
const TEMPER_MISTAKES = 6;   // this many upbringing mistakes → skittish
const TEMPERS = {
  cuddly:  {name:'Cuddly',   emoji:'🤗', desc:'loves head rubs, purrs easily, and flops near you',
            thumpMul:0.85, binkyMul:1.0, flopBond:2, flopRate:1.6, mischief:0.6, purr:1.6, petJoy:1.3, hide:0},
  bold:    {name:'Bold',     emoji:'⚡', desc:'explores everything, binkies a lot, and gets into mischief when bored',
            thumpMul:1.0,  binkyMul:1.5, flopBond:3, flopRate:1.0, mischief:1.5, purr:1.0, petJoy:1.0, hide:0},
  skittish:{name:'Skittish', emoji:'🍃', desc:'startles easily, hides often, and only flops once fully trusting you',
            thumpMul:1.3,  binkyMul:0.6, flopBond:6, flopRate:0.6, mischief:0.8, purr:0.7, petJoy:0.9, hide:0.25},
};
const TEMPER_YOUNG = {thumpMul:1, binkyMul:1, flopBond:3, flopRate:1, mischief:1, purr:1, petJoy:1, hide:0};
const temper = () => TEMPERS[rab.temper] || TEMPER_YOUNG;

/* Treats a rabbit can have as a favourite (rolled per rabbit at adoption, discovered in play) */
const FAV_TREATS = {banana:{name:'Banana', emoji:'🍌'}, greens:{name:'Leafy Greens', emoji:'🥬'}, chews:{name:'Apple Chew Sticks', emoji:'🥢'}};

/* Preferences — what makes THIS rabbit theirs. Rolled at adoption, never shown until the player
   discovers them in play; collected on the "About" tab of 📖 and quizzed in the Quiz game. */
const PET_SPOTS = {forehead:{name:'the forehead', emoji:'💆'}, cheeks:{name:'the cheeks', emoji:'☺️'}, ears:{name:'behind the ears', emoji:'👂'}};
const TOYS      = {ball:{name:'Treat Ball', emoji:'🧸'}, tunnel:{name:'Play Tunnel', emoji:'🕳️'}, tower:{name:'Climbing Tower', emoji:'🪜'}};
const NAP_SPOTS = {bed:{name:'the bed', emoji:'🛏️'}, hutch:{name:'the wooden hutch', emoji:'🛖'},
                   castle:{name:'the cardboard castle', emoji:'🏰'}, hammock:{name:'the hammock', emoji:'🪢'}};
const DISLIKES  = {rump:{name:'being brushed on the haunches', emoji:'🪮'}, nose:{name:'having their nose touched', emoji:'👃'},
                   ball:{name:'the Treat Ball', emoji:'🧸'}, tunnel:{name:'the Play Tunnel', emoji:'🕳️'}, tower:{name:'the Climbing Tower', emoji:'🪜'}};
const PREF_FIND = {pet:40, toy:2, nap:2};   // stroke ticks (~6s of rubbing) / plays / naps before it's "discovered"
function rollPrefs(){
  const toy = pick(Object.keys(TOYS));
  return { pet:pick(Object.keys(PET_SPOTS)), toy, nap:pick(Object.keys(NAP_SPOTS)),
           dislike:pick(['rump','nose', ...Object.keys(TOYS).filter(k=>k!==toy)]) };   // never dislikes the favourite toy
}

/* Hay by age: young rabbits (under ~6 months) can have rich alfalfa; adults switch GRADUALLY to a
   grass hay like timothy. The player makes the switch (Timothy Hay in the Shop, unlocked at Adult);
   it mixes over HAY_MIX_DAYS, and an adult left on alfalfa gains weight from it. */
const HAY_MIX_DAYS = 2;
const HAY_TYPES = {alfalfa:{name:'alfalfa hay', emoji:'🌱'}, mixed:{name:'alfalfa–timothy mix', emoji:'🌾'}, timothy:{name:'Timothy hay', emoji:'🌾'}};

/* Rabbit Notes — real rabbit knowledge, unlocked by witnessing the behaviour in play.
   Player knowledge, so it's account-wide (survives Rehome), like breed unlocks. */
const NOTES_KEY = 'thumpagotchi.notes';
const NOTES = [
  {id:'thump',   emoji:'🦶', title:'Thumping',        hint:'Something upsets your rabbit.',
   text:'A hard stamp with a back foot. Wild rabbits thump to warn the warren of danger; pet rabbits also thump when scared or annoyed.'},
  {id:'binky',   emoji:'✨', title:'Binkies',         hint:'Keep your rabbit very happy.',
   text:'A leap with a twist in mid-air. It is pure happiness, and you only see it from a rabbit that feels safe.'},
  {id:'flop',    emoji:'😌', title:'The flop',        hint:'Earn your rabbit’s trust.',
   text:'Dropping over onto their side looks alarming but means they feel completely safe. Prey animals only drop their guard like this when they trust their surroundings.'},
  {id:'purr',    emoji:'🦷', title:'Tooth purring',   hint:'Pet your rabbit’s head when they’re happy.',
   text:'A soft, gentle grinding of the teeth while being petted. It is a content rabbit’s purr.'},
  {id:'grind',   emoji:'😣', title:'Loud grinding',   hint:'You hope you never see this one.',
   text:'Loud, harsh teeth grinding, especially with a hunched posture, is a sign of pain. It is not a purr. A rabbit doing this needs a vet.'},
  {id:'chin',    emoji:'🪵', title:'Chinning',        hint:'Bring home something new.',
   text:'Rabbits have scent glands under the chin and rub them on things to claim them. People can’t smell it; other rabbits can.'},
  {id:'fav',     emoji:'💛', title:'A favourite treat', hint:'Try different treats.',
   text:'Every rabbit has a favourite. Knowing it matters: a rabbit refusing their favourite treat is one of the clearest early signs something is wrong.'},
  {id:'refuse',  emoji:'🚫', title:'Off their food',  hint:'Watch what your rabbit won’t eat.',
   text:'Rabbits are prey animals and hide illness. Refusing food, especially a favourite, is often the first sign. A rabbit that stops eating needs a vet the same day.'},
  {id:'droppings',emoji:'🟤', title:'Fewer droppings', hint:'Keep an eye on the litter box.',
   text:'Fewer or smaller droppings mean the gut is slowing down, an early warning of GI stasis.'},
  {id:'stasis',  emoji:'🚑', title:'GI stasis',       hint:'Let’s hope not.',
   text:'The gut stops moving, and it can turn fatal within a day or two. Unlimited hay keeps things moving; the vet handles the rest.'},
  {id:'hay',     emoji:'🌾', title:'Hay first',       hint:'Overdo the pellets.',
   text:'Hay should be most of a rabbit’s diet and available at all times. It wears down ever-growing teeth and keeps the gut moving. Pellets are a small supplement.'},
  {id:'sugar',   emoji:'🍌', title:'Easy on treats',  hint:'One banana too many.',
   text:'Rabbits can’t vomit, and a hit of sugar throws their gut off. A bite of banana is a party; a whole one is a bellyache.'},
  {id:'grudge',  emoji:'🥶', title:'Grudges',         hint:'Push your rabbit too far.',
   text:'Rabbits remember how they’re treated. Trust is earned back with space, a favourite treat, and time.'},
  {id:'dawn',    emoji:'🌅', title:'Dawn and dusk',   hint:'Watch your rabbit through a whole day.',
   text:'Rabbits are crepuscular: most active at dawn and dusk, resting through the middle of the day.'},
  {id:'zoomies', emoji:'🌙', title:'Zoomies',         hint:'Stay up late.',
   text:'Sudden bursts of running laps around the room. It is play and spare energy from a happy, healthy rabbit.'},
  {id:'bored',   emoji:'🕳️', title:'Boredom',         hint:'Leave your rabbit alone for a while.',
   text:'Bored rabbits make their own fun by digging carpets and chewing baseboards and cords. Toys, tunnels and time with you prevent it.'},
  {id:'tricks',  emoji:'🎓', title:'Trick training',  hint:'Ask your rabbit for a trick.',
   text:'Rabbits can learn tricks with patience and a favourite treat as a reward: spinning, standing up, coming when called, nose-booping a target, and hopping over a low step.'},
  {id:'forage',  emoji:'🥣', title:'Foraging',        hint:'Make your rabbit hunt for a treat.',
   text:'Rabbits naturally spend much of the day foraging. Hiding food under cups, in boxes or in shredded paper turns snack time into enrichment.'},
  {id:'safefoods',emoji:'🥬', title:'Safe foods',     hint:'Play Safe or Not?',
   text:'Leafy greens and herbs like romaine, cilantro and basil are great every day; fruit is a small treat. Chocolate, onion, garlic, avocado and rhubarb are poisonous to rabbits.'},
  {id:'haytypes',emoji:'🌱', title:'Hay by age',      hint:'Watch what changes when your rabbit grows up.',
   text:'Rabbits under about six months can have alfalfa hay, rich in protein and calcium for growing. Adults switch gradually to grass hays like timothy, orchard or oat; alfalfa is too rich for them.'},
  {id:'temper',  emoji:'🧬', title:'Personality',     hint:'Raise your rabbit to adulthood.',
   text:'Rabbits handled gently and often while young tend to grow into confident, friendly adults. Early care shapes the rabbit you end up with.'},
];
let notes = {};
function loadNotes(){ try{ notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; }catch(e){ notes = {}; } }
function saveNotes(){ try{ localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }catch(e){} }
loadNotes();
// Unlock a note the first time its behaviour is witnessed. `quiet` skips the toast (e.g. when a
// fact card is already on screen explaining it). The toast is delayed so it doesn't clobber the
// action's own message in the single toast slot.
function learnNote(id, quiet){
  if(notes[id] || !NOTES.some(n=>n.id===id)) return;
  notes[id] = rab.day || 1; saveNotes(); updateNotesBadge();
  if(started) applyGamesTab();   // a new note can make the Quiz ready
  if(!quiet){ const n=NOTES.find(n=>n.id===id); setTimeout(()=>toast(`📖 New Rabbit Note: ${n.emoji} ${n.title}`), 1800); }
}
function updateNotesBadge(){
  const b=document.getElementById('notesBadge'); if(!b) return;
  b.textContent = `${Object.keys(notes).length}/${NOTES.length}`;
}

const SHOP = [   // type: feed(instant) · cure(stock) · toy/decor(permanent) · tool(permanent)
  {id:'greens',  name:'Leafy Greens',    emoji:'🥬', cost:8,  type:'feed', unlock:1, desc:'Healthy: −hunger, +water, +health, trims weight.'},
  {id:'oxbow',   name:'Premium Pellets', emoji:'🥣', cost:14, type:'feed', unlock:1, desc:'Big hunger cut with less weight gain than banana.'},
  {id:'medicine',name:'Gut Medicine',    emoji:'💊', cost:20, type:'cure', unlock:1, desc:'Keep one on hand — the Vet uses it free to cure stasis.'},
  {id:'groom',   name:'Grooming Kit',    emoji:'🪮', cost:16, type:'tool', unlock:1, desc:'Cleaning also grooms: extra happiness + Bond, less molt.'},
  {id:'ball',    name:'Treat Ball',      emoji:'🧸', cost:18, type:'toy',  unlock:1, desc:'Enrichment: unlocks Play, slows happiness decay.'},
  {id:'tunnel',  name:'Play Tunnel',     emoji:'🕳️', cost:26, type:'toy',  unlock:2, desc:'More Play value and energy from zoomies.'},
  {id:'castle',  name:'Cardboard Castle',emoji:'🏰', cost:44, type:'decor',unlock:3, desc:'Cosy hideout — a little happiness every day.'},
  {id:'timothy', name:'Timothy Hay',     emoji:'🌾', cost:6,  type:'tool', unlock:1, adult:true, desc:'Grass hay for grown-up rabbits. Mixes in over 2 days to switch from alfalfa.'},
  {id:'chews',   name:'Apple Chew Sticks',emoji:'🥢',cost:10, type:'feed', unlock:1, desc:'A good chew: happiness + a little hunger, healthy teeth.'},
  {id:'bottle',  name:'Deluxe Water Bottle',emoji:'🚰',cost:16,type:'tool',unlock:2, desc:'Fresh water lasts longer — the Water need drains slower.'},
  {id:'rug_rose',name:'Rose Shag Rug',   emoji:'🟥', cost:24, type:'decor',unlock:2, desc:'Re-carpets the room in plush rose.'},
  {id:'tower',   name:'Climbing Tower',   emoji:'🪜', cost:34, type:'toy',  unlock:3, desc:'A multi-level lookout — enrichment + happiness.'},
  {id:'hutch',   name:'Wooden Hutch',     emoji:'🛖', cost:50, type:'decor',unlock:4, desc:'A rustic hidey-hutch. Décor + a daily happiness boost.'},
  {id:'hammock', name:'Bunny Hammock',    emoji:'🛏️', cost:40, type:'toy',  unlock:6, desc:'Lounge in style — a big daily happiness boost.'},
  {id:'bed_cloud',name:'Cloud Bed',       emoji:'☁️', cost:30, type:'decor',unlock:2, desc:'Upgrade the basic bed to a plush cloud bed (switch it in the Menu).'},
];
const shopItem = id => SHOP.find(s=>s.id===id);


/* Daily goal generators — 3 are rolled each new day */
// Each generator may carry an `avail()` predicate; a goal is only rollable when it returns
// true (e.g. Play needs a toy; minigame goals need the game unlocked). The 90%-Happiness goal
// was removed from rotation for being too easy — the happy90Armed logic stays but is now inert.
const SNAKE_GOAL = 6;   // score threshold for the Bunny Snake daily goal
const GOAL_POOL = [
  () => ({track:'hay',    target:2,  reward:7,  text:'Serve fresh hay ×2'}),
  () => ({track:'trick',  target:3,  reward:9,  text:'Perform ×3 tricks'}),
  () => ({track:'clean',  target:1,  reward:6,  text:'Scoop the litter box'}),
  () => ({track:'water',  target:1,  reward:5,  text:'Refill the water bowl'}),
  () => ({track:'pet',    target:10, reward:7,  text:'Give ×10 head pets'}),
  () => ({track:'binky',  target:2,  reward:9,  text:'Spark ×2 binkies'}),
  () => ({track:'groom',  target:3,  reward:7,  text:'Groom {name}’s coat ×3'}),
  () => ({track:'play',   target:2,  reward:8,  text:'Play together ×2',            avail:()=>owns('ball')||owns('tunnel')||owns('tower')}),
  () => ({track:'g_snake',target:1,  reward:10, text:`Score ${SNAKE_GOAL}+ in Bunny Snake`, avail:()=>gameUnlocked('snake')}),
  () => ({track:'g_guess',target:1,  reward:10, text:'Win at Guess My Number',      avail:()=>gameUnlocked('guess')}),
  () => ({track:'g_forage',target:1, reward:9,  text:'Win all 3 rounds of Forage',   avail:()=>gameUnlocked('forage')}),
  () => ({track:'g_dig',  target:1,  reward:9,  text:'Find every treat in the Dig Box', avail:()=>gameUnlocked('dig')}),
  () => ({track:'g_safe', target:1,  reward:9,  text:'Score 8+ in Safe or Not?',      avail:()=>gameUnlocked('safe')}),
  () => ({track:'g_quiz', target:1,  reward:12, text:'Ace {name}’s quiz',          avail:()=>gameUnlocked('quiz')}),
  () => ({track:'g_ttt',  target:1,  reward:12, text:'Beat me at Bunny Tic-Tac-Toe',avail:()=>gameUnlocked('ttt')}),
];

const ACHS = {   // one-time milestones (id → {name, carrots})
  firstDay:   {name:'Home Sweet Home', carrots:5},
  bond5:      {name:'Best Friends (Bond 5)', carrots:20},
  bond10:     {name:'Bonded for Life (Bond 10)', carrots:40},
  week:       {name:'One Week Strong', carrots:15},
  senior:     {name:'Grand Old Bun', carrots:30},
  nurse:      {name:'Back from the Brink', carrots:15},
  master:     {name:'Trick Master', carrots:25},
  rich:       {name:'Carrot Tycoon (100🥕)', carrots:0},
  toybox:     {name:'Spoiled Rotten (3 toys)', carrots:15},
  pets100:    {name:'A Hundred Head-Pats', carrots:10},
};

/* ---------------- World / layout ---------------- */
const world = { floorY:0, rug:{}, litter:{}, food:{}, water:{}, tube:{}, bed:{}, castle:{}, ball:{} };
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.floor(W*DPR); canvas.height = Math.floor(H*DPR);
  bgCtx.setTransform(DPR,0,0,DPR,0,0);
  // Toys/furniture are sized to the rabbit and scale with breed — but only HALFWAY,
  // so a dwarf breed still reads visibly small against its furniture.
  const rawBs = (typeof BREEDS!=='undefined' && BREEDS[rab.breed]) ? BREEDS[rab.breed].scale : 1;
  const bs = (1+rawBs)/2;
  // Layout is shifted up so the bed/bowls stay clear of the bottom control dock.
  // Depth rows: BACK (bases just below floorY) → FRONT (near the dock). Every prop's
  // base must land on the floor (y >= floorY), and back-row props must not overlap.
  // Centre lane (x ~0.42–0.60) is kept clear for the rabbit; big furniture flanks it
  // so nothing sits dead-behind her and her hop-to-nap / hop-to-den reads as real motion.
  // On a portrait (mobile) frame the wall is shortened and the window enlarged so the room
  // fills more of the screen; landscape (desktop) keeps the original proportions.
  const mobile = (H/W > 1.15);
  world.mobile = mobile;
  world.floorY = H*(mobile? 0.50 : 0.56);
  world.rug   = {x:W*0.5,  y:H*0.76, rx:W*0.45, ry:H*0.15};
  world.litter= {x:W*0.14, y:H*0.66, w:Math.min(230,W*0.30)*bs, h:Math.min(118,H*0.19)*bs};
  world.food  = {x:W*0.27, y:H*0.79, r:Math.min(32,W*0.05)};
  world.water = {x:W*0.365,y:H*0.80, r:Math.min(30,W*0.045)};
  world.hammock={x:W*0.355,y:H*0.725,w:Math.min(232,W*0.31)*bs}; // left-of-centre, in the open; cradles her
  world.hammock.postH = world.hammock.w*0.46;
  world.hammock.sy  = world.hammock.y - world.hammock.postH;      // back rim of the sling (behind her)
  world.hammock.nap = world.hammock.sy + world.hammock.w*0.215;   // where she settles into the pouch
  world.tower = {x:W*0.145,y:H*0.63, r:Math.min(72,W*0.108)*bs};  // far-left corner (thin, clears the litter)
  world.hutch = {x:W*0.665,y:H*0.605,r:Math.min(80,W*0.12)*bs};   // right-of-centre — she hops here to den
  world.tube  = {x:W*0.86, y:H*0.65, w:Math.min(230,W*0.30)*bs, h:Math.min(116,H*0.19)*bs};
  world.bed   = {x:W*0.585,y:H*0.795,r:Math.min(84,W*0.125)*bs};  // front, right of centre
  world.castle= {x:W*0.875,y:H*0.835,r:Math.min(80,W*0.12)*bs};   // front-far-right, below the tunnel mouth
  world.ball  = {x:W*0.305,y:H*0.815,r:Math.min(27,W*0.042)*bs};
  world.win   = mobile
    ? {x:W*0.5-W*0.165, y:H*0.045, w:W*0.33, h:H*0.31}   // bigger window fills the shorter wall
    : {x:W*0.5-W*0.11,  y:H*0.06,  w:W*0.22, h:H*0.28};
  rab.baseY = world.rug.y - 6;
  // Re-clamp her — and any in-flight hop — to the new floor bounds. A device rotation mid-hop
  // changes W, so hopFromX/hopToX (absolute pixels for the OLD width) can point off the new rug
  // or into a prop; clamping rab.x alone isn't enough because the next frame lerps her straight
  // back out toward the stale target (and touchdown snaps her to it).
  const rugLo = world.rug.x-world.rug.rx*0.6, rugHi = world.rug.x+world.rug.rx*0.6;
  rab.x = clamp(rab.x||world.rug.x, rugLo, rugHi);
  if(rab.hopping){ rab.hopFromX = clamp(rab.hopFromX, rugLo, rugHi); rab.hopToX = clamp(rab.hopToX, rugLo, rugHi); }
  // The charger cord bakes absolute pixels (outlet + H-fraction); a rotation would strand its
  // tap target off-screen. Re-derive it from the fresh layout, same as the rabbit re-clamp above.
  if(dayEvent && dayEvent.type==='hazard'){ const o=outletPos(); dayEvent.cord.x=o.x+78; dayEvent.cord.y=H*0.80; }
}
window.addEventListener('resize', resize);

/* ============================================================================ *
 *  GAME STATE
 * ============================================================================ */
const stats = { happy:80, hunger:30, water:85, hygiene:90, energy:75 };
const rab = {
  name:'Mowgli', sex:'buck', breed:'holland',
  x:0, baseY:0, hopOff:0, binkyHop:0, curScale:0.74,
  thumps:0, cold:false,
  bananasToday:0, day:1, ageDays:0,
  state:'loaf', legStomp:0, tummyUntil:0,
  breath:0, noseTwitch:0, blink:0, nextBlink:2.5,
  loaf:0,
  hopping:false, hopFromX:0, hopToX:0, hopT0:0, hopDur:0.6,
  groomUntil:0, lookX:0, lookY:0,
  binkyT:0, binkyDur:0.85,
  trick:null,
  restUntil:0,
  play:null, playAlpha:1, playYOff:0, hidden:false,
  boxT:0, boxYOff:0, hammockSag:0, decor:{rug:null,bed:null}, petReact:0,
  begUntil:0, begAt:0, begCooldown:0, begWant:'🍌', denUntil:0,
  maxAngerCount:0, weightStrikes:0, pelletsToday:0, _obeseT:0, _obeseWarned:false,
  // v2 "first ten minutes" state — persisted flags + runtime-only scripting timers
  firedCards:{}, gamesRevealed:false, baitDone:false, thumpSeen:false, exitBeatShown:false, lastSeen:0,
  petArmedOnce:false, baitAt:0, fallbackThumpBy:0,
  // progression
  bondLevel:1, bondXP:0, carrots:12,
  weight:100, health:100, sick:false, nextCheckupDay:5,
  items:{}, mastery:{}, achievements:{},
  goals:[], goalDay:0, goalCounters:{},
  lifetimePets:0,
  // realism pass: temperament, favourite treat, and runtime-only behaviour timers
  temper:null, upbringing:{mistakes:0, affection:0, play:0},
  favTreat:'banana', favKnown:false,
  prefs:{pet:'forehead', toy:'ball', nap:'bed', dislike:'nose'}, prefKnown:{}, prefCount:{}, quizPaidDay:0, safePaidDay:0,
  hayType:'alfalfa', haySwitchDay:0, napSpot:'bed', lastAnnoyed:0,
  lastEngaged:0, mischiefCooldown:0, digUntil:0, chewUntil:0, chinUntil:0, chinAt:0,
  purrCooldown:0, grindAt:0, flopCooldown:0, mischiefAt:0, mischiefKind:null, chinName:null, hurdle:false,
};
const PRON={doe:{s:'she',o:'her',p:'her'}, buck:{s:'he',o:'him',p:'his'}};
const P=()=>PRON[rab.sex]||PRON.doe;

/* time of day: 0..1 across daylight; then a night cutscene */
let timeOfDay = 0.05;
const DAY_LEN = 130;   // seconds of daylight (relaxed pacing)
// Day 1 runs longer so adoption, the tutorial goals, the bait flop, the first shop
// purchase and a quiet beat before nightfall all fit without the sun racing.
const dayLen = day => day===1 ? 170 : DAY_LEN;
let cutscene = null;
let started = false;

const particles = [];
const hayPiles = [];
const bananas = [];
let ballAnim = null;   // animated treat-ball position while she plays
let hayFresh = 0;
let thumpFx = 0, thumpRipples = [], thumpTextT = 0;

let pettingMode = false;
let groomMode = false;                 // comb-drag mode: restores Hygiene (mutually exclusive with petting)
let pointer = {x:-999,y:-999,down:false};
let lastPetGain = 0, lastFeetPet = 0, lastGroomGain = 0, groomGoalAt = 0;
let autosaveT = 0;
let minigameActive = false;   // freezes the pet sim while a minigame overlay is open
let dayEvent = null, hazardFlash = 0;   // daily event (hide-and-seek / charger hazard)

/* ============================================================================ *
 *  SAVE / LOAD  (localStorage)
 * ============================================================================ */
const SAVE_KEY = 'thumpagotchi.save.v2';
function save(){
  if(!started) return;
  try{
    const data = {
      v:2, name:rab.name, sex:rab.sex, breed:rab.breed, coatKey,
      stats:{...stats},
      thumps:rab.thumps, cold:rab.cold, bananasToday:rab.bananasToday,
      day:rab.day, ageDays:rab.ageDays, timeOfDay,
      bondLevel:rab.bondLevel, bondXP:rab.bondXP, carrots:rab.carrots,
      weight:rab.weight, health:rab.health, sick:rab.sick, nextCheckupDay:rab.nextCheckupDay,
      items:rab.items, mastery:rab.mastery, achievements:rab.achievements,
      goals:rab.goals, goalDay:rab.goalDay, goalCounters:rab.goalCounters,
      lifetimePets:rab.lifetimePets, decor:rab.decor,
      maxAngerCount:rab.maxAngerCount, weightStrikes:rab.weightStrikes, pelletsToday:rab.pelletsToday,
      // v2 first-session flags + a heartbeat for welcome-back catch-up
      firedCards:rab.firedCards, gamesRevealed:rab.gamesRevealed,
      baitDone:rab.baitDone, thumpSeen:rab.thumpSeen, exitBeatShown:rab.exitBeatShown,
      temper:rab.temper, upbringing:rab.upbringing, favTreat:rab.favTreat, favKnown:rab.favKnown,
      prefs:rab.prefs, prefKnown:rab.prefKnown, prefCount:rab.prefCount, hayType:rab.hayType, haySwitchDay:rab.haySwitchDay, quizPaidDay:rab.quizPaidDay, safePaidDay:rab.safePaidDay,
      lastSeen:Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){/* storage unavailable — play unsaved */}
}
function loadRaw(){
  try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){ return null; }
}
// numeric fields pass through num() so a corrupt save or hostile import can never
// NaN-poison a stat (clamp(NaN) stays NaN forever) — non-finite values fall back
const num=(v,f)=>{ v=+v; return Number.isFinite(v)?v:f; };
function applySave(d){
  rab.name=String(d.name||'Mowgli').slice(0,12); rab.sex=d.sex||'buck';   // match the name input's maxlength
  rab.breed = d.breed && BREEDS[d.breed] ? d.breed : 'holland';
  coatKey = d.coatKey && COATS[d.coatKey] ? d.coatKey : (BREED_DEFAULT_COAT[rab.breed]||'sableGrey');
  coat = COATS[coatKey];
  const ds=d.stats||{};
  for(const k of Object.keys(stats)) stats[k]=clamp(num(ds[k], stats[k]));
  rab.thumps=clamp(num(d.thumps,0),0,5); rab.cold=!!d.cold; rab.bananasToday=num(d.bananasToday,0);
  rab.day=Math.max(1,Math.round(num(d.day,1))); rab.ageDays=Math.max(0,Math.round(num(d.ageDays,0)));
  timeOfDay=clamp(num(d.timeOfDay,0.05),0,1);
  rab.bondLevel=Math.max(1,Math.round(num(d.bondLevel,1)));
  rab.bondXP=Math.min(10000,Math.max(0,num(d.bondXP,0)));   // cap so a hostile save can't level-loop addXP() forever
  rab.carrots=Math.max(0,Math.round(num(d.carrots,12)));
  rab.weight=clamp(num(d.weight,100),45,175); rab.health=clamp(num(d.health,100)); rab.sick=!!d.sick;
  // scheduled checkups: default an established save to the next day-5 boundary so it isn't retro-overdue
  rab.nextCheckupDay = Math.max(5, Math.round(num(d.nextCheckupDay, Math.floor(rab.day/5)*5 + 5)));
  rab.items=d.items||{}; rab.mastery=d.mastery||{}; rab.achievements=d.achievements||{};
  // coerce each saved goal's fields so a corrupt/hostile save can't inject markup (text)
  // or NaN-poison the progress bars (prog/target/reward all pass through num())
  rab.goals = Array.isArray(d.goals) ? d.goals.map(g=>{
    g = g && typeof g==='object' ? g : {};
    return {...g, text:String(g.text||''), track:String(g.track||''),
            prog:num(g.prog,0), target:Math.max(1,num(g.target,1)), reward:num(g.reward,0), done:!!g.done};
  }) : [];
  rab.goalDay=num(d.goalDay,0); rab.goalCounters=d.goalCounters||{};
  rab.lifetimePets=num(d.lifetimePets,0);
  rab.decor=d.decor||{rug:null,bed:null};
  rab.maxAngerCount=num(d.maxAngerCount,0); rab.weightStrikes=num(d.weightStrikes,0); rab.pelletsToday=num(d.pelletsToday,0);
  // v2 flags — migrate with defaults; established (day 2+) saves always have Games revealed
  rab.firedCards=d.firedCards||{};
  rab.gamesRevealed=!!d.gamesRevealed || rab.day>=2;
  rab.baitDone=!!d.baitDone;
  // pre-field saves (e.g. from the root build — same storage key) at day 2+ have surely
  // thumped already; only trust an explicit false from a save this build wrote itself
  rab.thumpSeen = d.thumpSeen===undefined ? rab.day>=2 : !!d.thumpSeen;
  rab.exitBeatShown=!!d.exitBeatShown;
  rab.lastSeen=num(d.lastSeen,0);
  // realism pass — migrate older saves: roll a favourite, and give an existing adult a
  // temperament from the history we do have (rage/obesity strikes → skittish, lots of pets → cuddly)
  const ub=d.upbringing||{};
  rab.upbringing={mistakes:num(ub.mistakes,0), affection:num(ub.affection,0), play:num(ub.play,0)};
  rab.favTreat = FAV_TREATS[d.favTreat] ? d.favTreat : pick(Object.keys(FAV_TREATS));
  rab.favKnown = !!d.favKnown;
  // preferences: keep only valid values, roll anything missing (older saves get a fresh set)
  const dp = d.prefs||{}, rp = rollPrefs();
  rab.prefs = { pet: PET_SPOTS[dp.pet]?dp.pet:rp.pet, toy: TOYS[dp.toy]?dp.toy:rp.toy,
                nap: NAP_SPOTS[dp.nap]?dp.nap:rp.nap, dislike: DISLIKES[dp.dislike]?dp.dislike:rp.dislike };
  if(rab.prefs.dislike===rab.prefs.toy) rab.prefs.dislike='nose';
  const dk=d.prefKnown||{}, dc=d.prefCount||{};
  rab.prefKnown = {pet:!!dk.pet, toy:!!dk.toy, nap:!!dk.nap, dislike:!!dk.dislike};
  rab.prefCount = {pet:num(dc.pet,0), toy:num(dc.toy,0), nap:num(dc.nap,0)};
  // hay: an existing adult save was already on "Timothy hay" (the old default); kits start on alfalfa
  rab.hayType = HAY_TYPES[d.hayType] ? d.hayType : (Math.round(num(d.ageDays,0))>=7 ? 'timothy' : 'alfalfa');
  rab.haySwitchDay = num(d.haySwitchDay,0);
  rab.quizPaidDay = num(d.quizPaidDay,0);
  rab.safePaidDay = num(d.safePaidDay,0);
  rab.temper = TEMPERS[d.temper] ? d.temper : null;
  if(!rab.temper && rab.ageDays>=7){
    rab.temper = (rab.maxAngerCount>=1 || rab.weightStrikes>=2) ? 'skittish'
               : rab.lifetimePets>=150 ? 'cuddly' : 'bold';
  }
  rab.curScale=stageFor(rab.ageDays).scale;
}
function wipeSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ============================================================================ *
 *  PROGRESSION — Bond XP / levels, Carrots, Achievements
 * ============================================================================ */
const xpNeeded = lv => 60 + (lv-1)*45;   // XP to advance from lv → lv+1
function addXP(n){
  rab.bondXP += n;
  while(rab.bondXP >= xpNeeded(rab.bondLevel)){
    rab.bondXP -= xpNeeded(rab.bondLevel);
    rab.bondLevel++;
    onLevelUp();
  }
}
function onLevelUp(){
  const lv = rab.bondLevel;
  addCarrots(3 + Math.floor(lv/2));
  const p=parts(); for(let i=0;i<6;i++) spawnHeart(p.head.x+rand(-24,24),p.head.y);
  spawnStars(p.head.x,p.head.y-20);
  let msg = `💞 Bond level ${lv}! `;
  // announce any trick that just unlocked
  const newT = Object.entries(TRICKS).filter(([k,t])=>t.unlock===lv).map(([k,t])=>t.name);
  if(newT.length) msg += `New trick${newT.length>1?'s':''}: ${newT.join(', ')}.`;
  else msg += `${cap(P().s)} trusts you a little more.`;
  toast(msg);
  if(lv>=5){ unlockAch('bond5');
    if(unlockBreed('lionhead')) toast('🦁 Lionhead breed UNLOCKED! Adopt one on your next pet.');
  }
  if(lv>=10) unlockAch('bond10');
}
function addCarrots(n, x, y){
  rab.carrots += n;
  if(n>0 && x!==undefined) spawnCarrot(x,y,n);
  if(rab.carrots>=100) unlockAch('rich');
}
function spendCarrots(n){ if(rab.carrots<n) return false; rab.carrots-=n; return true; }

function unlockAch(id){
  if(rab.achievements[id]) return;
  const a = ACHS[id]; if(!a) return;
  rab.achievements[id]=1;
  if(a.carrots) rab.carrots += a.carrots;
  toast(`🏆 Achievement: ${a.name}${a.carrots?`  (+${a.carrots}🥕)`:''}`);
}

/* ============================================================================ *
 *  DAILY GOALS
 * ============================================================================ */
function rollGoals(){
  // a goal is only rollable when its avail() predicate passes (toy owned, game unlocked, …)
  const pool = GOAL_POOL.map(f=>f()).filter(g=> !g.avail || g.avail());
  const chosen=[];
  for(let i=0;i<3 && pool.length;i++){
    const idx=Math.floor(Math.random()*pool.length);
    const g=pool.splice(idx,1)[0];
    g.prog=0; g.done=false; g.text=g.text.replace('{name}',rab.name);
    chosen.push(g);
  }
  rab.goals=chosen; rab.goalDay=rab.day; rab.goalCounters={};
  renderGoals();
}
// Day 1 uses a fixed, hand-ordered set instead of the random pool — the goals panel
// IS the tutorial (three unmissable first actions), no overlay or forced clicks.
// Economy check: new game starts at 12🥕 +5 (firstDay ach) = 17. These three pay
// 7+5+7 = 19, plus the +6 all-goals-done bonus = 25, landing the player near ~42🥕
// by dusk on day 1 — so the 18🥕 Treat Ball is comfortably affordable early on day 2
// without grinding. Payouts mirror the comparable pool goals above.
function setDay1Goals(){
  rab.goals = [
    {track:'hay',   target:1, reward:7, text:'Serve fresh hay'},
    {track:'water', target:1, reward:5, text:'Refill the water bowl'},
    {track:'pet',   target:5, reward:7, text:'Give ×5 head pets'},
  ].map(g=>({...g, prog:0, done:false}));
  rab.goalDay=rab.day; rab.goalCounters={};
  renderGoals();
}
function incGoal(track, n=1){
  let any=false;
  for(const g of rab.goals){
    if(g.track===track && !g.done){
      g.prog=Math.min(g.target,g.prog+n);
      if(g.prog>=g.target){ g.done=true; addCarrots(g.reward); addXP(12);
        toast(`🎯 Goal done: ${g.text}  (+${g.reward}🥕)`); any=true; }
    }
  }
  if(any && rab.goals.every(g=>g.done)){ addCarrots(6); toast('🌟 All daily goals complete! Bonus +6🥕'); }
  renderGoals();
}

/* ============================================================================ *
 *  FACT CARDS — one real rabbit fact at the moment of consequence, once/save.
 *  Dismissible, one at a time, pauses nothing. Canadian spelling, warm voice.
 *  Card copy lives here so v2.1 can add more with a single entry.
 * ============================================================================ */
const FACTS = {
  feet:    {icon:'🦶', title:'About that thump…',
    text:`A thump is an alarm — wild rabbits stomp to warn the whole warren of danger. {P} feet and hindquarters are off-limits for most rabbits; hands belong on the head and cheeks.`},
  banana3: {icon:'🍌', title:'Easy on the treats',
    text:`Rabbits can't vomit, and a hit of sugar throws their gut right off. That's why treats are capped — a bite of banana is a party; a whole one is a bellyache.`},
  stasis:  {icon:'🚑', title:`This one's serious`,
    text:`GI stasis is a genuine emergency — a gut that stops moving can turn fatal within a day or two. Unlimited hay keeps things moving; the vet handles the rest.`},
  pellet3: {icon:'🌾', title:'Hay first, always',
    text:`Hay should be roughly 80% of a rabbit's diet — it wears down ever-growing teeth and keeps the gut moving. Pellets are a small daily supplement, not the meal.`},
  cold:    {icon:'🥶', title:'{S} remembers',
    text:`Rabbits hold a grudge — they remember how they're treated, and trust is earned back rather than assumed. Give {o} space, a favourite treat, and a little time.`},
};
// Fact copy can carry pronoun tokens ({S}/{s} subject, {P}/{p} possessive, {O}/{o} object)
// so a card reads right for a doe or a buck. Substituted at display time.
function fillPron(str){
  const p=P();
  return str.replace(/\{S\}/g,cap(p.s)).replace(/\{s\}/g,p.s)
           .replace(/\{P\}/g,cap(p.p)).replace(/\{p\}/g,p.p)
           .replace(/\{O\}/g,cap(p.o)).replace(/\{o\}/g,p.o);
}
let factQueue = [], factShowing = false;
const FACT_NOTE = {feet:'thump', banana3:'sugar', stasis:'stasis', pellet3:'hay', cold:'grudge'};
function fireFact(id){
  if(FACT_NOTE[id]) learnNote(FACT_NOTE[id], true);   // the card itself explains it — no extra toast
  const f = FACTS[id]; if(!f || rab.firedCards[id]) return;
  rab.firedCards[id] = 1; save();
  factQueue.push(id);
  if(!factShowing) showNextFact();
}
function showNextFact(){
  const id = factQueue.shift();
  if(!id){ factShowing=false; return; }
  factShowing = true;
  const f = FACTS[id];
  $('fcIcon').textContent = f.icon; $('fcTitle').textContent = fillPron(f.title); $('fcText').textContent = fillPron(f.text);
  $('factCard').classList.add('show');
}
function dismissFact(){
  $('factCard').classList.remove('show');
  setTimeout(showNextFact, 260);   // slide out, then show any queued card
}
bind('factCard', dismissFact);
$('factCard').addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); dismissFact(); } });

/* ============================================================================ *
 *  Rabbit geometry
 * ============================================================================ */
function parts(){
  const B = BREEDS[rab.breed] || BREEDS.holland;
  const s = rab.curScale * (B.scale||1) * Math.min(W,H)/560 * 0.88;   // ~12% smaller so toys fit
  const cx = rab.x;
  const cr = rab.crouch||0;   // pre-hop anticipation crouch: compress down & wide before launch
  const cy = rab.baseY + rab.hopOff + rab.binkyHop + (rab.playYOff||0) + (rab.boxYOff||0) + cr*5*s;
  const loaf = rab.loaf;
  // squash & stretch: she stretches tall at the peak of a hop and squashes wide on impact/crouch
  const air = Math.max(0, -(rab.hopOff+rab.binkyHop));
  const stretch = clamp(air/70, 0, 0.22);
  const land = rab.landSquash||0;
  const sqX = 1 - stretch*0.5 + land*0.15 + cr*0.14;
  const sqY = 1 + stretch*0.9 - land*0.17 - cr*0.13;
  const bodyRx = 92*s*(1+0.06*loaf)*sqX, bodyRy = 72*s*(1-0.10*loaf)*sqY;
  const bodyCy = cy - bodyRy*0.82;
  // Nose Boop: the head pushes out toward the viewer (reads as a slight swell + dip) and back
  const boop = rab.trick && rab.trick.name==='boop' ? Math.sin(Math.min(1,rab.trick.t/rab.trick.dur)*Math.PI) : 0;
  // Chinning: a few quick downward rubs of the chin against whatever she's claiming
  const chin = now() < rab.chinUntil ? Math.abs(Math.sin(now()*9)) : 0;
  const headR  = 60*s*(B.headScale||1)*(1+0.14*boop);   // big head on a compact body — chibi proportions
  const beg = rab.trick && rab.trick.name==='beg';
  const alert = rab.state==='alert';
  const headCx = cx + (alert? 6*s:0);
  const headCy = bodyCy - bodyRy*0.55 - headR*0.22 + (alert? -8*s:4*s) + (beg? -34*s:0) + loaf*headR*0.18   // nestled low into the body
               + boop*14*s + chin*12*s;
  return {
    s, cx, cy, loaf,
    body:{x:cx, y:bodyCy, rx:bodyRx, ry:bodyRy},
    head:{x:headCx, y:headCy, r:headR},
    feet:{x:cx, y:cy-8*s, r:40*s},
    tail:{x:cx-bodyRx*0.86, y:bodyCy+bodyRy*0.35, r:22*s},
  };
}

/* ============================================================================ *
 *  BACKGROUND — sky / sun / room / props
 * ============================================================================ */
function skyLight(){ return Math.sin(clamp(timeOfDay,0,1)*Math.PI); }

/* ---- colour + light model (light direction is FROM the window) — ported from props-lab v2 ---- */
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
const hx2=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
function shade(hex,t){ const c=hx2(hex),k=[36,26,18]; return `rgb(${Math.round(c[0]*(1-t)+k[0]*t)},${Math.round(c[1]*(1-t)+k[1]*t)},${Math.round(c[2]*(1-t)+k[2]*t)})`; }
const sunX = ()=>clamp(timeOfDay,0,1);
const lightDirX = ()=>(sunX()-0.5)*2;               // −1 morning (sun left) … +1 evening (sun right)
function lightTone(){ const l=skyLight(), day=[255,247,223], gold=[255,181,110], night=[96,120,196];
  return l>0.5 ? mix(gold,day,(l-0.5)/0.5) : mix(night,gold,l/0.5); }
const nightFactor = ()=>clamp((0.22-skyLight())/0.22, 0, 1);   // 0 by day → 1 deep night

/* ---- composition: wall, baseboard, decor ---- */
function drawWall(){
  const fy=world.floorY;
  const g=ctx.createLinearGradient(0,0,0,fy);
  g.addColorStop(0,'#e2cee0'); g.addColorStop(0.62,'#d4bbd5'); g.addColorStop(1,'#c1a5c7');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,fy);
  ctx.save();                                     // subtle wallpaper: faint stripes + dot motif
  ctx.strokeStyle='rgba(255,255,255,.045)'; ctx.lineWidth=1;
  for(let x=W*0.037; x<W; x+=W*0.075){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,fy); ctx.stroke(); }
  ctx.fillStyle='rgba(110,80,115,.06)';
  const sp=Math.max(26,W*0.062);
  for(let yy=sp*0.5; yy<fy; yy+=sp){
    const rowOff=(Math.round(yy/sp)%2)? sp*0.5:0;
    for(let xx=rowOff; xx<W; xx+=sp){ ctx.beginPath(); ctx.arc(xx,yy,1.5,0,7); ctx.fill(); }
  }
  ctx.restore();
  const win=world.win, light=skyLight();          // warm bloom around the window
  const bloom=ctx.createRadialGradient(win.x+win.w/2,win.y+win.h*0.6,8,win.x+win.w/2,win.y+win.h*0.6,win.w*1.9);
  bloom.addColorStop(0,rgba(lightTone(),0.16*light)); bloom.addColorStop(1,'rgba(255,244,214,0)');
  ctx.fillStyle=bloom; ctx.fillRect(0,0,W,fy);
}
function drawBaseboard(){
  const fy=world.floorY;
  ctx.fillStyle='#ece2d2'; ctx.fillRect(0, fy-14, W, 14);
  ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(0, fy-14, W, 2);
  ctx.fillStyle='rgba(70,45,25,.18)'; ctx.fillRect(0, fy-3, W, 3);
}
function drawFrame(x,y,w,kind){
  const h=w*1.15;
  ctx.fillStyle='rgba(60,40,30,.16)'; roundRect(x-w/2+3,y-h/2+5,w,h,4); ctx.fill();
  ctx.fillStyle='#b3854f'; roundRect(x-w/2,y-h/2,w,h,4); ctx.fill();
  ctx.fillStyle='#8f6a3d'; roundRect(x-w/2+3,y-h/2+3,w-6,h-6,3); ctx.fill();
  const sky=ctx.createLinearGradient(0,y-h/2+6,0,y+h/2-6);
  if(kind==='bunny'){ sky.addColorStop(0,'#cfe3f0'); sky.addColorStop(1,'#eef3e6'); }
  else { sky.addColorStop(0,'#f2ddc2'); sky.addColorStop(1,'#e7c59d'); }
  ctx.fillStyle=sky; roundRect(x-w/2+6,y-h/2+6,w-12,h-12,2); ctx.fill();
  if(kind==='bunny'){
    ctx.fillStyle='#9a7a52';
    ctx.beginPath();ctx.ellipse(x,y+h*0.12,w*0.19,w*0.17,0,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse(x,y-h*0.02,w*0.12,w*0.12,0,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse(x-w*0.07,y-h*0.20,w*0.045,w*0.13,-0.15,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+w*0.07,y-h*0.20,w*0.045,w*0.13, 0.15,0,7);ctx.fill();
    ctx.fillStyle='#d9c4a0'; ctx.beginPath();ctx.arc(x+w*0.14,y+h*0.14,w*0.05,0,7);ctx.fill();
  } else {                                          // little carrot still-life
    for(const dx of [-w*0.13, w*0.05]){
      ctx.fillStyle='#5aa64b';
      ctx.beginPath();ctx.moveTo(x+dx, y-h*0.22);ctx.lineTo(x+dx-w*0.05,y-h*0.06);ctx.lineTo(x+dx+w*0.05,y-h*0.06);ctx.closePath();ctx.fill();
      ctx.fillStyle='#e8892b';
      ctx.beginPath();ctx.moveTo(x+dx-w*0.07,y-h*0.05);ctx.lineTo(x+dx+w*0.07,y-h*0.05);ctx.lineTo(x+dx,y+h*0.2);ctx.closePath();ctx.fill();
    }
  }
}
function drawShelf(){
  const sx=W*0.81, sy=H*0.255, sw=W*0.22;   // clear of the enlarged window
  ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(sx-sw/2+3, sy+8, sw, 5);
  ctx.fillStyle='#a97e4e'; roundRect(sx-sw/2, sy, sw, 8, 2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.28)'; ctx.fillRect(sx-sw/2, sy, sw, 2);
  ctx.fillStyle='#7c8fb0'; ctx.fillRect(sx-sw*0.42, sy-16, 26, 16);   // books
  ctx.fillStyle='#b07c8f'; ctx.fillRect(sx-sw*0.42+4, sy-27, 22, 11);
  ctx.fillStyle='rgba(180,210,220,.75)'; roundRect(sx-6, sy-23, 16, 23, 4); ctx.fill();  // jar
  ctx.fillStyle='#caa25a'; ctx.fillRect(sx-6, sy-9, 16, 9);
  ctx.fillStyle='#c86a50'; roundRect(sx+sw*0.30, sy-15, 18, 15, 3); ctx.fill();           // succulent
  ctx.fillStyle='#5fa26a';
  for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.ellipse(sx+sw*0.30+9+i*5, sy-17, 3.6, 9, i*0.4,0,7); ctx.fill(); }
  if(nightFactor()>0.15){          // a little lamp on the shelf when it's dark (the night-glow source)
    ctx.fillStyle='#8a6a45'; ctx.fillRect(sx+sw*0.05-2, sy-6, 4, 6);
    ctx.fillStyle='rgba(255,214,140,.95)'; ctx.beginPath();ctx.moveTo(sx+sw*0.05-9,sy-6);ctx.lineTo(sx+sw*0.05+9,sy-6);ctx.lineTo(sx+sw*0.05+6,sy-18);ctx.lineTo(sx+sw*0.05-6,sy-18);ctx.closePath();ctx.fill();
  }
}
function drawHangingPlant(){
  const hx=W*0.115, potY=H*0.135;
  ctx.strokeStyle='rgba(90,70,50,.5)'; ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(hx-13,0);ctx.lineTo(hx,potY);ctx.moveTo(hx+13,0);ctx.lineTo(hx,potY);ctx.stroke();
  /* trailing vines WITH leaf pairs along them — bare strokes read as a jellyfish */
  const vines=[[-2,1.0],[-1,1.35],[0,1.15],[1,1.45],[2,0.95]];
  for(const [i,len] of vines){
    const sx0=hx+i*5, sy0=potY+10;
    const ex=hx+i*9, ey=potY+34*len+Math.abs(i)*8;
    ctx.strokeStyle='#579a60'; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(sx0, sy0);
    ctx.quadraticCurveTo(hx+i*12, potY+20*len, ex, ey); ctx.stroke();
    ctx.fillStyle='#67ad72';
    for(let k=1;k<=3;k++){
      const t=k/3, lx=sx0+(ex-sx0)*t, ly=sy0+(ey-sy0)*t*t;
      ctx.beginPath(); ctx.ellipse(lx-3, ly,   4.5, 3, -0.5+i*0.1, 0,7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lx+3, ly+2, 4.5, 3,  0.5+i*0.1, 0,7); ctx.fill();
    }
  }
  ctx.lineCap='butt';
  /* pot drawn OVER the vine roots, with a lip and a crown of leaves spilling out */
  ctx.fillStyle='#b9714e'; roundRect(hx-16, potY, 32, 15, 4); ctx.fill();
  ctx.fillStyle='#a05f3e'; roundRect(hx-18, potY-2, 36, 7, 3); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect(hx-16, potY+5, 32, 3);
  ctx.fillStyle='#67ad72';
  for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.ellipse(hx+i*7, potY-5, 7, 5.5, i*0.3,0,7); ctx.fill(); }
  ctx.fillStyle='#579a60';
  for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.ellipse(hx+i*9, potY-2, 6, 4.5, i*0.35,0,7); ctx.fill(); }
}

/* ---- window + sky + sun + stars/moon ---- */
function drawWindow(){
  const light = skyLight(), edge = 1-light, win = world.win, nf=nightFactor();
  ctx.save();
  roundRect(win.x,win.y,win.w,win.h,8); ctx.clip();
  const top = mix([122,178,232],[236,150,86], Math.min(1,edge*1.05));
  const bot = mix([196,224,244],[248,205,150], Math.min(1,edge*1.05));
  const topN=mix(top,[18,22,54],nf), botN=mix(bot,[30,34,70],nf);
  const sg=ctx.createLinearGradient(0,win.y,0,win.y+win.h);
  sg.addColorStop(0,rgb(topN)); sg.addColorStop(1,rgb(botN));
  ctx.fillStyle=sg; ctx.fillRect(win.x,win.y,win.w,win.h);
  if(nf>0.2){                                        // stars
    ctx.fillStyle=`rgba(255,255,255,${0.9*nf})`;
    for(let i=0;i<16;i++){ const sx=win.x+((i*97)%1000)/1000*win.w, sy=win.y+((i*57)%1000)/1000*win.h*0.7;
      ctx.fillRect(sx, sy, 1.6, 1.6); }
  }
  if(nf>0.3){                                        // moon
    ctx.fillStyle=`rgba(238,240,255,${nf})`; ctx.beginPath();ctx.arc(win.x+win.w*0.72,win.y+win.h*0.26,win.w*0.09,0,7);ctx.fill();
  }
  ctx.fillStyle=`rgba(255,255,255,${(0.5*light+0.12)*(1-nf)})`;
  cloud(win.x + win.w*0.32 + Math.sin(timeOfDay*3)*win.w*0.14, win.y+win.h*0.28, win.w*0.12);
  const m = Math.min(win.w,win.h)*0.18, q = clamp(timeOfDay,0,1);
  const sx = win.x + m + (win.w-2*m)*q;
  const sy = (win.y+win.h-m) - Math.sin(q*Math.PI)*(win.h-2*m);
  const sunCol = mix([255,236,140],[255,150,70], Math.min(1,edge*1.1));
  const glow=ctx.createRadialGradient(sx,sy,2,sx,sy,win.w*0.45);
  glow.addColorStop(0,`rgba(${sunCol[0]},${sunCol[1]},${sunCol[2]},${.6*(1-nf)})`);
  glow.addColorStop(1,'rgba(255,220,120,0)');
  ctx.fillStyle=glow; ctx.fillRect(win.x,win.y,win.w,win.h);
  const sa=Math.max(0, 1-nf*1.6);                 // sun fully gone by night (moon takes over)
  if(light>0.02 && sa>0){ ctx.fillStyle=`rgba(${sunCol[0]},${sunCol[1]},${sunCol[2]},${sa})`;
    ctx.beginPath();ctx.arc(sx,sy,Math.min(win.w,win.h)*0.12,0,7);ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle='#f3ede2'; ctx.lineWidth=10; roundRect(win.x,win.y,win.w,win.h,8); ctx.stroke();
  ctx.strokeStyle='rgba(243,237,226,.95)'; ctx.lineWidth=6;
  ctx.beginPath();
  ctx.moveTo(win.x+win.w/2,win.y); ctx.lineTo(win.x+win.w/2,win.y+win.h);
  ctx.moveTo(win.x,win.y+win.h/2); ctx.lineTo(win.x+win.w,win.y+win.h/2); ctx.stroke();
  ctx.fillStyle='#e7ddce'; ctx.fillRect(win.x-8, win.y+win.h, win.w+16, 8);
  ctx.fillStyle='rgba(0,0,0,.10)'; ctx.fillRect(win.x-8, win.y+win.h+8, win.w+16, 4);
}

/* ---- floor ---- */
function drawFloor(){
  const floor=ctx.createLinearGradient(0,world.floorY,0,H);
  floor.addColorStop(0,'#cea06d'); floor.addColorStop(0.6,'#b6844f'); floor.addColorStop(1,'#9c6f3c');
  ctx.fillStyle=floor; ctx.fillRect(0,world.floorY,W,H-world.floorY);
  ctx.strokeStyle='rgba(88,52,22,.20)'; ctx.lineWidth=2;
  for(let i=1;i<7;i++){const y=world.floorY+(H-world.floorY)*i/7;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  /* sparse irregular joins — a regular half-offset grid reads as BRICK, not wood */
  ctx.strokeStyle='rgba(88,52,22,.12)'; ctx.lineWidth=1.5;
  const joins=[0.18,0.62,0.35,0.81,0.09,0.53,0.72,0.27,0.9,0.44,0.66,0.14];
  for(let i=0;i<6;i++){
    const y0=world.floorY+(H-world.floorY)*i/7, y1=world.floorY+(H-world.floorY)*(i+1)/7;
    for(let j=0;j<2;j++){ const x=joins[(i*2+j)%joins.length]*W;
      ctx.beginPath();ctx.moveTo(x,y0+1);ctx.lineTo(x,y1-1);ctx.stroke(); }
  }
  /* faint wavy grain streaks inside each plank — kills the "flat vinyl" read */
  ctx.strokeStyle='rgba(88,52,22,.07)'; ctx.lineWidth=1;
  for(let i=0;i<7;i++){
    const y0=world.floorY+(H-world.floorY)*i/7, rh=(H-world.floorY)/7;
    for(let k=0;k<3;k++){
      const gx=((joins[(i+k*3)%joins.length]+k*0.31)%1)*W, gy=y0+rh*(0.28+0.22*k);
      ctx.beginPath(); ctx.moveTo(gx-W*0.06,gy);
      ctx.quadraticCurveTo(gx,gy-2, gx+W*0.06,gy+1); ctx.stroke();
    }
  }
}
/* ---- rug ---- */
function drawRug(){
  const r=world.rug;
  const rc = (rab.decor && rab.decor.rug==='rose') ? ['#e6afbf','#cd8599','#ad5f77'] : ['#7bb0a4','#5f958c','#4d7d75'];
  const rg=ctx.createRadialGradient(r.x,r.y,4,r.x,r.y,r.rx);
  rg.addColorStop(0,rc[0]);rg.addColorStop(.7,rc[1]);rg.addColorStop(1,rc[2]);
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx,r.ry,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx*0.82,r.ry*0.82,0,0,7);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx*0.55,r.ry*0.55,0,0,7);ctx.stroke();
  /* braided-rug stitch marks: short angled dashes along concentric rings */
  ctx.save();
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx,r.ry,0,0,7);ctx.clip();
  ctx.strokeStyle='rgba(25,50,45,.11)'; ctx.lineWidth=2;
  for(let ring=0.93; ring>0.12; ring-=0.13){
    const n=Math.round(34*ring);
    for(let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2 + ring*3;
      const x1=r.x+Math.cos(a)*r.rx*ring, y1=r.y+Math.sin(a)*r.ry*ring;
      const a2=a+0.05/ring;
      ctx.beginPath(); ctx.moveTo(x1,y1);
      ctx.lineTo(r.x+Math.cos(a2)*r.rx*(ring-0.045), r.y+Math.sin(a2)*r.ry*(ring-0.045));
      ctx.stroke();
    }
  }
  ctx.restore();
  /* darker rim grounds the rug so it doesn't float on the wood */
  ctx.strokeStyle='rgba(20,40,36,.25)'; ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx-1.5,r.ry-1.5,0,0,7);ctx.stroke();
}

/* soft directional cast shadow, offset away from the sun (used per-prop in drawRoom) */
function castShadow(x,y,rx,ry){
  // A soft, GROUNDED shadow (radial falloff = darker at the contact core, fading at the edges) that
  // leans only slightly with the sun, so it stays connected under the prop instead of detaching.
  ry = ry || rx*0.26;
  const dir=lightDirX();                       // −1 morning … +1 evening
  const lean=-dir*rx*0.20;                      // gentle lean away from the sun; base stays under the item
  const w=rx*(1+Math.abs(dir)*0.16);
  const a=0.15+0.07*skyLight();
  const g=ctx.createRadialGradient(x+lean*0.4, y, ry*0.18, x+lean, y, w);
  g.addColorStop(0, `rgba(22,14,7,${a})`);
  g.addColorStop(0.6, `rgba(22,14,7,${a*0.72})`);
  g.addColorStop(1, 'rgba(22,14,7,0)');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(x+lean, y, w, ry, 0,0,7); ctx.fill();
}

/* ---- night mood: blue multiply + warm shelf-lamp glow (NOT the zoomies drawNight) ---- */
function drawRoomNight(){
  const nf=nightFactor(); if(nf<=0) return;
  ctx.save(); ctx.globalCompositeOperation='multiply';
  ctx.fillStyle=rgba([64,80,146], 0.52*nf); ctx.fillRect(0,0,W,H); ctx.restore();
  const lx=W*0.81, ly=H*0.255;                 // warm glow from the shelf lamp (must match drawShelf's sx/sy)
  const glow=ctx.createRadialGradient(lx,ly,4,lx,ly,W*0.5);
  glow.addColorStop(0, rgba([255,208,128], 0.55*nf)); glow.addColorStop(1, rgba([255,208,128],0));
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle=glow; ctx.fillRect(0,0,W,H); ctx.restore();
}


function drawSky(){
  // Interior wall + wall decor, then the window pane (sky/sun/stars). Ported from props-lab v2.
  drawWall(); drawWallArt(); drawShelf();
  drawFrame(W*0.885, H*0.42, Math.min(56,W*0.055), 'carrot');
  drawHangingPlant();
  drawWindow();
}
function cloud(x,y,r){
  ctx.beginPath();
  ctx.arc(x,y,r,0,7); ctx.arc(x+r,y+4,r*0.8,0,7);
  ctx.arc(x-r,y+5,r*0.7,0,7); ctx.arc(x+r*0.4,y-r*0.5,r*0.7,0,7);
  ctx.fill();
}
// a little framed portrait on the wall — a cosy touch of home
function drawWallArt(){ drawFrame(W*0.115, H*0.365, Math.min(74,W*0.072), 'bunny'); }

function drawRoom(){
  // baseboard + outlet at the wall/floor join, floor, the rug, then the props — each gets a
  // directional cast shadow via prop() that shifts with the sun (the cast light was removed).
  drawBaseboard();
  drawOutlet();   // permanent wall outlet (the charger plugs in here when the hazard event fires)
  drawFloor();
  drawRug();
  const w=world;
  if(owns('tower'))  prop(w.tower.x,  w.tower.y+w.tower.r*0.24, w.tower.r*0.95, drawTower);
  if(owns('hutch'))  prop(w.hutch.x,  w.hutch.y+w.hutch.r*0.73, w.hutch.r*1.15, drawHutch);
  if(owns('hammock'))prop(w.hammock.x,w.hammock.y+3, w.hammock.w*0.16, drawHammock);
  if(owns('tunnel')) prop(w.tube.x,   w.tube.y+w.tube.h*0.52, w.tube.w*0.46, drawTube);
  prop(w.bed.x, w.bed.y+w.bed.r*0.62, w.bed.r*0.95, drawBed);
  prop(w.litter.x, w.litter.y+w.litter.h*0.5, w.litter.w*0.5, drawLitter);
  prop(w.food.x, w.food.y+w.food.r*0.5, w.food.r*1.05, drawFoodBowl);
  prop(w.water.x, w.water.y+w.water.r*0.5, w.water.r*1.05, drawWaterBowl);
  if(owns('castle')) prop(w.castle.x, w.castle.y+w.castle.r*0.24, w.castle.r*1.05, drawCastle);
  if(owns('ball'))   prop(w.ball.x, w.ball.y+w.ball.r*0.9, w.ball.r*1.1, drawBall);
}
function prop(x,y,rx,fn){ castShadow(x,y,rx); fn(); }
// soft contact shadow so furniture reads as sitting ON the floor, not floating
function groundShadow(x,y,rx){
  ctx.fillStyle='rgba(40,25,12,.18)';
  ctx.beginPath();ctx.ellipse(x,y,rx,rx*0.22,0,0,7);ctx.fill();
}
function drawLitterFront(){
  const L=world.litter;
  ctx.fillStyle='#3f6fae'; roundRect(L.x-L.w/2, L.y+L.h*0.02, L.w, L.h*0.5, 8); ctx.fill();
  ctx.fillStyle='#5a86c2'; roundRect(L.x-L.w/2+6, L.y+L.h*0.08, L.w-12, L.h*0.36, 6); ctx.fill();
  ctx.strokeStyle='#cbb24e'; ctx.lineWidth=2;
  for(let i=0;i<9;i++){const bx=L.x-L.w*0.32+i*L.w*0.08; ctx.beginPath();ctx.moveTo(bx,L.y+L.h*0.05);ctx.lineTo(bx+3,L.y+L.h*0.05-9);ctx.stroke();}
}
function drawTower(){
  const c=world.tower, r=c.r;
  ctx.fillStyle='#6f5436';
  ctx.fillRect(c.x-r*0.62, c.y-r*1.5, r*0.13, r*1.7); ctx.fillRect(c.x+r*0.5, c.y-r*1.5, r*0.13, r*1.7);
  for(let i=0;i<3;i++){
    const py=c.y - i*r*0.72;
    ctx.fillStyle= i%2? '#9a7a52':'#87693f';
    roundRect(c.x-r*0.75, py-r*0.14, r*1.5, r*0.28, 4); ctx.fill();
    ctx.strokeStyle=shade(i%2?'#9a7a52':'#87693f',0.5); ctx.lineWidth=1.5; ctx.stroke();
    ctx.strokeStyle='rgba(70,45,20,.22)'; ctx.lineWidth=1;   // grain on each platform
    ctx.beginPath();ctx.moveTo(c.x-r*0.55, py+r*0.02);ctx.lineTo(c.x+r*0.2, py+r*0.02);ctx.stroke();
    ctx.beginPath();ctx.moveTo(c.x-r*0.1, py+r*0.08);ctx.lineTo(c.x+r*0.6, py+r*0.08);ctx.stroke();
    ctx.fillStyle='#6f9e93'; roundRect(c.x-r*0.7, py-r*0.2, r*1.4, r*0.1, 3); ctx.fill();
  }
  // celLight removed: an unclipped highlight ellipse overhangs the prop and reads as a halo/bubble
}
function drawHutch(){
  const c=world.hutch, r=c.r;
  const baseY=c.y+r*0.7;
  ctx.fillStyle='#b58a5a'; roundRect(c.x-r*0.95, c.y-r*0.6, r*1.9, r*1.3, 6); ctx.fill();
  ctx.strokeStyle=shade('#b58a5a',0.45); ctx.lineWidth=2; roundRect(c.x-r*0.95, c.y-r*0.6, r*1.9, r*1.3, 6); ctx.stroke();
  ctx.strokeStyle='rgba(90,60,30,.3)';ctx.lineWidth=1.5;
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(c.x-r*0.95,c.y-r*0.6+i*r*0.43);ctx.lineTo(c.x+r*0.95,c.y-r*0.6+i*r*0.43);ctx.stroke();}
  /* vertical grain ticks between the plank lines */
  ctx.strokeStyle='rgba(90,60,30,.16)';ctx.lineWidth=1;
  for(const gx of [-0.62,-0.2,0.33,0.7]){
    ctx.beginPath();ctx.moveTo(c.x+gx*r, c.y-r*0.56);ctx.lineTo(c.x+gx*r+2, c.y+r*0.66);ctx.stroke();
  }
  ctx.fillStyle='#8a5f38';
  ctx.beginPath();ctx.moveTo(c.x-r*1.1, c.y-r*0.55);ctx.lineTo(c.x, c.y-r*1.3);ctx.lineTo(c.x+r*1.1, c.y-r*0.55);ctx.closePath();ctx.fill();
  ctx.strokeStyle=shade('#8a5f38',0.5); ctx.lineWidth=2; ctx.stroke();
  /* shingle courses on the roof */
  ctx.strokeStyle='rgba(50,32,16,.28)'; ctx.lineWidth=1.5;
  for(const t of [0.33,0.66]){
    const hw=r*1.1*(1-t), yy=c.y-r*0.55-r*0.75*t;
    ctx.beginPath();ctx.moveTo(c.x-hw,yy);ctx.lineTo(c.x+hw,yy);ctx.stroke();
  }
  ctx.fillStyle='#2a1f16';
  ctx.beginPath();
  ctx.moveTo(c.x-r*0.42, baseY);
  ctx.lineTo(c.x-r*0.42, c.y-r*0.05);
  ctx.arc(c.x, c.y-r*0.05, r*0.42, Math.PI, 0);
  ctx.lineTo(c.x+r*0.42, baseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(200,170,90,.8)'; ctx.lineWidth=2;
  for(let i=0;i<5;i++){const sx=c.x-r*0.3+i*r*0.15;
    ctx.beginPath();ctx.moveTo(sx,baseY+4);ctx.lineTo(sx+4,baseY+9);ctx.stroke();}
  // celLight removed: an unclipped highlight ellipse overhangs the prop and reads as a halo/bubble
}
// The hammock renders in two passes so she can lie INSIDE it: drawHammock() is the
// stand + the pouch (drawn behind her in the room pass); drawHammockFront() is the
// near lip, drawn over her lower body after the rabbit so she reads as tucked in.
function hammockGeo(){
  const hm=world.hammock, w=hm.w, px=hm.x, py=hm.y, sy=hm.sy;
  const occupied = !!rab.inHammock;
  // the sling sags deeper under her weight and springs back up when empty (damped
  // in the tick as rab.hammockSag; the lab has no tick, so it falls back to state)
  const sag = (rab.hammockSag!=null) ? rab.hammockSag : (occupied?1:0);
  const low = w*(0.31 + 0.06*sag);
  return {hm,w,px,py,sy,low,occupied,legSpread:w*0.15};
}
function drawHammock(){
  const {w,px,py,sy,low,occupied}=hammockGeo();
  const capR=w*0.05, ty=sy-w*0.05;
  /* stands: solid A-legs with a low crossbar for structure */
  ctx.strokeStyle='#7a5a38'; ctx.lineCap='round';
  for(const dir of [-1,1]){
    const topx=px+dir*w/2;
    ctx.lineWidth=Math.max(5,w*0.055);
    ctx.beginPath();ctx.moveTo(topx-w*0.13, py);ctx.lineTo(topx, ty);ctx.lineTo(topx+w*0.13, py);ctx.stroke();
    ctx.lineWidth=Math.max(3,w*0.03);
    ctx.beginPath();ctx.moveTo(topx-w*0.09, py-w*0.09);ctx.lineTo(topx+w*0.09, py-w*0.09);ctx.stroke();
  }
  ctx.lineCap='butt';
  /* cloth: one deep sling anchored AT the caps */
  const grad=ctx.createLinearGradient(0,ty,0,ty+low*1.7);
  grad.addColorStop(0,'#c86a80'); grad.addColorStop(1,'#a3465c');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(px-w/2, ty);
  ctx.quadraticCurveTo(px, ty+low*1.85, px+w/2, ty);
  ctx.quadraticCurveTo(px, ty+low*0.95, px-w/2, ty);
  ctx.fill();
  /* fabric fold lines */
  ctx.strokeStyle='rgba(255,255,255,.16)'; ctx.lineWidth=2;
  for(const k of [0.45,0.75]){
    ctx.beginPath();
    ctx.moveTo(px-w*0.33, ty+low*0.5*k);
    ctx.quadraticCurveTo(px, ty+low*1.55*k, px+w*0.33, ty+low*0.5*k);
    ctx.stroke();
  }
  /* post caps ON TOP of the cloth ends — the cloth visibly wraps them */
  for(const dir of [-1,1]){
    const topx=px+dir*w/2;
    ctx.fillStyle='#5f4526'; ctx.beginPath();ctx.arc(topx,ty,capR,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.25)'; ctx.beginPath();ctx.arc(topx-capR*0.3,ty-capR*0.3,capR*0.35,0,7);ctx.fill();
  }
  // empty sling shows the SAME near lip it has when she's in it, so the hammock
  // always reads as a deep pouch (not a shallow cloth with a floating pillow)
  if(!occupied) drawHammockFront();
}
function drawHammockFront(){
  const {w,px,sy,low}=hammockGeo();
  const ty=sy-w*0.05;
  const grad=ctx.createLinearGradient(0,ty+low*0.5,0,ty+low*1.9);
  grad.addColorStop(0,'#d67d92'); grad.addColorStop(1,'#a3465c');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(px-w/2, ty);
  ctx.quadraticCurveTo(px, ty+low*1.9, px+w/2, ty);
  ctx.quadraticCurveTo(px, ty+low*1.16, px-w/2, ty);
  ctx.fill();
  ctx.strokeStyle='#e493a4'; ctx.lineWidth=Math.max(3,w*0.028);
  ctx.beginPath();ctx.moveTo(px-w/2, ty);ctx.quadraticCurveTo(px, ty+low*1.16, px+w/2, ty);ctx.stroke();
}

function drawLitter(){
  // The box is ALWAYS shown from the front — the same 3/4 view you get when she
  // sits in it — instead of flipping to a top-down tray when empty. This draws
  // the interior (back wall + hay); drawLitterFront() supplies the near wall,
  // called at the end here when she's OUTSIDE, or over her when she's inside.
  const L=world.litter, x=L.x, w=L.w, h=L.h, top=L.y-L.h/2;
  // interior back wall, with a lit top rim
  ctx.fillStyle='#2c4a7c'; roundRect(x-w/2, top, w, h*0.64, 8); ctx.fill();
  ctx.strokeStyle=shade('#3f6fae',0.5); ctx.lineWidth=2; roundRect(x-w/2, top, w, h*0.64, 8); ctx.stroke();
  ctx.fillStyle='#5a86c2'; roundRect(x-w/2+3, top+2, w-6, h*0.07, 5); ctx.fill();
  // hay bed rising against the back wall — alfalfa (young rabbits) is greener and leafier than
  // timothy; the mix sits in between
  const bright=hayFresh>0?1:0.75;
  const hayK = rab.hayType==='alfalfa'?1 : rab.hayType==='mixed'?0.5 : 0;
  ctx.fillStyle= hayK===1?'#d5dcb4' : hayK?'#dedcbc' : '#e7dcc4'; roundRect(x-w/2+5, top+h*0.16, w-10, h*0.5, 6); ctx.fill();
  ctx.fillStyle='rgba(18,32,58,.16)'; roundRect(x-w/2+5, top+h*0.16, w-10, 6, 5); ctx.fill();
  // hay sprigs standing up out of the bed
  for(let i=0;i<26;i++){
    const bx=x-w/2+9+((i*29)%Math.max(6,w-18));
    const by=top+h*0.24+((i*13)%(h*0.3));
    ctx.strokeStyle=`hsl(${72+hayK*28+((i*11)%26)},${58+hayK*6}%,${(46+((i*7)%15))*bright}%)`;
    ctx.lineWidth=2;
    const ang=((i%5)-2)*0.3;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.sin(ang)*11,by-13);ctx.stroke();
    // alfalfa is leafy: small clover-like leaves on some sprigs (fewer in the mix)
    if(hayK && i%(hayK===1?2:4)===0){
      ctx.fillStyle=`hsl(${108+((i*7)%14)},48%,${40*bright+6}%)`;
      ctx.beginPath();ctx.ellipse(bx+Math.sin(ang)*11, by-13, 3.2, 2, ang, 0, 7);ctx.fill();
    }
  }
  const mess = Math.round((100-stats.hygiene)/13);
  const dsz = (rab.sick||unwell()) ? 0.62 : 1;   // a slowing gut → fewer, SMALLER droppings (a real early sign)
  for(let i=0;i<mess;i++){
    const mx=x-w/2+10+((i*37)%Math.max(6,w-20));
    const my=top+h*0.22+((i*23)%(h*0.3));
    ctx.fillStyle= i%3? 'rgba(110,80,45,.85)':'rgba(140,112,66,.7)';
    ctx.beginPath();ctx.ellipse(mx,my,5*dsz,3.4*dsz,0.5,0,7);ctx.fill();
  }
  if(!(now() < rab.boxT)) drawLitterFront();   // near wall — unless she's inside (drawn over her instead)
}
function drawFoodBowl(){
  const b=world.food;
  ctx.fillStyle='#7d5230'; ctx.beginPath();ctx.ellipse(b.x,b.y+b.r*0.35,b.r,b.r*0.5,0,0,7);ctx.fill();
  ctx.fillStyle='#9a6a3e'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.fill();
  ctx.strokeStyle=shade('#9a6a3e',0.4); ctx.lineWidth=1.5; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.stroke();
  ctx.fillStyle='#6a4527'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r*0.78,b.r*0.42,0,0,7);ctx.fill();
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2, rr=b.r*0.5*Math.sqrt(((i*7)%10)/10);
    ctx.fillStyle=`hsl(28,45%,${34+((i*5)%16)}%)`;
    ctx.beginPath();ctx.ellipse(b.x+Math.cos(a)*rr,b.y+Math.sin(a)*rr*0.55,3.2,4.4,a,0,7);ctx.fill();
  }
}
function drawWaterBowl(){
  const b=world.water;
  ctx.fillStyle='#5a5f6a'; ctx.beginPath();ctx.ellipse(b.x,b.y+b.r*0.32,b.r,b.r*0.5,0,0,7);ctx.fill();
  ctx.fillStyle='#7b818c'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.fill();
  ctx.strokeStyle=shade('#7b818c',0.4); ctx.lineWidth=1.5; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.stroke();
  const lvl = stats.water/100;
  const wr=b.r*0.72*Math.max(0.25,lvl), wry=b.r*0.4*Math.max(0.25,lvl);
  ctx.fillStyle='rgba(90,170,220,.9)';
  ctx.beginPath();ctx.ellipse(b.x,b.y,wr,wry,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.4)';           // ambient sheen
  ctx.beginPath();ctx.ellipse(b.x-b.r*0.2,b.y-b.r*0.06,b.r*0.22,b.r*0.09,0,0,7);ctx.fill();
  const sp=0.35+0.6*skyLight();                    // specular glint that tracks the light
  ctx.fillStyle=`rgba(255,255,255,${sp})`;
  ctx.beginPath();ctx.arc(b.x+lightDirX()*wr*0.4, b.y-wry*0.35, b.r*0.08, 0,7);ctx.fill();
}
/* PADDED PET BED, side-on (like the litter box). Both variants are a soft torus:
   a tall BACK bolster, a sunken CUSHION pillow, and a lower FRONT bolster drawn
   last. drawBedFront() re-draws just that front bolster over the napping rabbit,
   so the front functions must own their geometry. Bolsters are fat round-capped
   arcs — soft tubes, not a hard wall — cel-shaded in base/shadow/highlight bands. */
function bedGeo(){
  const b=world.bed;
  return { b, oy:b.y-b.r*0.18, R:b.r };   // oy = the rim opening plane
}
const BED_ROSE='#c85f78';
// short strokes ACROSS a bolster tube at intervals → tufted fabric, not a smooth ring.
function bolsterTufts(cx0,cy0,rx,ry,th0,th1,nr){
  ctx.strokeStyle='rgba(120,45,65,.26)'; ctx.lineWidth=Math.max(1.2,rx*0.035); ctx.lineCap='round';
  const steps=5;
  for(let i=0;i<steps;i++){
    const th=th0+(th1-th0)*(i+0.5)/steps, c=Math.cos(th), s=Math.sin(th);
    const cx=cx0+rx*c, cy=cy0+ry*s;
    ctx.beginPath();ctx.moveTo(cx-c*nr, cy-s*nr*0.85);ctx.lineTo(cx+c*nr, cy+s*nr*0.85);ctx.stroke();
  }
  ctx.lineCap='butt';
}
// FRONT bolster — the near padded rim, also redrawn over the napping rabbit
function drawBasicBedWall(){
  const {b,oy,R}=bedGeo();
  ctx.lineCap='round';
  ctx.strokeStyle=shade(BED_ROSE,0.22); ctx.lineWidth=R*0.25;                                  // base
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.12, R*0.82, R*0.30, 0, 0.03*Math.PI, 0.97*Math.PI);ctx.stroke();
  ctx.strokeStyle=BED_ROSE; ctx.lineWidth=R*0.17;                                              // rounded face
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.10, R*0.82, R*0.30, 0, 0.06*Math.PI, 0.94*Math.PI);ctx.stroke();
  ctx.strokeStyle='rgba(255,214,224,.36)'; ctx.lineWidth=R*0.045;                              // soft matte sheen
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.075, R*0.82, R*0.30, 0, 0.15*Math.PI, 0.85*Math.PI);ctx.stroke();
  ctx.lineCap='butt';
  bolsterTufts(b.x, oy+R*0.10, R*0.82, R*0.30, 0.14*Math.PI, 0.86*Math.PI, R*0.12);            // tufted seams
}
// FRONT bolster for the cloud bed — a scalloped lip of merged puffs
function drawCloudFrontPuffs(){
  const {b,oy,R}=bedGeo();
  const p=new Path2D();
  p.ellipse(b.x, oy+R*0.20, R*0.72, R*0.15, 0, 0, Math.PI*2);                                  // base ribbon → puffs merge, no gap
  for(let i=0;i<=6;i++){
    const ang=Math.PI*(0.06+0.88*i/6);
    const px=b.x+Math.cos(ang)*R*0.74, py=oy+R*0.15+Math.sin(ang)*R*0.26;
    const br=R*(0.17+0.05*Math.sin(i*1.7));
    p.moveTo(px+br,py); p.arc(px,py,br,0,Math.PI*2);
  }
  ctx.fillStyle='#e9eff9'; ctx.fill(p);
  ctx.save(); ctx.clip(p);
  ctx.fillStyle='rgba(150,168,205,.20)';                                                       // underside shade
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.36, R*0.9, R*0.18, 0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.4)';                                                        // soft top catch
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.07, R*0.66, R*0.10, 0,0,7);ctx.fill();
  ctx.restore();
}
function drawBed(){
  const {b,oy,R}=bedGeo();
  if(rab.decor && rab.decor.bed==='cloud'){
    // BACK cloud bolster — merged scallops across the top, on a solid body
    const back=new Path2D();
    back.ellipse(b.x, oy, R*0.80, R*0.26, 0, 0, Math.PI*2);
    for(let i=0;i<=7;i++){
      const ang=Math.PI*(1.08+0.84*i/7);
      const px=b.x+Math.cos(ang)*R*0.80, py=oy+Math.sin(ang)*R*0.30;
      const br=R*(0.20+0.06*Math.sin(i*1.9));
      back.moveTo(px+br,py); back.arc(px,py,br,0,Math.PI*2);
    }
    ctx.fillStyle='#dbe4f3'; ctx.fill(back);
    ctx.save(); ctx.clip(back);
    ctx.fillStyle='rgba(255,255,255,.5)';
    ctx.beginPath();ctx.ellipse(b.x-R*0.2, oy-R*0.22, R*0.5, R*0.22, -0.1,0,7);ctx.fill();
    ctx.fillStyle='rgba(150,168,205,.16)';
    ctx.beginPath();ctx.ellipse(b.x, oy+R*0.16, R*0.8, R*0.2, 0,0,7);ctx.fill();
    ctx.restore();
    // CUSHION — a soft matte pale-blue pillow, sunk in the hollow
    ctx.fillStyle='#c9d6ec';
    ctx.beginPath();ctx.ellipse(b.x, oy+R*0.10, R*0.54, R*0.19, 0,0,7);ctx.fill();
    ctx.fillStyle='#e7eefa';
    ctx.beginPath();ctx.ellipse(b.x, oy+R*0.07, R*0.48, R*0.15, 0,0,7);ctx.fill();
    ctx.fillStyle='rgba(150,168,205,.22)';                                                     // back-bolster overhang
    ctx.beginPath();ctx.ellipse(b.x, oy+R*0.00, R*0.46, R*0.11, 0, Math.PI, 2*Math.PI);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.beginPath();ctx.ellipse(b.x-R*0.10, oy+R*0.10, R*0.22, R*0.06, 0,0,7);ctx.fill();
    drawCloudFrontPuffs();
    return;
  }
  // BASIC bed — BACK bolster (fat arc across the top, raised taller than the front)
  ctx.lineCap='round';
  ctx.strokeStyle=shade(BED_ROSE,0.36); ctx.lineWidth=R*0.32;                                  // base (recedes)
  ctx.beginPath();ctx.ellipse(b.x, oy-R*0.03, R*0.82, R*0.30, 0, Math.PI, 2*Math.PI);ctx.stroke();
  ctx.strokeStyle=shade(BED_ROSE,0.10); ctx.lineWidth=R*0.23;                                  // face
  ctx.beginPath();ctx.ellipse(b.x, oy-R*0.05, R*0.82, R*0.30, 0, 1.04*Math.PI, 1.96*Math.PI);ctx.stroke();
  ctx.strokeStyle='#ec91a6'; ctx.lineWidth=R*0.07;                                             // top highlight
  ctx.beginPath();ctx.ellipse(b.x, oy-R*0.08, R*0.82, R*0.30, 0, 1.10*Math.PI, 1.90*Math.PI);ctx.stroke();
  ctx.lineCap='butt';
  bolsterTufts(b.x, oy-R*0.05, R*0.82, R*0.30, 1.14*Math.PI, 1.86*Math.PI, R*0.11);            // tufted seams
  // CUSHION — a soft cream pillow, wide so the bolster reads as a rim (not a tube)
  ctx.fillStyle='#e6cba8';
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.09, R*0.66, R*0.25, 0,0,7);ctx.fill();
  ctx.fillStyle='#f4e6cf';
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.06, R*0.61, R*0.22, 0,0,7);ctx.fill();
  ctx.fillStyle='rgba(150,110,70,.20)';                                                        // back-bolster overhang
  ctx.beginPath();ctx.ellipse(b.x, oy-R*0.03, R*0.57, R*0.15, 0, Math.PI, 2*Math.PI);ctx.fill();
  ctx.fillStyle='rgba(255,250,240,.5)';
  ctx.beginPath();ctx.ellipse(b.x-R*0.14, oy+R*0.10, R*0.32, R*0.10, 0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(150,110,70,.16)';ctx.lineWidth=1.2;                                    // pillow seam ring
  ctx.beginPath();ctx.ellipse(b.x, oy+R*0.07, R*0.40, R*0.12, 0,0,7);ctx.stroke();
  drawBasicBedWall();
}
/* the bed's near side, redrawn over the rabbit while she naps in it (cf. drawHammockFront) */
function drawBedFront(){
  if(rab.decor && rab.decor.bed==='cloud'){ drawCloudFrontPuffs(); return; }
  drawBasicBedWall();
}
function drawTube(){
  const tb=world.tube;
  const g=ctx.createLinearGradient(0,tb.y-tb.h/2,0,tb.y+tb.h/2);
  g.addColorStop(0,'#7ea9d6'); g.addColorStop(0.5,'#5b83b4'); g.addColorStop(1,'#3f5f8c');
  ctx.fillStyle=g; roundRect(tb.x-tb.w/2,tb.y-tb.h/2,tb.w,tb.h,tb.h*0.5); ctx.fill();
  ctx.strokeStyle=shade('#3f5f8c',0.35); ctx.lineWidth=2; roundRect(tb.x-tb.w/2,tb.y-tb.h/2,tb.w,tb.h,tb.h*0.5); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=3;
  for(let i=1;i<4;i++){const x=tb.x-tb.w/2+i*tb.w/4;
    ctx.beginPath();ctx.ellipse(x,tb.y,tb.h*0.22,tb.h*0.48,0,-1.35,1.35);ctx.stroke();}
  for(const dir of [-1,1]){
    const ex=tb.x+dir*(tb.w/2-tb.h*0.30);
    ctx.fillStyle='#31517e';
    ctx.beginPath();ctx.ellipse(ex,tb.y,tb.h*0.30,tb.h*0.485,0,0,7);ctx.fill();
    ctx.fillStyle='#1c1426';
    ctx.beginPath();ctx.ellipse(ex,tb.y,tb.h*0.24,tb.h*0.42,0,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.10)';
    ctx.beginPath();ctx.ellipse(ex-dir*tb.h*0.05,tb.y-tb.h*0.10,tb.h*0.10,tb.h*0.22,0,0,7);ctx.fill();
  }
  // celLight removed: an unclipped highlight ellipse overhangs the prop and reads as a halo/bubble
}
function drawCastle(){
  const c=world.castle, r=c.r;
  ctx.fillStyle='#c79a5e'; roundRect(c.x-r,c.y-r*1.1,r*2,r*1.3,6); ctx.fill();
  ctx.strokeStyle=shade('#c79a5e',0.4); ctx.lineWidth=2; roundRect(c.x-r,c.y-r*1.1,r*2,r*1.3,6); ctx.stroke();
  /* corrugated-cardboard fluting — says "cardboard", not "sandstone block" */
  ctx.strokeStyle='rgba(120,85,40,.16)'; ctx.lineWidth=2;
  for(let i=1;i<10;i++){const fx=c.x-r+i*r*0.2;
    ctx.beginPath();ctx.moveTo(fx, c.y-r*1.05);ctx.lineTo(fx, c.y+r*0.15);ctx.stroke();}
  ctx.fillStyle='#b0824a'; for(let i=0;i<4;i++){ctx.fillRect(c.x-r+i*r*0.55, c.y-r*1.3, r*0.32, r*0.28);}
  ctx.fillStyle='#3a2a1c'; ctx.beginPath();ctx.ellipse(c.x,c.y-r*0.2,r*0.42,r*0.5,0,0,7);ctx.fill();
  // celLight removed: an unclipped highlight ellipse overhangs the prop and reads as a halo/bubble
}
function drawBall(){
  const b={x:(ballAnim?ballAnim.x:world.ball.x), y:(ballAnim?ballAnim.y:world.ball.y), r:world.ball.r};
  ctx.fillStyle='#e2a3c0'; ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();
  ctx.fillStyle='#c67ea0';
  for(let i=0;i<6;i++){const a=i/6*7;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*b.r*0.5,b.y+Math.sin(a)*b.r*0.5,b.r*0.16,0,7);ctx.fill();}
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.arc(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.24,0,7);ctx.fill();
}

function drawAmbient(){
  const edge=1-skyLight();
  const vig=ctx.createRadialGradient(W*0.5,H*0.52,H*0.32,W*0.5,H*0.52,H*0.82);
  vig.addColorStop(0,'rgba(20,10,20,0)');
  vig.addColorStop(1,`rgba(18,8,16,${0.14+edge*0.10})`);
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
}

/* ============================================================================ *
 *  DAILY EVENTS — hide-and-seek mornings + the phone-charger hazard
 * ============================================================================ */
function rollDailyEvent(){
  dayEvent=null; rab.hidden=false; hazardFlash=0;
  const roll=Math.random();
  if(roll<0.22){ startHideEvent(); return 'hide'; }
  if(roll<0.40){ startHazardEvent(); return 'hazard'; }
  return null;
}
/* --- Hide & seek --- */
function startHideEvent(){
  const spots=[
    {x:world.bed.x,    y:world.bed.y-6,    name:'the cozy bed'},
    {x:world.litter.x, y:world.litter.y-6, name:'the litter box'},
  ];
  // she only hides behind furniture that actually exists in the room
  if(owns('tunnel')) spots.push({x:world.tube.x,   y:world.tube.y-6,   name:'the play tunnel'});
  if(owns('castle')) spots.push({x:world.castle.x, y:world.castle.y-6, name:'the cardboard castle'});
  if(owns('tower'))  spots.push({x:world.tower.x,  y:world.tower.y-6,  name:'the climbing tower'});
  if(owns('hutch'))  spots.push({x:world.hutch.x,  y:world.hutch.y+world.hutch.r*0.4, name:'the wooden hutch'});
  dayEvent={type:'hide', spot:pick(spots), found:false};
  rab.hidden=true; rab.x=dayEvent.spot.x; rab.hopping=false; rab.loaf=0;
}
function findRabbit(px,py){
  if(!dayEvent || dayEvent.type!=='hide') return false;
  const d=Math.hypot(px-dayEvent.spot.x, py-dayEvent.spot.y);
  if(d<80){
    rab.hidden=false; rab.x=dayEvent.spot.x;
    addCarrots(8, rab.x, rab.baseY-60); addXP(10); stats.happy=clamp(stats.happy+10);
    startBinky();
    toast(`🎉 Found ${rab.name} behind ${dayEvent.spot.name}! Peekaboo! (+8🥕)`);
    dayEvent=null; save();
  } else {
    toast(d<180 ? '🔥 Warmer… keep looking!' : '❄️ Colder — try somewhere else.');
  }
  return true;   // consume the tap while hiding
}
function drawHideHint(t){
  if(!dayEvent || dayEvent.type!=='hide') return;
  const sx=dayEvent.spot.x, sy=dayEvent.spot.y, wig=Math.sin(t*3)*2;
  ctx.fillStyle=coat.body;
  ctx.beginPath();ctx.ellipse(sx-7, sy-16+wig, 4,11,-0.1,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+7, sy-16-wig, 4,11, 0.1,0,7);ctx.fill();
  ctx.fillStyle=coat.pointMid;
  ctx.beginPath();ctx.ellipse(sx-7, sy-16+wig, 2,7,-0.1,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+7, sy-16-wig, 2,7, 0.1,0,7);ctx.fill();
  if(Math.random()<0.02) spawnSparkle(sx+rand(-10,10), sy-6);
}
/* --- Phone-charger hazard --- */
// The wall outlet is a PERMANENT fixture of the room (drawn on the baseboard in drawRoom); only
// the charger cord + phone appear when the hazard fires, plugged into that fixed outlet.
function outletPos(){ return {x: Math.max(24, W*0.085), y: world.floorY - 18}; }
function drawOutlet(){
  const o=outletPos();
  ctx.fillStyle='#efe6d4'; roundRect(o.x-9, o.y-13, 18, 26, 3); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=1.5; roundRect(o.x-9, o.y-13, 18, 26, 3); ctx.stroke();
  ctx.fillStyle='#4a4a4a'; ctx.fillRect(o.x-3.5, o.y-7, 2.5, 6); ctx.fillRect(o.x+1, o.y-7, 2.5, 6);
}
function startHazardEvent(){
  const o=outletPos();
  dayEvent={type:'hazard', cord:{x:o.x+78, y:H*0.80}, secured:false, chewed:false, nearT:0, nextTemptt:now()+rand(4,8)};
}
function tapCord(px,py){
  if(!dayEvent || dayEvent.type!=='hazard' || dayEvent.secured || dayEvent.chewed) return false;
  if(Math.hypot(px-dayEvent.cord.x, py-dayEvent.cord.y) < 64){
    dayEvent.secured=true; dayEvent.doneAt=now();   // unplugged — fades out, then gone
    addCarrots(6, rab.x, rab.baseY-60); addXP(8); stats.happy=clamp(stats.happy+4);
    toast(`✅ Unplugged and put away! ${rab.name} is safe. (+6🥕)`);
    save();
    return true;
  }
  return false;
}
function hazardShock(){
  dayEvent.chewed=true;
  stats.happy=clamp(stats.happy-16); rab.health=clamp(rab.health-14); rab.thumps=clamp(rab.thumps+1,0,5);
  triggerThump(); hazardFlash=0.5;
  const p=parts(); spawnStars(p.head.x,p.head.y);
  toast(`⚡ ZAP! ${rab.name} chewed the charger cord and got a scare! Rabbit-proof your cords.`);
  save();
}
function drawBegBubble(){
  if(now() >= rab.begUntil || rab.hidden || rab.play || rab.cold) return;
  const p=parts();
  const bob = Math.sin(now()*2.6)*2.2;                       // gentle idle float
  const bx=p.head.x, by=p.head.y - p.head.r*1.45 + bob;      // snug above the head
  const grow = clamp((now() - rab.begAt)/0.22, 0, 1);        // pop-in: grows from when the bubble appeared
  const sc = 0.6 + 0.4*grow;
  ctx.save(); ctx.translate(bx,by); ctx.scale(sc,sc); ctx.translate(-bx,-by);
  // connecting tail first (so the bubble body caps it)
  ctx.fillStyle='rgba(255,255,255,.97)';
  ctx.beginPath();ctx.moveTo(bx-7,by+10);ctx.lineTo(bx+7,by+10);ctx.lineTo(bx-1, by+24);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=1.5;
  roundRect(bx-24, by-19, 48, 33, 12); ctx.fill(); ctx.stroke();
  ctx.font='23px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(rab.begWant||'🍌', bx, by-1); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.restore();
}
function tickEvent(dt,t){
  if(!dayEvent || dayEvent.type!=='hazard' || dayEvent.secured || dayEvent.chewed) return;
  const c=dayEvent.cord;
  if(Math.abs(rab.x-c.x) < 42 && !rab.hopping){
    dayEvent.nearT += dt;
    if(dayEvent.nearT > 1.6) hazardShock();
  } else {
    dayEvent.nearT = Math.max(0, dayEvent.nearT-dt);
    if(t>dayEvent.nextTemptt && !rab.hopping && !rab.cold && rab.state!=='rest' && rab.state!=='tummy'){
      dayEvent.nextTemptt = t + rand(5,10);
      hopTo(c.x+22);   // curiosity: hops toward the tempting cord
    }
  }
}
function drawHazard(){
  if(!dayEvent || dayEvent.type!=='hazard') return;
  // once unplugged, linger with a ✅ for a couple of seconds, then clear entirely
  let fade=1;
  if(dayEvent.secured){
    const el=now()-(dayEvent.doneAt||0);
    if(el>2.5){ dayEvent=null; return; }
    fade=clamp(1-el/2.5, 0, 1);
  }
  const c=dayEvent.cord, o=outletPos();
  ctx.save(); ctx.globalAlpha=fade;
  // the cord: plug at the (permanent) outlet, drooping down the wall, snaking along the floor to the phone
  ctx.strokeStyle = dayEvent.chewed? '#a8452f' : '#242424';
  ctx.lineWidth=3; ctx.lineCap='round';
  if(!dayEvent.secured){
    ctx.fillStyle='#242424'; roundRect(o.x-5, o.y+1, 10, 9, 2); ctx.fill();            // plug body at the outlet
    ctx.beginPath(); ctx.moveTo(o.x, o.y+9);
    ctx.bezierCurveTo(o.x, c.y-6, c.x-46, c.y+10, c.x-2, c.y+2);                        // wall droop → floor snake
    ctx.stroke();
  }
  ctx.lineCap='butt';
  ctx.fillStyle='#20242a'; roundRect(c.x-9, c.y-13, 18, 30, 3); ctx.fill();            // phone
  ctx.fillStyle='#3a6ea5'; roundRect(c.x-7, c.y-11, 14, 24, 1); ctx.fill();
  ctx.textAlign='center';
  if(dayEvent.secured){ ctx.font='16px system-ui'; ctx.fillText('✅', c.x, c.y-20); }
  else if(dayEvent.chewed){ ctx.font='16px system-ui'; ctx.fillText('⚡', c.x, c.y-20); }
  else { const a=0.3+0.35*Math.sin(now()*4); ctx.strokeStyle=`rgba(255,90,60,${a})`; ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(c.x, c.y, 26, 0,7);ctx.stroke(); }
  ctx.textAlign='left'; ctx.restore();
}

/* ============================================================================ *
 *  THE RABBIT
 * ============================================================================ */
function sableGrad(x,y,r,inner,outer){
  const g=ctx.createRadialGradient(x,y,r*0.15,x,y,r);
  g.addColorStop(0,inner);g.addColorStop(0.55,inner);g.addColorStop(1,outer);
  return g;
}

function drawRabbit(t){
  const p = parts();
  const s = p.s;

  const air = (rab.hopOff+rab.binkyHop);
  const shSc = clamp(1 + air/220, 0.55, 1);
  if(!(t < rab.boxT) && !rab.inHammock && !rab.inBed){   // no ground shadow in the litter box, hammock, or bed
    ctx.fillStyle=`rgba(0,0,0,${0.22*shSc})`;
    ctx.beginPath();ctx.ellipse(p.cx, rab.baseY+6, p.body.rx*0.95*shSc, 15*s*shSc, 0,0,7);ctx.fill();
  }

  let rot=0;
  if(rab.trick && rab.trick.name==='spin') rot = (rab.trick.t/rab.trick.dur)*Math.PI*2;
  if(rab.trick && rab.trick.name==='flop') rot = Math.min(1,rab.trick.t/0.45)*1.35;
  if(rab.binkyT>0 && !rab.hurdle){const pr=1-rab.binkyT/rab.binkyDur; rot += Math.sin(pr*Math.PI*2)*0.22;}

  ctx.save();
  if(rot){ctx.translate(p.cx,p.body.y);ctx.rotate(rot);ctx.translate(-p.cx,-p.body.y);}

  if(rab.state==='cold'){ drawRabbitBack(p,t); ctx.restore(); return; }

  const tummy = rab.state==='tummy' || rab.sick;
  const resting = rab.state==='rest';
  const flopped = rab.trick && rab.trick.name==='flop';
  const breath = Math.sin(rab.breath)*2*s;

  ctx.fillStyle=sableGrad(p.tail.x,p.tail.y,p.tail.r, coat.point, coat.pointMid);
  ctx.beginPath();ctx.ellipse(p.tail.x,p.tail.y,p.tail.r,p.tail.r*0.95,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(40,34,28,.4)';
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;
    ctx.beginPath();ctx.arc(p.tail.x+Math.cos(a)*p.tail.r*0.8,p.tail.y+Math.sin(a)*p.tail.r*0.8,p.tail.r*0.28,0,7);ctx.fill();}
  // fluffy white cottontail puff (all breeds)
  ctx.fillStyle='rgba(250,248,240,.95)';
  ctx.beginPath();ctx.arc(p.tail.x - p.tail.r*0.12, p.tail.y - p.tail.r*0.08, p.tail.r*0.55, 0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.55)';
  ctx.beginPath();ctx.arc(p.tail.x - p.tail.r*0.32, p.tail.y - p.tail.r*0.3, p.tail.r*0.22, 0,7);ctx.fill();

  const bg=ctx.createRadialGradient(p.body.x-p.body.rx*0.3,p.body.y-p.body.ry*0.4,p.body.ry*0.2,
                                    p.body.x,p.body.y,p.body.rx*1.15);
  bg.addColorStop(0,coat.hi);bg.addColorStop(0.6,coat.body);bg.addColorStop(1,coat.bodySh);
  ctx.fillStyle=bg;
  ctx.beginPath();ctx.ellipse(p.body.x,p.body.y+breath,p.body.rx,p.body.ry-breath*0.4,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.26)';
  ctx.beginPath();ctx.ellipse(p.body.x-p.body.rx*0.18,p.body.y-p.body.ry*0.25,p.body.rx*0.5,p.body.ry*0.4,0,0,7);ctx.fill();
  // a soft round haunch on the rear so the body reads bunny-shaped, not egg-shaped
  ctx.strokeStyle='rgba(60,45,32,.16)'; ctx.lineWidth=3*s;
  ctx.beginPath();ctx.ellipse(p.cx-p.body.rx*0.42, p.body.y+p.body.ry*0.22, p.body.rx*0.40, p.body.ry*0.52, -0.12, -1.5, 1.35);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.10)';
  ctx.beginPath();ctx.ellipse(p.cx-p.body.rx*0.46, p.body.y+p.body.ry*0.05, p.body.rx*0.26, p.body.ry*0.30, -0.12, 0, 7);ctx.fill();

  // Broken (white + brown): irregular brown spots on the white base, clipped to the torso.
  // Each row is [ux,uy centre (fraction of body rx/ry), rx-frac, ry-frac]; asymmetry sells it.
  if(coat.broken){
    ctx.save();
    ctx.beginPath();ctx.ellipse(p.body.x,p.body.y+breath,p.body.rx,p.body.ry-breath*0.4,0,0,7);ctx.clip();
    const PATCH=[[ 0.30,-0.06, 0.60, 0.72],   // right rump saddle
                 [-0.42, 0.20, 0.40, 0.48],   // low left flank spot
                 [ 0.00,-0.44, 0.30, 0.24]];  // small speckle near the shoulders
    for(const [ux,uy,fx,fy] of PATCH){
      const cx=p.body.x+ux*p.body.rx, cy=p.body.y+uy*p.body.ry, pr=p.body.rx*fx;
      const pg=ctx.createRadialGradient(cx-pr*0.3,cy-pr*0.35,pr*0.12, cx,cy,pr);
      pg.addColorStop(0,coat.patchHi); pg.addColorStop(0.55,coat.patch); pg.addColorStop(1,coat.patchSh);
      ctx.fillStyle=pg;
      ctx.beginPath();ctx.ellipse(cx,cy,pr,p.body.ry*fy,0,0,7);ctx.fill();
    }
    ctx.restore();
  }

  // Black & tan: a white underside — a low, flat sliver along the belly line (Elvis
  // has white on his belly, not a big chest patch; a large oval + dark paws reads as a skull)
  if(coat.tan){
    ctx.fillStyle=coat.belly || coat.tanCol;
    ctx.globalAlpha=0.92;
    ctx.beginPath();ctx.ellipse(p.body.x, p.body.y+p.body.ry*0.72, p.body.rx*0.4, p.body.ry*0.24, 0,0,7);ctx.fill();
    ctx.globalAlpha=1;
  }

  if(rab.sick){
    ctx.fillStyle='rgba(120,180,90,.18)';
    ctx.beginPath();ctx.ellipse(p.body.x,p.body.y,p.body.rx,p.body.ry,0,0,7);ctx.fill();
  }
  if(rab.state==='tummy'){
    ctx.fillStyle='rgba(120,180,90,.30)';
    ctx.beginPath();ctx.ellipse(p.body.x,p.body.y+breath+8*s,p.body.rx*0.7,p.body.ry*0.55,0,0,7);ctx.fill();
  }

  // Hind feet (the big flat back feet) — drawn IN FRONT at the base so legs read clearly
  if(rab.loaf<0.75){
    const stomp=rab.legStomp;
    const footY = p.body.y + p.body.ry - 8*s;
    drawFoot(p.cx - p.body.rx*0.5, footY, s, 0);
    drawFoot(p.cx + p.body.rx*0.5, footY + stomp*10*s, s, stomp);
  }

  if(rab.loaf<0.75){
    const beg = rab.trick && rab.trick.name==='beg';
    ctx.fillStyle=coat.body;
    const groom = t < rab.groomUntil || t < rab.digUntil;   // digging reuses the busy-paws motion (eyes stay open)
    const pawY = p.body.y+p.body.ry*0.55;
    const pawLift = groom? Math.sin(t*14)*6*s : (beg? -30*s : 0);
    roundedPaw(p.cx-16*s, pawY - pawLift, 13*s);
    roundedPaw(p.cx+16*s, pawY - pawLift, 13*s);
  }

  drawHead(p, t, tummy, groom_(t) || flopped || resting);
  ctx.restore();
}
function groom_(t){ return t < rab.groomUntil; }

function drawFoot(x,y,s,stomp){
  ctx.fillStyle=sableGrad(x,y,26*s, coat.point, coat.bodySh);
  ctx.beginPath();ctx.ellipse(x,y,24*s,15*s,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(40,32,24,.6)';
  for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(x+i*9*s,y+8*s,4*s,0,7);ctx.fill();}
  if(stomp>0.15){
    ctx.fillStyle=`rgba(200,180,150,${0.5*stomp})`;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x+((i-1.5)*12)*s,y+16*s,(4+i*1.5)*s*stomp,0,7);ctx.fill();}
  }
}
function roundedPaw(x,y,r){
  ctx.beginPath();ctx.ellipse(x,y,r,r*0.8,0,0,7);ctx.fill();
  ctx.save();ctx.fillStyle='rgba(50,40,30,.3)';
  ctx.beginPath();ctx.ellipse(x,y+r*0.5,r*0.7,r*0.3,0,0,7);ctx.fill();ctx.restore();
}

function drawHead(p,t,tummy,closedEyes){
  const B = BREEDS[rab.breed] || BREEDS.holland;
  const hx=p.head.x, hy=p.head.y, r=p.head.r, s=p.s;
  const look = rab.state==='alert' ? {x:rab.lookX*8*s, y:rab.lookY*5*s} : {x:0,y:0};
  const droop = rab.sick? 11*s : unwell()? 9*s : 0;   // sick/unwell → ears hang lower
  const eyeCol = coat.eye || '#140f0b';

  // Mane (Lionhead) — fluffy ring drawn BEHIND the head
  if(B.mane) drawMane(hx,hy,r,'back');
  // Upright ears (Netherland / Lionhead) — drawn BEHIND the head, rising above it
  if(B.ears==='up'){ drawUprightEar(hx,hy,r,s,-1,t,B); drawUprightEar(hx,hy,r,s,1,t,B); }

  // Head base + cheeks
  const hg=ctx.createRadialGradient(hx-r*0.3+look.x,hy-r*0.35,r*0.2,hx+look.x,hy,r*1.1);
  hg.addColorStop(0,coat.hi);hg.addColorStop(0.6,coat.body);hg.addColorStop(1,coat.bodySh);
  ctx.fillStyle=hg;
  ctx.beginPath();ctx.ellipse(hx,hy,r,r*0.94,0,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(hx-r*0.7,hy+r*0.3,r*0.42,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(hx+r*0.7,hy+r*0.3,r*0.42,0,7);ctx.fill();
  // a scruffy little fur tuft on the crown
  ctx.beginPath();ctx.arc(hx-r*0.17, hy-r*0.86, r*0.14, 0, 7);ctx.fill();
  ctx.beginPath();ctx.arc(hx+r*0.02, hy-r*0.95, r*0.17, 0, 7);ctx.fill();
  ctx.beginPath();ctx.arc(hx+r*0.20, hy-r*0.84, r*0.12, 0, 7);ctx.fill();

  // Broken (white + brown) face: an asymmetric brown cap over one eye/ear-base plus a soft
  // nose smudge (the "butterfly"). Drawn UNDER the eyes/nose, which paint on top later.
  if(coat.broken){
    ctx.save();
    ctx.beginPath();ctx.ellipse(hx,hy,r,r*0.94,0,0,7);ctx.clip();   // stay on the head
    let cx=hx-r*0.42, cy=hy-r*0.28, rr=r*0.46;                       // cap over the LEFT eye + ear base
    let pg=ctx.createRadialGradient(cx-rr*0.3,cy-rr*0.3,2,cx,cy,rr);
    pg.addColorStop(0,coat.patchHi);pg.addColorStop(0.55,coat.patch);pg.addColorStop(1,coat.patchSh);
    ctx.fillStyle=pg;ctx.beginPath();ctx.ellipse(cx,cy,rr*0.9,rr,-0.2,0,7);ctx.fill();
    cx=hx+look.x; cy=hy+r*0.30;                                      // soft nose smudge, fading out
    pg=ctx.createRadialGradient(cx,cy-r*0.06,2,cx,cy,r*0.32);
    pg.addColorStop(0,coat.patch);pg.addColorStop(0.55,coat.patch);pg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=pg;ctx.beginPath();ctx.ellipse(cx,cy,r*0.26,r*0.30,0,0,7);ctx.fill();
    ctx.restore();
  }

  const nmx=hx+look.x, nmy=hy+r*0.32;
  if(coat.sable){
    const mg=ctx.createRadialGradient(nmx,nmy-r*0.05,2,nmx,nmy,r*0.72);
    mg.addColorStop(0,'rgba(60,52,46,.9)');
    mg.addColorStop(0.45,'rgba(90,80,70,.5)');
    mg.addColorStop(1,'rgba(120,110,100,0)');
    ctx.fillStyle=mg;
    ctx.beginPath();ctx.ellipse(nmx,nmy,r*0.6,r*0.64,0,0,7);ctx.fill();
  }
  // Black & tan markings: like the real Elvis — just a few white highlights tucked
  // under the bottom of each eye (no big white patches; those read as spooky), plus
  // the usual tan muzzle/cheek highlights.
  if(coat.tan){
    const eyeWhite = coat.belly || '#f2ece0';
    ctx.strokeStyle=eyeWhite; ctx.lineWidth=2.6*s; ctx.lineCap='round';
    for(const dir of [-1,1]){
      const ex=hx+dir*r*0.44+look.x*0.6, ey=hy-r*0.02+look.y*0.6;
      ctx.beginPath();ctx.arc(ex,ey, 11.8*s, 0.22*Math.PI, 0.78*Math.PI);ctx.stroke();   // lower-lid crescent (peeks below the bigger eye)
    }
    ctx.lineCap='butt';
    ctx.fillStyle=coat.tanCol;                            // tan highlights (muzzle + cheeks)
    ctx.beginPath();ctx.ellipse(nmx, hy+r*0.5, r*0.26, r*0.2, 0,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(hx-r*0.64, hy+r*0.3, r*0.15,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(hx+r*0.64, hy+r*0.3, r*0.15,0,7);ctx.fill();
  }

  // Lop ears IN FRONT (Holland) — layered over the cheeks so they read clearly
  if(B.ears==='lop'){ drawLopEar(hx, hy+droop, r, s, -1, t); drawLopEar(hx, hy+droop, r, s, 1, t); }
  // Mane front tufts (Lionhead) — chin/neck fluff over the lower face
  if(B.mane) drawMane(hx,hy,r,'front');

  const eyeY=hy-r*0.02, eyeDX=r*0.44;
  ctx.lineWidth=3.4*s;
  for(const dir of [-1,1]){
    const ex=hx+dir*eyeDX+look.x*0.6, ey=eyeY+look.y*0.6;
    if(tummy){
      ctx.strokeStyle='#140f0b';
      ctx.beginPath();ctx.moveTo(ex-6*s,ey-6*s);ctx.lineTo(ex+6*s,ey+6*s);
      ctx.moveTo(ex+6*s,ey-6*s);ctx.lineTo(ex-6*s,ey+6*s);ctx.stroke();
    } else if(rab.petReact>0){          // happy squint ^^ while being petted
      ctx.strokeStyle='#140f0b';
      ctx.beginPath();ctx.arc(ex,ey+3*s,7.4*s, 1.12*Math.PI, 1.88*Math.PI);ctx.stroke();
    } else if(closedEyes || rab.blink>0){
      ctx.strokeStyle='#140f0b';
      ctx.beginPath();ctx.arc(ex,ey,7.4*s,0.15*Math.PI,0.85*Math.PI);ctx.stroke();
    } else if(rab.sick || unwell()){    // dull, half-lidded eyes: a rabbit in discomfort
      ctx.fillStyle=eyeCol;
      ctx.beginPath();ctx.ellipse(ex,ey+2.4*s,8.2*s,5.2*s,0,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.35)';                        // one dim catchlight, no sparkle
      ctx.beginPath();ctx.arc(ex-2.2*s,ey+0.8*s,1.6*s,0,7);ctx.fill();
      ctx.strokeStyle='#140f0b'; ctx.lineWidth=2.6*s; ctx.lineCap='round';   // heavy upper lid
      ctx.beginPath();ctx.moveTo(ex-9*s,ey-2.2*s);ctx.quadraticCurveTo(ex,ey-4.2*s,ex+9*s,ey-2.2*s);ctx.stroke();
      ctx.lineCap='butt'; ctx.lineWidth=3.4*s;
    } else {
      const joy = clamp((stats.happy-70)/30,0,1);          // rounder & brighter when content
      // big glossy anime eyes — the single biggest cuteness lever
      ctx.fillStyle=eyeCol;
      ctx.beginPath();ctx.ellipse(ex,ey,(8.6+joy*0.7)*s,(9.9+joy*0.9)*s,0,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.95)';                        // primary catchlight
      ctx.beginPath();ctx.arc(ex-2.6*s,ey-3.6*s,3.1*s,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.55)';                        // secondary sparkle
      ctx.beginPath();ctx.arc(ex+2.8*s,ey+2.6*s,1.5*s,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.30)';                        // soft lower-iris glow
      ctx.beginPath();ctx.ellipse(ex,ey+4.6*s,4.4*s,2.1*s,0,0,7);ctx.fill();
      // a lowered brow when patience is thin (annoyed)
      if(rab.thumps>=2){
        ctx.strokeStyle=coat.bodySh||'#3a2a20'; ctx.lineWidth=2.8*s; ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(ex+dir*8*s, ey-11.5*s);ctx.lineTo(ex-dir*7*s, ey-7*s);ctx.stroke();
        ctx.lineCap='butt';
      }
    }
  }
  // rosy blush under the eyes — instant charm (skipped while sick/upset tummy)
  if(!tummy && !unwell()){
    ctx.fillStyle='rgba(248,148,158,.38)';
    ctx.beginPath();ctx.ellipse(hx-r*0.60+look.x*0.5, hy+r*0.26+look.y*0.5, r*0.155, r*0.095, -0.1, 0, 7);ctx.fill();
    ctx.beginPath();ctx.ellipse(hx+r*0.60+look.x*0.5, hy+r*0.26+look.y*0.5, r*0.155, r*0.095,  0.1, 0, 7);ctx.fill();
  }

  const tw = Math.sin(rab.noseTwitch)*(rab.state==='alert'?2.2:1)*s;
  const nx=nmx, ny=hy+r*0.30+tw*0.4;
  ctx.fillStyle='#0d0b0a';
  ctx.beginPath();
  ctx.moveTo(nx-6*s, ny-3*s);
  ctx.quadraticCurveTo(nx, ny-4*s, nx+6*s, ny-3*s);
  ctx.lineTo(nx, ny+4*s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.25)';
  ctx.beginPath();ctx.arc(nx-2.4*s,ny-1.4*s,0.9*s,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(nx+2.4*s,ny-1.4*s,0.9*s,0,7);ctx.fill();
  ctx.strokeStyle='rgba(30,22,16,.7)';ctx.lineWidth=2*s;
  ctx.beginPath();ctx.moveTo(nx,ny+4*s);ctx.lineTo(nx,ny+8*s);
  ctx.moveTo(nx,ny+8*s);ctx.quadraticCurveTo(nx-6*s,ny+11*s,nx-9*s,ny+8*s);
  ctx.moveTo(nx,ny+8*s);ctx.quadraticCurveTo(nx+6*s,ny+11*s,nx+9*s,ny+8*s);ctx.stroke();

  if(!tummy){
    ctx.fillStyle='#fdfcf5';
    roundRect(nx-2.7*s, ny+8*s, 2.4*s, 4.3*s, 1*s); ctx.fill();
    roundRect(nx+0.3*s, ny+8*s, 2.4*s, 4.3*s, 1*s); ctx.fill();
    ctx.strokeStyle='rgba(120,110,90,.5)';ctx.lineWidth=0.8*s;
    ctx.beginPath();ctx.moveTo(nx,ny+8.4*s);ctx.lineTo(nx,ny+11.8*s);ctx.stroke();
  }

  ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.4*s;
  for(let i=-1;i<=1;i++){   // whiskers reach past the cheeks so they read against the room
    ctx.beginPath();ctx.moveTo(nx-6*s,ny+tw*0.4+i*3*s);ctx.lineTo(nx-r*1.04,ny-4*s+i*8*s+tw);ctx.stroke();
    ctx.beginPath();ctx.moveTo(nx+6*s,ny+tw*0.4+i*3*s);ctx.lineTo(nx+r*1.04,ny-4*s+i*8*s+tw);ctx.stroke();
  }
}

function drawLopEar(hx,hy,r,s,dir,t){
  const jiggle = Math.sin(t*26 + dir)*(rab.earJiggle||0)*9*s;     // floppy bounce on landing
  const swivel = (dir===rab.earSwivelDir? Math.sin((rab.earSwivel||0)*Math.PI)*8*s : 0);   // occasional single-ear swivel
  const trail  = clamp((rab.earTrail||0)*0.03, -7, 7)*s;          // heavy tips lag the body's vertical motion
  const sway = Math.sin(t*1.4 + dir)*3*s + (rab.state==='alert'? -6*s:0) + jiggle + swivel;
  const baseY = hy - r*0.55;
  const tipX  = hx + dir*r*1.15 + sway;
  const tipY  = hy + r*1.05 - trail;
  const g=ctx.createLinearGradient(hx,baseY,tipX,tipY);
  g.addColorStop(0,coat.body);g.addColorStop(0.5,coat.bodySh);
  g.addColorStop(0.82,coat.pointMid);g.addColorStop(1,coat.point);
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(hx + dir*r*0.22, baseY);
  ctx.quadraticCurveTo(hx+dir*r*1.35, baseY+r*0.1, tipX+dir*r*0.02, tipY-r*0.1);
  ctx.quadraticCurveTo(tipX+dir*r*0.16, tipY+r*0.18, tipX-dir*r*0.16, tipY);
  ctx.quadraticCurveTo(hx+dir*r*0.55, baseY+r*0.75, hx+dir*r*0.55, baseY+r*0.15);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(120,80,70,.2)';
  ctx.beginPath();
  ctx.moveTo(hx+dir*r*0.5,baseY+r*0.05);
  ctx.quadraticCurveTo(hx+dir*r*1.05,baseY+r*0.25,tipX-dir*r*0.02,tipY-r*0.2);
  ctx.quadraticCurveTo(hx+dir*r*0.6,baseY+r*0.6,hx+dir*r*0.55,baseY+r*0.2);
  ctx.closePath();ctx.fill();
}

/* Upright ear (Netherland Dwarf / Lionhead) — a tall rounded ear that splays
   slightly outward, with a soft inner ear (tan on black-&-tan coats). */
function drawUprightEar(hx,hy,r,s,dir,t,B){
  const alert = rab.state==='alert';
  const jiggle = Math.sin(t*24 + dir)*(rab.earJiggle||0)*0.10;    // ears wobble on landing
  const swivel = (dir===rab.earSwivelDir? Math.sin((rab.earSwivel||0)*Math.PI)*0.13 : 0);   // occasional single-ear swivel
  const trail  = clamp((rab.earTrail||0)*0.00035, -0.09, 0.09);   // vertical motion tilts the upright ears
  const sway = Math.sin(t*1.5 + dir)*0.05 + (alert? -0.06 : 0) + jiggle + swivel + dir*trail;
  const baseX = hx + dir*r*0.42, baseY = hy - r*0.42;
  const len = r*(B.earLen||1.15);
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(dir*(0.18 + sway));
  const g=ctx.createLinearGradient(0,0,0,-len);
  if(coat.broken){ g.addColorStop(0,coat.patchHi); g.addColorStop(1,coat.patchSh); }   // broken: brown ears
  else { g.addColorStop(0,coat.body); g.addColorStop(1,coat.pointMid); }
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(0,-len*0.5, r*0.21, len*0.5, 0,0,7); ctx.fill();
  ctx.fillStyle = coat.tan ? coat.tanCol : 'rgba(228,158,158,.85)';   // inner ear
  ctx.beginPath(); ctx.ellipse(0,-len*0.48, r*0.1, len*0.38, 0,0,7); ctx.fill();
  ctx.restore();
}

/* Lion's mane — a fluffy ring of fur tufts. 'back' draws the full halo behind
   the head; 'front' adds chin/neck fluff over the lower face. */
function drawMane(hx,hy,r,layer){
  // ONE solid scalloped shape instead of separate balls — the balls left visible
  // gaps between them as the head moved. A base disc guarantees no holes; the
  // wavy tufts along the rim give the fluffy edge.
  if(layer==='back'){
    const R=r*1.24, n=15;
    const p=new Path2D();
    p.arc(hx,hy,R,0,Math.PI*2);                                  // solid core: gaps impossible
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2;
      const wob=0.8+0.35*Math.sin(i*2.1);
      const br=r*0.24*wob;
      const px=hx+Math.cos(a)*(R-br*0.3), py=hy+Math.sin(a)*(R-br*0.3)*0.98;
      p.moveTo(px+br,py); p.arc(px,py,br,0,Math.PI*2);
    }
    ctx.fillStyle=coat.broken?coat.patch:coat.body; ctx.fill(p);   // broken: brown mane frames the white face
    ctx.save(); ctx.clip(p);                                     // soft ruff shading, clipped
    ctx.fillStyle='rgba(0,0,0,.10)';
    ctx.beginPath();ctx.ellipse(hx, hy+R*0.55, R*1.15, R*0.62, 0,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.10)';
    ctx.beginPath();ctx.ellipse(hx-R*0.3, hy-R*0.45, R*0.55, R*0.4, -0.2,0,7);ctx.fill();
    ctx.restore();
  } else {
    // chin fluff: a scalloped crescent over the lower face — one path, no gaps
    const p=new Path2D(), n=7;
    for(let i=0;i<=n;i++){
      const a=Math.PI*(0.16+0.68*i/n);
      const wob=0.8+0.3*Math.sin(i*2.3);
      const br=r*0.21*wob;
      const px=hx+Math.cos(a)*r*1.02, py=hy+Math.sin(a)*r*1.02;
      p.moveTo(px+br,py); p.arc(px,py,br,0,Math.PI*2);
    }
    ctx.fillStyle=coat.broken?coat.patch:coat.body; ctx.fill(p);   // broken: brown mane frames the white face
  }
}

function drawRabbitBack(p,t){
  const s=p.s;
  const breath=Math.sin(rab.breath)*2*s;
  const bg=ctx.createRadialGradient(p.body.x,p.body.y-p.body.ry*0.3,p.body.ry*0.2,p.body.x,p.body.y,p.body.rx*1.2);
  bg.addColorStop(0,coat.hi);bg.addColorStop(0.65,coat.body);bg.addColorStop(1,coat.bodySh);
  ctx.fillStyle=bg;
  ctx.beginPath();ctx.ellipse(p.body.x,p.body.y+breath,p.body.rx*0.98,p.body.ry*1.05,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(150,120,90,.22)';ctx.lineWidth=6*s;
  ctx.beginPath();ctx.moveTo(p.body.x,p.body.y-p.body.ry*0.7);ctx.lineTo(p.body.x,p.body.y+p.body.ry*0.6);ctx.stroke();
  for(const dir of [-1,1]){
    const ex=p.body.x+dir*p.body.rx*0.5, ey=p.body.y-p.body.ry*0.85;
    const g=ctx.createLinearGradient(ex,ey,ex+dir*20*s,ey+70*s);
    g.addColorStop(0,coat.body);g.addColorStop(0.8,coat.pointMid);g.addColorStop(1,coat.point);
    ctx.fillStyle=g;
    ctx.beginPath();ctx.ellipse(ex,ey+20*s,20*s,34*s,dir*0.3,0,7);ctx.fill();
  }
  const tx=p.body.x, ty=p.body.y+p.body.ry*0.55;
  ctx.fillStyle=sableGrad(tx,ty,30*s,coat.point,coat.pointMid);
  ctx.beginPath();ctx.ellipse(tx,ty,28*s,26*s,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(40,32,24,.5)';
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;
    ctx.beginPath();ctx.arc(tx+Math.cos(a)*24*s,ty+Math.sin(a)*22*s,9*s,0,7);ctx.fill();}
  for(const dir of [-1,1]){drawFoot(p.body.x+dir*p.body.rx*0.62,p.cy-4*s,s,0);}
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.font=`${20*s}px system-ui`;
  ctx.fillText('💢', p.body.x+p.body.rx*0.8, p.body.y-p.body.ry*0.9);
}

function drawMiniBunny(x,y,s,dir,alpha){
  ctx.globalAlpha=alpha;
  ctx.fillStyle=coat.point;
  for(const d of [-1,1]){ctx.beginPath();ctx.ellipse(x-dir*10*s+d*7*s,y-14*s,5*s,12*s,d*0.3,0,7);ctx.fill();}
  ctx.fillStyle=coat.body;
  ctx.beginPath();ctx.ellipse(x,y,20*s,14*s,0,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(x+dir*15*s,y-9*s,11*s,10*s,0,0,7);ctx.fill();
  ctx.fillStyle=coat.pointMid;
  ctx.beginPath();ctx.ellipse(x-dir*18*s,y-2*s,7*s,7*s,0,0,7);ctx.fill();
  ctx.fillStyle='#0d0b0a';
  ctx.beginPath();ctx.arc(x+dir*20*s,y-10*s,1.8*s,0,7);ctx.fill();
  ctx.globalAlpha=1;
}

/* ============================================================================ *
 *  PARTICLES / FX
 * ============================================================================ */
function spawnHeart(x,y){particles.push({type:'heart',x,y,vy:-40,vx:rand(-15,15),life:1.1,t:0});}
function spawnSparkle(x,y){for(let i=0;i<6;i++)particles.push({type:'spark',x,y,vx:rand(-40,40),vy:rand(-40,10),life:.6,t:0});}
function spawnDrop(x,y){for(let i=0;i<7;i++)particles.push({type:'drop',x:x+rand(-10,10),y,vx:rand(-20,20),vy:rand(-10,20),life:.7,t:0});}
function spawnZ(x,y){particles.push({type:'z',x,y,vy:-22,vx:8,life:2,t:0});}
function spawnStars(x,y){for(let i=0;i<5;i++)particles.push({type:'star',x,y,vx:rand(-50,50),vy:rand(-60,-10),life:.9,t:0});}
// small floating sound-words (purr, grind, boop, chomp) — the game has no audio, so sounds are drawn
function spawnWord(x,y,text,col){particles.push({type:'word',x,y,vy:-18,vx:rand(-6,6),life:1.3,t:0,text,col:col||'#fff'});}
function spawnDust(x,y){for(let i=0;i<4;i++)particles.push({type:'dust',x:x+rand(-14,14),y,vx:rand(-30,30),vy:rand(-40,-10),life:.7,t:0});}
function spawnCarrot(x,y,n){particles.push({type:'carrot',x:x??rab.x,y:y??rab.baseY-60,vy:-34,vx:rand(-8,8),life:1.4,t:0,n});}

function twinkle(x,y,r,col){                       // a 4-point sparkle with a bright core
  ctx.fillStyle=col;
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2, rr=(i%2? r*0.38:r);
    const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr; i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath();ctx.arc(x,y,r*0.3,0,7);ctx.fill();
}
function drawParticles(dt){
  ctx.textAlign='center';
  for(const pl of particles){
    pl.t+=dt; pl.x+=pl.vx*dt; pl.y+=pl.vy*dt; pl.vy+=20*dt;
    const a=Math.max(0,1-pl.t/pl.life);
    ctx.globalAlpha=a;
    if(pl.type==='heart'){ const sc=1+Math.sin(pl.t*8)*0.13; ctx.font=`${Math.round(20*sc)}px system-ui`;ctx.fillText('💗',pl.x,pl.y);}
    else if(pl.type==='spark'){ twinkle(pl.x,pl.y, 4+Math.sin(pl.t*18)*1.4, '#ffe9a8'); }
    else if(pl.type==='drop'){ctx.fillStyle='#8fd0f0';ctx.beginPath();ctx.ellipse(pl.x,pl.y,2.6,3.6,0,0,7);ctx.fill();}
    else if(pl.type==='star'){ctx.font='16px system-ui';ctx.fillText('⭐',pl.x,pl.y);}
    else if(pl.type==='z'){ const sz=Math.round(15+pl.t*7); ctx.font=`700 ${sz}px system-ui`;
      const zx=pl.x+Math.sin(pl.t*3)*5;
      ctx.strokeStyle='rgba(120,110,150,.5)'; ctx.lineWidth=2.5; ctx.strokeText('Z',zx,pl.y);
      ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fillText('Z',zx,pl.y); }
    else if(pl.type==='carrot'){ctx.font='bold 16px system-ui';ctx.fillStyle='#e8863a';
      ctx.fillText(`+${pl.n}🥕`,pl.x,pl.y);}
    else if(pl.type==='word'){ ctx.font='italic 700 14px system-ui';
      ctx.strokeStyle='rgba(40,30,25,.55)'; ctx.lineWidth=3; ctx.strokeText(pl.text,pl.x,pl.y);
      ctx.fillStyle=pl.col; ctx.fillText(pl.text,pl.x,pl.y); }
    else if(pl.type==='dust'){ ctx.fillStyle='rgba(150,120,85,.8)'; ctx.beginPath(); ctx.arc(pl.x,pl.y,2.4,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
  }
  ctx.textAlign='left';
  for(let i=particles.length-1;i>=0;i--) if(particles[i].t>=particles[i].life) particles.splice(i,1);

  for(const b of bananas){
    b.life-=dt; ctx.globalAlpha=Math.min(1,b.life);
    ctx.font='30px system-ui';ctx.fillText('🍌',b.x-12,b.y+6); ctx.globalAlpha=1;
  }
  for(let i=bananas.length-1;i>=0;i--) if(bananas[i].life<=0) bananas.splice(i,1);
}

function drawThumpFx(dt){
  for(const r of thumpRipples){
    r.t+=dt; const rad=r.t*260, a=Math.max(0,1-r.t/0.8);
    ctx.strokeStyle=`rgba(224,96,58,${a*0.8})`;ctx.lineWidth=4;
    ctx.beginPath();ctx.ellipse(r.x,r.y,rad,rad*0.35,0,0,7);ctx.stroke();
  }
  for(let i=thumpRipples.length-1;i>=0;i--) if(thumpRipples[i].t>0.8) thumpRipples.splice(i,1);

  if(thumpTextT>0){
    thumpTextT-=dt; const p=parts();
    const scale=1+(1-thumpTextT/0.9)*0.6, a=Math.min(1,thumpTextT/0.9*1.6);
    ctx.save();
    ctx.translate(p.head.x, p.head.y - p.head.r*2.2); ctx.scale(scale,scale);
    ctx.globalAlpha=a; ctx.font='900 44px Arial Black, system-ui'; ctx.textAlign='center';
    ctx.lineWidth=6;ctx.strokeStyle='#3a1e12';ctx.strokeText('THUMP!',0,0);
    ctx.fillStyle='#ffcf5b';ctx.fillText('THUMP!',0,0);
    ctx.restore(); ctx.textAlign='left';
  }
}

/* ============================================================================ *
 *  NIGHT CUTSCENE  (zoomies) — also the daily rollover: age, goals, energy
 * ============================================================================ */
function startNight(){ cutscene={type:'night', t:0, dur:5.5}; }
function endNight(){
  if(!cutscene) return;   // one-shot guard: the daily rollover must never run twice for a single night
  cutscene=null;
  timeOfDay=0.04;
  rab.day++; rab.ageDays++; rab.bananasToday=0; rab.pelletsToday=0;
  $('dayLbl').textContent='Day '+rab.day;
  // overnight: she's starving but rested and refreshed
  stats.hunger=clamp(stats.hunger+52, 55, 100);
  stats.water=clamp(stats.water-16);
  // waking-up joy, plus the promised daily boosts from cosy furniture
  let morningJoy = 18;
  if(owns('castle'))  morningJoy += 4;   // cardboard castle hideout
  if(owns('hutch'))   morningJoy += 5;   // rustic hidey-hutch
  if(owns('hammock')) morningJoy += 8;   // lounged in style all night
  stats.happy=clamp(stats.happy+morningJoy);
  stats.energy=clamp(stats.energy+55, 40, 100);
  rab.cold=false; rab.thumps=clamp(rab.thumps-1,0,5);
  rab.x=world.rug.x;
  // life-stage growth check — shown as a follow-up so the morning toast doesn't clobber it
  const st=stageFor(rab.ageDays);
  const grewTo = (st.key!=='kit' && stageFor(rab.ageDays-1).key!==st.key) ? st : null;
  if(grewTo && grewTo.key==='senior') unlockAch('senior');
  learnNote('zoomies', true);   // the night cutscene itself showed it
  const becameAdult = grewTo && grewTo.key==='adult' && !rab.temper;
  if(becameAdult) settleTemperament();
  if(rab.ageDays>=7) unlockAch('week');
  // Progressive disclosure: the Games tab appears on the morning of day 2 (item 5); individual
  // games then unlock on later days, so re-apply visibility every rollover (Tic-Tac-Toe day 3,
  // Carrot Catch day 4).
  const revealGames = !rab.gamesRevealed && rab.day>=2;
  if(revealGames) rab.gamesRevealed=true;
  const tttNew   = rab.gamesRevealed && rab.day===3;
  const catchNew = rab.gamesRevealed && rab.day===4;
  applyGamesTab();
  // Scheduled vet checkup: due day 5 and every 5 days. If overdue, her health slips and illness
  // risk climbs each morning until the (free) checkup is done — see callVet/completeCheckup.
  const checkupOverdue = rab.day - rab.nextCheckupDay;   // <0 not due · 0 due today · ≥1 overdue
  if(checkupOverdue>=1 && !rab.sick){
    raiseMistake(1);
    rab.health = clamp(rab.health - (10 + checkupOverdue*5));
    if(Math.random() < Math.min(0.7, 0.18 + checkupOverdue*0.18)) getSick();
  }
  addCarrots(6);
  const ev = rollDailyEvent();
  if(ev==='hide'){
    toast(`🔍 Day ${rab.day}! ${rab.name} is hiding somewhere in the room — tap around to find ${P().o}! (+6🥕)`);
  } else if(ev==='hazard'){
    startBinky();
    toast(`⚠️ Day ${rab.day}! A phone charger got left plugged in — ${rab.name} thinks the cord is "spicy hay". Tap it to rabbit-proof it! (+6🥕)`);
  } else {
    startBinky();
    toast(`☀️ Good morning! Day ${rab.day} — ${rab.name} is STARVING but binkying with joy. (+6🥕 daily bonus)`);
  }
  // Fresh goals roll AFTER the morning binky/joy boost, so neither the binky goal nor
  // the 90%-happiness goal starts the day partially complete for free.
  rollGoals();
  happy90Armed=false;
  hayCreditAt=0;   // drop any feeding credit still pending across the rollover
  // Staggered morning follow-ups so each beat is actually read (the toast is single-slot).
  let followT = 3200;
  if(grewTo){ const g=grewTo;
    setTimeout(()=>toast(`🎂 ${rab.name} grew up — now a ${g.name}! ${g.label}`), followT); followT+=3200; }
  if(becameAdult){ const T=temper();
    setTimeout(()=>{ toast(`${T.emoji} ${rab.name} has turned out ${T.name.toLowerCase()}: ${P().s} ${T.desc}.`); learnNote('temper'); }, followT);
    followT+=4200; }
  // hay: finish a gradual switch, or nudge a grown-up who's still on alfalfa
  if(rab.hayType==='mixed' && rab.day - rab.haySwitchDay >= HAY_MIX_DAYS){
    rab.hayType='timothy';
    setTimeout(()=>toast(`🌾 ${rab.name} is fully on Timothy hay now — the right hay for a grown-up rabbit.`), followT); followT+=3200;
  } else if(rab.hayType==='alfalfa' && isAdult()){
    setTimeout(()=>toast(becameAdult
      ? `🌱 Grown up means a new hay: time to start switching ${rab.name} from alfalfa to Timothy Hay (in the 🛒 Shop).`
      : `🌱 ${rab.name} is still on alfalfa — it's too rich for an adult. Timothy Hay is in the 🛒 Shop.`), followT); followT+=3600;
  }
  if(revealGames){
    setTimeout(()=>toast('🎮 New! The Games tab just opened in the bottom bar — tap 🎮 Games for arcade minigames and extra 🥕.'), followT); followT+=3200; }
  if(tttNew){
    setTimeout(()=>toast(`⭕ New game unlocked: Bunny Tic-Tac-Toe! Find it in the 🎮 Games tab — beat ${P().o} to earn 🥕.`), followT); followT+=3200; }
  if(catchNew){
    setTimeout(()=>toast('🥕 New game unlocked: Carrot Catch! Slide the bunny to catch falling carrots (dodge the wilted lettuce). In 🎮 Games.'), followT); followT+=3200; }
  if(checkupOverdue===0){
    setTimeout(()=>toast(`🩺 ${rab.name} is due for a wellness checkup today — it's free. Tap 🩺 Vet in the Health tab.`), followT); followT+=3200; }
  else if(checkupOverdue>=1 && !rab.sick){
    setTimeout(()=>toast(`⚠️ Checkup overdue (${checkupOverdue}d late)! ${cap(P().p)} health is slipping — see the 🩺 Vet (free) before ${P().s} falls ill.`), followT); followT+=3200; }
  // Growth-moment exit beat: one quiet line right after the day-3 Kit→Junior growth (item 10)
  if(grewTo && grewTo.key==='junior' && !rab.exitBeatShown){
    rab.exitBeatShown=true;
    setTimeout(()=>toast(`💾 ${cap(P().p)} progress saves right here in this browser. Want a backup? There's a save code in the ⚙️ Menu — for when ${P().s} matters to you.`), followT);
  }
  save();
}
function drawNight(dt){
  cutscene.t+=dt;
  const ct=cutscene.t;
  ctx.fillStyle='#0c1030'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,.9)';
  for(let i=0;i<60;i++){
    const sx=(i*89)%W, sy=(i*57)%(world.floorY);
    const tw=0.5+0.5*Math.sin(ct*3+i);
    ctx.globalAlpha=0.3+0.7*tw; ctx.fillRect(sx,sy,2,2);
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='#eef1ff'; ctx.beginPath();ctx.arc(W*0.8,H*0.16,34,0,7);ctx.fill();
  ctx.fillStyle='#0c1030'; ctx.beginPath();ctx.arc(W*0.83,H*0.13,30,0,7);ctx.fill();
  ctx.fillStyle='#14173a'; ctx.fillRect(0,world.floorY,W,H-world.floorY);
  ctx.fillStyle='rgba(60,70,140,.25)';
  ctx.beginPath();ctx.ellipse(world.rug.x,world.rug.y,world.rug.rx,world.rug.ry,0,0,7);ctx.fill();

  const s = Math.min(W,H)/560 * 0.9 * rab.curScale;
  const spd = 5.5;
  for(let k=5;k>=0;k--){
    const tt = ct - k*0.045;
    const zx = W*(0.5 + 0.42*Math.sin(tt*spd));
    const dir = Math.cos(tt*spd)>=0 ? 1 : -1;
    const zy = world.rug.y - Math.abs(Math.sin(tt*spd*2))*(Math.min(W,H)*0.14) - 4;
    drawMiniBunny(zx, zy, s, dir, k===0?1:0.14*(6-k));
  }
  if(Math.sin(ct*spd*2)>0.9) spawnStars(W*(0.5+0.42*Math.sin(ct*spd)), world.rug.y-40);

  const a = ct<0.6? ct/0.6 : (ct>cutscene.dur-0.7? (cutscene.dur-ct)/0.7 : 1);
  ctx.globalAlpha=Math.max(0,a);
  ctx.textAlign='center';
  ctx.font='900 34px Arial Black, system-ui';
  ctx.fillStyle='#ffd95b'; ctx.strokeStyle='#2a1e40'; ctx.lineWidth=6;
  const bob = Math.sin(ct*6)*4;
  ctx.strokeText('🌙 3 A.M. ZOOMIES', W/2, H*0.30+bob);
  ctx.fillText('🌙 3 A.M. ZOOMIES', W/2, H*0.30+bob);
  ctx.font='16px system-ui'; ctx.fillStyle='#cfd3ff';
  ctx.fillText(`${cap(P().s)} runs laps around the room all night long…`, W/2, H*0.30+28+bob);
  ctx.textAlign='left'; ctx.globalAlpha=1;

  drawParticles(dt);
  if(ct>=cutscene.dur) endNight();
}

/* ============================================================================ *
 *  ILLNESS / DIET / HEALTH
 * ============================================================================ */
function owns(id){ return !!rab.items[id]; }
function addWeight(n){ rab.weight = clamp(rab.weight+n, 45, 175); }

const isAdult = () => rab.ageDays >= 7;

/* "Unwell" is the quiet stage before stasis. No HUD chip: the player has to read it from her
   behaviour — refusing treats (above all her favourite), only nibbling hay, fewer/smaller
   droppings, hunched with droopy ears, no binkies, and the odd bout of loud tooth grinding. */
const UNWELL_BELOW = 45;
function unwell(){ return !rab.sick && rab.health < UNWELL_BELOW; }

/* Upbringing tally — only counts while she's a Kit/Junior and her temperament isn't set yet */
function raising(){ return !rab.temper && rab.ageDays < 7; }
function raiseMistake(n){ if(raising()) rab.upbringing.mistakes += n; }
function raiseAffection(n){ if(raising()) rab.upbringing.affection += n; }
function raisePlay(n){ if(raising()) rab.upbringing.play += n; }
function settleTemperament(){
  const u = rab.upbringing;
  rab.temper = u.mistakes >= TEMPER_MISTAKES ? 'skittish'
             : u.affection >= u.play ? 'cuddly' : 'bold';
}

function getSick(){
  if(rab.sick) return;
  rab.sick=true;
  raiseMistake(3);
  rab.thumps=clamp(rab.thumps+0.5,0,5);
  toast(`🤒 ${rab.name} has gone into GI stasis! ${cap(P().s)} needs the Vet — fast.`);
  fireFact('stasis');
  refreshActions();
}
function cureSick(free){
  rab.sick=false; rab.health=clamp(Math.max(rab.health,68));
  if(checkupDueNow()) rab.nextCheckupDay=rab.day+5;   // the emergency visit doubles as the due checkup
  stats.hunger=clamp(stats.hunger-10);
  const p=parts(); for(let i=0;i<5;i++) spawnHeart(p.head.x+rand(-20,20),p.head.y);
  unlockAch('nurse');
  toast(free? `💊 The gut medicine worked — ${rab.name} is recovering. 💚`
            : `🩺 The vet treated ${rab.name}. Recovering nicely. 💚`);
  refreshActions();
}
function collapse(){
  // safety net so neglect stings without a hard game-over
  const lost=Math.floor(rab.carrots*0.5);
  rab.carrots-=lost; rab.sick=false; rab.health=42;
  stats.hunger=40; stats.hygiene=60; rab.thumps=2;
  const p=parts(); spawnStars(p.head.x,p.head.y);
  toast(`🚑 Emergency vet! ${rab.name} pulled through, but it cost ${lost}🥕. Please take better care. 💔`);
  refreshActions();
}
function tickHealth(dt){
  let dh=0;
  if(stats.hunger>90) dh-=2.4*dt;
  if(stats.hygiene<12) dh-=2.4*dt;
  if(stats.water<10)  dh-=1.8*dt;
  if(stats.energy<6)  dh-=1.2*dt;
  // Overweight is a weight problem, not an illness: it's handled by the vet's welfare warnings
  // (checkWeight), not by draining health — so too many pellets can't tip her into "unwell"/stasis.
  // Underweight still drains health: that's starvation.
  if(rab.weight<66) dh-=1.0*dt;
  // recovers a touch quicker when cared for — but once her gut has slowed (unwell), good care
  // only holds the line; it takes a vet visit to turn it around
  if(dh===0 && !rab.sick) dh += (unwell()? 0.15 : 1.8)*dt;
  rab.health=clamp(rab.health+dh);
  // illness only from genuinely sustained neglect
  if(!rab.sick && rab.health<12 && Math.random()<0.35*dt) getSick();
  if(rab.sick){
    rab.health=clamp(rab.health-1.0*dt);
    if(rab.health<=0) collapse();
  }
  // slow drift of weight toward a light "resting burn"
  addWeight(-0.05*dt);
}

/* ---- Weight & welfare (internal weight ~100 = ideal; shown in breed lbs) ---- */
function weightStatus(){
  const B=BREEDS[rab.breed]||BREEDS.holland, ideal=B.idealLbs;
  const lbs=+(ideal*(rab.weight/100)).toFixed(1);
  let band,txt;
  if(rab.weight>160){ band='obese'; txt='dangerously overweight ⚠️'; }
  else if(rab.weight>135){ band='over'; txt='a bit overweight'; }
  else if(rab.weight<72){ band='under'; txt='underweight'; }
  else { band='ok'; txt='a healthy weight 👌'; }
  return {ideal, lbs, band, txt};
}
function checkWeight(dt){
  if(rab.weight>160){
    rab._obeseT += dt;
    if(rab._obeseT>18 && !rab._obeseWarned){        // sustained obesity → a welfare warning
      rab._obeseWarned=true; rab._obeseT=0; rab.weightStrikes++;
      if(rab.weightStrikes>=3){ takenAway('weight'); return; }
      toast(`🩺 Welfare check — ${rab.name} is obese! Warning ${rab.weightStrikes}/2. More hay, fewer pellets/treats, more Play.`);
    }
  } else {
    rab._obeseT=Math.max(0, rab._obeseT-dt);
    if(rab.weight<150) rab._obeseWarned=false;       // reset the episode once slimmed down
  }
}
function onMaxAnger(){
  rab.maxAngerCount++;
  raiseMistake(2);
  if(rab.maxAngerCount>=3){ takenAway('anger'); return; }
  toast(`💢 ${rab.name} is FURIOUS! Rage strike ${rab.maxAngerCount}/2 — 3 and RPS takes ${P().o}! Offer ${P().p} favourite treat.`);
}
function takenAway(reason){
  started=false; wipeSave();
  // tidy up any open minigame (losing Guess can trigger this mid-overlay)
  if(SN.timer){ clearInterval(SN.timer); SN.timer=null; } SN.on=false;
  if(CC.raf){ cancelAnimationFrame(CC.raf); CC.raf=null; } CC.on=false;
  GS.on=false; TTT.on=false; QZ.on=false; SF.on=false; FG.on=false; DG.on=false; DG.over=true; clearInterval(DG.timer);
  minigameActive=false;
  ['snake','guess','ttt','catch','quiz','forage','dig','safe'].forEach(id=>{ const el=$(id); if(el) el.classList.remove('show'); });
  const o=$('rps');
  if(reason==='anger'){
    $('rpsIcon').textContent='🚔'; $('rpsTitle').textContent='Rabbit Protective Services';
    $('rpsMsg').textContent=`${rab.name} flew into a rage one too many times. A neighbour heard the thumping and called RPS — you've been hauled to bunny jail for repeated neglect. 🚔`;
  } else {
    $('rpsIcon').textContent='😔'; $('rpsTitle').textContent="You've been reported";
    $('rpsMsg').textContent=`The vet has found ${rab.name} obese three times. For ${P().p} welfare, ${P().s} has been taken into care. Feed hay, not endless treats. Shame.`;
  }
  o.classList.add('show');
}

/* ============================================================================ *
 *  ACTIONS
 * ============================================================================ */
function toast(msg){
  const el=$('toast');
  const hud=$('hud');                                  // sit just under the live HUD height,
  if(hud) el.style.top=(hud.offsetHeight+10)+'px';     // so it clears the stat bars on any screen
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),3000);
}
function triggerThump(){
  rab.thumpSeen=true;   // the thump has now been demonstrated — cancels the day-2 fallback (item 3b)
  learnNote('thump', !!rab.firedCards.feet);   // quiet if the feet fact card already explained it
  rab.legStomp=1; thumpFx=0.5; thumpTextT=0.9;
  const p=parts(); thumpRipples.push({x:p.cx,y:rab.baseY,t:0}); spawnSparkle(p.feet.x,p.feet.y);
}
function startBinky(){ rab.binkyT=rab.binkyDur; rab.hurdle=false; const p=parts();
  for(let i=0;i<5;i++) spawnHeart(p.head.x+rand(-24,24),p.head.y);
  stats.energy=clamp(stats.energy-4);
  learnNote('binky');
  incGoal('binky'); }
// Hop Over trick: the same leap arc as a binky, but a trained straight jump — no twist, no joy-binky credit
function startHurdle(){ rab.binkyT=rab.binkyDur; rab.hurdle=true; stats.energy=clamp(stats.energy-4); }
const HOP_CROUCH = 0.11;   // anticipation: she compresses for a beat before launching
function hopTo(x){
  rab.hopToX=clamp(x, 80, W-80); rab.hopFromX=rab.x; rab.hopT0=now()+HOP_CROUCH; rab.hopping=true;
  rab.crouchT=1;                                   // deepen the pre-hop crouch until takeoff
  rab.lookXTarget=Math.sign(rab.hopToX-rab.x);
  stats.energy=clamp(stats.energy-1.5);
}
function wake(){ if(rab.state==='rest'){ rab.restUntil=0; } }

// Feeding anti-spam: a short cooldown per food button (the button is visibly disabled in
// updateHUD while it's live), and the hay goal is credited only once she's actually hopped over
// and started eating — not per click. Together these kill the double-click-hay goal exploit.
const FEED_CD = 5;                          // seconds; covers the hop-over + first munch
const feedLock = {hay:0, pellets:0, clean:0, water:0};
let hayCreditAt = 0;                        // when the pending hay-goal credit resolves (0 = none)

// During a hide-and-seek morning she's invisible — block care actions (a stray hay credit,
// a litter box that renders occupied, a queued hop that lands after the reveal) until she's found.
function hiddenBlock(){ if(rab.hidden){ toast(`🔍 Find ${rab.name} first!`); return true; } return false; }
// A sick or unwell rabbit goes off her food — the game's main early-warning sign.
// kind: 'hay' | 'pellets' | a FAV_TREATS key. Returns true if she refused.
function refusesFood(kind){
  const isTreat = !!FAV_TREATS[kind];
  const isFav = kind===rab.favTreat;
  if(!rab.sick && !(unwell() && (isTreat || isFav))) return false;
  const p=parts(); spawnWord(p.head.x+p.head.r, p.head.y-p.head.r*0.4, 'sniff…', '#dfe6ea');
  if(isFav && rab.favKnown){
    toast(`${rab.name} sniffs the ${FAV_TREATS[kind].name.toLowerCase()} and turns away. ${cap(P().s)} NEVER refuses that. Something's wrong. 🩺`);
  } else if(rab.sick){
    toast(`${rab.name} won't touch it. A rabbit that stops eating needs the vet today. 🩺`);
  } else {
    toast(`${rab.name} sniffs it and turns away. Not like ${P().o}…`);
  }
  learnNote('refuse');
  return true;
}
// Favourite-treat reaction: the first time it's a discovery; after that, just extra joy
function favReact(kind){
  if(kind!==rab.favTreat) return false;
  stats.happy=clamp(stats.happy+10);
  const p=parts(); for(let i=0;i<4;i++) spawnHeart(p.head.x+rand(-24,24),p.head.y-10);
  if(!rab.favKnown){
    rab.favKnown=true;
    setTimeout(()=>toast(`💛 ${FAV_TREATS[kind].emoji} That's ${rab.name}'s favourite! Remember it: if ${P().s} ever refuses it, something's wrong.`), 1500);
    learnNote('fav', true);
  }
  return true;
}
// Mark a preference as discovered (once) and tell the player what they learned about their rabbit.
function discoverPref(key, msg){
  if(rab.prefKnown[key]) return;
  rab.prefKnown[key]=true;
  setTimeout(()=>toast(msg), 1500);
  applyGamesTab(); save();
}
// Count one more experience of a favourite; discover it at the PREF_FIND threshold.
function prefHit(key, msg){
  rab.prefCount[key]=(rab.prefCount[key]||0)+1;
  if(rab.prefCount[key]>=PREF_FIND[key]) discoverPref(key, msg);
}
// A dislike: mild annoyance (never a big thump), throttled; the first time reveals what it is.
function annoyed(key, msg){
  const t=now(); if(t-rab.lastAnnoyed<1.4) return;
  rab.lastAnnoyed=t;
  rab.thumps=clamp(rab.thumps+0.35,0,5); stats.happy=clamp(stats.happy-4);
  const p=parts(); spawnWord(p.head.x+p.head.r*0.8, p.head.y-p.head.r*0.6, 'hmph', '#ffd6c9');
  if(!rab.prefKnown.dislike) discoverPref('dislike', msg);
  checkThreshold();
}
function giveHay(){
  if(hiddenBlock()) return;
  if(rab.cold){ coldRefuse(); return; }
  if(now()<feedLock.hay) return;            // still munching the last serving — ignore
  feedLock.hay = now()+FEED_CD;
  wake();
  if(refusesFood('hay')) return;
  if(unwell()){                              // off her food: a few strands, then she walks away
    stats.hunger=clamp(stats.hunger-14);
    hayFresh=6; hayCreditAt = now()+0.8;
    hopTo(world.litter.x);
    toast(`${rab.name} nibbles a few strands of hay and wanders off.`);
    learnNote('refuse');
    return;
  }
  stats.hunger=clamp(stats.hunger-40);
  stats.happy=clamp(stats.happy+4);
  rab.thumps=clamp(rab.thumps-0.4,0,5);
  // hay is the healthy staple and trims weight — except rich alfalfa on a grown-up rabbit
  const richHay = rab.hayType==='alfalfa' && isAdult();
  addWeight(richHay ? 2.2 : -1.6);
  hayFresh=6; addXP(3); addCarrots(1, rab.x, rab.baseY-70);
  hayCreditAt = now()+0.8;                  // goal counts only once she's hopped over & eating
  hopTo(world.litter.x);
  rab.boxT = now() + 8;                     // hops over and climbs into the box to munch
  const H=HAY_TYPES[rab.hayType];
  toast(richHay ? `Fresh alfalfa in the box. ${rab.name} loves it, but it's too rich for a grown-up rabbit — time for Timothy Hay from the Shop. 🌱`
                : `Fresh ${H.name} in the box! ${rab.name} climbs in to munch. ${H.emoji}`);
  if(richHay) learnNote('haytypes');
}
function givePellets(){
  if(hiddenBlock()) return;
  if(rab.cold){ coldRefuse(); return; }
  if(now()<feedLock.pellets) return;        // one scoop per cooldown
  feedLock.pellets = now()+FEED_CD;
  wake();
  if(refusesFood('pellets')) return;
  if(unwell()){
    stats.hunger=clamp(stats.hunger-8); hopTo(world.food.x);
    toast(`${rab.name} picks at a couple of pellets and leaves the rest.`);
    learnNote('refuse');
    return;
  }
  stats.hunger=clamp(stats.hunger-26);
  stats.happy=clamp(stats.happy+6);
  rab.pelletsToday++;
  // pellets are a 1–2×/day supplement; a 3rd+ scoop piles on the weight
  if(rab.pelletsToday<=2){ addWeight(2.5); }
  else { addWeight(7); toast(`⚠️ That's ${P().p} ${ord(rab.pelletsToday)} scoop of pellets today — too many! Pellets are 1–2×/day; hay should be the main food.`); fireFact('pellet3'); }
  addXP(2);
  hopTo(world.food.x);
  spawnHeart(parts().head.x, parts().head.y);
  if(rab.pelletsToday<=2) toast(`A scoop of dry pellets (${rab.pelletsToday}/2 today). ${cap(P().s)} nose-dives into the bowl. 🥣`);
}
function giveWater(){
  if(now()<feedLock.water) return;          // one refill per cooldown — no XP/happy farming on a held button
  feedLock.water = now()+FEED_CD;
  wake();
  stats.water=100;
  rab.thumps=clamp(rab.thumps-0.2,0,5);
  addXP(1); incGoal('water');
  spawnDrop(world.water.x, world.water.y-10);
  toast('Fresh, clean water. 💧');
}
function offerBanana(){
  if(hiddenBlock()) return;
  wake(); rab.begUntil=0;
  const p=parts();
  bananas.push({x:rab.x+rand(-10,10), y:rab.baseY-10, life:3});
  if(rab.cold){
    if(rab.favTreat==='banana') forgive('banana');
    else toast(`${rab.name} sniffs the banana but stays turned away. It'll take ${P().p} favourite treat.`);
    return;
  }
  if(refusesFood('banana')) return;
  if(rab.bananasToday>=2){
    raiseMistake(1);
    rab.tummyUntil=now()+5; rab.state='tummy';
    stats.happy=clamp(stats.happy-14); stats.hunger=clamp(stats.hunger+8);
    rab.thumps=clamp(rab.thumps+0.6,0,5);
    rab.health=clamp(rab.health-8); addWeight(6);
    toast(`That's ${P().p} 3rd banana — tummy ache! 🤢 Too much sugar hurts ${P().p} gut. (max 2/day)`);
    fireFact('banana3');
    return;
  }
  rab.bananasToday++;
  stats.happy=clamp(stats.happy+22); stats.hunger=clamp(stats.hunger-6);
  rab.thumps=clamp(rab.thumps-1,0,5); addWeight(5); addXP(2);
  startBinky();
  favReact('banana');
  toast(`Banana! A full-body binky of joy. (${rab.bananasToday}/2 today)`);
}
function cleanLitter(){
  if(now()<feedLock.clean) return;          // one scoop per cooldown — no XP/happy farming on a held button
  feedLock.clean = now()+FEED_CD;
  wake();
  stats.hygiene=100; rab.thumps=clamp(rab.thumps-0.6,0,5);
  let bonus = owns('groom')? 10 : 4;
  stats.happy=clamp(stats.happy+bonus);
  addXP(owns('groom')?4:2); incGoal('clean');
  spawnSparkle(world.litter.x, world.litter.y);
  if(rab.sick || unwell()){
    toast(`Hardly anything to scoop: only a few small droppings. ${rab.name}'s gut may be slowing down.`);
    learnNote('droppings'); return;
  }
  toast(owns('groom')
    ? 'Scooped & groomed — spotless coat, extra-happy bun. ✨🪮'
    : 'Litter box scooped & fresh. Hygiene restored. ✨');
}
function togglePetting(){
  pettingMode=!pettingMode;
  if(pettingMode && groomMode) setGroom(false);   // the two drag modes are mutually exclusive
  $('bPet').classList.toggle('armed',pettingMode);
  $('game').classList.remove('grooming');
  $('game').style.cursor = pettingMode ? 'grab' : 'default';   // hand cursor while petting
  toast(pettingMode? 'Petting ON — drag over the HEAD (never the feet!).' : 'Petting off.');
  // Day-1 bait: once she's been armed for petting, arm one scripted feet-out flop (item 3a)
  if(pettingMode && !rab.petArmedOnce){
    rab.petArmedOnce=true;
    if(rab.day===1 && !rab.baitDone) rab.baitAt = now()+rand(5,8);
  }
}
// Grooming: drag a comb over her coat to restore Hygiene. Extra effective with the Grooming Kit.
function setGroom(on){
  groomMode=on;
  $('bGroom').classList.toggle('armed',on);
  $('game').classList.toggle('grooming',on);          // custom comb cursor (CSS)
  if(on){ $('bPet').classList.remove('armed'); }      // caller cleared pettingMode
  else if(!pettingMode){ $('game').style.cursor='default'; }
}
function toggleGrooming(){
  if(!groomMode && pettingMode){ pettingMode=false; $('bPet').classList.remove('armed'); $('game').style.cursor=''; }
  setGroom(!groomMode);
  toast(groomMode
    ? (owns('groom') ? `Grooming ON — drag the comb over ${P().p} coat. The Grooming Kit makes it extra soothing. 🪮`
                     : `Grooming ON — drag over ${P().p} coat to tidy ${P().p} fur and lift Hygiene. 🪮`)
    : 'Grooming off.');
}
function handleGroom(px,py){
  if(!groomMode || rab.cold || rab.state==='tummy') return;
  const p=parts();
  const dFeet=Math.hypot(px-p.feet.x, py-p.feet.y);
  const dTail=Math.hypot(px-p.tail.x, py-p.tail.y);
  const tnow=now();
  // the feet stay sacred even with a comb in hand
  if((dFeet<p.feet.r && py>p.head.y+p.head.r*0.6) || dTail<p.tail.r*1.3){
    if(tnow-lastFeetPet>0.8){
      lastFeetPet=tnow;
      const dmg = rab.bondLevel>=8? 0.9 : 1.4;
      rab.thumps=clamp(rab.thumps+dmg,0,5); stats.happy=clamp(stats.happy-8);
      raiseMistake(0.5);
      triggerThump(); toast('You combed the SACRED back feet! 😾 *THUMP*'); checkThreshold();
      fireFact('feet');
    }
    return;
  }
  // grooming the coat: the point is inside the body ellipse (or over the head/mane)
  const inBody = ((px-p.body.x)**2)/(p.body.rx*p.body.rx) + ((py-p.body.y)**2)/(p.body.ry*p.body.ry) <= 1.15;
  const inHead = Math.hypot(px-p.head.x, py-p.head.y) < p.head.r*1.2;
  if(inBody || inHead){
    // the haunches: lower body, out toward the sides
    const haunch = inBody && !inHead && py>p.body.y && Math.abs(px-p.body.x)>p.body.rx*0.45;
    if(haunch && rab.prefs.dislike==='rump'){
      annoyed('rump', `${rab.name} twists away from the comb — ${P().s} doesn't like being brushed on the haunches. Noted in 📖.`);
      return;
    }
    if(tnow-lastGroomGain>0.12){
      lastGroomGain=tnow; wake();
      rab.lastEngaged=tnow; raiseAffection(0.25);
      const kit=owns('groom');
      stats.hygiene=clamp(stats.hygiene + (kit?4:2.6));
      stats.happy=clamp(stats.happy + (kit?1.4:0.8));
      rab.thumps=clamp(rab.thumps-0.05,0,5);
      rab.groomUntil = tnow + 0.5;                 // she settles into the being-groomed pose
      rab.petReact=0.4;
      if(kit && Math.random()<0.03) addXP(2);       // the kit deepens the bond over time
      if(tnow>=groomGoalAt){ groomGoalAt=tnow+8; incGoal('groom'); }   // goal counts grooming bouts, not ticks
      spawnSparkle(p.body.x+rand(-p.body.rx*0.5,p.body.rx*0.5), p.body.y-rand(0,p.body.ry*0.4));
    }
  }
}
// Where she naps: her favourite spot if it's in the room, else the hammock if owned, else the bed.
function napTarget(){
  const fav=rab.prefs.nap;
  if(fav==='bed' || owns(fav)) return fav;
  return owns('hammock') ? 'hammock' : 'bed';
}
function napSpotPos(k){ return k==='bed' ? world.bed : (furnitureSpot(k) || world.bed); }
function napAtFavourite(){
  if(rab.napSpot!==rab.prefs.nap) return;
  prefHit('nap', `💛 ${rab.name} always curls up in ${NAP_SPOTS[rab.prefs.nap].name}. That's ${P().p} favourite nap spot.`);
}
function restRabbit(){
  if(hiddenBlock()) return;
  if(rab.cold){ coldRefuse(); return; }
  if(stats.energy>85){ toast(`${rab.name} isn't sleepy — plenty of energy right now.`); return; }
  const k=napTarget(); rab.napSpot=k;
  hopTo(napSpotPos(k).x);                       // she settles in her chosen spot
  rab.restUntil=now()+4.5; rab.state='rest'; rab.trick=null;
  spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r);
  toast(k==='hammock' ? `${rab.name} settles into the hammock for a deluxe nap. 😴🪢`
      : k==='bed'     ? `${rab.name} curls into a cozy nap. 😴`
                      : `${rab.name} tucks into ${NAP_SPOTS[k].name} for a nap. 😴`);
  napAtFavourite();
}
function playToy(){
  if(hiddenBlock()) return;
  if(rab.cold){ coldRefuse(); return; }
  if(rab.play) return;                       // already playing
  if(!(owns('ball')||owns('tunnel')||owns('tower'))){ toast('Buy a toy from the Shop 🛒 first, then Play!'); return; }
  if(stats.energy<12){ toast(`${rab.name} is too tired to play — try Rest 😴.`); return; }
  wake();
  rab.lastEngaged=now(); raisePlay(15);
  rab.digUntil=rab.chewUntil=rab.mischiefAt=0;
  startPlay();
  const type = rab.play.type, big = type!=='ball';
  if(type===rab.prefs.dislike){                       // a toy she just doesn't like: sniff, and done
    rab.play.dur=1.2; stats.happy=clamp(stats.happy+2); stats.energy=clamp(stats.energy-2);
    incGoal('play');
    if(rab.prefKnown.dislike) toast(`${rab.name} sniffs the ${TOYS[type].name.toLowerCase()} and wanders off. Not ${P().p} thing.`);
    else { toast(`${rab.name} sniffs the ${TOYS[type].name.toLowerCase()} and wanders off.`);
      discoverPref('dislike', `🙅 ${rab.name} really isn't into the ${TOYS[type].name}. Noted in 📖.`); }
    return;
  }
  if(type===rab.prefs.toy){                           // her favourite: extra joy, a binky mid-play
    stats.happy=clamp(stats.happy+10); startBinky();
    prefHit('toy', `💛 The ${TOYS[type].name} is ${rab.name}'s favourite toy — ${P().s} goes wild for it.`);
  }
  stats.happy=clamp(stats.happy + (big?20:15));
  stats.energy=clamp(stats.energy - (big?8:9));
  addWeight(-3);                          // exercise burns weight — play to keep her trim
  rab.thumps=clamp(rab.thumps-0.5,0,5);
  addXP(5); addCarrots(2, rab.x, rab.baseY-70); incGoal('play');
  toast(type==='tunnel' ? `Tunnel zoomies! ${cap(P().s)} bolts through the tube. 🕳️`
      : type==='tower'  ? `${cap(P().s)} scrambles up the climbing tower to survey ${P().p} kingdom! 🪜`
      : `${cap(P().s)} bats the treat ball around the rug. 🧸`);
}

/* --- Toy-play animation: she actually chases the ball / runs the tunnel --- */
function startPlay(){
  let toys=['ball','tunnel','tower'].filter(owns);
  // knowing her pays off: once you've learned what she dislikes you stop offering it,
  // and once you know her favourite you reach for it more often
  if(rab.prefKnown.dislike && toys.length>1) toys=toys.filter(k=>k!==rab.prefs.dislike);
  let type = toys.length? pick(toys) : 'ball';
  if(rab.prefKnown.toy && toys.includes(rab.prefs.toy) && Math.random()<0.6) type=rab.prefs.toy;
  const dur = type==='ball'?4.2 : type==='tunnel'?3.8 : 4.0;
  rab.play = {type, t:0, dur, binked:false};
  rab.trick=null; rab.binkyT=0; rab.hopping=false; rab.restUntil=0; rab.groomUntil=0;
  if(type==='ball') ballAnim={x:world.ball.x, y:world.ball.y};
}
function endPlay(){
  rab.play=null; ballAnim=null; rab.playAlpha=1; rab.playYOff=0; rab.hopOff=0;
  rab.x=clamp(rab.x, world.rug.x-world.rug.rx*0.6, world.rug.x+world.rug.rx*0.6);
  rab.state='loaf';
}
function updatePlay(dt){
  const pl=rab.play; pl.t+=dt; const k=pl.t/pl.dur; const sc=Math.min(W,H)/560;
  rab.state='play';
  if(pl.type==='ball'){
    // the ball rolls back and forth; she scampers just behind it, nudging it on
    const range=world.rug.rx*0.5;
    const bx=world.rug.x + Math.sin(pl.t*3.0)*range;
    const by=(world.rug.y-4) - Math.abs(Math.sin(pl.t*6.0))*22;   // bounces up on the rug
    ballAnim.x=bx; ballAnim.y=by;
    const behind=bx - 36*sc*Math.sign(Math.cos(pl.t*3.0)||1);
    rab.x=lerp(rab.x, behind, Math.min(1,dt*6));
    rab.x=clamp(rab.x, world.rug.x-world.rug.rx*0.72, world.rug.x+world.rug.rx*0.72);
    rab.hopOff=-Math.abs(Math.sin(pl.t*6.0))*16*sc;
    rab.lookXTarget=Math.sign(bx-rab.x);   // eased head-turn toward the ball
    if(Math.random()<dt*3) spawnSparkle(bx,by);
    if(k>=1) endPlay();
  } else if(pl.type==='tunnel'){
    // she darts up to the tunnel, ducks in one end and pops out the other
    const tb=world.tube;
    const leftX=tb.x-tb.w*0.30, rightX=tb.x+tb.w*0.30;
    const tunOff=world.tube.y-rab.baseY;                        // lift her up to tube height
    rab.playYOff=lerp(rab.playYOff, (k>=0.16&&k<0.84?tunOff:0), Math.min(1,dt*5));  // run in on the floor, then rise
    const tx = k<0.30?leftX : k<0.80?rightX : world.rug.x;      // duck in the near end, pop out the FAR end, then home
    rab.x=lerp(rab.x, tx, Math.min(1,dt*5));
    let a=1;
    if(k>=0.30&&k<0.46) a=1-(k-0.30)/0.16;      // vanish into the near opening
    else if(k>=0.46&&k<0.64) a=0;               // travelling through, hidden
    else if(k>=0.64&&k<0.80) a=(k-0.64)/0.16;   // reappear at the far opening
    rab.playAlpha=clamp(a,0,1);
    rab.hopOff = (k<0.24||k>=0.80)? -Math.abs(Math.sin(pl.t*10))*15*sc : 0;
    if(k>=0.46&&k<0.64 && Math.random()<dt*4) spawnSparkle(k<0.55?leftX:rightX, tb.y);
    if(k>=0.66 && !pl.binked){ pl.binked=true; startBinky(); }   // triumphant pop-out
    if(k>=1) endPlay();
  } else if(pl.type==='tower'){
    // she scrambles up the climbing tower, surveys her kingdom, then hops back down
    const tw=world.tower;
    rab.x=lerp(rab.x, tw.x, Math.min(1,dt*5));
    const topOff=(tw.y - tw.r*0.95) - rab.baseY;
    rab.playYOff=lerp(rab.playYOff||0, (k<0.30?0 : k<0.82? topOff : 0), Math.min(1,dt*4));
    rab.hopOff = (k<0.30||k>=0.82) ? -Math.abs(Math.sin(pl.t*8))*12*sc : -Math.abs(Math.sin(pl.t*5))*5*sc;
    if(k>=0.5 && k<0.82 && !pl.binked){ pl.binked=true; startBinky(); }
    if(k>=1) endPlay();
  }
}
// Scheduled wellness checkups: due on day 5 and every 5 days after. A due checkup is FREE
// (it's required care); skipping it slips her health and risks illness until it's done (see endNight).
function checkupDueNow(){ return rab.day >= rab.nextCheckupDay; }
function completeCheckup(){
  rab.nextCheckupDay = rab.day + 5;                 // next one in 5 days
  rab.health=clamp(rab.health+15); stats.happy=clamp(stats.happy+4);
  addXP(8);                                         // responsible care deepens the bond
  const ws=weightStatus();
  toast(`🩺 Checkup done — all clear! Next one on day ${rab.nextCheckupDay}. (${cap(P().s)}'s ${ws.lbs} lb — ${ws.txt}.)`);
  save();
}
function callVet(){
  if(rab.sick){
    if(owns('medicine')){ rab.items.medicine=Math.max(0,(rab.items.medicine|0)-1);
      if(rab.items.medicine<=0) delete rab.items.medicine;
      cureSick(true); refreshActions(); return; }
    if(spendCarrots(45)){ cureSick(false); return; }
    toast(`An emergency vet visit is 45🥕 (you have ${rab.carrots})! Cheaper to keep Gut Medicine 💊 stocked.`);
    return;
  }
  // caught early: an unwell (pre-stasis) bun is treated at checkup price and bounces back
  if(unwell()){
    const due = checkupDueNow();
    if(!due && !spendCarrots(10)){ toast(`A checkup is 10🥕 — you have ${rab.carrots}. Keep an eye on ${P().o}…`); return; }
    if(due) rab.nextCheckupDay = rab.day + 5;
    rab.health = clamp(Math.max(rab.health, 78));
    stats.happy=clamp(stats.happy+4); addXP(10);
    toast(`🩺 Caught early${due?'':' (−10🥕)'} — the vet found ${rab.name}'s gut slowing down. Fibre, fluids and a tummy rub: ${P().s}'s eating again. Good eye. 💚`);
    learnNote('droppings', true);
    save(); return;
  }
  // the required scheduled checkup is free when it's due/overdue
  if(checkupDueNow()){ completeCheckup(); return; }
  // an optional off-schedule wellness checkup still costs 10🥕
  if(spendCarrots(10)){
    rab.health=clamp(rab.health+20); stats.happy=clamp(stats.happy+4);
    const ws=weightStatus();
    toast(`🩺 Checkup (−10🥕): ideal for a ${BREEDS[rab.breed].name} is ~${ws.ideal} lb. ${cap(P().s)} is ${ws.lbs} lb — ${ws.txt}.`);
  } else {
    toast(`A checkup is 10🥕 — you have ${rab.carrots}. Earn more by caring for ${P().o}.`);
  }
}
function doTrick(){
  if(hiddenBlock()) return;
  if(rab.cold){ coldRefuse(); return; }
  if(rab.sick){ toast(`${rab.name} feels too poorly for tricks. See the Vet. 🩺`); return; }
  wake();
  if(rab.trick||rab.binkyT>0) return;
  rab.lastEngaged = now();
  if(unwell()){ toast(`${rab.name} just watches you and stays hunched. Not in the mood today.`); return; }
  if(stats.happy<30){ toast(`${rab.name} isn't in the mood for tricks. Bond a little more first.`); return; }
  if(stats.energy<12){ toast(`${rab.name} is worn out — let ${P().o} Rest 😴 first.`); return; }
  // choose from unlocked tricks
  const avail = Object.keys(TRICKS).filter(k=>TRICKS[k].unlock<=rab.bondLevel);
  const key = pick(avail);
  const T = TRICKS[key];
  if(Math.random()<0.12){ toast(`${rab.name} ignores you and grooms an ear. Rabbits. 🙄`); return; }
  // mastery grows with practice; payout scales with it
  const m = rab.mastery[key]||0;
  const nm = Math.min(100, m + (12 - m*0.08));
  rab.mastery[key]=nm;
  if(m<100 && nm>=100) unlockAch('master');
  stats.energy=clamp(stats.energy-T.energy);
  stats.happy=clamp(stats.happy+8);
  addWeight(-0.6);
  const reward = 2 + Math.floor(nm/30);      // 2..5 carrots by skill
  addCarrots(reward, rab.x, rab.baseY-70); addXP(6);
  incGoal('trick'); raisePlay(6); learnNote('tricks');
  // map each trick to a visible motion
  if(key==='jump'){ startHurdle(); }
  else if(key==='come'){                     // recall: she hops to the front of the rug, toward you
    const tx = Math.abs(rab.x-world.rug.x) > 50 ? world.rug.x : world.rug.x + (rab.x<world.rug.x? 90 : -90);
    hopTo(tx);
  }
  else rab.trick={name:key, t:0, dur:T.dur};
  const p=parts(); for(let i=0;i<4;i++) spawnHeart(p.head.x+rand(-20,20),p.head.y);
  if(key==='boop') setTimeout(()=>{ const q=parts(); spawnWord(q.head.x, q.head.y+q.head.r*0.2, 'boop!', '#ffd1dc'); }, 500);
  toast(`${rab.name} performs ${T.name} ${T.emoji}  (mastery ${Math.round(nm)}% · +${reward}🥕)`);
}
// The Cold Shoulder is only forgiven with this rabbit's OWN favourite treat — so a sulk is also
// a way to learn what that favourite is. (Banana treats are hand-fed; greens/apple chews come from the Shop.)
function forgive(kind){
  const p=parts(), F=FAV_TREATS[kind];
  rab.cold=false; rab.thumps=0; stats.happy=clamp(stats.happy+20);
  for(let i=0;i<6;i++) spawnHeart(p.head.x+rand(-20,20),p.head.y);
  startBinky();
  toast(`The apology ${F.name.toLowerCase()}! ${cap(P().s)} turns back around… forgiven. ${F.emoji}`);
  if(!rab.favKnown){ rab.favKnown=true; learnNote('fav'); }
  save();
}
function coldRefuse(){
  const fav = rab.favKnown ? `${P().p} favourite, ${FAV_TREATS[rab.favTreat].name.toLowerCase()} ${FAV_TREATS[rab.favTreat].emoji}` : `${P().p} favourite treat`;
  toast(`${cap(P().s)} has turned ${P().p} back. Only ${fav} will fix this.`);
  spawnSparkle(parts().tail.x, parts().tail.y);
}

/* ---------------- Petting ---------------- */
function handlePet(px,py){
  if(!pettingMode || rab.cold || rab.state==='tummy') return;
  const p=parts();
  const dHead=Math.hypot(px-p.head.x, py-p.head.y);
  const dFeet=Math.hypot(px-p.feet.x, py-p.feet.y);
  const dTail=Math.hypot(px-p.tail.x, py-p.tail.y);
  const tnow=now();
  if((dFeet<p.feet.r && py>p.head.y+p.head.r*0.6) || dTail<p.tail.r*1.3){
    if(tnow-lastFeetPet>0.8){
      lastFeetPet=tnow;
      // trust softens the feet reaction a little at high Bond
      const dmg = rab.bondLevel>=8? 0.9 : 1.4;
      rab.thumps=clamp(rab.thumps+dmg,0,5); stats.happy=clamp(stats.happy-8);
      raiseMistake(0.5);                                  // rough handling while young makes a warier adult
      triggerThump(); toast('You touched the SACRED back feet! 😾 *THUMP*'); checkThreshold();
      fireFact('feet');
    }
    return;
  }
  if(dHead<p.head.r*1.3){
    // which part of the head: nose (muzzle), ears (far sides), forehead (top), cheeks (lower sides)
    const hdx=px-p.head.x, hdy=py-p.head.y, hr=p.head.r;
    const zone = (hdy>hr*0.12 && Math.abs(hdx)<hr*0.3) ? 'nose'
               : Math.abs(hdx)>hr*0.62 ? 'ears'
               : hdy<-hr*0.2 ? 'forehead'
               : Math.abs(hdx)>hr*0.28 ? 'cheeks' : null;
    if(zone==='nose' && rab.prefs.dislike==='nose'){
      annoyed('nose', `${rab.name} shakes ${P().p} head and pulls back — ${P().s} doesn't like ${P().p} nose touched. Noted in 📖.`);
      return;
    }
    const favSpot = zone && zone===rab.prefs.pet;
    if(tnow-lastPetGain>0.14){
      lastPetGain=tnow; wake();
      stats.happy=clamp(stats.happy+3*temper().petJoy*(favSpot?1.7:1)); rab.thumps=clamp(rab.thumps-0.2,0,5);
      if(favSpot){
        if(Math.random()<0.3) spawnHeart(p.head.x+rand(-18,18), p.head.y-p.head.r*1.2);
        prefHit('pet', `💛 ${rab.name} leans right into it — ${PET_SPOTS[rab.prefs.pet].name} is ${P().p} favourite place for a rub.`);
      }
      rab.petReact=0.6;                                   // obvious happy reaction
      rab.lastEngaged=tnow; raiseAffection(0.5);   // per stroke tick (~7/s) — weighed against play in settleTemperament
      rab.digUntil=rab.chewUntil=rab.mischiefAt=0;        // attention ends the mischief
      // tooth purr: soft grinding when a content bun is being stroked (never when she's unwell)
      if(stats.happy>70 && !unwell() && !rab.sick && tnow>=rab.purrCooldown && Math.random()<0.07*temper().purr*(favSpot?3:1)){
        rab.purrCooldown = tnow+3;
        spawnWord(p.head.x+p.head.r*0.9, p.head.y+p.head.r*0.3, 'prrr', '#fff3c4');
        learnNote('purr');
      }
      rab.lifetimePets++; if(rab.lifetimePets%30===0) addXP(4);
      if(rab.lifetimePets>=100) unlockAch('pets100');
      incGoal('pet',1);                                   // counts every pet now
      spawnHeart(p.head.x+rand(-12,12), p.head.y - p.head.r*1.35);   // above the mane, always visible
      if(!rab.trick) rab.state='loaf';
    }
  }
}

/* ---------------- Thump thresholds ---------------- */
let wasAbove3=false, happy90Armed=false;
function checkThreshold(){
  if(rab.thumps>=3 && !wasAbove3){ wasAbove3=true; triggerThump(); raiseMistake(1); }
  if(rab.thumps<2.6) wasAbove3=false;
  if(rab.thumps>=5 && !rab.cold){ rab.cold=true; onMaxAnger(); fireFact('cold'); }   // maxed anger → a rage strike
}

/* ---------------- Idle brain ---------------- */
let nextIdle=3;
// Rabbits are crepuscular: busiest at dawn and dusk, dozy at midday. Scales idle activity.
function activity(){ const d=timeOfDay; return (d<0.2||d>0.78) ? 1.6 : (d>0.38&&d<0.62) ? 0.55 : 1; }
// Boredom mischief: needs are met but nobody has petted, groomed, played or trained her for a while.
function boredomCheck(t,T){
  if(t<rab.mischiefCooldown || rab.mischiefAt || t<rab.digUntil || t<rab.chewUntil) return false;
  if(!rab.lastEngaged) rab.lastEngaged=t;          // start the clock on a fresh session
  const needsMet = stats.hunger<60 && stats.water>40 && stats.hygiene>40 && stats.energy>30;
  if(!needsMet || t-rab.lastEngaged<45 || stats.happy>=75) return false;
  if(Math.random() > 0.0008*T.mischief) return false;
  rab.mischiefCooldown = t + rand(35,60);
  if(Math.random()<0.55){
    rab.mischiefKind='dig';
    hopTo(world.rug.x + (Math.random()<0.5?-1:1)*world.rug.rx*0.55);
    toast(`${rab.name} is digging at the rug. ${cap(P().s)}'s bored — play or a few pets would help.`);
  } else {
    rab.mischiefKind='chew';
    hopTo(Math.max(90, W*0.1));
    toast(`${rab.name} is chewing the baseboard! Bored bunnies chew. Time for a toy or some attention.`);
  }
  rab.mischiefAt = t + 0.8;                        // starts once she's landed (see frame timers)
  stats.happy=clamp(stats.happy+3); stats.hygiene=clamp(stats.hygiene-3);   // amuses herself, makes a mess
  learnNote('bored'); return true;
}
// Idle chinning: she wanders over to a piece of her furniture and claims it again
function chinSomething(){
  const ids=['castle','tower','hutch','tunnel','bed_cloud'].filter(id=>owns(id));
  const spot = ids.length ? furnitureSpot(pick(ids)) : world.bed;
  hopTo(spot.x); rab.chinAt=now()+0.9; rab.chinName=null;
}
function idleBrain(dt,t){
  if(rab.cold||rab.state==='tummy'||rab.state==='rest'||rab.hopping||rab.trick||rab.binkyT>0) return;
  if(pettingMode && pointer.down) return;
  if(rab.mischiefAt || t<rab.digUntil || t<rab.chewUntil || rab.chinAt || t<rab.chinUntil) return;   // busy
  const T = temper(), act = activity(), ill = unwell() || rab.sick;
  if(stats.energy<18 && Math.random()<0.01){ rab.restUntil=now()+rand(2,4); rab.state='rest'; rab.napSpot=null;
    spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r); return; }
  // midday lull: rabbits doze through the middle of the day
  if(act<1 && stats.energy<80 && !ill && Math.random()<0.003){ rab.restUntil=now()+rand(3,5); rab.state='rest'; rab.napSpot=null;
    spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r); return; }
  if(!ill && stats.happy>88 && stats.energy>25 && Math.random()<0.004*T.binkyMul*act){ startBinky(); return; }
  // a spontaneous flop — only once she trusts you enough (temperament sets how much)
  if(!ill && rab.bondLevel>=T.flopBond && stats.happy>80 && rab.loaf>0.5 && t>=rab.flopCooldown
     && Math.random()<0.0015*T.flopRate){
    rab.flopCooldown=t+rand(40,70);
    rab.trick={name:'flop', t:0, dur:rand(4,6)};
    if(!notes.flop) toast(`${rab.name} flops over onto ${P().p} side. That's total trust. 😌`);
    learnNote('flop'); return;
  }
  // boredom: needs met but nobody's paid her attention for a while → she makes her own fun
  if(!ill && boredomCheck(t, T)) return;
  // occasionally asks for something with a speech bubble. What she wants is contextual
  // (real needs first; treats/attention only when content), and there's a proper
  // cooldown so she isn't a broken banana vending-machine ad.
  if(now()>=rab.begUntil && now()>=rab.begCooldown && Math.random()<0.0012){
    const wants=[];
    if(stats.water<45)   wants.push('💧');
    if(stats.hunger>60)  wants.push('🌾');
    if(stats.hygiene<40) wants.push('🧹');
    if(stats.energy<30)  wants.push('😴');
    if(!wants.length && stats.happy>35 && !ill){                // content → mischief asks (never while unwell)
      wants.push('✋');
      if(owns('ball')||owns('tunnel')||owns('tower')) wants.push(owns(rab.prefs.toy) ? TOYS[rab.prefs.toy].emoji : '🧸');   // her favourite toy, if you have it
      // asks for HER favourite treat — a quiet clue for players still working out what it is
      if(rab.favTreat!=='banana' || rab.bananasToday<2) wants.push(FAV_TREATS[rab.favTreat].emoji, FAV_TREATS[rab.favTreat].emoji);
    }
    if(wants.length){
      rab.begWant=pick(wants);
      rab.begAt=now(); rab.begUntil=now()+rand(4,6);
      rab.begCooldown=now()+rand(22,40);                        // quiet time between asks
    }
  }
  nextIdle-=dt;
  if(nextIdle<=0){
    nextIdle=rand(3.5,7)/act;                  // busier at dawn and dusk, slower at midday
    if(ill){ nextIdle*=2.5; if(Math.random()<0.7) return; }   // hunched and reluctant to move
    const roll=Math.random();
    if(T.hide && Math.random()<T.hide){        // skittish: retreats to cover
      if(owns('hutch')){ hopTo(world.hutch.x); rab.denUntil=now()+rand(3.5,5.5); }
      else { hopTo(world.bed.x); rab.bedNapAt=now()+0.9; }
    }
    else if(roll<0.4){ hopTo(rand(world.rug.x-world.rug.rx*0.6, world.rug.x+world.rug.rx*0.6)); }
    else if(roll<0.62){ rab.groomUntil=t+rand(1.4,2.6); }
    else if(roll<0.74 && stats.happy>75 && stats.energy>30 && !ill){ if(Math.random()<T.binkyMul) startBinky(); }
    else if(roll<0.77){ chinSomething(); }
    else if(roll<0.82 && owns('hutch')){ hopTo(world.hutch.x); rab.denUntil=now()+rand(3.5,5.5); }  // pops into her hutch
    else if(roll<0.9){ rab.napSpot=napTarget(); hopTo(napSpotPos(rab.napSpot).x); rab.bedNapAt=now()+0.9; }   // wander to her nap spot → maybe curl up
    else { rab.groomUntil=0; }
  }
}

/* ---------------- State machine ---------------- */
function updateState(t){
  if(rab.cold){ rab.state='cold'; return; }
  if(t<rab.restUntil){ rab.state='rest'; return; }
  if(t<rab.tummyUntil){ rab.state='tummy'; return; }
  if(rab.trick){ rab.state='trick'; return; }
  if(rab.legStomp>0.05){ rab.state='thump'; return; }
  const p=parts();
  // She only turns to follow the cursor while you're actually pressing (no hover-twitch).
  const near = pointer.down && Math.hypot(pointer.x-p.head.x,pointer.y-p.head.y) < p.head.r*3;
  const needy = stats.hunger>62 || stats.hygiene<32 || stats.water<28 || stats.energy<20 || rab.thumps>=2;
  if(rab.hopping || rab.binkyT>0 || near || needy){
    rab.state='alert';
    if(pointer.down){
      rab.lookXTarget=clamp((pointer.x-p.head.x)/120,-1,1);   // eased toward this in the frame timers
      rab.lookY=clamp((pointer.y-p.head.y)/120,-1,1);
    } else { rab.lookXTarget=0; rab.lookY=0; }
    return;
  }
  rab.state='loaf';
}


/* ============================================================================ *
 *  MAIN LOOP
 * ============================================================================ */
let last=now();
/* ============================================================================ *
 *  FIRST-SESSION SCRIPTING — the engineered thump (item 3)
 * ============================================================================ */
function tickScript(t){
  // (a) The bait: one luxurious, feet-out flop on day 1, once petting is armed. If she
  //     stretches out and the player touches the sacred feet, the normal thump path fires.
  if(rab.day===1 && !rab.baitDone && rab.petArmedOnce && rab.baitAt && t>=rab.baitAt){
    // only when she's calm and idle, so the pose reads clearly and nothing is interrupted
    if(!rab.cold && !rab.sick && !rab.play && !rab.hidden && !rab.trick
       && rab.binkyT<=0 && !rab.hopping && rab.state!=='rest' && rab.state!=='tummy'){
      rab.baitDone=true; rab.baitAt=0;
      rab.trick={name:'flop', t:0, dur:6.5};   // long, luxurious flop (reuses the flop pose)
      rab.state='trick';
      toast(`${rab.name} flops over and stretches right out — back feet on full display. So relaxed. 😌`);
      learnNote('flop');
      save();
    }
  }
  // (b) The fallback: if no thump has happened by mid-day-2, guarantee one so the meter is
  //     demonstrated either way. Crosses the 3-paw threshold once — recoverable, never cold shoulder.
  if(!rab.thumpSeen && rab.day>=2 && timeOfDay>0.4){
    rab.thumps=Math.max(rab.thumps,3.0);
    checkThreshold();   // fires the natural thump; triggerThump() sets thumpSeen, so this won't repeat
  }
}

function frame(){
  const t=now(); let dt=t-last; last=t; dt=Math.min(dt,0.05);

  if(minigameActive){ requestAnimationFrame(frame); return; }   // pause the pet sim

  ctx.clearRect(0,0,W,H);

  if(cutscene){ drawNight(dt); requestAnimationFrame(frame); return; }

  const stage = stageFor(rab.ageDays);
  rab.curScale = damp(rab.curScale, stage.scale, 1.5, dt);

  timeOfDay += dt/dayLen(rab.day);
  if(timeOfDay>=1){ timeOfDay=1; startNight(); requestAnimationFrame(frame); return; }
  $('clockLbl').textContent =
    timeOfDay<0.15?'🌅': timeOfDay<0.45?'☀️': timeOfDay<0.75?'🌤️': timeOfDay<0.9?'🌇':'🌆';

  /* stat decay (stage-scaled hunger + energy; sick & max-anger drain faster) */
  const coldMul = rab.cold? 1.5 : 1;   // a furious bun neglects itself
  // A slowing gut means FEWER droppings, so the box stays cleaner when she's unwell or in stasis —
  // that quiet litter box is one of the clues. (Hunger isn't sped up: a sick rabbit stops eating.)
  const gutMul = rab.sick? 0.35 : unwell()? 0.6 : 1;
  stats.hunger=clamp(stats.hunger + stage.hunger*coldMul*dt);
  stats.hygiene=clamp(stats.hygiene - 0.72*coldMul*gutMul*dt);
  stats.water=clamp(stats.water - 0.62*(owns('bottle')?0.6:1)*coldMul*dt);   // Deluxe Water Bottle: water lasts longer
  const happyDecay = 0.6 * (owns('castle')||owns('hutch')?0.82:1) * ((owns('ball')||owns('tunnel')||owns('tower'))?0.88:1);
  stats.happy=clamp(stats.happy - happyDecay*dt);
  if(rab.state==='rest'){
    const favNap = rab.napSpot===rab.prefs.nap;
    stats.energy=clamp(stats.energy + (owns('hammock')?15:11)*(favNap?1.3:1)*dt);   // hammock = cushier naps; her favourite spot = deeper sleep
    if(favNap) stats.happy=clamp(stats.happy + 0.6*dt);
  }
  else { stats.energy=clamp(stats.energy - stage.energy*0.5*dt); }
  if(hayFresh>0) hayFresh-=dt;

  tickHealth(dt);
  checkWeight(dt);
  if(!started) return;   // taken away → stop updating behind the game-over overlay

  let pressure=0;
  if(stats.hunger>70) pressure++;
  if(stats.hygiene<30) pressure++;
  if(stats.water<25)   pressure++;
  if(stats.happy<25)   pressure++;
  if(stats.energy<15)  pressure++;
  if(rab.sick)         pressure++;
  if(pressure>0) rab.thumps=clamp(rab.thumps + pressure*0.11*temper().thumpMul*dt,0,5);
  else if(!rab.cold) rab.thumps=clamp(rab.thumps - 0.12*dt,0,5);
  checkThreshold();

  // the 90%-happiness goal must be EARNED: it arms once happiness has dipped below the 90 target
  // (which any normal day does within seconds of the morning-joy peak), then completes when she's
  // brought back up to 90. Arming at the target — not a lower 85 — means it can never get stuck
  // uncompletable when she wakes at 90+; the morning-joy boost still can't auto-complete it because
  // she starts the day above 90, so the flag stays disarmed until she first drops below it.
  if(stats.happy<90) happy90Armed=true;
  if(happy90Armed && stats.happy>=90 && rab.goals.some(g=>g.track==='happy90'&&!g.done)) incGoal('happy90');

  /* animation timers */
  rab.breath+=dt*2.2;
  // idle micro-motion: the nose sniffs in occasional bursts, not at a constant rate
  rab.noseBurstT=(rab.noseBurstT||0)-dt;
  if(rab.noseBurstT<=0){ rab.noseBurstT=rand(1.4,4); rab.noseBurst=rand(0.35,0.6); }
  if(rab.noseBurst>0) rab.noseBurst=Math.max(0,rab.noseBurst-dt);
  rab.noseTwitch += dt*((rab.state==='alert'?12:4) + (rab.noseBurst>0?9:0));
  if(rab.legStomp>0) rab.legStomp=Math.max(0,rab.legStomp-dt*2.2);
  if(thumpFx>0) thumpFx=Math.max(0,thumpFx-dt);
  if(rab.binkyT>0){ rab.binkyT=Math.max(0,rab.binkyT-dt);
    const pr=1-rab.binkyT/rab.binkyDur; rab.binkyHop=-Math.sin(pr*Math.PI)*72*(Math.min(W,H)/560); }
  else rab.binkyHop=0;
  if(rab.trick){ rab.trick.t+=dt; if(rab.trick.t>=rab.trick.dur) rab.trick=null; }
  // blink variation: varied duration + an occasional quick double-blink
  rab.nextBlink-=dt; if(rab.nextBlink<=0){ rab.blink=rand(0.09,0.16); rab.nextBlink = Math.random()<0.22? 0.2 : rand(2.5,6); }
  if(rab.blink>0) rab.blink-=dt;
  if(rab.petReact>0) rab.petReact=Math.max(0,rab.petReact-dt);
  // chinning: once she's hopped over to something new, she rubs her chin on it to claim it
  if(rab.chinAt && t>=rab.chinAt && !rab.hopping){
    rab.chinAt=0; rab.chinUntil=t+1.6;
    if(rab.chinName) toast(`${rab.name} rubs ${P().p} chin all over the ${rab.chinName.toLowerCase()}. It's ${rab.sex==='buck'?'his':'hers'} now.`);
    rab.chinName=null; learnNote('chin');
  }
  // boredom mischief: begins once she's landed; dust while digging, chomps while chewing the baseboard
  if(rab.mischiefAt && t>=rab.mischiefAt && !rab.hopping){
    if(rab.mischiefKind==='dig') rab.digUntil=t+2.6; else rab.chewUntil=t+2.4;
    rab.mischiefAt=0;
  }
  if(t<rab.digUntil && Math.random()<dt*6) spawnDust(rab.x, rab.baseY-4);
  if(t<rab.chewUntil && Math.random()<dt*2.5){ const q=parts(); spawnWord(q.head.x+q.head.r, q.head.y+q.head.r*0.3, 'chomp', '#f3e2c7'); }
  // pain sign: loud tooth grinding every so often while unwell or sick
  if(rab.sick || unwell()){
    if(!rab.grindAt) rab.grindAt = t + rand(4,8);
    else if(t>=rab.grindAt){ rab.grindAt = t + rand(9,16);
      const q=parts(); spawnWord(q.head.x+q.head.r*0.9, q.head.y+q.head.r*0.3, 'grrk grrk', '#cfc8c2'); learnNote('grind'); }
  } else rab.grindAt = 0;
  // the first evening: point out that she perks up at dusk (crepuscular)
  if(timeOfDay>0.78 && !notes.dawn && !rab.sick && !cutscene){
    learnNote('dawn', true);
    toast(`🌇 Evening — ${rab.name} perks up and starts exploring. Rabbits are most active at dawn and dusk.`);
  }
  // pre-hop crouch settle/release, eased head-turn, ear-trail spring, occasional ear swivel
  rab.crouch = damp(rab.crouch||0, rab.crouchT||0, 16, dt);
  rab.lookX  = damp(rab.lookX||0, rab.lookXTarget||0, 12, dt);
  const _bodyOff = rab.hopOff + rab.binkyHop;                         // ear trail = smoothed vertical velocity
  rab.earTrail = damp(rab.earTrail||0, (_bodyOff-(rab._earPrev||0))/Math.max(dt,0.001), 13, dt);
  rab._earPrev = _bodyOff;
  rab.earSwivelT=(rab.earSwivelT||0)-dt;
  if(rab.earSwivelT<=0){ rab.earSwivelT=rand(3.5,8); if(!rab.hopping && rab.binkyT<=0){ rab.earSwivel=1; rab.earSwivelDir=Math.random()<0.5?-1:1; } }
  if(rab.earSwivel>0) rab.earSwivel=Math.max(0,rab.earSwivel-dt*1.4);

  if(rab.play){
    updatePlay(dt);
  } else if(rab.hidden){
    /* hiding for a hide-and-seek morning — hold still until found */
  } else if(t < rab.boxT && !rab.hopping){
    /* climbed into the litter box to munch — sit inside it */
    rab.state='loaf';
    rab.x = damp(rab.x, world.litter.x, 8, dt);
    rab.boxYOff = damp(rab.boxYOff||0, (world.litter.y + world.litter.h*0.15) - rab.baseY, 5, dt);
  } else {
    rab.boxYOff = damp(rab.boxYOff||0, 0, 6, dt);
    if(rab.hopping){
      const k=(t-rab.hopT0)/rab.hopDur;
      if(k<0){ rab.hopOff=0; rab.x=rab.hopFromX; }                                    // anticipation crouch (holds at takeoff spot)
      else if(k>=1){rab.hopping=false;rab.hopOff=0;rab.x=rab.hopToX; rab.landSquash=1; rab.earJiggle=1; rab.crouchT=0;}   // touchdown → squash + ears bounce
      else{rab.x=lerp(rab.hopFromX,rab.hopToX,k); rab.hopOff=-Math.sin(k*Math.PI)*46*(Math.min(W,H)/560); rab.crouchT=0;} // launch → release crouch
    }
    idleBrain(dt,t);
    updateState(t);
  }
  tickEvent(dt,t);
  tickScript(t);
  // state-gated feeding credit: the hay goal ticks only once she's actually eating
  if(hayCreditAt && t>=hayCreditAt){ hayCreditAt=0; incGoal('hay'); }

  /* owned-furniture interactions: she settles INTO the hammock for a nap, and fades
     into the hutch doorway when she pops in for a den visit */
  if(!rab.play){
    const hm=world.hammock;
    rab.inHammock = rab.state==='rest' && owns('hammock') && !rab.hopping && Math.abs(rab.x-hm.x)<hm.w*0.5;
    rab.hammockSag = damp(rab.hammockSag||0, rab.inHammock?1:0, 6, dt);   // sling sags under her weight, springs up when empty
    // she sometimes curls up in her bed after wandering to it (short nap, interruptible)
    if(rab.bedNapAt && t>rab.bedNapAt){
      rab.bedNapAt=0;
      const ns=napSpotPos(rab.napSpot||'bed');
      if(!rab.hopping && !rab.cold && rab.state!=='tummy' && !rab.trick
         && Math.abs(rab.x-ns.x)<Math.max(40,(ns.r||ns.w*0.3||60)*0.6) && Math.random()<0.65){
        rab.restUntil = t + rand(5,9);
        napAtFavourite();
      }
    }
    rab.inBed = rab.state==='rest' && !rab.inHammock && !rab.hopping && Math.abs(rab.x-world.bed.x)<world.bed.r*0.6;
    rab.playYOff = damp(rab.playYOff||0,
      rab.inHammock? (hm.nap - rab.baseY) : rab.inBed? (world.bed.y - rab.baseY)*0.55 : 0, 5, dt);
    const inDen = t<rab.denUntil && owns('hutch') && !rab.hopping && Math.abs(rab.x-world.hutch.x)<world.hutch.r*0.5;
    rab.playAlpha = damp(rab.playAlpha!==undefined?rab.playAlpha:1, inDen? 0.12 : 1, 5, dt);
  }

  /* squash/stretch impact + ear bounce settle back to rest */
  rab.landSquash = damp(rab.landSquash||0, 0, 11, dt);
  rab.earJiggle  = damp(rab.earJiggle||0, 0, 6, dt);

  /* loaf pose: content, fed, calm */
  // content loaf — or, when unwell, the hunched, tucked-up sit of a rabbit in discomfort
  const wantsLoaf = rab.state==='loaf' && !rab.hopping && ((stats.happy>60 && stats.hunger<55) || unwell() || rab.sick);
  rab.loaf = damp(rab.loaf, wantsLoaf?1:0, 3, dt);

  if((rab.state==='loaf'||rab.state==='rest') && stats.happy>70 && !unwell() && Math.random()<0.006){
    const p=parts(); spawnZ(p.head.x+p.head.r*0.6,p.head.y-p.head.r);
  }

  /* render — everything on the single canvas, sharing one screen-shake offset */
  let shx=0, shy=0;
  if(thumpFx>0){ const m=thumpFx*8; shx=rand(-m,m); shy=rand(-m,m); }

  ctx = bgCtx;
  ctx.save(); ctx.translate(shx, shy);
  // room + props + FX
  drawSky();
  drawRoom();
  drawHazard();
  drawParticles(dt);
  drawThumpFx(dt);
  if(rab.cold){ const a=0.13+0.08*Math.sin(now()*5); ctx.fillStyle=`rgba(205,35,25,${a})`; ctx.fillRect(0,0,W,H); }  // furious red aura
  if(hazardFlash>0){ ctx.fillStyle=`rgba(255,240,180,${hazardFlash})`; ctx.fillRect(-40,-40,W+80,H+80); hazardFlash=Math.max(0,hazardFlash-dt*1.5); }
  // the rabbit, drawn in front of the room
  ctx.save();
  ctx.globalAlpha = rab.playAlpha!==undefined?rab.playAlpha:1;
  if(rab.hidden) drawHideHint(t); else drawRabbit(t);
  ctx.restore();
  if(rab.inHammock && !rab.hidden) drawHammockFront();   // the sling's near lip wraps over her
  if(rab.inBed && !rab.hidden && !rab.play) drawBedFront();   // the bed's near rim tucks her in
  if(t < rab.boxT) drawLitterFront();         // box wall in front of the rabbit while it's inside
  // scene-wide mood LAST, so the room AND the rabbit share the same light (drawRoomNight is the
  // dusk/evening tint; the zoomies drawNight cutscene is separate)
  drawRoomNight();
  drawAmbient();
  drawBegBubble();                            // speech bubble on top of everything (kept untinted)
  ctx.restore();

  updateHUD();

  autosaveT+=dt; if(autosaveT>4){ autosaveT=0; save(); }

  requestAnimationFrame(frame);
}

/* ============================================================================ *
 *  HUD
 * ============================================================================ */
const PAW_SVG = c=>`<svg class="paw" viewBox="0 0 24 24"><path fill="${c}" d="M12 14c-3 0-5 2-5 4 0 1.5 1.5 2 3 2 1 0 1.5-.5 2-.5s1 .5 2 .5c1.5 0 3-.5 3-2 0-2-2-4-5-4zM6.5 12.5c1 0 1.7-1.2 1.5-2.6C7.8 8.5 6.9 7.7 6 7.8c-1 .1-1.6 1.3-1.4 2.7.2 1.2 1 2 1.9 2zM17.5 12.5c.9 0 1.7-.8 1.9-2 .2-1.4-.4-2.6-1.4-2.7-.9-.1-1.8.7-2 2.1-.2 1.4.5 2.6 1.5 2.6zM9.5 8.3c.9-.2 1.4-1.4 1.1-2.7C10.3 4.3 9.4 3.6 8.5 3.8c-.9.2-1.4 1.4-1.1 2.7.3 1.3 1.2 2 2.1 1.8zM14.5 8.3c.9.2 1.8-.5 2.1-1.8.3-1.3-.2-2.5-1.1-2.7-.9-.2-1.8.5-2.1 1.8-.3 1.3.2 2.5 1.1 2.7z"/></svg>`;
function initPaws(){
  const wrap=$('paws'); wrap.innerHTML='';
  for(let i=0;i<5;i++){const d=document.createElement('span');d.innerHTML=PAW_SVG('#e0603a');wrap.appendChild(d.firstChild);}
}
function barColor(v){
  // continuous crimson→amber→green ramp (no hard step boundaries); the .fill CSS transition
  // then eases the colour as a stat drifts, instead of snapping at 55/28
  v=clamp(v,0,100);
  const hue = v<50 ? 6 + (v/50)*(46-6) : 46 + ((v-50)/50)*(124-46);
  const sat = v<50 ? 70 : 58;
  return `linear-gradient(90deg,hsl(${hue|0} ${sat}% 49%),hsl(${hue|0} ${sat}% 62%))`;
}
function updateHUD(){
  const set=(id,v,invert)=>{
    const el=$(id); if(!el) return; el.style.width=v+'%';
    el.style.background = barColor(invert?(100-v):v);
  };
  set('fHappy',Math.round(stats.happy),false);
  set('fHunger',Math.round(stats.hunger),true);
  set('fWater',Math.round(stats.water),false);
  set('fHygiene',Math.round(stats.hygiene),false);
  set('fEnergy',Math.round(stats.energy),false);
  $('vHappy').textContent=Math.round(stats.happy);
  $('vHunger').textContent=Math.round(stats.hunger);
  $('vWater').textContent=Math.round(stats.water);
  $('vHygiene').textContent=Math.round(stats.hygiene);
  $('vEnergy').textContent=Math.round(stats.energy);
  const paws=document.querySelectorAll('.paw'); const n=Math.round(rab.thumps);
  paws.forEach((pw,i)=>pw.classList.toggle('on',i<n));
  // progression chips
  $('carrotN').textContent=rab.carrots;
  $('bondN').textContent=rab.bondLevel;
  $('bondBar').style.width=(rab.bondXP/xpNeeded(rab.bondLevel)*100)+'%';
  const st=stageFor(rab.ageDays);
  $('stageChip').textContent=`${st.label} ${st.name}`;
  const ws=weightStatus(); const wc=$('weightChip');
  wc.textContent='⚖️ '+ws.lbs+'lb'; wc.className='chip'+(ws.band!=='ok'?' warn':'');
  // health warning pip
  const hc=$('healthChip');
  // No chip for low health any more: "unwell" has to be spotted from her behaviour (see unwell())
  if(rab.sick){ hc.style.display='inline-flex'; hc.textContent='🤒 Sick'; hc.className='chip warn blink'; }
  else if(checkupDueNow()){ hc.style.display='inline-flex'; hc.textContent='🩺 Checkup'; hc.className='chip warn'; }
  else { hc.style.display='none'; }
  // contextual action enabling
  $('bVet').classList.toggle('urgent', rab.sick || checkupDueNow());
  const _ft=now();   // feed cooldown: grey the button out until she's done with the last serving
  const bh=$('bHay');     if(bh) bh.disabled = _ft<feedLock.hay;
  const bp=$('bPellets'); if(bp) bp.disabled = _ft<feedLock.pellets;
  const bcl=$('bClean');  if(bcl) bcl.disabled = _ft<feedLock.clean;
  const bw=$('bWater');   if(bw) bw.disabled = _ft<feedLock.water;
  const bc=$('banCount'); if(bc){ bc.textContent=rab.bananasToday+'/2'; bc.classList.toggle('warn', rab.bananasToday>=2); }
  // the tip line teaches on day 1, then fades away once she's established (keeps the scene clean)
  const hintEl=$('hint');
  if(hintEl){ const show = rab.day<2; if(hintEl._shown!==show){ hintEl._shown=show; hintEl.style.opacity=show?'':'0'; } }
}

/* Buttons that appear/disable based on ownership & state */
function refreshActions(){
  const play=$('bPlay');
  if(play) play.style.display = (owns('ball')||owns('tunnel')||owns('tower')) ? 'flex' : 'none';
}

/* ============================================================================ *
 *  PANELS  (Shop · Goals · Menu)
 * ============================================================================ */
let panelOpen=null;
function openPanel(kind){
  panelOpen=kind;
  $('panelWrap').classList.add('show');
  $('panelTitle').textContent = kind==='shop'?'🛒 Carrot Shop' : kind==='goals'?'🎯 Daily Goals'
                              : kind==='notes'?'📖 Notebook' : kind==='games'?'🎮 Games' : '⚙️ Menu';
  if(kind==='shop') renderShop();
  else if(kind==='goals') renderGoals(true);
  else if(kind==='notes') renderNotes();
  else if(kind==='games') renderGames();
  else renderMenu();
}
let notesTab='about';
function notesTabs(body){
  const tabs=document.createElement('div'); tabs.className='mbtns';
  tabs.innerHTML=`<button id="ntAbout" class="mbtn${notesTab==='about'?' on':''}">🐰 About ${esc(rab.name)}</button>
    <button id="ntNotes" class="mbtn${notesTab==='notes'?' on':''}">📖 Rabbit Notes</button>`;
  body.appendChild(tabs);
  $('ntAbout').onclick=()=>{ notesTab='about'; renderNotes(); };
  $('ntNotes').onclick=()=>{ notesTab='notes'; renderNotes(); };
}
// "About <name>": everything you've learned about THIS rabbit. Unknowns show a hint, not the answer.
function renderAbout(body){
  const S=P().s, Pp=P().p, pr=rab.prefs, k=rab.prefKnown;
  const st=stageFor(rab.ageDays);
  const notOwned = key => key!=='bed' && !owns(key);
  const rows=[
    ['🧬','Personality', rab.temper ? `${TEMPERS[rab.temper].emoji} ${TEMPERS[rab.temper].name}: ${S} ${TEMPERS[rab.temper].desc}.` : null,
      `Shows when ${S} grows up. How you raise ${P().o} now shapes it.`],
    ['💛','Favourite treat', rab.favKnown ? `${FAV_TREATS[rab.favTreat].emoji} ${FAV_TREATS[rab.favTreat].name}` : null,
      `Try different treats, or watch what ${S} begs for.`],
    ['💆','Favourite place for a rub', k.pet ? `${PET_SPOTS[pr.pet].emoji} ${cap(PET_SPOTS[pr.pet].name)}` : null,
      `Try stroking different parts of ${Pp} head: forehead, cheeks, behind the ears.`],
    ['🧸','Favourite toy', k.toy ? `${TOYS[pr.toy].emoji} ${TOYS[pr.toy].name}` : null,
      notOwned(pr.toy) ? `Maybe a toy you don't have yet.` : `Play together and watch which toy gets the biggest reaction.`],
    ['😴','Favourite nap spot', k.nap ? `${NAP_SPOTS[pr.nap].emoji} ${cap(NAP_SPOTS[pr.nap].name)}` : null,
      notOwned(pr.nap) ? `Maybe somewhere you haven't set up yet.` : `Watch where ${S} chooses to nap.`],
    ['🙅','Doesn’t like', k.dislike ? `${DISLIKES[pr.dislike].emoji} ${cap(DISLIKES[pr.dislike].name)}` : null,
      `Every rabbit has something. You'll find out, probably by accident.`],
    ['🌾','Hay', `${HAY_TYPES[rab.hayType].emoji} ${cap(HAY_TYPES[rab.hayType].name)}${rab.hayType==='alfalfa' && isAdult() ? ' — time to switch to Timothy' : ''}`, ''],
    ['🎂','Age', `${rab.ageDays} day(s) · ${st.label} ${st.name}`, ''],
  ];
  const found = [rab.favKnown,k.pet,k.toy,k.nap,k.dislike].filter(Boolean).length;
  const head=document.createElement('div'); head.className='balance';
  head.innerHTML=`You know <b>${found}/5</b> of ${esc(rab.name)}'s likes and dislikes.`;
  body.appendChild(head);
  rows.forEach(([emo,label,val,hint])=>{
    const row=document.createElement('div'); row.className='srow'+(val?'':' locked');
    row.innerHTML=`<div class="semoji">${val?emo:'❓'}</div><div class="sinfo"><div class="sname">${label}</div>
      <div class="sdesc">${val ? val : 'Not discovered yet. '+hint}</div></div>`;
    body.appendChild(row);
  });
}
function renderNotes(){
  const body=$('panelBody'); body.innerHTML='';
  notesTabs(body);
  if(notesTab==='about'){ renderAbout(body); return; }
  const head=document.createElement('div'); head.className='balance';
  head.innerHTML=`Learned <b>${Object.keys(notes).length}/${NOTES.length}</b>. Notes unlock when you see the behaviour yourself.`;
  body.appendChild(head);
  NOTES.forEach(n=>{
    const known=!!notes[n.id];
    const row=document.createElement('div'); row.className='srow'+(known?'':' locked');
    row.innerHTML = known
      ? `<div class="semoji">${n.emoji}</div><div class="sinfo"><div class="sname">${n.title}</div><div class="sdesc">${n.text}</div></div>`
      : `<div class="semoji">🔒</div><div class="sinfo"><div class="sname">Not seen yet</div><div class="sdesc">Hint: ${n.hint}</div></div>`;
    body.appendChild(row);
  });
}
function closePanel(){ panelOpen=null; $('panelWrap').classList.remove('show'); }

function renderShop(){
  const body=$('panelBody'); body.innerHTML='';
  const bal=document.createElement('div'); bal.className='balance';
  bal.innerHTML=`Balance: <b>${rab.carrots}🥕</b> &nbsp;·&nbsp; Bond Lv ${rab.bondLevel}`;
  body.appendChild(bal);
  SHOP.forEach(it=>{
    const adultLock = it.adult && !isAdult();          // Timothy Hay is for grown-ups
    const locked = rab.bondLevel < it.unlock || adultLock;
    const ownedPerm = ((it.type==='toy'||it.type==='decor'||it.type==='tool') && owns(it.id))
                   || (it.id==='timothy' && rab.hayType!=='alfalfa');
    const row=document.createElement('div'); row.className='srow'+(locked?' locked':'');
    const stock = it.type==='cure' ? ` ×${rab.items[it.id]||0}` : '';
    row.innerHTML=`<div class="semoji">${it.emoji}</div>
      <div class="sinfo"><div class="sname">${it.name}${stock}</div><div class="sdesc">${it.desc}</div></div>`;
    const btn=document.createElement('button'); btn.className='sbuy';
    if(locked){ btn.textContent= adultLock ? 'Adult' : `Lv ${it.unlock}`; btn.disabled=true; }
    else if(ownedPerm){ btn.textContent='Owned'; btn.disabled=true; }
    else { btn.textContent=`${it.cost}🥕`; btn.onclick=()=>buy(it.id); }
    row.appendChild(btn); body.appendChild(row);
  });
}
// where a piece of furniture sits, so she can hop over and chin it
function furnitureSpot(id){
  const m = {castle:world.castle, tower:world.tower, hutch:world.hutch, hammock:world.hammock,
             tunnel:world.tube, ball:world.ball, bed_cloud:world.bed, rug_rose:world.rug};
  return m[id] || null;
}
function buy(id){
  const it=shopItem(id); if(!it) return;
  if(rab.bondLevel<it.unlock) return;
  if(it.adult && !isAdult()) return;
  if(id==='timothy' && rab.hayType!=='alfalfa') return;   // already switched / switching
  if((it.type==='toy'||it.type==='decor'||it.type==='tool') && owns(it.id)){ return; }
  // A sulking bun refuses food from anyone — shop feed must honour the cold shoulder that
  // hand-feeding does, and abort before spending a single carrot.
  if(it.type==='feed' && rab.cold){
    if(id!==rab.favTreat){ coldRefuse(); return; }                 // only the favourite earns forgiveness
    if(!spendCarrots(it.cost)){ toast(`Not enough carrots — need ${it.cost}🥕, have ${rab.carrots}.`); return; }
    closePanel(); forgive(id); return;
  }
  // …and an unwell bun refuses treats (and a sick one everything) — also before any carrots are spent
  if(it.type==='feed' && refusesFood(id==='oxbow' ? 'pellets' : id)){ closePanel(); return; }
  if(!spendCarrots(it.cost)){ toast(`Not enough carrots — need ${it.cost}🥕, have ${rab.carrots}.`); return; }
  if(it.type==='feed'){
    if(id==='greens'){ stats.hunger=clamp(stats.hunger-30); stats.water=clamp(stats.water+18);
      rab.health=clamp(rab.health+8); addWeight(-2.5); }                              // second-best to hay
    else if(id==='oxbow'){ stats.hunger=clamp(stats.hunger-40); rab.health=clamp(rab.health+3);
      rab.pelletsToday++; addWeight(rab.pelletsToday<=2?2:6); }                        // premium pellets count too
    else if(id==='chews'){ stats.hunger=clamp(stats.hunger-8); stats.happy=clamp(stats.happy+10);
      stats.energy=clamp(stats.energy+6); addWeight(1.5); rab.thumps=clamp(rab.thumps-0.3,0,5); }   // treat
    stats.happy=clamp(stats.happy+6); spawnHeart(parts().head.x,parts().head.y);
    if(favReact(id)) startBinky();
    if(id==='oxbow' && rab.pelletsToday>2)
      { toast(`⚠️ That's ${P().p} ${ord(rab.pelletsToday)} scoop of pellets today — too many! Hay should be the main food.`); fireFact('pellet3'); }
    else toast(`Yum! ${it.name} served. 😋`);
  } else if(it.type==='cure'){
    rab.items[id]=(rab.items[id]||0)+1;
    toast(`Bought ${it.name}. The Vet will use it free when needed. 💊`);
  } else {
    rab.items[id]=1;
    if(id==='timothy'){                               // start the gradual switch off alfalfa
      rab.hayType='mixed'; rab.haySwitchDay=rab.day;
      toast(`Timothy Hay! It'll be mixed in with the alfalfa for ${HAY_MIX_DAYS} days — switching slowly is easier on ${P().p} gut. 🌾`);
      learnNote('haytypes', true); addXP(2); renderShop(); save(); return;
    }
    if(id==='rug_rose') rab.decor.rug='rose';         // room customization
    if(id==='bed_cloud') rab.decor.bed='cloud';       // upgraded bed
    toast(`Bought ${it.name}! ${it.emoji}`);
    const spot = furnitureSpot(id);
    if(spot && !rab.sick && !rab.cold){ hopTo(spot.x); rab.chinAt = now()+0.9; rab.chinName = it.name; }   // she goes to claim it
    if(it.type==='toy'||it.type==='decor'){
      const toys=['ball','tunnel','castle','tower','hutch','hammock'].filter(owns).length;
      if(toys>=3) unlockAch('toybox');
    }
    refreshActions();
  }
  addXP(2); renderShop(); save();
}

function renderGoals(inPanel){
  // list container lives in the panel; also keep a tiny summary badge count
  const badge=$('goalBadge');
  if(badge){ const done=rab.goals.filter(g=>g.done).length; badge.textContent=`${done}/${rab.goals.length}`; }
  if(!inPanel || panelOpen!=='goals') return;
  const body=$('panelBody'); body.innerHTML='';
  const head=document.createElement('div'); head.className='balance';
  head.innerHTML=`Complete goals for 🥕 & Bond XP. Refreshes each new day.`;
  body.appendChild(head);
  rab.goals.forEach(gg=>{
    const row=document.createElement('div'); row.className='grow'+(gg.done?' done':'');
    row.innerHTML=`<div class="gtext">${gg.done?'✅':'⬜'} ${esc(gg.text)}</div>
      <div class="gtrack"><div class="gfill" style="width:${Math.round(gg.prog/gg.target*100)}%"></div></div>
      <div class="greward">${gg.prog}/${gg.target} · +${gg.reward}🥕</div>`;
    body.appendChild(row);
  });
}

/* ---- Save codes (item 8): a compact base64 backup — the only guard against cleared
 *      browser storage. Bundles the save blob plus account-wide unlocks. Import validates
 *      before writing anything, so corrupt/hostile input never crashes or wipes a save. */
function buildSaveCode(){
  save();   // flush the latest state to storage first
  const data = loadRaw();
  if(!data) return null;   // storage unavailable — never hand out a junk code
  const payload = { c:'thump', v:2, save:data, unlocks, notes };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));   // unicode-safe base64
}
function parseSaveCode(code){
  code=(code||'').trim();
  if(!code || code.length>200000) return {ok:false, err:'That code isn’t readable.'};   // size cap: no quota blowups
  let payload;
  try{ payload = JSON.parse(decodeURIComponent(escape(atob(code)))); }
  catch(e){ return {ok:false, err:'That code isn’t readable.'}; }
  if(!payload || payload.c!=='thump' || payload.v!==2 || !payload.save || typeof payload.save!=='object')
    return {ok:false, err:'That code isn’t a Thumpagotchi save.'};
  const s = payload.save;
  if(!s.name || !s.stats || typeof s.day!=='number')
    return {ok:false, err:'That save is missing key fields.'};
  return {ok:true, payload};   // ranges are re-clamped by applySave on reload
}

function renderMenu(){
  const body=$('panelBody'); body.innerHTML='';
  const weightTxt = cap(weightStatus().txt);   // one source of truth for weight bands (see weightStatus())
  const masteryList = Object.keys(TRICKS).map(k=>{
    const unlocked = TRICKS[k].unlock<=rab.bondLevel;
    const m = Math.round(rab.mastery[k]||0);
    return `<div class="mrow"><span>${TRICKS[k].emoji} ${TRICKS[k].name}${unlocked?'':` <i>(Lv ${TRICKS[k].unlock})</i>`}</span>
      <span>${unlocked? m+'%' : '🔒'}</span></div>`;
  }).join('');
  const achDone=Object.keys(rab.achievements).length, achTotal=Object.keys(ACHS).length;
  body.innerHTML=`
    <div class="vitals">
      <div><b>${esc(rab.name)}</b> · ${cap(rab.sex)} · ${coat.name}</div>
      <div>Age: ${rab.ageDays} day(s) · ${stageFor(rab.ageDays).name} ${stageFor(rab.ageDays).label}</div>
      <div>Bond: Lv ${rab.bondLevel} (${rab.bondXP}/${xpNeeded(rab.bondLevel)} XP)</div>
      <div>Health: ${rab.sick?'🤒 in stasis — see the Vet':'watch how '+P().s+'’s eating'} · next checkup day ${rab.nextCheckupDay}</div>
      <div>Personality: ${rab.temper ? `${TEMPERS[rab.temper].emoji} ${TEMPERS[rab.temper].name}` : `still growing up (shows at Adult)`}</div>
      <div>Favourite treat: ${rab.favKnown ? `${FAV_TREATS[rab.favTreat].emoji} ${FAV_TREATS[rab.favTreat].name}` : 'not found yet'}</div>
      <div>Weight: ${Math.round(rab.weight)} · ${weightTxt}</div>
      <div>Carrots: ${rab.carrots}🥕 · Achievements: ${achDone}/${achTotal} 🏆</div>
    </div>
    <div class="mhdr">Room decor</div>
    <div class="mbtns">
      <button id="rugTeal" class="mbtn${!(rab.decor&&rab.decor.rug==='rose')?' on':''}">Teal Rug</button>
      <button id="rugRose" class="mbtn${(rab.decor&&rab.decor.rug==='rose')?' on':''}" ${owns('rug_rose')?'':'disabled'}>Rose Rug${owns('rug_rose')?'':' 🔒'}</button>
    </div>
    <div class="mbtns">
      <button id="bedBasic" class="mbtn${!(rab.decor&&rab.decor.bed==='cloud')?' on':''}">Basic Bed</button>
      <button id="bedCloud" class="mbtn${(rab.decor&&rab.decor.bed==='cloud')?' on':''}" ${owns('bed_cloud')?'':'disabled'}>Cloud Bed${owns('bed_cloud')?'':' 🔒'}</button>
    </div>
    <div class="mhdr">Trick mastery</div>${masteryList}
    <div class="mbtns">
      <button id="mSave" class="mbtn">💾 Save now</button>
      <button id="mReset" class="mbtn danger">🗑️ Rehome (reset)</button>
    </div>
    <div class="mhdr">Backup — save code</div>
    <div class="mbackup">
      <textarea id="saveCodeBox" class="mcode" readonly rows="3" placeholder="Tap “Export” to generate your save code…"></textarea>
      <div class="mbtns">
        <button id="mExport" class="mbtn">📤 Export</button>
        <button id="mCopy" class="mbtn" disabled>📋 Copy</button>
      </div>
      <textarea id="importBox" class="mcode" rows="3" placeholder="Paste a save code here to restore…"></textarea>
      <div class="mbtns"><button id="mImport" class="mbtn">📥 Import &amp; reload</button></div>
      <div class="mtip">Your save lives only in this browser. A save code is your one backup — copy it somewhere safe, or use it to move to another device.</div>
    </div>
    <div class="mtip">Tip: hay keeps weight healthy; bananas are treats (max 2/day). Neglect risks GI&nbsp;stasis — keep the Vet 🩺 and Gut Medicine 💊 in mind.</div>`;
  $('rugTeal').onclick=()=>{ rab.decor.rug=null; save(); renderMenu(); };
  $('rugRose').onclick=()=>{ if(owns('rug_rose')){ rab.decor.rug='rose'; save(); renderMenu(); } };
  $('bedBasic').onclick=()=>{ rab.decor.bed=null; save(); renderMenu(); };
  $('bedCloud').onclick=()=>{ if(owns('bed_cloud')){ rab.decor.bed='cloud'; save(); renderMenu(); } };
  $('mSave').onclick=()=>{ save(); toast('Game saved. 💾'); };
  $('mReset').onclick=()=>{
    if(confirm('Rehome your rabbit and start over? This erases your save.')){
      wipeSave(); location.reload();
    }
  };
  // --- Save codes (item 8) ---
  $('mExport').onclick=()=>{
    const code=buildSaveCode();
    if(!code){ toast('⚠️ Couldn’t read storage — no save to export.'); return; }
    const box=$('saveCodeBox'); box.value=code;
    box.focus(); box.select(); $('mCopy').disabled=false;
    toast('Save code ready — copy it somewhere safe. 📤');
  };
  $('mCopy').onclick=()=>{
    const box=$('saveCodeBox'); if(!box.value) return;
    box.focus(); box.select();
    const done=()=>toast('Copied to clipboard! 📋');
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(box.value).then(done,()=>{ try{document.execCommand('copy');done();}catch(e){toast('Copy failed — select the text and copy manually.');} });
    else { try{document.execCommand('copy');done();}catch(e){toast('Select the text and copy manually.');} }
  };
  $('mImport').onclick=()=>{
    const res=parseSaveCode($('importBox').value);
    if(!res.ok){ toast('⚠️ '+res.err+' Your current game is untouched.'); return; }
    const s=res.payload.save;
    if(!confirm(`Import ${s.name} (Day ${s.day||1})? This replaces your current rabbit.`)) return;
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      if(res.payload.unlocks && typeof res.payload.unlocks==='object')
        localStorage.setItem(UNLOCK_KEY, JSON.stringify(res.payload.unlocks));
      if(res.payload.notes && typeof res.payload.notes==='object'){   // keep only known note ids
        const clean={}; NOTES.forEach(n=>{ if(res.payload.notes[n.id]) clean[n.id]=num(res.payload.notes[n.id],1); });
        localStorage.setItem(NOTES_KEY, JSON.stringify({...notes, ...clean}));
      }
    }catch(e){ toast('⚠️ Couldn’t write to storage — import cancelled.'); return; }
    location.reload();
  };
}

/* ============================================================================ *
 *  INPUT
 * ============================================================================ */
function canvasPos(e){
  const r=canvas.getBoundingClientRect();
  const cx=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX)-r.left;
  const cy=(e.touches&&e.touches[0]?e.touches[0].clientY:e.clientY)-r.top;
  return {x:cx,y:cy};
}
function onDown(e){pointer.down=true;const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;
  if(pettingMode) $('game').style.cursor='grabbing';
  if(findRabbit(p.x,p.y)) return;
  if(tapCord(p.x,p.y)) return;
  handlePet(p.x,p.y); handleGroom(p.x,p.y);}
function onMove(e){const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;if(pointer.down){handlePet(p.x,p.y); handleGroom(p.x,p.y);}}
function onUp(){pointer.down=false; if(pettingMode) $('game').style.cursor='grab';}
// Register pointer handlers exactly once. Reset/import reload the page today, but guarding here
// means a future reload-free reset can't stack duplicate handlers (every pet would fire twice).
let _inputBound=false;
function bindInput(){
  if(_inputBound) return;
  _inputBound=true;
  canvas.addEventListener('mousedown',onDown);
  canvas.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();onDown(e);},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();onMove(e);},{passive:false});
  window.addEventListener('touchend',onUp);
}
bindInput();

function bind(id,fn){ const el=$(id); if(el) el.addEventListener('click',fn); }
bind('bHay',giveHay); bind('bPellets',givePellets); bind('bWater',giveWater);
bind('bBanana',offerBanana); bind('bPet',togglePetting); bind('bTrick',doTrick);
bind('bClean',cleanLitter); bind('bGroom',toggleGrooming); bind('bRest',restRabbit); bind('bPlay',playToy); bind('bVet',callVet);
bind('tbShop',()=>openPanel('shop')); bind('tbGoals',()=>openPanel('goals')); bind('tbMenu',()=>openPanel('menu'));
bind('tbNotes',()=>openPanel('notes')); updateNotesBadge();

// Games tab stays hidden until it's revealed (day 2, or immediately for established saves) — item 5.
// Individual games unlock on a schedule after that: Snake/Guess with the tab, Tic-Tac-Toe on day 3,
// Carrot Catch on day 4. Single source of truth for both goal availability and button visibility.
// The games menu: one row per game, in unlock order. `btn` is the (hidden) button whose existing
// click handler opens the game.
const GAMES = [
  {id:'snake',  btn:'bSnake', emoji:'🐍', name:'Bunny Snake',       day:2, desc:'Steer your rabbit to the banana slices without hitting the walls.'},
  {id:'guess',  btn:'bGuess', emoji:'🎲', name:'Guess My Number',   day:2, desc:'Guess the number your rabbit picked, 1–15, in 3 tries.'},
  {id:'forage', btn:'bForage',emoji:'🥣', name:'Forage',            day:2, desc:'Follow the treat under the shuffling cups.'},
  {id:'ttt',    btn:'bTtt',   emoji:'⭕', name:'Bunny Tic-Tac-Toe', day:3, desc:'You’re 🥕, your rabbit is 🌾.'},
  {id:'dig',    btn:'bDig',   emoji:'📦', name:'Dig Box',           day:3, desc:'Dig through shredded paper for buried treats.'},
  {id:'catch',  btn:'bCatch', emoji:'🥕', name:'Carrot Catch',      day:4, desc:'Catch falling carrots; dodge the wilted lettuce.'},
  {id:'safe',   btn:'bSafe',  emoji:'🥬', name:'Safe or Not?',      day:4, desc:'Which foods are OK for rabbits? Learn why.'},
  {id:'quiz',   btn:'bQuiz',  emoji:'🧠', name:'How well do you know me?', day:5, desc:'Your rabbit quizzes you on them and on 📖.'},
];
function renderGames(){
  const body=$('panelBody'); body.innerHTML='';
  const head=document.createElement('div'); head.className='balance';
  head.innerHTML=`Play together for 🥕 and Bond. New games open up over the first few days.`;
  body.appendChild(head);
  GAMES.forEach(g=>{
    const open=gameUnlocked(g.id);
    const why = !rab.gamesRevealed || rab.day<g.day ? `Day ${g.day}` : 'Learn more';   // quiz: needs enough known
    const row=document.createElement('div'); row.className='srow'+(open?'':' locked');
    row.innerHTML=`<div class="semoji">${g.emoji}</div><div class="sinfo"><div class="sname">${g.name}</div><div class="sdesc">${g.desc}</div></div>`;
    const b=document.createElement('button'); b.className='sbuy';
    if(open){ b.textContent='Play'; b.onclick=()=>{ closePanel(); $(g.btn).click(); }; }
    else { b.textContent=why; b.disabled=true; }
    row.appendChild(b); body.appendChild(row);
  });
}
function gameUnlocked(id){
  if(!rab.gamesRevealed) return false;
  if(id==='ttt' || id==='dig')    return rab.day>=3;
  if(id==='catch' || id==='safe') return rab.day>=4;
  if(id==='quiz')  return rab.day>=5 && quizReady();   // needs enough discovered to ask about
  return true;   // snake, guess
}
function applyGamesTab(){
  const t=$('tabGames'); if(t) t.style.display = rab.gamesRevealed ? '' : 'none';
  const bt=$('bTtt');   if(bt) bt.style.display   = gameUnlocked('ttt')   ? 'flex' : 'none';
  const bct=$('bCatch');if(bct) bct.style.display = gameUnlocked('catch') ? 'flex' : 'none';
  const bq=$('bQuiz');  if(bq) bq.style.display   = gameUnlocked('quiz')  ? 'flex' : 'none';
}

// bottom-dock sub-tabs (Care / Play / Health)
function setTab(name){
  document.querySelectorAll('.atab').forEach(b=>b.classList.toggle('on', b.dataset.tab===name));
  document.querySelectorAll('.actrow').forEach(r=>{ r.hidden = r.dataset.group!==name; });
}
// The 🎮 Games tab opens the games menu instead of a crowded row of buttons (the old buttons stay in
// the markup, hidden, so every game still opens through its own existing handler).
document.querySelectorAll('.atab').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.tab==='games'){ openPanel('games'); return; }
  setTab(b.dataset.tab);
}));
bind('panelClose',closePanel);
$('panelWrap').addEventListener('click',e=>{ if(e.target===$('panelWrap')) closePanel(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
window.addEventListener('beforeunload',save);

/* ============================================================================ *
 *  START / ADOPTION SCREEN
 * ============================================================================ */
let chosenCoat='sableGrey', chosenSex='buck', chosenBreed='holland';
const EXAMPLE_NAMES = { holland:'Mowgli', netherland:'Elvis', lionhead:'Tywin' };
function renderSwatches(breed){
  const sw=$('swatches'); sw.innerHTML='';
  const keys = BREED_COATS[breed] || BREED_COATS.holland;
  chosenCoat = BREED_DEFAULT_COAT[breed] || keys[0];
  keys.forEach(key=>{
    const co=COATS[key];
    // Two-tone swatch (body + the point colour that defines the coat), drawn on a
    // small canvas with the circle clipped IN the bitmap — CSS border-radius over a
    // gradient leaks square corners in some browsers, so we never rely on it.
    const d=document.createElement('canvas');
    const px=46, dpr=Math.min(window.devicePixelRatio||1, 3);
    d.width=px*dpr; d.height=px*dpr;
    const c=d.getContext('2d'); c.scale(dpr,dpr);
    c.beginPath(); c.arc(px/2, px/2, px/2, 0, Math.PI*2); c.clip();
    const g=c.createLinearGradient(0,0,px,px);
    if(co.tan){
      g.addColorStop(0,co.body);    g.addColorStop(0.50,co.body);
      g.addColorStop(0.50,co.tanCol); g.addColorStop(0.72,co.tanCol);
      g.addColorStop(0.72,co.point);  g.addColorStop(1,co.point);
    } else {
      g.addColorStop(0,co.body);       g.addColorStop(0.55,co.body);
      g.addColorStop(0.55,co.pointMid); g.addColorStop(0.78,co.pointMid);
      g.addColorStop(0.78,co.point);    g.addColorStop(1,co.point);
    }
    c.fillStyle=g; c.fillRect(0,0,px,px);
    c.strokeStyle='rgba(0,0,0,.14)'; c.lineWidth=1.6;          // soft inner rim
    c.beginPath(); c.arc(px/2, px/2, px/2-0.9, 0, Math.PI*2); c.stroke();
    d.className='swatch'+(key===chosenCoat?' on':'');
    d.title=co.name; d.dataset.key=key;
    d.addEventListener('click',()=>{
      chosenCoat=key;
      document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('on'));
      d.classList.add('on');
      $('coatName').textContent=co.name;
    });
    sw.appendChild(d);
  });
  $('coatName').textContent = COATS[chosenCoat].name;
}
function buildStart(){
  // ---- Breed selector (Lionhead gated behind the account-wide unlock) ----
  const lion=$('breedLion');
  if(lion){
    if(unlocks.lionhead){ lion.disabled=false; lion.textContent='🦁 Lionhead'; lion.title=''; }
    else { lion.disabled=true; lion.innerHTML='🦁 Lionhead<br><small>🔒 Bond Lv 5</small>'; lion.title='Reach Bond level 5 with a rabbit to unlock'; }
  }
  document.querySelectorAll('#breedSeg button').forEach(b=>{
    b.addEventListener('click',()=>{
      if(b.disabled) return;
      chosenBreed=b.dataset.breed;
      document.querySelectorAll('#breedSeg button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      renderSwatches(chosenBreed);
      $('nameInput').placeholder='e.g. '+(EXAMPLE_NAMES[chosenBreed]||'Mowgli');
    });
  });
  renderSwatches(chosenBreed);
  $('nameInput').placeholder='e.g. '+(EXAMPLE_NAMES[chosenBreed]||'Mowgli');

  document.querySelectorAll('#sexSeg button').forEach(b=>{
    b.addEventListener('click',()=>{
      chosenSex=b.dataset.sex;
      document.querySelectorAll('#sexSeg button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
    });
  });
  $('startBtn').addEventListener('click',()=>startGame(false));
  $('nameInput').addEventListener('keydown',e=>{ if(e.key==='Enter') startGame(false); });
  const cont=$('continueBtn');
  const saved=loadRaw();
  if(saved && saved.name){
    cont.style.display='block';
    cont.textContent=`▶ Continue with ${saved.name} (Day ${saved.day||1})`;
    cont.addEventListener('click',()=>startGame(true, saved));
  }
}
function beginLoop(){
  $('start').classList.add('hidden');
  initPaws(); refreshActions(); applyGamesTab(); setTab('care'); resize();
  rab.baseY=world.rug.y-6;
  renderGoals(); updateHUD();
  last=now();
  requestAnimationFrame(frame);
}
// Welcome-back catch-up: if she's been alone a long while, a gentle, capped drift —
// hungrier, thirstier, messier box, but never sick, never cold, never below safety floors (item 9).
const AWAY_MS = 12*60*60*1000;   // 12 real hours
function welcomeBack(){
  const away = rab.lastSeen ? Date.now()-rab.lastSeen : 0;
  if(away < AWAY_MS){ toast(`Welcome back! ${rab.name} missed you. 🐰`); return; }
  stats.hunger  = clamp(Math.max(stats.hunger, 62), 0, 92);   // hungry, not starving into crisis
  stats.water   = clamp(Math.min(stats.water, 45), 30, 100);  // thirsty, above the safety floor
  stats.hygiene = clamp(Math.min(stats.hygiene, 42), 30, 100);// box needs a tidy, not filthy
  stats.happy   = clamp(Math.max(stats.happy, 40), 40, 100);  // a touch mopey, never miserable
  rab.thumps    = clamp(Math.min(rab.thumps, 1.5), 0, 5);     // calm on return, never a grudge she didn't earn
  const colour = pick([
    `dug a crater in the litter box`,
    `rearranged every hay strand into one suspicious pile`,
    `binky'd at 3 a.m. and knocked the water bowl askew`,
    `flopped in your spot and won't admit it`,
    `chinned the entire room to reclaim it as ${P().p} own`,
  ]);
  save();
  toast(`👋 Welcome back! While you were away, ${rab.name} ${colour}. ${cap(P().s)}'s hungry and the box could use a tidy.`);
}
function startGame(fromSave, saved){
  if(started) return;
  started=true;
  if(fromSave && saved){
    applySave(saved);
    $('petName').textContent=rab.name;
    $('dayLbl').textContent='Day '+rab.day;
    if(!rab.goals.length || rab.goalDay!==rab.day){ rab.day<=1 ? setDay1Goals() : rollGoals(); }
    beginLoop();
    welcomeBack();
    return;
  }
  rab.breed = BREEDS[chosenBreed] ? chosenBreed : 'holland';
  coat = COATS[chosenCoat] || COATS[BREED_DEFAULT_COAT[rab.breed]] || COATS.sableGrey; coatKey=chosenCoat;
  rab.sex = chosenSex;
  const nm=($('nameInput').value||'').trim();
  rab.name = nm || pick(['Mowgli','Nutmeg','Clover','Waffles','Mochi','Pip','Biscuit','Bramble','Poppy']);
  $('petName').textContent=rab.name;
  rab.curScale=stageFor(0).scale;
  rab.favTreat = pick(Object.keys(FAV_TREATS));   // a secret to discover
  rab.prefs = rollPrefs(); rab.prefKnown = {}; rab.prefCount = {};   // …and so are these
  rab.hayType = 'alfalfa';                         // young rabbits start on alfalfa
  setDay1Goals();          // day 1 = the fixed tutorial goal set (item 2)
  unlockAch('firstDay');
  beginLoop();
  rab.x=world.rug.x;
  startBinky();
  toast(`Welcome home, ${rab.name}! ${cap(P().s)} does a happy binky. Care for ${P().o} to earn 🥕 and grow your Bond.`);
  save();
}

/* ============================================================================ *
 *  BUNNY SNAKE — a self-contained minigame (you play as your rabbit)
 * ============================================================================ */
const SNAKE_BEST_KEY = 'thumpagotchi.snakeBest';
const SN = { cols:17, rows:15, cell:22, snake:[], dir:{x:1,y:0}, nextDir:{x:1,y:0},
             food:{x:0,y:0}, score:0, best:0, timer:null, stepMs:150, state:'idle', on:false };
let snCanvas=null, snCtx=null;

function roundRectCtx(c2,x,y,w,h,r){
  r=Math.min(r,w/2,h/2); c2.beginPath(); c2.moveTo(x+r,y);
  c2.arcTo(x+w,y,x+w,y+h,r); c2.arcTo(x+w,y+h,x,y+h,r);
  c2.arcTo(x,y+h,x,y,r); c2.arcTo(x,y,x+w,y,r); c2.closePath();
}
function openSnake(){
  if(rab.cold){ coldRefuse(); return; }
  snCanvas = $('snakeCanvas'); snCtx = snCanvas.getContext('2d');
  try{ SN.best = parseInt(localStorage.getItem(SNAKE_BEST_KEY))||0; }catch(e){ SN.best=0; }
  $('snBest').textContent = SN.best;
  $('snake').classList.add('show');
  minigameActive = true;
  snResize(); snReset();
}
function closeSnake(){
  if(SN.timer){ clearInterval(SN.timer); SN.timer=null; }
  SN.on=false; SN.state='idle'; minigameActive=false;
  $('snake').classList.remove('show');
  last = now();   // prevent a giant dt when the pet sim resumes
}
function snResize(){
  const wCss = Math.min((window.innerWidth||360)*0.9, 440);
  SN.cell = Math.max(14, Math.floor(wCss/SN.cols));
  const w=SN.cell*SN.cols, h=SN.cell*SN.rows, dpr=Math.min(window.devicePixelRatio||1,2);
  snCanvas.style.width=w+'px'; snCanvas.style.height=h+'px';
  snCanvas.width=Math.floor(w*dpr); snCanvas.height=Math.floor(h*dpr);
  snCtx.setTransform(dpr,0,0,dpr,0,0);
}
function snReset(){
  SN.snake=[{x:8,y:7},{x:7,y:7},{x:6,y:7}];
  SN.dir={x:1,y:0}; SN.nextDir={x:1,y:0}; SN.score=0; SN.stepMs=150; SN.state='play'; SN.on=true;
  $('snScore').textContent=0; $('snakeOverlayMsg').classList.remove('show');
  snPlaceFood();
  if(SN.timer) clearInterval(SN.timer);
  SN.timer=setInterval(snStep, SN.stepMs);
  snDraw();
}
function snPlaceFood(){
  let p; do{ p={x:(Math.random()*SN.cols)|0, y:(Math.random()*SN.rows)|0}; }
  while(SN.snake.some(s=>s.x===p.x&&s.y===p.y));
  SN.food=p;
}
function snSetDir(x,y){
  if(SN.state!=='play') return;
  if(x===-SN.dir.x && y===-SN.dir.y) return;   // no instant reverse
  SN.nextDir={x,y};
}
function snStep(){
  if(SN.state!=='play') return;
  SN.dir=SN.nextDir;
  const head={x:SN.snake[0].x+SN.dir.x, y:SN.snake[0].y+SN.dir.y};
  if(head.x<0||head.y<0||head.x>=SN.cols||head.y>=SN.rows || SN.snake.some(s=>s.x===head.x&&s.y===head.y)){
    snGameOver(); return;
  }
  SN.snake.unshift(head);
  if(head.x===SN.food.x && head.y===SN.food.y){
    SN.score++; $('snScore').textContent=SN.score; snPlaceFood();
    if(SN.score%4===0 && SN.stepMs>78){ SN.stepMs-=8; clearInterval(SN.timer); SN.timer=setInterval(snStep,SN.stepMs); }
  } else { SN.snake.pop(); }
  snDraw();
}
function snGameOver(){
  SN.state='over'; SN.on=false;
  if(SN.timer){ clearInterval(SN.timer); SN.timer=null; }
  const reward = SN.score;
  if(reward>0){ addCarrots(reward); addXP(Math.min(15, SN.score)); }   // via addCarrots so 🏆 Tycoon can trigger
  if(SN.score>=SNAKE_GOAL) incGoal('g_snake');                          // daily goal: score N in a run
  const isBest = SN.score>SN.best && SN.score>0;
  if(isBest){ SN.best=SN.score; try{ localStorage.setItem(SNAKE_BEST_KEY, SN.best); }catch(e){} }
  $('snBest').textContent=SN.best;
  save();
  const msg=$('snakeOverlayMsg');
  msg.innerHTML=`<div class="mgover"><h3>${SN.score>0?'Nice run!':'Oops!'}</h3>
    <p>Score ${SN.score}${reward>0?` &middot; +${reward}🥕`:''}${isBest?' &middot; 🏆 new best!':''}</p>
    <div class="mgbtns"><button id="snRetry">Play again</button><button id="snDone">Done</button></div></div>`;
  msg.classList.add('show');
  $('snRetry').onclick=snReset;
  $('snDone').onclick=closeSnake;
}
function snDraw(){
  const c=SN.cell, ww=SN.cols*c, hh=SN.rows*c;
  snCtx.fillStyle='#5f958c'; snCtx.fillRect(0,0,ww,hh);          // rug-green board
  snCtx.fillStyle='rgba(255,255,255,.05)';
  for(let y=0;y<SN.rows;y++) for(let x=0;x<SN.cols;x++) snCtx.fillRect(x*c+c/2-1,y*c+c/2-1,2,2);
  // food = a little banana slice (cross-section)
  const fx=SN.food.x*c+c/2, fy=SN.food.y*c+c/2;
  snCtx.fillStyle='#e6bd45';
  snCtx.beginPath(); snCtx.arc(fx, fy, c*0.34, 0, 7); snCtx.fill();
  snCtx.fillStyle='#f6e08c';
  snCtx.beginPath(); snCtx.arc(fx, fy, c*0.25, 0, 7); snCtx.fill();
  snCtx.fillStyle='rgba(120,90,40,.55)';
  snCtx.beginPath(); snCtx.arc(fx, fy-c*0.07, c*0.032, 0, 7); snCtx.fill();
  snCtx.beginPath(); snCtx.arc(fx-c*0.07, fy+c*0.05, c*0.032, 0, 7); snCtx.fill();
  snCtx.beginPath(); snCtx.arc(fx+c*0.07, fy+c*0.05, c*0.032, 0, 7); snCtx.fill();
  // body segments in the rabbit's coat colours
  for(let i=SN.snake.length-1;i>=1;i--){
    const seg=SN.snake[i];
    snCtx.fillStyle = (i%2)? coat.bodySh : coat.body;
    roundRectCtx(snCtx, seg.x*c+2, seg.y*c+2, c-4, c-4, c*0.32); snCtx.fill();
  }
  // head = a clear little rabbit (upright ears, round face, eyes, pink nose)
  const h=SN.snake[0], cx=h.x*c+c/2, cy=h.y*c+c/2;
  snCtx.fillStyle=coat.body;
  snCtx.beginPath();snCtx.ellipse(cx-c*0.2, cy-c*0.46, c*0.11, c*0.34, -0.15, 0,7);snCtx.fill();
  snCtx.beginPath();snCtx.ellipse(cx+c*0.2, cy-c*0.46, c*0.11, c*0.34,  0.15, 0,7);snCtx.fill();
  snCtx.fillStyle=coat.pointMid;
  snCtx.beginPath();snCtx.ellipse(cx-c*0.2, cy-c*0.46, c*0.05, c*0.22, -0.15, 0,7);snCtx.fill();
  snCtx.beginPath();snCtx.ellipse(cx+c*0.2, cy-c*0.46, c*0.05, c*0.22,  0.15, 0,7);snCtx.fill();
  snCtx.fillStyle=coat.body;
  snCtx.beginPath();snCtx.arc(cx, cy+c*0.02, c*0.44, 0,7);snCtx.fill();
  snCtx.fillStyle='#140f0b';
  snCtx.beginPath();snCtx.arc(cx-c*0.17, cy-c*0.02, c*0.08,0,7);snCtx.fill();
  snCtx.beginPath();snCtx.arc(cx+c*0.17, cy-c*0.02, c*0.08,0,7);snCtx.fill();
  snCtx.fillStyle='#c86a72';
  snCtx.beginPath();snCtx.ellipse(cx, cy+c*0.16, c*0.05, c*0.04, 0,0,7);snCtx.fill();
}
/* wiring (runs once at load; DOM is ready since the script is at end of <body>) */
(function wireSnake(){
  window.addEventListener('keydown', e=>{
    if(!SN.on) return;
    if(e.key==='ArrowUp'||e.key==='w') snSetDir(0,-1);
    else if(e.key==='ArrowDown'||e.key==='s') snSetDir(0,1);
    else if(e.key==='ArrowLeft'||e.key==='a') snSetDir(-1,0);
    else if(e.key==='ArrowRight'||e.key==='d') snSetDir(1,0);
    else return;
    e.preventDefault();
  });
  document.querySelectorAll('#snake .mgpad button').forEach(b=>{
    b.addEventListener('click',()=>{ const d=b.dataset.d;
      if(d==='up')snSetDir(0,-1); else if(d==='down')snSetDir(0,1);
      else if(d==='left')snSetDir(-1,0); else snSetDir(1,0); });
  });
  const cv=$('snakeCanvas'); let tsx=0,tsy=0;
  cv.addEventListener('touchstart',e=>{ const t=e.touches[0]; tsx=t.clientX; tsy=t.clientY; },{passive:true});
  cv.addEventListener('touchend',e=>{ const t=e.changedTouches[0]; const dx=t.clientX-tsx, dy=t.clientY-tsy;
    if(Math.abs(dx)<16 && Math.abs(dy)<16) return;
    if(Math.abs(dx)>Math.abs(dy)) snSetDir(dx>0?1:-1,0); else snSetDir(0,dy>0?1:-1); },{passive:true});
  window.addEventListener('resize',()=>{ if(snCanvas && $('snake').classList.contains('show')){ snResize(); snDraw(); } });
  bind('bSnake', openSnake);
  bind('snakeClose', closeSnake);
})();

/* ============================================================================ *
 *  GUESS MY NUMBER — a light gamble (you guess the bunny's number)
 *  Fixed range 1–15, 3 tries. Win = +30🥕. Losing is harmless — she just teases.
 * ============================================================================ */
const GS = { on:false, secret:0, max:15, guesses:0, done:false };
function openGuess(){
  if(rab.cold){ coldRefuse(); return; }
  GS.max = 15;
  GS.secret = 1 + Math.floor(Math.random()*GS.max);
  GS.guesses = 0; GS.done = false; GS.on = true;
  minigameActive = true;
  $('gFace').textContent = rab.thumps>=3 ? '😾' : '🐰';
  $('gBubble').textContent = `I'm thinking of a number from 1 to ${GS.max}… bet you can't guess it!`;
  $('gHint').textContent = ''; $('gMsg').className='gmsg'; $('gMsg').innerHTML='';
  renderGuessLives(); renderGuessPad();
  $('guess').classList.add('show');
}
function closeGuess(){ GS.on=false; minigameActive=false; $('guess').classList.remove('show'); last=now(); }
function renderGuessLives(){
  const el=$('gLives'); el.innerHTML='';
  for(let i=0;i<3;i++) el.appendChild(Object.assign(document.createElement('span'),{textContent:i<(3-GS.guesses)?'🐾':'✖'}));
}
function renderGuessPad(){
  const pad=$('gPad'); pad.innerHTML=''; pad.className='gpad';
  for(let n=1;n<=GS.max;n++){
    const b=document.createElement('button'); b.textContent=n; b.onclick=()=>guessNum(n,b); pad.appendChild(b);
  }
}
function guessNum(n,btn){
  if(GS.done) return;
  if(btn) btn.disabled=true;
  GS.guesses++;
  if(n===GS.secret){ guessWin(); return; }
  $('gHint').textContent = n<GS.secret ? `⬆️  Higher than ${n}…` : `⬇️  Lower than ${n}…`;
  renderGuessLives();
  if(GS.guesses>=3) guessLose();
}
function guessEndCard(html){ const m=$('gMsg'); m.innerHTML=html+`<div class="mgbtns"><button id="gAgain">Play again</button><button id="gDone2">Done</button></div>`;
  m.className='gmsg show'; $('gAgain').onclick=openGuess; $('gDone2').onclick=closeGuess; }
function guessWin(){
  GS.done=true; GS.on=false;
  addCarrots(30, rab.x, rab.baseY-60); addXP(15); stats.happy=clamp(stats.happy+14); rab.thumps=clamp(rab.thumps-1,0,5);
  incGoal('g_guess');   // daily goal: win Guess My Number
  startBinky();
  $('gFace').textContent='😻'; $('gBubble').textContent=`It WAS ${GS.secret}! You read my mind! 🥕`;
  guessEndCard(`<h3>Correct! +30🥕</h3>`); save();
}
function guessLose(){
  GS.done=true; GS.on=false;   // no penalty — she just gloats
  $('gFace').textContent='😏'; $('gBubble').textContent=`It was ${GS.secret}! Better luck next time~`;
  guessEndCard(`<h3>It was ${GS.secret} — ${cap(P().s)} wins this round 🐰</h3>`); save();
}
bind('bGuess', openGuess);
bind('guessClose', closeGuess);

/* ============================================================================ *
 *  "HOW WELL DO YOU KNOW ME?" — the rabbit quizzes the owner (day-5 unlock).
 *  Questions only come from things the player has DISCOVERED about this rabbit or UNLOCKED
 *  in Rabbit Notes, so it rewards paying attention, and every wrong answer teaches.
 * ============================================================================ */
// One question per Rabbit Note, asked in the rabbit's voice. a = right answer, w = wrong answers.
const QUIZ_NOTES = {
  thump:   {q:'When I thump my back foot, I’m…', a:'Warning of danger, or annoyed', w:['Asking for a treat','Happy to see you']},
  binky:   {q:'A leap with a twist in mid-air is called a…', a:'Binky', w:['Flop','Thump']},
  flop:    {q:'If I flop over onto my side, it means…', a:'I feel completely safe', w:['I’m unwell','I’m ignoring you']},
  purr:    {q:'Soft teeth grinding while you pet me means…', a:'I’m content', w:['I’m in pain','I’m hungry']},
  grind:   {q:'Loud teeth grinding while I sit hunched means…', a:'I’m in pain and need a vet', w:['I’m content','I’m sleepy']},
  chin:    {q:'Why do I rub my chin on things?', a:'To mark them as mine with scent', w:['My chin itches','To file my teeth']},
  fav:     {q:'Why should you know my favourite treat?', a:'If I refuse it, something may be wrong', w:['So you can give it all day','It doesn’t matter']},
  refuse:  {q:'If I stop eating, you should…', a:'Take me to the vet the same day', w:['Wait a few days','Give me more pellets']},
  droppings:{q:'Fewer or smaller droppings can mean…', a:'My gut is slowing down', w:['I’m extra healthy','I drank too much']},
  stasis:  {q:'What keeps my gut moving?', a:'Unlimited hay', w:['Lots of fruit','Extra pellets']},
  hay:     {q:'What should most of my diet be?', a:'Hay', w:['Pellets','Fruit']},
  sugar:   {q:'Why are sweet treats like banana limited?', a:'Sugar upsets my gut', w:['They make me too bouncy','They dull my fur']},
  grudge:  {q:'After you upset me, trust comes back with…', a:'Space, time and a favourite treat', w:['Picking me up more','Nothing, ever']},
  dawn:    {q:'When am I most active?', a:'Dawn and dusk', w:['Midday','Only at midnight']},
  zoomies: {q:'Wild laps around the room mean…', a:'I’m happy and full of energy', w:['I’m scared','I’m unwell']},
  bored:   {q:'If I dig the carpet or chew the baseboard, I’m probably…', a:'Bored', w:['Hungry','Cold']},
  tricks:  {q:'How do rabbits learn tricks?', a:'Patience, with a favourite treat as a reward', w:['Being told off','They can’t']},
  temper:  {q:'What shapes the rabbit I grow up to be?', a:'Gentle care while I’m young', w:['Only my breed','Nothing at all']},
  forage:  {q:'Why hide my food in cups, boxes or paper?', a:'Foraging keeps me busy and happy', w:['To keep it fresh','So I eat less']},
  safefoods:{q:'Which of these is poisonous to me?', a:'Avocado', w:['Romaine lettuce','Cilantro']},
  haytypes:{q:'Which hay suits a grown-up rabbit?', a:'Grass hay, like timothy', w:['Alfalfa','No hay, just pellets']},
};
const QUIZ_DISLIKE = {rump:'Being brushed on my haunches', nose:'Having my nose touched',
                      ball:'The Treat Ball', tunnel:'The Play Tunnel', tower:'The Climbing Tower'};
function quizOthers(all, right, n){ return all.filter(x=>x!==right).sort(()=>Math.random()-0.5).slice(0,n); }
// Build every question the player could fairly be asked right now.
function quizPool(){
  const Q=[], pr=rab.prefs, k=rab.prefKnown;
  const ask=(q,a,w,why,about)=>Q.push({q,a,w,why,about});
  if(rab.favKnown){ const all=Object.values(FAV_TREATS).map(t=>t.name);
    ask('What’s my favourite treat?', FAV_TREATS[rab.favTreat].name, quizOthers(all,FAV_TREATS[rab.favTreat].name,2), `${FAV_TREATS[rab.favTreat].emoji} It’s ${FAV_TREATS[rab.favTreat].name.toLowerCase()}!`, true); }
  if(k.pet){ const all=Object.values(PET_SPOTS).map(s=>cap(s.name));
    ask('Where do I love a rub the most?', cap(PET_SPOTS[pr.pet].name), quizOthers(all,cap(PET_SPOTS[pr.pet].name),2), `${PET_SPOTS[pr.pet].emoji} ${cap(PET_SPOTS[pr.pet].name)}, every time.`, true); }
  if(k.toy){ const all=Object.values(TOYS).map(t=>t.name);
    ask('Which toy do I love most?', TOYS[pr.toy].name, quizOthers(all,TOYS[pr.toy].name,2), `${TOYS[pr.toy].emoji} The ${TOYS[pr.toy].name}!`, true); }
  if(k.nap){ const all=Object.values(NAP_SPOTS).map(s=>cap(s.name));
    ask('Where’s my favourite nap spot?', cap(NAP_SPOTS[pr.nap].name), quizOthers(all,cap(NAP_SPOTS[pr.nap].name),2), `${NAP_SPOTS[pr.nap].emoji} ${cap(NAP_SPOTS[pr.nap].name)}.`, true); }
  if(k.dislike){ const all=Object.values(QUIZ_DISLIKE);
    ask('What do I NOT like?', QUIZ_DISLIKE[pr.dislike], quizOthers(all,QUIZ_DISLIKE[pr.dislike],2), `${DISLIKES[pr.dislike].emoji} Please remember that one.`, true); }
  if(rab.temper){ const all=Object.values(TEMPERS).map(t=>t.name);
    ask('What kind of personality do I have?', TEMPERS[rab.temper].name, quizOthers(all,TEMPERS[rab.temper].name,2), `${TEMPERS[rab.temper].emoji} ${TEMPERS[rab.temper].name}. That’s me!`, true); }
  NOTES.forEach(n=>{ const Z=QUIZ_NOTES[n.id]; if(notes[n.id] && Z) ask(Z.q, Z.a, Z.w, n.text, false); });
  return Q;
}
const QUIZ_LEN = 5, QUIZ_MIN = 4;
function quizReady(){ return quizPool().length >= QUIZ_MIN; }
const QZ = { on:false, qs:[], i:0, right:0, answered:false };
function openQuiz(){
  if(rab.cold){ coldRefuse(); return; }
  const pool=quizPool();
  if(pool.length<QUIZ_MIN){ toast(`Learn a little more about ${rab.name} first — check 📖.`); return; }
  // lead with questions about her (up to 2), then fill with rabbit-care questions
  const about=pool.filter(q=>q.about).sort(()=>Math.random()-0.5), care=pool.filter(q=>!q.about).sort(()=>Math.random()-0.5);
  const pickN=[...about.slice(0,2), ...care].slice(0,QUIZ_LEN);
  while(pickN.length<Math.min(QUIZ_LEN,pool.length)){ const extra=about.find(q=>!pickN.includes(q)); if(!extra) break; pickN.push(extra); }
  QZ.qs=pickN.sort(()=>Math.random()-0.5); QZ.i=0; QZ.right=0; QZ.on=true;
  minigameActive=true;
  $('qTitle').textContent=`🧠 How well do you know ${rab.name}?`;
  $('qMsg').className='gmsg'; $('qMsg').innerHTML='';
  $('quiz').classList.add('show');
  quizShow();
}
function closeQuiz(){ QZ.on=false; minigameActive=false; $('quiz').classList.remove('show'); last=now(); }
function quizShow(){
  const Q=QZ.qs[QZ.i]; QZ.answered=false;
  $('qFace').textContent='🐰'; $('qBubble').textContent=Q.q;
  $('qProg').textContent=QZ.qs.map((_,j)=>j<QZ.i?'🐾':j===QZ.i?'◉':'·').join(' ');
  $('qExplain').innerHTML='';
  const box=$('qOpts'); box.innerHTML=''; box.style.display='';
  [Q.a, ...Q.w].sort(()=>Math.random()-0.5).forEach(opt=>{
    const b=document.createElement('button'); b.textContent=opt;
    b.onclick=()=>quizAnswer(opt,b); box.appendChild(b);
  });
}
function quizAnswer(opt,btn){
  if(QZ.answered) return; QZ.answered=true;
  const Q=QZ.qs[QZ.i], ok=opt===Q.a;
  if(ok) QZ.right++;
  $('qOpts').querySelectorAll('button').forEach(b=>{ b.disabled=true; if(b.textContent===Q.a) b.classList.add('right'); });
  if(!ok) btn.classList.add('wrong');
  $('qFace').textContent = ok ? '😻' : '🙀';
  $('qBubble').textContent = ok ? pick(['Yes! You know me!','Exactly right!','Correct! 🥕']) : pick(['Nope!','Not quite…','Hmm, no!']);
  const last_ = QZ.i===QZ.qs.length-1;
  $('qExplain').innerHTML = `${esc(Q.why)}<br><button id="qNext">${last_?'See score':'Next question'}</button>`;
  $('qNext').onclick=()=>{ if(last_) quizEnd(); else { QZ.i++; quizShow(); } };
  $('qNext').focus();
}
function quizEnd(){
  QZ.on=false;
  const n=QZ.qs.length, r=QZ.right, perfect = r===n;
  // the pool is small, so only the first round each day pays — later rounds are practice
  const paid = rab.quizPaidDay!==rab.day;
  let carrots = paid ? r*3 + (perfect?10:0) : 0;
  if(paid) rab.quizPaidDay=rab.day;
  if(carrots) addCarrots(carrots, rab.x, rab.baseY-60);
  if(paid) addXP(r*3 + (perfect?8:0));
  stats.happy=clamp(stats.happy + r*2);
  if(perfect){ incGoal('g_quiz'); startBinky(); }
  $('qOpts').innerHTML=''; $('qOpts').style.display='none'; $('qExplain').innerHTML='';
  $('qProg').textContent='';
  $('qFace').textContent = perfect ? '😻' : r>=n/2 ? '🐰' : '🙄';
  $('qBubble').textContent = perfect ? `You really know me. Best human.` : r>=n/2 ? `Not bad! You're getting to know me.` : `Do you even know me? Keep watching!`;
  const m=$('qMsg');
  m.innerHTML=`<h3>${r}/${n} right${carrots?` · +${carrots}🥕`:''}</h3>${paid?'':'<p>Practice round — carrots pay once a day.</p>'}<div class="mgbtns"><button id="qAgain">Play again</button><button id="qDone">Done</button></div>`;
  m.className='gmsg show'; $('qAgain').onclick=openQuiz; $('qDone').onclick=closeQuiz;
  save();
}
bind('bQuiz', openQuiz);
bind('quizClose', closeQuiz);

/* ============================================================================ *
 *  FORAGE — the cup game. Her treat goes under a cup, the cups shuffle, you pick.
 *  3 rounds, each faster with more swaps; a miss ends the game. Real enrichment:
 *  rabbits forage, and hiding food under cups is a common foraging toy.
 * ============================================================================ */
const FG = { on:false, round:0, won:0, slots:[0,1,2], treatCup:1, busy:true };
const F_SLOT = ['0%','37%','74%'];
const forageTreat = () => rab.favKnown ? FAV_TREATS[rab.favTreat].emoji : '🥕';   // never gives the favourite away
function forageCups(fn){ for(let c=0;c<3;c++) fn($('fCup'+c), c); }
function forageLayout(){
  forageCups((el,c)=>{ el.style.left=F_SLOT[FG.slots[c]]; });
  $('fTreat').style.left=F_SLOT[FG.slots[FG.treatCup]];
}
function openForage(){
  if(rab.cold){ coldRefuse(); return; }
  FG.on=true; FG.round=0; FG.won=0; minigameActive=true;
  $('fMsg').className='gmsg'; $('fMsg').innerHTML=''; $('fStage').style.display='';
  $('fTreat').textContent=forageTreat();
  $('forage').classList.add('show');
  forageRound();
}
function closeForage(){ FG.on=false; minigameActive=false; $('forage').classList.remove('show'); last=now(); }
function forageRound(){
  FG.round++; FG.busy=true; FG.slots=[0,1,2]; FG.treatCup=Math.floor(Math.random()*3);
  const speed=[0.42,0.30,0.22][FG.round-1], swaps=[4,6,8][FG.round-1];
  $('fProg').textContent=[1,2,3].map(n=>n<FG.round?'🐾':n===FG.round?'◉':'·').join(' ');
  $('fFace').textContent='🐰';
  $('fBubble').textContent = FG.round===1 ? 'Watch where my treat goes…' : FG.round===2 ? 'Faster this time!' : 'Last one, fastest!';
  forageCups(el=>{ el.disabled=true; el.classList.remove('up'); el.style.transitionDuration=speed+'s'; });
  $('fTreat').style.transitionDuration='0s';
  forageLayout(); $('fTreat').style.visibility='visible';
  const cup=$('fCup'+FG.treatCup); cup.classList.add('up');          // show where it starts
  setTimeout(()=>{ if(!FG.on) return;
    cup.classList.remove('up');
    setTimeout(()=>{ if(!FG.on) return;
      $('fTreat').style.visibility='hidden';
      let n=0;
      const step=()=>{ if(!FG.on) return;
        if(n++>=swaps){ FG.busy=false; forageCups(el=>{ el.disabled=false; }); $('fBubble').textContent='Which cup is it under?'; return; }
        const a=Math.floor(Math.random()*3), b=(a+1+Math.floor(Math.random()*2))%3;   // two different slots
        const ca=FG.slots.indexOf(a), cb=FG.slots.indexOf(b);
        FG.slots[ca]=b; FG.slots[cb]=a; forageLayout();
        setTimeout(step, speed*1000+70);
      };
      step();
    }, 450);
  }, 1100);
}
function forageTap(c){
  if(FG.busy || !FG.on) return;
  FG.busy=true; forageCups(el=>{ el.disabled=true; });
  forageLayout(); $('fTreat').style.visibility='visible';
  const right = c===FG.treatCup;
  $('fCup'+FG.treatCup).classList.add('up');
  if(!right) $('fCup'+c).classList.add('up');
  if(right){ FG.won++; $('fFace').textContent='😻'; $('fBubble').textContent=pick(['Found it!','Yes! Treat time!','You were watching!']); }
  else { $('fFace').textContent='😏'; $('fBubble').textContent='Nope, it was over here!'; }
  setTimeout(()=>{ if(!FG.on) return;
    if(right && FG.round<3) forageRound(); else forageEnd();
  }, 1300);
}
function forageEnd(){
  const all = FG.won===3;
  const carrots = FG.won*4 + (all?4:0);
  if(carrots) addCarrots(carrots, rab.x, rab.baseY-60);
  addXP(FG.won*3); stats.happy=clamp(stats.happy + FG.won*3);
  learnNote('forage');
  if(all){ incGoal('g_forage'); startBinky(); }
  $('fStage').style.display='none'; $('fProg').textContent='';
  $('fFace').textContent = all ? '😻' : '🐰';
  $('fBubble').textContent = all ? 'Three for three! That was fun.' : 'Good foraging. Again?';
  const m=$('fMsg');
  m.innerHTML=`<h3>${FG.won}/3 found${carrots?` · +${carrots}🥕`:''}</h3><div class="mgbtns"><button id="fAgain">Play again</button><button id="fDone">Done</button></div>`;
  m.className='gmsg show'; $('fAgain').onclick=openForage; $('fDone').onclick=closeForage;
  save();
}
bind('bForage', openForage);
bind('forageClose', closeForage);
for(let c=0;c<3;c++) bind('fCup'+c, ()=>forageTap(c));

/* ============================================================================ *
 *  DIG BOX — a 4×4 box of shredded paper with 5 buried treats and 2 pebbles.
 *  Empty spots show 👃N: how many treats are right next to them (a little
 *  minesweeper), so it's skill, not luck. Dig boxes are real rabbit enrichment.
 * ============================================================================ */
const DG = { on:false, over:true, cells:[], found:0, total:5, time:20, timer:null };
const DIG_TIME=20, DIG_SIZE=4;
function digNeighbours(i){
  const r=Math.floor(i/DIG_SIZE), c=i%DIG_SIZE, out=[];
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(!dr && !dc) continue;
    const rr=r+dr, cc=c+dc;
    if(rr>=0 && rr<DIG_SIZE && cc>=0 && cc<DIG_SIZE) out.push(rr*DIG_SIZE+cc);
  }
  return out;
}
function digHud(){ $('dTime').textContent=DG.time; $('dFound').textContent=DG.found; $('dTotal').textContent=DG.total; }
function openDig(){
  if(rab.cold){ coldRefuse(); return; }
  clearInterval(DG.timer);
  DG.on=true; DG.over=false; DG.found=0; DG.time=DIG_TIME; minigameActive=true;
  const order=[...Array(DIG_SIZE*DIG_SIZE).keys()].sort(()=>Math.random()-0.5);
  DG.cells=Array(DIG_SIZE*DIG_SIZE).fill('empty');
  order.slice(0,DG.total).forEach(i=>DG.cells[i]='treat');
  order.slice(DG.total,DG.total+2).forEach(i=>DG.cells[i]='pebble');
  const grid=$('dGrid'); grid.innerHTML=''; grid.style.display='';
  DG.cells.forEach((_,i)=>{
    const b=document.createElement('button'); b.setAttribute('aria-label',`Dig spot ${i+1}`);
    b.onclick=()=>digAt(i,b); grid.appendChild(b);
  });
  $('dMsg').className='gmsg'; $('dMsg').innerHTML='';
  digHud(); $('dig').classList.add('show');
  DG.timer=setInterval(()=>{ if(!DG.on||DG.over) return; DG.time--; digHud(); if(DG.time<=0) digEnd(); }, 1000);
}
function closeDig(){ clearInterval(DG.timer); DG.on=false; DG.over=true; minigameActive=false; $('dig').classList.remove('show'); last=now(); }
function digAt(i,b){
  if(DG.over || b.classList.contains('dug') || b.classList.contains('found')) return;
  const cell=DG.cells[i];
  if(cell==='treat'){
    b.classList.add('found'); b.textContent = rab.favKnown && Math.random()<0.4 ? FAV_TREATS[rab.favTreat].emoji : pick(['🥕','🌿']);
    DG.found++;
  } else if(cell==='pebble'){
    b.classList.add('dug'); b.textContent='🪨'; DG.time=Math.max(0,DG.time-2);
  } else {
    b.classList.add('dug');
    const n=digNeighbours(i).filter(j=>DG.cells[j]==='treat').length;
    b.textContent = n ? `👃${n}` : '·';
  }
  digHud();
  if(DG.found>=DG.total || DG.time<=0) digEnd();
}
function digEnd(){
  if(DG.over) return;
  DG.over=true; clearInterval(DG.timer);
  const all = DG.found>=DG.total;
  // show where the rest were hiding
  [...$('dGrid').children].forEach((b,i)=>{ b.disabled=true; if(DG.cells[i]==='treat' && !b.classList.contains('found')){ b.textContent='🥕'; b.style.opacity='.45'; } });
  const carrots = DG.found*2 + (all?5:0);
  if(carrots) addCarrots(carrots, rab.x, rab.baseY-60);
  addXP(DG.found*2); stats.happy=clamp(stats.happy + DG.found*2);
  learnNote('forage');
  if(all){ incGoal('g_dig'); startBinky(); }
  const m=$('dMsg');
  m.innerHTML=`<h3>${all?'Every treat found!':`${DG.found}/${DG.total} found`}${carrots?` · +${carrots}🥕`:''}</h3><div class="mgbtns"><button id="dAgain">Dig again</button><button id="dDone">Done</button></div>`;
  m.className='gmsg show'; $('dAgain').onclick=openDig; $('dDone').onclick=closeDig;
  save();
}
bind('bDig', openDig);
bind('digClose', closeDig);

/* ============================================================================ *
 *  SAFE OR NOT? — tap whether a food is OK for rabbits; every answer says why.
 *  Food list fact-checked 25 Sep 2026 against RSPCA, PDSA, House Rabbit Society and RWAF;
 *  only foods where those sources AGREE are included. Deliberately left out as ambiguous:
 *  carrot root and banana (sugary treats, not "safe" or "unsafe"), spinach/kale/parsley/broccoli
 *  leaves (safe but limited), celery (choking caveat), lilies (evidence is for cats).
 * ============================================================================ */
const SAFE_FOODS = [
  {e:'🌾', n:'Timothy hay',            ok:true,  why:'Hay should be most of what a rabbit eats.'},
  {e:'🥬', n:'Romaine lettuce',        ok:true,  why:'A dark, leafy lettuce: a good everyday green.'},
  {e:'🌿', n:'Cilantro (coriander)',   ok:true,  why:'A leafy herb that’s fine every day.'},
  {e:'🌿', n:'Basil',                  ok:true,  why:'A safe herb for daily greens.'},
  {e:'🌱', n:'Mint',                   ok:true,  why:'A safe herb that lots of rabbits love.'},
  {e:'🥕', n:'Carrot tops (the leaves)',ok:true, why:'The leafy tops are healthier than the carrot itself.'},
  {e:'🫑', n:'Bell pepper',            ok:true,  why:'Safe, crunchy veg in small portions.'},
  {e:'🌼', n:'Dandelion greens',       ok:true,  why:'Dandelion leaves are a natural, healthy green.'},
  {e:'🍎', n:'Apple slice (no seeds)', ok:true,  why:'A small piece is a fine treat. Always remove the seeds.'},
  {e:'🍓', n:'Strawberry',             ok:true,  why:'Fine as a small, occasional treat.'},
  {e:'🍫', n:'Chocolate',              ok:false, why:'Chocolate is poisonous to rabbits.'},
  {e:'🧅', n:'Onion',                  ok:false, why:'Onions can damage a rabbit’s blood cells.'},
  {e:'🧄', n:'Garlic',                 ok:false, why:'Garlic can damage a rabbit’s blood cells too.'},
  {e:'🥑', n:'Avocado',                ok:false, why:'Avocado has a toxin that can harm a rabbit’s heart.'},
  {e:'🥬', n:'Iceberg lettuce',        ok:false, why:'Mostly water with little nutrition, and it can upset the tummy.'},
  {e:'🌱', n:'Rhubarb',                ok:false, why:'Rhubarb is poisonous to rabbits.'},
  {e:'🍏', n:'Apple seeds (pips)',     ok:false, why:'Apple seeds are poisonous, so always remove them.'},
  {e:'🍞', n:'Bread',                  ok:false, why:'Too starchy: it upsets a rabbit’s gut.'},
  {e:'🥛', n:'Yogurt drops',           ok:false, why:'Sugary dairy treats can make rabbits seriously ill.'},
  {e:'🌸', n:'Foxglove',               ok:false, why:'Foxglove is a poisonous plant that affects the heart.'},
];
const SF = { on:false, list:[], i:0, right:0, answered:false };
function openSafe(){
  if(rab.cold){ coldRefuse(); return; }
  const mix=a=>a.sort(()=>Math.random()-0.5);
  SF.list = mix([...mix(SAFE_FOODS.filter(f=>f.ok)).slice(0,5), ...mix(SAFE_FOODS.filter(f=>!f.ok)).slice(0,5)]);
  SF.i=0; SF.right=0; SF.on=true; minigameActive=true;
  $('sMsg').className='gmsg'; $('sMsg').innerHTML=''; $('sBtns').style.display='';
  $('sTotal').textContent=SF.list.length;
  $('safe').classList.add('show');
  safeShow();
}
function closeSafe(){ SF.on=false; minigameActive=false; $('safe').classList.remove('show'); last=now(); }
function safeShow(){
  const f=SF.list[SF.i]; SF.answered=false;
  $('sFood').textContent=f.e; $('sName').textContent=f.n; $('sScore').textContent=SF.right;
  $('sExplain').innerHTML=''; $('sYes').disabled=false; $('sNo').disabled=false;
}
function safeAnswer(saidOk){
  if(SF.answered || !SF.on) return; SF.answered=true;
  const f=SF.list[SF.i], right = saidOk===f.ok;
  if(right) SF.right++;
  $('sScore').textContent=SF.right; $('sYes').disabled=true; $('sNo').disabled=true;
  const last_ = SF.i===SF.list.length-1;
  $('sExplain').innerHTML = `<b>${right?'✅ Right!':'❌ Not quite.'}</b> ${f.ok?'Safe':'Not safe'}: ${esc(f.why)}<br><button id="sNext">${last_?'See score':'Next food'}</button>`;
  $('sNext').onclick=()=>{ if(last_) safeEnd(); else { SF.i++; safeShow(); } };
  $('sNext').focus();
}
function safeEnd(){
  SF.on=false;
  const n=SF.list.length, r=SF.right;
  // a small fixed list is easy to memorise, so like the quiz only the first round each day pays
  const paid = rab.safePaidDay!==rab.day;
  const carrots = paid ? r*2 : 0;
  if(paid){ rab.safePaidDay=rab.day; addXP(r*2); }
  if(carrots) addCarrots(carrots, rab.x, rab.baseY-60);
  learnNote('safefoods');
  if(r>=8) incGoal('g_safe');
  $('sBtns').style.display='none'; $('sExplain').innerHTML='';
  $('sFood').textContent = r>=8 ? '🏅' : '🥬'; $('sName').textContent = r>=8 ? 'You know your rabbit food!' : 'Keep learning. It matters!';
  const m=$('sMsg');
  m.innerHTML=`<h3>${r}/${n} right${carrots?` · +${carrots}🥕`:''}</h3>${paid?'':'<p>Practice round — carrots pay once a day.</p>'}<div class="mgbtns"><button id="sAgain">Play again</button><button id="sDone">Done</button></div>`;
  m.className='gmsg show'; $('sAgain').onclick=openSafe; $('sDone').onclick=closeSafe;
  save();
}
bind('bSafe', openSafe);
bind('safeClose', closeSafe);
bind('sYes', ()=>safeAnswer(true));
bind('sNo',  ()=>safeAnswer(false));
bind('rpsBtn', ()=>location.reload());

/* ============================================================================ *
 *  BUNNY TIC-TAC-TOE — you're 🥕, she's 🌾 (day-3 unlock).
 *  The AI is DELIBERATELY imperfect: ~70% of her moves are optimal (minimax),
 *  the rest a random legal move — so a win is earnable, never free, never denied.
 * ============================================================================ */
const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const TTT = { board:[], over:false, on:false, busy:false };
function tttWinner(b){
  for(const [a,c,d] of TTT_LINES){ if(b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]; }
  return b.every(x=>x) ? 'draw' : null;
}
function tttCanWin(b,who){
  for(let i=0;i<9;i++){ if(b[i]) continue; b[i]=who; const win=tttWinner(b)===who; b[i]=''; if(win) return true; }
  return false;
}
// minimax from the bunny's ('h') perspective — she maximises, the player ('c') minimises
function tttMinimax(b, turn){
  const w=tttWinner(b);
  if(w==='h') return {score:10};
  if(w==='c') return {score:-10};
  if(w==='draw') return {score:0};
  let best = turn==='h' ? {score:-Infinity, move:-1} : {score:Infinity, move:-1};
  for(let i=0;i<9;i++){
    if(b[i]) continue;
    b[i]=turn;
    const s=tttMinimax(b, turn==='h'?'c':'h').score;
    b[i]='';
    if(turn==='h' ? s>best.score : s<best.score) best={score:s, move:i};
  }
  return best;
}
function tttAIMove(){
  const empties=[]; for(let i=0;i<9;i++) if(!TTT.board[i]) empties.push(i);
  if(!empties.length) return;
  let move;
  if(Math.random()<0.70){ const r=tttMinimax(TTT.board.slice(),'h'); if(r.move>=0) move=r.move; }
  if(move===undefined) move = pick(empties);   // the 30% slip (or a fallback)
  TTT.board[move]='h';
}
function openTtt(){
  if(rab.cold){ coldRefuse(); return; }
  TTT.board=Array(9).fill(''); TTT.over=false; TTT.on=true; TTT.busy=false;
  minigameActive=true;
  $('tttMsg').className='gmsg'; $('tttMsg').innerHTML='';
  $('tttFace').textContent='🐰';
  $('tttBubble').textContent="You're 🥕, I'm 🌾 — three in a row wins!";
  renderTtt();
  $('ttt').classList.add('show');
}
function closeTtt(){ TTT.on=false; TTT.busy=false; minigameActive=false; $('ttt').classList.remove('show'); last=now(); }
function renderTtt(){
  const bd=$('tttBoard'); bd.innerHTML='';
  for(let i=0;i<9;i++){
    const cell=document.createElement('button');
    cell.className='tttcell';
    cell.textContent = TTT.board[i]==='c'?'🥕' : TTT.board[i]==='h'?'🌾' : '';
    cell.disabled = !!TTT.board[i] || TTT.over || TTT.busy;
    cell.onclick=()=>tttPlay(i);
    bd.appendChild(cell);
  }
}
function tttReact(){
  const b=TTT.board;
  if(tttCanWin(b,'h')){ $('tttFace').textContent='😼'; $('tttBubble').textContent='Hehe… three little hays coming up. 🌾'; }
  else if(tttCanWin(b,'c')){ $('tttFace').textContent='😧'; $('tttBubble').textContent="Hey — don't you dare line those up!"; }
  else { $('tttFace').textContent='🐰'; $('tttBubble').textContent='Your move, friend. 🥕'; }
}
function tttPlay(i){
  if(TTT.over || TTT.busy || !TTT.on || TTT.board[i]) return;
  TTT.board[i]='c';
  let w=tttWinner(TTT.board);
  if(w){ renderTtt(); tttEndGame(w); return; }
  // her turn: brief think, block input meanwhile
  TTT.busy=true; renderTtt();
  setTimeout(()=>{
    if(!$('ttt').classList.contains('show') || TTT.over) return;   // closed mid-think
    tttAIMove();
    const w2=tttWinner(TTT.board);
    TTT.busy=false; renderTtt();
    if(w2){ tttEndGame(w2); return; }
    tttReact();
  }, 460);
}
function tttEndGame(w){
  TTT.over=true; TTT.on=false; TTT.busy=false; renderTtt();
  let title;
  if(w==='c'){
    addCarrots(20, rab.x, rab.baseY-60); addXP(12); incGoal('g_ttt');
    stats.happy=clamp(stats.happy+6);
    $('tttFace').textContent='😿'; $('tttBubble').textContent='Nooo, you got three! 🥕';
    title='You win! +20🥕';
  } else if(w==='h'){
    stats.happy=clamp(stats.happy+8); startBinky();
    $('tttFace').textContent='😼'; $('tttBubble').textContent='Three hays in a row — I win! 🌾';
    title=`${esc(rab.name)} wins! 🌾`;
  } else {
    addCarrots(5);
    $('tttFace').textContent='😐'; $('tttBubble').textContent='A tie! Good game. 🤝';
    title='Draw · +5🥕';
  }
  save();
  const m=$('tttMsg');
  m.innerHTML=`<h3>${title}</h3><div class="mgbtns"><button id="tttAgain">Play again</button><button id="tttDone">Done</button></div>`;
  m.className='gmsg show';
  $('tttAgain').onclick=openTtt; $('tttDone').onclick=closeTtt;
}
bind('bTtt', openTtt);
bind('tttClose', closeTtt);

/* ============================================================================ *
 *  CARROT CATCH — slide the bunny to catch falling 🥕, dodge wilted 🥬 (day-4).
 *  A reflex game to balance the cerebral roster; speed + spawn rate ramp with score.
 * ============================================================================ */
const CATCH_BEST_KEY = 'thumpagotchi.catchBest';
const CC = { on:false, over:false, score:0, best:0, lives:3, items:[], pops:[],
             bx:0, vx:0, spawnT:0, speed:1, W:320, H:416, bw:64, raf:null, lastT:0 };
let ccCanvas=null, ccCtx=null;

function openCatch(){
  if(rab.cold){ coldRefuse(); return; }
  ccCanvas=$('catchCanvas'); ccCtx=ccCanvas.getContext('2d');
  try{ CC.best=parseInt(localStorage.getItem(CATCH_BEST_KEY))||0; }catch(e){ CC.best=0; }
  $('ccBest').textContent=CC.best;
  minigameActive=true; $('catch').classList.add('show'); $('catchOverlayMsg').className='mgmsg';
  ccResize(); ccReset();
}
function closeCatch(){
  CC.on=false; if(CC.raf){ cancelAnimationFrame(CC.raf); CC.raf=null; }
  minigameActive=false; $('catch').classList.remove('show'); last=now();
}
function ccResize(){
  const wCss=Math.min((window.innerWidth||360)*0.86, 360);
  CC.W=Math.round(wCss); CC.H=Math.round(wCss*1.3);
  const dpr=Math.min(window.devicePixelRatio||1,2);
  ccCanvas.style.width=CC.W+'px'; ccCanvas.style.height=CC.H+'px';
  ccCanvas.width=Math.round(CC.W*dpr); ccCanvas.height=Math.round(CC.H*dpr);
  ccCtx.setTransform(dpr,0,0,dpr,0,0);
  CC.bw=Math.round(CC.W*0.20);
  CC.bx=clamp(CC.bx||CC.W/2, CC.bw/2, CC.W-CC.bw/2);
}
function ccLivesUI(){ $('ccLives').textContent='❤'.repeat(CC.lives)+'🖤'.repeat(Math.max(0,3-CC.lives)); }
function ccReset(){
  CC.score=0; CC.lives=3; CC.items=[]; CC.pops=[]; CC.speed=1; CC.spawnT=0; CC.vx=0;
  CC.bx=CC.W/2; CC.over=false; CC.on=true;
  $('ccScore').textContent=0; ccLivesUI(); $('catchOverlayMsg').className='mgmsg';
  CC.lastT=now(); if(CC.raf) cancelAnimationFrame(CC.raf); CC.raf=requestAnimationFrame(ccFrame);
}
function ccSpawn(){
  const badChance = clamp(0.15 + CC.score*0.006, 0.15, 0.42);   // more wilted lettuce as you climb
  const bad = Math.random()<badChance;
  const r = CC.W*0.052;
  CC.items.push({ x:rand(CC.W*0.10, CC.W*0.90), y:-r, r, bad,
                  vy: CC.H*(0.30+CC.speed*0.11)*rand(0.9,1.12) });   // px/sec
}
function ccHit(){ if(CC.over) return;   // two bad items in the same frame must not run ccEnd() twice
  CC.lives--; ccLivesUI(); if(CC.lives<=0) ccEnd(); }
function ccFrame(){
  if(!CC.on) return;
  const t=now(); let dt=t-CC.lastT; CC.lastT=t; dt=Math.min(dt,0.033);
  // difficulty ramp
  CC.speed = 1 + CC.score*0.06;
  const spawnEvery = Math.max(0.42, 0.9 - CC.score*0.02);
  CC.spawnT += dt;
  if(CC.spawnT>=spawnEvery){ CC.spawnT=0; ccSpawn(); }
  // keyboard glide
  if(CC.vx) CC.bx = clamp(CC.bx + CC.vx*dt, CC.bw/2, CC.W-CC.bw/2);
  // advance + resolve items
  const catchY = CC.H-40;
  const keep=[];
  for(const it of CC.items){
    it.y += it.vy*dt;
    const inBand = it.y>=catchY-it.r && it.y<=catchY+16;
    const overBunny = Math.abs(it.x-CC.bx) < CC.bw/2 + it.r*0.6;
    if(inBand && overBunny){
      if(it.bad){ ccHit(); }
      else { CC.score++; $('ccScore').textContent=CC.score; CC.pops.push({x:it.x,y:catchY,t:0}); }
      continue;   // consumed
    }
    if(it.y > CC.H+22){ if(!it.bad) ccHit(); continue; }   // a dropped carrot costs a life; lettuce is safe
    keep.push(it);
  }
  CC.items=keep;
  for(const p of CC.pops) p.t+=dt;
  CC.pops=CC.pops.filter(p=>p.t<0.4);
  ccDraw();
  if(CC.on) CC.raf=requestAnimationFrame(ccFrame);
}
function ccEnd(){
  CC.over=true; CC.on=false;
  if(CC.raf){ cancelAnimationFrame(CC.raf); CC.raf=null; }
  const reward=CC.score;
  if(reward>0){ addCarrots(reward); addXP(Math.min(15,CC.score)); }   // 1🥕 per carrot caught
  const isBest = CC.score>CC.best && CC.score>0;
  if(isBest){ CC.best=CC.score; try{ localStorage.setItem(CATCH_BEST_KEY,CC.best); }catch(e){} }
  $('ccBest').textContent=CC.best;
  if(CC.score>=10){ stats.happy=clamp(stats.happy+5); startBinky(); }
  save();
  const m=$('catchOverlayMsg');
  m.innerHTML=`<div class="mgover"><h3>${CC.score>0?'Nice catching!':'Butterfingers!'}</h3>
    <p>Caught ${CC.score}${reward>0?` &middot; +${reward}🥕`:''}${isBest?' &middot; 🏆 new best!':''}</p>
    <div class="mgbtns"><button id="ccRetry">Play again</button><button id="ccDone">Done</button></div></div>`;
  m.className='mgmsg show';
  $('ccRetry').onclick=ccReset; $('ccDone').onclick=closeCatch;
}
function ccCarrot(c,x,y,r){
  c.fillStyle='#5aa64b';                                   // leafy top
  c.beginPath(); c.moveTo(x,y-r*1.35); c.lineTo(x-r*0.5,y-r*0.45); c.lineTo(x+r*0.5,y-r*0.45); c.closePath(); c.fill();
  c.fillStyle='#e8892b';                                   // body
  c.beginPath(); c.moveTo(x-r*0.6,y-r*0.42); c.lineTo(x+r*0.6,y-r*0.42); c.lineTo(x,y+r*1.15); c.closePath(); c.fill();
  c.strokeStyle='rgba(255,255,255,.4)'; c.lineWidth=1.4;   // ridges
  c.beginPath(); c.moveTo(x-r*0.24,y-r*0.12); c.lineTo(x-r*0.08,y+r*0.24);
  c.moveTo(x+r*0.2,y-r*0.12); c.lineTo(x+r*0.06,y+r*0.24); c.stroke();
}
function ccLettuce(c,x,y,r){
  c.fillStyle='#8a9a5b';
  c.beginPath(); c.ellipse(x,y,r*0.98,r*0.82,0,0,7); c.fill();
  c.fillStyle='#727f45';
  c.beginPath(); c.ellipse(x-r*0.22,y+r*0.1,r*0.5,r*0.42,0,0,7); c.fill();
  c.beginPath(); c.ellipse(x+r*0.28,y-r*0.08,r*0.34,r*0.3,0,0,7); c.fill();
  c.strokeStyle='rgba(50,60,30,.5)'; c.lineWidth=1.4;      // droopy wilt veins
  c.beginPath(); c.moveTo(x-r*0.45,y-r*0.15); c.lineTo(x+r*0.45,y-r*0.05);
  c.moveTo(x-r*0.3,y+r*0.25); c.lineTo(x+r*0.35,y+r*0.2); c.stroke();
}
function ccDraw(){
  const c=ccCtx, W=CC.W, H=CC.H;
  const bg=c.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#bfe0ea'); bg.addColorStop(0.62,'#e5d9bf'); bg.addColorStop(1,'#d4b48a');
  c.fillStyle=bg; c.fillRect(0,0,W,H);
  c.fillStyle='rgba(120,80,40,.16)'; c.fillRect(0,H-26,W,26);   // floor strip the bunny stands on
  for(const it of CC.items){ it.bad ? ccLettuce(c,it.x,it.y,it.r) : ccCarrot(c,it.x,it.y,it.r); }
  // catch pops
  for(const p of CC.pops){ const a=1-p.t/0.4, rr=CC.W*0.05*(1+p.t*4);
    c.strokeStyle=`rgba(255,220,120,${a})`; c.lineWidth=2; c.beginPath(); c.arc(p.x,p.y,rr,0,7); c.stroke(); }
  ccBunny(c, CC.bx, H-30, CC.bw);
}
function ccBunny(c,x,yBase,w){
  const r=w*0.44, cx=x, cy=yBase;
  c.fillStyle='#b3854f'; roundRectCtx(c, x-w/2, cy+r*0.25, w, r*0.85, 6); c.fill();   // little basket
  c.strokeStyle='rgba(80,50,25,.5)'; c.lineWidth=1.4;
  for(let i=1;i<4;i++){ const bx=x-w/2+w*i/4; c.beginPath(); c.moveTo(bx,cy+r*0.28); c.lineTo(bx,cy+r*1.05); c.stroke(); }
  c.fillStyle=coat.body;                                    // ears
  c.beginPath();c.ellipse(cx-r*0.42,cy-r*0.92,r*0.18,r*0.5,-0.12,0,7);c.fill();
  c.beginPath();c.ellipse(cx+r*0.42,cy-r*0.92,r*0.18,r*0.5, 0.12,0,7);c.fill();
  c.fillStyle=coat.pointMid;
  c.beginPath();c.ellipse(cx-r*0.42,cy-r*0.92,r*0.08,r*0.3,-0.12,0,7);c.fill();
  c.beginPath();c.ellipse(cx+r*0.42,cy-r*0.92,r*0.08,r*0.3, 0.12,0,7);c.fill();
  c.fillStyle=coat.body;                                    // head
  c.beginPath();c.arc(cx,cy-r*0.05,r*0.72,0,7);c.fill();
  c.fillStyle='#140f0b';                                    // eyes
  c.beginPath();c.arc(cx-r*0.26,cy-r*0.08,r*0.1,0,7);c.fill();
  c.beginPath();c.arc(cx+r*0.26,cy-r*0.08,r*0.1,0,7);c.fill();
  c.fillStyle='#c86a72';                                    // nose
  c.beginPath();c.ellipse(cx,cy+r*0.16,r*0.1,r*0.075,0,0,7);c.fill();
}
(function wireCatch(){
  const cv=$('catchCanvas');
  const move=(clientX)=>{ if(!CC.on) return; const rct=cv.getBoundingClientRect();
    CC.bx=clamp((clientX-rct.left)*(CC.W/rct.width), CC.bw/2, CC.W-CC.bw/2); };
  cv.addEventListener('mousemove',e=>move(e.clientX));
  cv.addEventListener('touchstart',e=>{ e.preventDefault(); move(e.touches[0].clientX); },{passive:false});
  cv.addEventListener('touchmove', e=>{ e.preventDefault(); move(e.touches[0].clientX); },{passive:false});
  window.addEventListener('keydown',e=>{ if(!CC.on) return;
    if(e.key==='ArrowLeft'){ CC.vx=-CC.W*1.8; e.preventDefault(); }
    else if(e.key==='ArrowRight'){ CC.vx=CC.W*1.8; e.preventDefault(); } });
  window.addEventListener('keyup',e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight') CC.vx=0; });
  window.addEventListener('resize',()=>{ if(ccCanvas && $('catch').classList.contains('show')){ ccResize(); ccDraw(); } });
  bind('bCatch', openCatch); bind('catchClose', closeCatch);
})();

/* ---------------- Boot ---------------- */
loadUnlocks();
buildStart();
resize();

})();
