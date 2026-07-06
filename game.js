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
const COATS = {
  sableGrey:  {name:'Sable Point (Grey)',  body:'#f2ebd9', bodySh:'#dbd0b6', hi:'#fefaf0', point:'#4c443d', pointMid:'#7d7469', sable:true },
  sableSepia: {name:'Sable Point (Sepia)', body:'#f6efdd', bodySh:'#e6d8b8', hi:'#fffdf4', point:'#3f2a1e', pointMid:'#6b4a34', sable:true },
  chestnut:   {name:'Chestnut',            body:'#b47c44', bodySh:'#8f5f30', hi:'#d6a066', point:'#5a3a20', pointMid:'#7a4f2c', sable:false},
  black:      {name:'Black',               body:'#413a34', bodySh:'#2b2622', hi:'#5f564d', point:'#171412', pointMid:'#342e29', sable:false},
  blue:       {name:'Blue (Grey)',         body:'#909196', bodySh:'#727379', hi:'#bcbdc3', point:'#4d4e53', pointMid:'#6b6c71', sable:false},
  fawn:       {name:'Fawn / Orange',       body:'#e2ab61', bodySh:'#c98f47', hi:'#f4cb88', point:'#c07f3d', pointMid:'#dba25a', sable:false},
  // ---- Netherland Dwarf coats ----
  ndBlackTan: {name:'Black & Tan',         body:'#2c2825', bodySh:'#1a1613', hi:'#463d36', point:'#100d0b', pointMid:'#2b2622', sable:false, tan:true, tanCol:'#c68a3e', belly:'#f2ece0'},
  ndBlueOtter:{name:'Blue Otter',          body:'#8f9096', bodySh:'#6f7076', hi:'#b6b7bd', point:'#4a4b50', pointMid:'#67686d', sable:false, tan:true, tanCol:'#ddd2be'},
  ndChestnut: {name:'Chestnut Agouti',     body:'#9a6b3c', bodySh:'#79512b', hi:'#c08c52', point:'#4a2f18', pointMid:'#6b4526', sable:false},
  ndTort:     {name:'Tortoise',            body:'#cd925a', bodySh:'#a06f3d', hi:'#e6ad72', point:'#3c2416', pointMid:'#6e4526', sable:false},
  // ---- Lionhead coats ----
  lhTort:     {name:'Tortoise',            body:'#d79a5e', bodySh:'#b57a40', hi:'#eeb87b', point:'#3a2417', pointMid:'#6b4327', sable:false},
  lhREW:      {name:'Ruby-Eyed White',     body:'#f4f0e4', bodySh:'#ddd6c4', hi:'#ffffff', point:'#cfc6b2', pointMid:'#e4dccb', sable:false, eye:'#c0303a'},
  lhBlack:    {name:'Black',               body:'#413a34', bodySh:'#2b2622', hi:'#5f564d', point:'#171412', pointMid:'#342e29', sable:false},
  lhChestnut: {name:'Chestnut',            body:'#b47c44', bodySh:'#8f5f30', hi:'#d6a066', point:'#5a3a20', pointMid:'#7a4f2c', sable:false},
};
let coat = COATS.sableGrey;
let coatKey = 'sableGrey';

/* ---------------- Breeds ----------------
   Each breed has its own silhouette: lop vs. upright ears, an optional mane,
   and body/head proportions. Lionhead unlocks account-wide at Bond level 10. */
const BREEDS = {
  holland:    {name:'Holland Lop',      ears:'lop', mane:false, scale:1.0,  headScale:1.0,               idealLbs:3.5, emoji:'🐰', desc:'Floppy lop ears, cobby & chill.'},
  netherland: {name:'Netherland Dwarf', ears:'up',  mane:false, scale:0.72, headScale:1.16, earLen:0.95, idealLbs:2.2, emoji:'🐇', desc:'Tiny body, big head, upright ears.'},   // a dwarf stays visibly small, even grown
  lionhead:   {name:'Lionhead',         ears:'up',  mane:true,  scale:0.94, headScale:1.06, earLen:1.2,  idealLbs:3.0, emoji:'🦁', desc:'A majestic fluffy mane.', unlock:'bond5'},
};
const BREED_COATS = {
  holland:    ['sableGrey','sableSepia','chestnut','black','blue','fawn'],
  netherland: ['ndBlackTan','ndBlueOtter','ndChestnut','ndTort'],
  lionhead:   ['lhTort','lhREW','lhBlack','lhChestnut'],
};
const BREED_DEFAULT_COAT = { holland:'sableGrey', netherland:'ndBlackTan', lionhead:'lhTort' };

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

const TRICKS = {   // unlock gates by Bond level; energy is the cost to perform
  flop:    {name:'Flop',      emoji:'😌', unlock:1, energy:5,  dur:1.8},
  spin:    {name:'Spin',      emoji:'🌀', unlock:1, energy:9,  dur:1.0},
  binky:   {name:'Binky',     emoji:'✨', unlock:1, energy:13, dur:0.85},
  beg:     {name:'Beg',       emoji:'🙏', unlock:2, energy:6,  dur:1.4},
  highfive:{name:'High-Five', emoji:'🖐️', unlock:4, energy:7,  dur:1.0},
  jump:    {name:'Hurdle',    emoji:'⤴️', unlock:6, energy:15, dur:1.1},
};

const SHOP = [   // type: feed(instant) · cure(stock) · toy/decor(permanent) · tool(permanent)
  {id:'greens',  name:'Leafy Greens',    emoji:'🥬', cost:8,  type:'feed', unlock:1, desc:'Healthy: −hunger, +water, +health, trims weight.'},
  {id:'oxbow',   name:'Premium Pellets', emoji:'🥣', cost:14, type:'feed', unlock:1, desc:'Big hunger cut with less weight gain than banana.'},
  {id:'medicine',name:'Gut Medicine',    emoji:'💊', cost:20, type:'cure', unlock:1, desc:'Keep one on hand — the Vet uses it free to cure stasis.'},
  {id:'groom',   name:'Grooming Kit',    emoji:'🪮', cost:16, type:'tool', unlock:1, desc:'Cleaning also grooms: extra happiness + Bond, less molt.'},
  {id:'ball',    name:'Treat Ball',      emoji:'🧸', cost:18, type:'toy',  unlock:1, desc:'Enrichment: unlocks Play, slows happiness decay.'},
  {id:'tunnel',  name:'Play Tunnel',     emoji:'🕳️', cost:26, type:'toy',  unlock:2, desc:'More Play value and energy from zoomies.'},
  {id:'castle',  name:'Cardboard Castle',emoji:'🏰', cost:44, type:'decor',unlock:3, desc:'Cosy hideout — a little happiness every day.'},
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
const GOAL_POOL = [
  () => ({track:'hay',    target:2,  reward:7,  text:'Serve fresh hay ×2'}),
  () => ({track:'trick',  target:3,  reward:9,  text:'Perform ×3 tricks'}),
  () => ({track:'clean',  target:1,  reward:6,  text:'Scoop the litter box'}),
  () => ({track:'water',  target:1,  reward:5,  text:'Refill the water bowl'}),
  () => ({track:'pet',    target:10, reward:7,  text:'Give ×10 head pets'}),
  () => ({track:'binky',  target:2,  reward:9,  text:'Spark ×2 binkies'}),
  () => ({track:'happy90',target:1,  reward:9,  text:'Reach 90% Happiness'}),
  () => ({track:'play',   target:2,  reward:8,  text:'Play together ×2'}),
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
  world.floorY = H*0.56;
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
  world.win   = {x:W*0.5-W*0.11, y:H*0.06, w:W*0.22, h:H*0.28};
  rab.baseY = world.rug.y - 6;
  rab.x = clamp(rab.x||world.rug.x, world.rug.x-world.rug.rx*0.6, world.rug.x+world.rug.rx*0.6);
}
window.addEventListener('resize', resize);

/* ============================================================================ *
 *  GAME STATE
 * ============================================================================ */
const stats = { happy:80, hunger:30, water:85, hygiene:90, energy:75 };
const rab = {
  name:'Mowgli', sex:'doe', breed:'holland',
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
  boxT:0, boxYOff:0, decor:{rug:null,bed:null}, petReact:0,
  begUntil:0, begCooldown:0, begWant:'🍌', denUntil:0,
  maxAngerCount:0, weightStrikes:0, pelletsToday:0, _obeseT:0, _obeseWarned:false,
  // v2 "first ten minutes" state — persisted flags + runtime-only scripting timers
  firedCards:{}, gamesRevealed:false, baitDone:false, thumpSeen:false, exitBeatShown:false, lastSeen:0,
  petArmedOnce:false, baitAt:0, fallbackThumpBy:0,
  // progression
  bondLevel:1, bondXP:0, carrots:12,
  weight:100, health:100, sick:false, sickAt:0,
  items:{}, mastery:{}, achievements:{},
  goals:[], goalDay:0, goalCounters:{},
  lifetimePets:0,
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
let pointer = {x:-999,y:-999,down:false,moved:0};
let lastPetGain = 0, lastFeetPet = 0;
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
      weight:rab.weight, health:rab.health, sick:rab.sick,
      items:rab.items, mastery:rab.mastery, achievements:rab.achievements,
      goals:rab.goals, goalDay:rab.goalDay, goalCounters:rab.goalCounters,
      lifetimePets:rab.lifetimePets, decor:rab.decor,
      maxAngerCount:rab.maxAngerCount, weightStrikes:rab.weightStrikes, pelletsToday:rab.pelletsToday,
      // v2 first-session flags + a heartbeat for welcome-back catch-up
      firedCards:rab.firedCards, gamesRevealed:rab.gamesRevealed,
      baitDone:rab.baitDone, thumpSeen:rab.thumpSeen, exitBeatShown:rab.exitBeatShown,
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
  rab.name=d.name||'Mowgli'; rab.sex=d.sex||'doe';
  rab.breed = d.breed && BREEDS[d.breed] ? d.breed : 'holland';
  coatKey = d.coatKey && COATS[d.coatKey] ? d.coatKey : (BREED_DEFAULT_COAT[rab.breed]||'sableGrey');
  coat = COATS[coatKey];
  const ds=d.stats||{};
  for(const k of Object.keys(stats)) stats[k]=clamp(num(ds[k], stats[k]));
  rab.thumps=clamp(num(d.thumps,0),0,5); rab.cold=!!d.cold; rab.bananasToday=num(d.bananasToday,0);
  rab.day=Math.max(1,Math.round(num(d.day,1))); rab.ageDays=Math.max(0,Math.round(num(d.ageDays,0)));
  timeOfDay=clamp(num(d.timeOfDay,0.05),0,1);
  rab.bondLevel=Math.max(1,Math.round(num(d.bondLevel,1))); rab.bondXP=Math.max(0,num(d.bondXP,0));
  rab.carrots=Math.max(0,Math.round(num(d.carrots,12)));
  rab.weight=clamp(num(d.weight,100),45,175); rab.health=clamp(num(d.health,100)); rab.sick=!!d.sick;
  rab.items=d.items||{}; rab.mastery=d.mastery||{}; rab.achievements=d.achievements||{};
  rab.goals=Array.isArray(d.goals)?d.goals:[]; rab.goalDay=num(d.goalDay,0); rab.goalCounters=d.goalCounters||{};
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
  // the Play goal is only rollable once a toy is owned (otherwise it can't be completed)
  const hasToy = owns('ball')||owns('tunnel')||owns('tower');
  const pool = GOAL_POOL.map(f=>f()).filter(g=>g.track!=='play' || hasToy);
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
function fireFact(id){
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
  const cy = rab.baseY + rab.hopOff + rab.binkyHop + (rab.playYOff||0) + (rab.boxYOff||0);
  const loaf = rab.loaf;
  // squash & stretch: she stretches tall at the peak of a hop and squashes wide on impact
  const air = Math.max(0, -(rab.hopOff+rab.binkyHop));
  const stretch = clamp(air/70, 0, 0.22);
  const land = rab.landSquash||0;
  const sqX = 1 - stretch*0.5 + land*0.15;
  const sqY = 1 + stretch*0.9 - land*0.17;
  const bodyRx = 92*s*(1+0.06*loaf)*sqX, bodyRy = 72*s*(1-0.10*loaf)*sqY;
  const bodyCy = cy - bodyRy*0.82;
  const headR  = 60*s*(B.headScale||1);   // big head on a compact body — chibi proportions
  const beg = rab.trick && rab.trick.name==='beg';
  const alert = rab.state==='alert';
  const headCx = cx + (alert? 6*s:0);
  const headCy = bodyCy - bodyRy*0.55 - headR*0.22 + (alert? -8*s:4*s) + (beg? -34*s:0) + loaf*headR*0.18;   // nestled low into the body
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

function drawSky(){
  // The upper area is an interior WALL; the outdoor sky — and the sun that marks
  // the passing day — is only visible through the window pane (clipped to it).
  const light = skyLight(), edge = 1-light;
  const win = world.win;

  // --- interior wall ---
  {
    const wall=ctx.createLinearGradient(0,0,0,world.floorY);
    wall.addColorStop(0,'#dcc6d8'); wall.addColorStop(1,'#c9b0cf');
    ctx.fillStyle=wall; ctx.fillRect(0,0,W,world.floorY);
    // warm daylight bloom washing in from the window (fades at dusk)
    const bloom=ctx.createRadialGradient(win.x+win.w/2,win.y+win.h*0.6,8,win.x+win.w/2,win.y+win.h*0.6,win.w*1.6);
    bloom.addColorStop(0,`rgba(255,244,214,${0.30*light})`);
    bloom.addColorStop(1,'rgba(255,244,214,0)');
    ctx.fillStyle=bloom; ctx.fillRect(0,0,W,world.floorY);
  }
  drawWallArt();

  // --- sky gradient + sun, CLIPPED to the window opening ---
  ctx.save();
  roundRect(win.x,win.y,win.w,win.h,8); ctx.clip();
  const top = mix([122,178,232],[236,150,86], Math.min(1,edge*1.05));
  const bot = mix([196,224,244],[248,205,150], Math.min(1,edge*1.05));
  const sg=ctx.createLinearGradient(0,win.y,0,win.y+win.h);
  sg.addColorStop(0,rgb(top)); sg.addColorStop(1,rgb(bot));
  ctx.fillStyle=sg; ctx.fillRect(win.x,win.y,win.w,win.h);
  // a small drifting cloud
  ctx.fillStyle=`rgba(255,255,255,${0.5*light+0.18})`;
  cloud(win.x + win.w*0.32 + Math.sin(timeOfDay*3)*win.w*0.14, win.y+win.h*0.28, win.w*0.12);
  // the sun arcs across the pane: left→right through the day, high at noon
  const m = Math.min(win.w,win.h)*0.18, q = clamp(timeOfDay,0,1);
  const sx = win.x + m + (win.w-2*m)*q;
  const sy = (win.y+win.h-m) - Math.sin(q*Math.PI)*(win.h-2*m);
  const sunCol = mix([255,236,140],[255,150,70], Math.min(1,edge*1.1));
  const glow=ctx.createRadialGradient(sx,sy,2,sx,sy,win.w*0.45);
  glow.addColorStop(0,`rgba(${sunCol[0]},${sunCol[1]},${sunCol[2]},.6)`);
  glow.addColorStop(1,'rgba(255,220,120,0)');
  ctx.fillStyle=glow; ctx.fillRect(win.x,win.y,win.w,win.h);
  ctx.fillStyle=rgb(sunCol);
  ctx.beginPath();ctx.arc(sx,sy,Math.min(win.w,win.h)*0.12,0,7);ctx.fill();
  ctx.restore();

  // --- window frame + mullions + sill (drawn on top of the pane) ---
  ctx.strokeStyle='#f3ede2'; ctx.lineWidth=10; roundRect(win.x,win.y,win.w,win.h,8); ctx.stroke();
  ctx.strokeStyle='rgba(243,237,226,.95)'; ctx.lineWidth=6;
  ctx.beginPath();
  ctx.moveTo(win.x+win.w/2,win.y); ctx.lineTo(win.x+win.w/2,win.y+win.h);
  ctx.moveTo(win.x,win.y+win.h/2); ctx.lineTo(win.x+win.w,win.y+win.h/2); ctx.stroke();
  ctx.fillStyle='#e7ddce'; ctx.fillRect(win.x-8, win.y+win.h, win.w+16, 8);
  ctx.fillStyle='rgba(0,0,0,.10)'; ctx.fillRect(win.x-8, win.y+win.h+8, win.w+16, 4);
}
function cloud(x,y,r){
  ctx.beginPath();
  ctx.arc(x,y,r,0,7); ctx.arc(x+r,y+4,r*0.8,0,7);
  ctx.arc(x-r,y+5,r*0.7,0,7); ctx.arc(x+r*0.4,y-r*0.5,r*0.7,0,7);
  ctx.fill();
}
// a little framed portrait on the wall — a cosy touch of home
function drawWallArt(){
  const w=Math.min(74,W*0.072), h=w*1.16, x=W*0.11, y=H*0.34;
  ctx.fillStyle='rgba(60,40,30,.14)'; roundRect(x-w/2+3,y-h/2+5,w,h,4); ctx.fill();  // cast shadow
  ctx.fillStyle='#b3854f'; roundRect(x-w/2,y-h/2,w,h,4); ctx.fill();                  // wood frame
  ctx.fillStyle='#8f6a3d'; roundRect(x-w/2+3,y-h/2+3,w-6,h-6,3); ctx.fill();
  const sky=ctx.createLinearGradient(0,y-h/2+6,0,y+h/2-6);                            // little sky mat
  sky.addColorStop(0,'#cfe3f0'); sky.addColorStop(1,'#eef3e6');
  ctx.fillStyle=sky; roundRect(x-w/2+6,y-h/2+6,w-12,h-12,2); ctx.fill();
  // a simple bunny silhouette in the picture
  ctx.fillStyle='#9a7a52';
  ctx.beginPath();ctx.ellipse(x,y+h*0.12,w*0.19,w*0.17,0,0,7);ctx.fill();             // body
  ctx.beginPath();ctx.ellipse(x,y-h*0.02,w*0.12,w*0.12,0,0,7);ctx.fill();             // head
  ctx.beginPath();ctx.ellipse(x-w*0.07,y-h*0.20,w*0.045,w*0.13,-0.15,0,7);ctx.fill(); // ears
  ctx.beginPath();ctx.ellipse(x+w*0.07,y-h*0.20,w*0.045,w*0.13, 0.15,0,7);ctx.fill();
  ctx.fillStyle='#d9c4a0';
  ctx.beginPath();ctx.arc(x+w*0.14,y+h*0.14,w*0.05,0,7);ctx.fill();                   // tail
}

function drawRoom(){
  // wainscot highlight + soft shadow where the wall meets the floor
  ctx.fillStyle='rgba(255,255,255,.16)'; ctx.fillRect(0,world.floorY-14,W,5);
  ctx.fillStyle='rgba(0,0,0,.08)'; ctx.fillRect(0,world.floorY-8,W,8);
  {
    const floor=ctx.createLinearGradient(0,world.floorY,0,H);
    floor.addColorStop(0,'#cea06d'); floor.addColorStop(0.6,'#b6844f'); floor.addColorStop(1,'#9c6f3c');
    ctx.fillStyle=floor; ctx.fillRect(0,world.floorY,W,H-world.floorY);
  }
  // receding floorboard seams
  ctx.strokeStyle='rgba(88,52,22,.20)'; ctx.lineWidth=2;
  for(let i=1;i<7;i++){const y=world.floorY+(H-world.floorY)*i/7;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // sparse plank joins (staggered per row) for a wood-plank read
  ctx.strokeStyle='rgba(88,52,22,.12)'; ctx.lineWidth=1.5;
  for(let i=0;i<6;i++){
    const y0=world.floorY+(H-world.floorY)*i/7, y1=world.floorY+(H-world.floorY)*(i+1)/7;
    const cols=5, off=(i%2)*0.5;
    for(let j=0;j<cols;j++){ const x=((j+off)/cols)*W;
      ctx.beginPath();ctx.moveTo(x,y0+1);ctx.lineTo(x,y1-1);ctx.stroke(); }
  }
  // warm light pooling on the floor beneath the window (fades toward night)
  const lp = skyLight();
  if(lp>0.04){
    const wx=world.win.x+world.win.w/2, py=world.floorY+(H-world.floorY)*0.34;
    const pool=ctx.createRadialGradient(wx,py,8,wx,py,world.win.w*1.35);
    pool.addColorStop(0,`rgba(255,241,205,${0.17*lp})`); pool.addColorStop(1,'rgba(255,241,205,0)');
    ctx.fillStyle=pool; ctx.fillRect(0,world.floorY,W,H-world.floorY);
  }

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

  // back row (drawn first = furthest), then front row
  if(owns('hammock')) drawHammock();
  if(owns('hutch')) drawHutch();
  if(owns('tower')) drawTower();
  if(owns('tunnel')) drawTube();          // tunnel only appears once bought
  drawBed(); drawLitter(); drawFoodBowl(); drawWaterBowl();
  if(owns('castle')) drawCastle();
  if(owns('ball'))   drawBall();
}
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
  groundShadow(c.x, c.y+r*0.24, r*0.95);
  ctx.fillStyle='#6f5436';
  ctx.fillRect(c.x-r*0.62, c.y-r*1.5, r*0.13, r*1.7); ctx.fillRect(c.x+r*0.5, c.y-r*1.5, r*0.13, r*1.7);
  for(let i=0;i<3;i++){
    const py=c.y - i*r*0.72;
    ctx.fillStyle= i%2? '#9a7a52':'#87693f';
    roundRect(c.x-r*0.75, py-r*0.14, r*1.5, r*0.28, 4); ctx.fill();
    ctx.fillStyle='#6f9e93'; roundRect(c.x-r*0.7, py-r*0.2, r*1.4, r*0.1, 3); ctx.fill();
  }
}
function drawHutch(){
  const c=world.hutch, r=c.r;
  const baseY=c.y+r*0.7;                                   // the hutch SITS here
  groundShadow(c.x, baseY+3, r*1.15);
  ctx.fillStyle='#b58a5a'; roundRect(c.x-r*0.95, c.y-r*0.6, r*1.9, r*1.3, 6); ctx.fill();
  // plank lines
  ctx.strokeStyle='rgba(90,60,30,.3)';ctx.lineWidth=1.5;
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(c.x-r*0.95,c.y-r*0.6+i*r*0.43);ctx.lineTo(c.x+r*0.95,c.y-r*0.6+i*r*0.43);ctx.stroke();}
  // pitched roof with a little overhang
  ctx.fillStyle='#8a5f38';
  ctx.beginPath();ctx.moveTo(c.x-r*1.1, c.y-r*0.55);ctx.lineTo(c.x, c.y-r*1.3);ctx.lineTo(c.x+r*1.1, c.y-r*0.55);ctx.closePath();ctx.fill();
  // a rabbit-sized arched doorway, opening at floor level
  ctx.fillStyle='#2a1f16';
  ctx.beginPath();
  ctx.moveTo(c.x-r*0.42, baseY);
  ctx.lineTo(c.x-r*0.42, c.y-r*0.05);
  ctx.arc(c.x, c.y-r*0.05, r*0.42, Math.PI, 0);
  ctx.lineTo(c.x+r*0.42, baseY);
  ctx.closePath(); ctx.fill();
  // welcome mat of straw at the door
  ctx.strokeStyle='rgba(200,170,90,.8)'; ctx.lineWidth=2;
  for(let i=0;i<5;i++){const sx=c.x-r*0.3+i*r*0.15;
    ctx.beginPath();ctx.moveTo(sx,baseY+4);ctx.lineTo(sx+4,baseY+9);ctx.stroke();}
}
// The hammock renders in two passes so she can lie INSIDE it: drawHammock() is the
// stand + the pouch (drawn behind her in the room pass); drawHammockFront() is the
// near lip, drawn over her lower body after the rabbit so she reads as tucked in.
function hammockGeo(){
  const hm=world.hammock, w=hm.w, px=hm.x, py=hm.y, sy=hm.sy;
  const occupied = !!rab.inHammock;
  const low = w*0.30 + (occupied? w*0.05 : 0);          // pouch depth below the back rim
  return {hm,w,px,py,sy,low,occupied,legSpread:w*0.15};
}
function drawHammock(){
  const {w,px,py,sy,low,occupied,legSpread}=hammockGeo();
  groundShadow(px-w/2-legSpread*0.4, py+3, w*0.14); groundShadow(px+w/2+legSpread*0.4, py+3, w*0.14);
  // wooden A-frame stands (two splayed legs meeting at a hanging peg)
  ctx.strokeStyle='#7a5a38'; ctx.lineWidth=Math.max(4,w*0.05); ctx.lineCap='round';
  for(const dir of [-1,1]){
    const topx=px+dir*w/2, ty=sy-w*0.05;
    ctx.beginPath();ctx.moveTo(topx-legSpread, py);ctx.lineTo(topx, ty);ctx.lineTo(topx+legSpread, py);ctx.stroke();
    ctx.strokeStyle='#8a6a45'; ctx.lineWidth=Math.max(2,w*0.02);           // rope from peg to rim
    ctx.beginPath();ctx.moveTo(topx,ty);ctx.lineTo(px+dir*w*0.46, sy);ctx.stroke();
    ctx.strokeStyle='#7a5a38'; ctx.lineWidth=Math.max(4,w*0.05);
    ctx.fillStyle='#5f4526';ctx.beginPath();ctx.arc(topx,ty,w*0.045,0,7);ctx.fill();  // hanging peg
  }
  ctx.lineCap='butt';
  // the pouch (full) — the rabbit sits in front of its middle; the near lip is
  // redrawn over her by drawHammockFront()
  const grad=ctx.createLinearGradient(0,sy,0,sy+low*1.7);
  grad.addColorStop(0,'#c86a80'); grad.addColorStop(1,'#a3465c');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(px-w/2, sy);
  ctx.quadraticCurveTo(px, sy+low*1.8, px+w/2, sy);           // deep underside
  ctx.quadraticCurveTo(px, sy+low*0.95, px-w/2, sy);          // back rim
  ctx.fill();
  if(!occupied){   // empty: a plush cushion tucked in the pouch
    ctx.fillStyle='#f2c8d3';
    ctx.beginPath();ctx.ellipse(px, sy+low*1.05, w*0.30, w*0.12, 0, 0, 7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.4)';
    ctx.beginPath();ctx.ellipse(px-w*0.09, sy+low*0.96, w*0.11, w*0.045, 0, 0, 7);ctx.fill();
  }
}
function drawHammockFront(){
  const {w,px,sy,low}=hammockGeo();
  // near lip of the sling, wrapping up over her lower body
  const grad=ctx.createLinearGradient(0,sy+low*0.5,0,sy+low*1.9);
  grad.addColorStop(0,'#d67d92'); grad.addColorStop(1,'#a3465c');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(px-w/2, sy);
  ctx.quadraticCurveTo(px, sy+low*1.9, px+w/2, sy);           // underside
  ctx.quadraticCurveTo(px, sy+low*1.16, px-w/2, sy);          // near lip (rises over her)
  ctx.fill();
  ctx.strokeStyle='#e493a4'; ctx.lineWidth=Math.max(3,w*0.028);   // rolled highlight on the lip
  ctx.beginPath();ctx.moveTo(px-w/2, sy);ctx.quadraticCurveTo(px, sy+low*1.16, px+w/2, sy);ctx.stroke();
}

function drawLitter(){
  const L=world.litter;
  ctx.fillStyle='#3f6fae'; roundRect(L.x-L.w/2,L.y-L.h/2,L.w,L.h,10); ctx.fill();
  ctx.fillStyle='#5a86c2'; roundRect(L.x-L.w/2+6,L.y-L.h/2+6,L.w-12,L.h-12,7); ctx.fill();
  ctx.fillStyle='#e7dcc4'; roundRect(L.x-L.w/2+10,L.y-L.h/2+10,L.w-20,L.h-20,6); ctx.fill();
  const hx=L.x, hy=L.y-L.h/2+12, bright = hayFresh>0?1:0.75;
  for(let i=0;i<34;i++){
    const bx=hx-L.w*0.36+((i*29)%(L.w*0.72));
    const by=hy+((i*13)%(L.h*0.42));
    ctx.strokeStyle=`hsl(${72+((i*11)%26)},58%,${(46+((i*7)%15))*bright}%)`;
    ctx.lineWidth=2;
    const ang=((i%5)-2)*0.3;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.sin(ang)*13,by-13);ctx.stroke();
  }
  const mess = Math.round((100-stats.hygiene)/13);
  for(let i=0;i<mess;i++){
    const mx=L.x-L.w/2+16+((i*37)%(L.w-32));
    const my=L.y+2+((i*23)%(L.h*0.32));
    ctx.fillStyle= i%3? 'rgba(110,80,45,.85)':'rgba(140,112,66,.7)';
    ctx.beginPath();ctx.ellipse(mx,my,5,3.4,0.5,0,7);ctx.fill();
  }
}
function drawFoodBowl(){
  const b=world.food;
  ctx.fillStyle='#7d5230'; ctx.beginPath();ctx.ellipse(b.x,b.y+b.r*0.35,b.r,b.r*0.5,0,0,7);ctx.fill();
  ctx.fillStyle='#9a6a3e'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.fill();
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
  const lvl = stats.water/100;
  ctx.fillStyle='rgba(90,170,220,.9)';
  ctx.beginPath();ctx.ellipse(b.x,b.y,b.r*0.72*Math.max(0.25,lvl),b.r*0.4*Math.max(0.25,lvl),0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.beginPath();ctx.ellipse(b.x-b.r*0.2,b.y-b.r*0.06,b.r*0.22,b.r*0.09,0,0,7);ctx.fill();
}
function drawBed(){
  const b=world.bed;
  if(rab.decor && rab.decor.bed==='cloud'){
    // plush cloud bed (upgraded)
    ctx.fillStyle='#dfe6f2';
    for(const o of [[-0.7,0.05,0.5],[0.7,0.05,0.5],[-0.35,-0.18,0.55],[0.35,-0.18,0.55],[0,0.06,0.7]])
      { ctx.beginPath();ctx.ellipse(b.x+b.r*o[0], b.y+b.r*o[1], b.r*o[2], b.r*o[2]*0.62, 0,0,7); ctx.fill(); }
    ctx.fillStyle='#b7c6e6'; ctx.beginPath();ctx.ellipse(b.x,b.y+b.r*0.06,b.r*0.66,b.r*0.34,0,0,7);ctx.fill();
    ctx.fillStyle='#eef3fb'; ctx.beginPath();ctx.ellipse(b.x-b.r*0.18,b.y-b.r*0.02,b.r*0.3,b.r*0.14,0,0,7);ctx.fill();
    return;
  }
  ctx.fillStyle='#b5546a'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.fill();
  ctx.strokeStyle='#c96a80'; ctx.lineWidth=b.r*0.28;
  ctx.beginPath();ctx.ellipse(b.x,b.y,b.r*0.86,b.r*0.46,0,0,7);ctx.stroke();
  ctx.fillStyle='#e79fae'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r*0.6,b.r*0.32,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.ellipse(b.x-b.r*0.2,b.y-b.r*0.06,b.r*0.28,b.r*0.12,0,0,7);ctx.fill();
}
function drawTube(){
  const tb=world.tube;
  groundShadow(tb.x, tb.y+tb.h*0.52, tb.w*0.48);
  const g=ctx.createLinearGradient(0,tb.y-tb.h/2,0,tb.y+tb.h/2);
  g.addColorStop(0,'#7ea9d6'); g.addColorStop(0.5,'#5b83b4'); g.addColorStop(1,'#3f5f8c');
  ctx.fillStyle=g; roundRect(tb.x-tb.w/2,tb.y-tb.h/2,tb.w,tb.h,tb.h*0.5); ctx.fill();
  // fabric ribs — subtle, matching the end-cap curvature
  ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=3;
  for(let i=1;i<4;i++){const x=tb.x-tb.w/2+i*tb.w/4;
    ctx.beginPath();ctx.ellipse(x,tb.y,tb.h*0.22,tb.h*0.48,0,-1.35,1.35);ctx.stroke();}
  // end openings: full-height mouths that match the capsule ends, with a rim
  for(const dir of [-1,1]){
    const ex=tb.x+dir*(tb.w/2-tb.h*0.30);
    ctx.fillStyle='#31517e';                                // rim ring
    ctx.beginPath();ctx.ellipse(ex,tb.y,tb.h*0.30,tb.h*0.485,0,0,7);ctx.fill();
    ctx.fillStyle='#1c1426';                                // dark interior
    ctx.beginPath();ctx.ellipse(ex,tb.y,tb.h*0.24,tb.h*0.42,0,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.10)';                  // faint inner curve
    ctx.beginPath();ctx.ellipse(ex-dir*tb.h*0.05,tb.y-tb.h*0.10,tb.h*0.10,tb.h*0.22,0,0,7);ctx.fill();
  }
}
function drawCastle(){
  const c=world.castle, r=c.r;
  groundShadow(c.x, c.y+r*0.24, r*1.05);
  ctx.fillStyle='#c79a5e'; roundRect(c.x-r,c.y-r*1.1,r*2,r*1.3,6); ctx.fill();
  ctx.fillStyle='#b0824a'; for(let i=0;i<4;i++){ctx.fillRect(c.x-r+i*r*0.55, c.y-r*1.3, r*0.32, r*0.28);}
  ctx.fillStyle='#3a2a1c'; ctx.beginPath();ctx.ellipse(c.x,c.y-r*0.2,r*0.42,r*0.5,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(90,60,30,.4)';ctx.lineWidth=2;ctx.strokeRect(c.x-r,c.y-r*1.1,r*2,r*1.3);
}
function drawBall(){
  const b={x:(ballAnim?ballAnim.x:world.ball.x), y:(ballAnim?ballAnim.y:world.ball.y), r:world.ball.r};
  ctx.fillStyle='#e2a3c0'; ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();
  ctx.fillStyle='#c67ea0';
  for(let i=0;i<6;i++){const a=i/6*7;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*b.r*0.5,b.y+Math.sin(a)*b.r*0.5,b.r*0.16,0,7);ctx.fill();}
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.arc(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.24,0,7);ctx.fill();
}

function drawAmbient(){
  const edge = 1-skyLight();
  if(edge>0.35){
    const a=(edge-0.35)*0.55;
    ctx.fillStyle=`rgba(38,30,74,${a})`;
    ctx.fillRect(0,0,W,H);
  }
  // soft edge vignette — gently darkens the corners so the scene has depth & focus
  const vig=ctx.createRadialGradient(W*0.5,H*0.52,H*0.32,W*0.5,H*0.52,H*0.82);
  vig.addColorStop(0,'rgba(20,10,20,0)');
  vig.addColorStop(1,`rgba(18,8,16,${0.16+edge*0.12})`);
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
function startHazardEvent(){
  dayEvent={type:'hazard', cord:{x:Math.max(80, W*0.12), y:H*0.80}, secured:false, chewed:false, nearT:0, nextTemptt:now()+rand(4,8)};
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
  const grow = clamp((rab.begUntil - now())/0.22, 0, 1);     // little pop-in
  const sc = 0.6 + 0.4*(rab.begUntil-now()>4? 1 : grow);
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
  const c=dayEvent.cord;
  ctx.save(); ctx.globalAlpha=fade;
  // the wall outlet the charger is actually plugged into (on the baseboard)
  const ox=Math.max(14, c.x-70), oy=world.floorY+14;
  ctx.fillStyle='#efe6d4'; roundRect(ox-9, oy-13, 18, 26, 3); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=1.5; roundRect(ox-9, oy-13, 18, 26, 3); ctx.stroke();
  ctx.fillStyle='#4a4a4a'; ctx.fillRect(ox-3.5, oy-7, 2.5, 6); ctx.fillRect(ox+1, oy-7, 2.5, 6);
  // the cord: plug at the outlet, drooping down the wall, snaking along the floor to the phone
  ctx.strokeStyle = dayEvent.chewed? '#a8452f' : '#242424';
  ctx.lineWidth=3; ctx.lineCap='round';
  if(!dayEvent.secured){
    ctx.fillStyle='#242424'; roundRect(ox-5, oy+1, 10, 9, 2); ctx.fill();              // plug body
    ctx.beginPath(); ctx.moveTo(ox, oy+9);
    ctx.bezierCurveTo(ox, c.y-6, c.x-46, c.y+10, c.x-2, c.y+2);                        // wall droop → floor snake
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
  if(!(t < rab.boxT) && !rab.inHammock){   // no ground shadow in the litter box or hammock
    ctx.fillStyle=`rgba(0,0,0,${0.22*shSc})`;
    ctx.beginPath();ctx.ellipse(p.cx, rab.baseY+6, p.body.rx*0.95*shSc, 15*s*shSc, 0,0,7);ctx.fill();
  }

  let rot=0;
  if(rab.trick && rab.trick.name==='spin') rot = (rab.trick.t/rab.trick.dur)*Math.PI*2;
  if(rab.trick && rab.trick.name==='flop') rot = Math.min(1,rab.trick.t/0.45)*1.35;
  if(rab.binkyT>0){const pr=1-rab.binkyT/rab.binkyDur; rot += Math.sin(pr*Math.PI*2)*0.22;}

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
    const groom = t < rab.groomUntil;
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
  const droop = rab.sick? 8*s : 0;   // sick/tired → ears hang lower
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
  if(!tummy){
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
  const sway = Math.sin(t*1.4 + dir)*3*s + (rab.state==='alert'? -6*s:0) + jiggle;
  const baseY = hy - r*0.55;
  const tipX  = hx + dir*r*1.15 + sway;
  const tipY  = hy + r*1.05;
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
  const sway = Math.sin(t*1.5 + dir)*0.05 + (alert? -0.06 : 0) + jiggle;
  const baseX = hx + dir*r*0.42, baseY = hy - r*0.42;
  const len = r*(B.earLen||1.15);
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(dir*(0.18 + sway));
  const g=ctx.createLinearGradient(0,0,0,-len);
  g.addColorStop(0,coat.body); g.addColorStop(1,coat.pointMid);
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(0,-len*0.5, r*0.21, len*0.5, 0,0,7); ctx.fill();
  ctx.fillStyle = coat.tan ? coat.tanCol : 'rgba(228,158,158,.85)';   // inner ear
  ctx.beginPath(); ctx.ellipse(0,-len*0.48, r*0.1, len*0.38, 0,0,7); ctx.fill();
  ctx.restore();
}

/* Lion's mane — a fluffy ring of fur tufts. 'back' draws the full halo behind
   the head; 'front' adds chin/neck fluff over the lower face. */
function drawMane(hx,hy,r,layer){
  const rr=r*1.16, n=22;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2;
    if(layer==='front' && Math.sin(a) < 0.35) continue;   // front → lower arc only
    const wob = 0.8 + 0.36*Math.sin(i*1.9 + a*3);
    const mx=hx+Math.cos(a)*rr, my=hy+Math.sin(a)*rr*0.96;
    ctx.fillStyle = coat.body;
    ctx.beginPath(); ctx.arc(mx,my, r*0.27*wob, 0,7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(mx-r*0.05,my-r*0.05, r*0.13*wob, 0,7); ctx.fill();
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
  if(rab.ageDays>=7) unlockAch('week');
  // Progressive disclosure: the Games tab appears on the morning of day 2 (item 5)
  const revealGames = !rab.gamesRevealed && rab.day>=2;
  if(revealGames){ rab.gamesRevealed=true; applyGamesTab(); }
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
  // Staggered morning follow-ups so each beat is actually read (the toast is single-slot).
  let followT = 3200;
  if(grewTo){ const g=grewTo;
    setTimeout(()=>toast(`🎂 ${rab.name} grew up — now a ${g.name}! ${g.label}`), followT); followT+=3200; }
  if(revealGames){
    setTimeout(()=>toast('🎮 New! The Games tab just opened in the bottom bar — tap 🎮 Games for arcade minigames and extra 🥕.'), followT); followT+=3200; }
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

function getSick(){
  if(rab.sick) return;
  rab.sick=true; rab.sickAt=now();
  rab.thumps=clamp(rab.thumps+0.5,0,5);
  toast(`🤒 ${rab.name} has gone into GI stasis! ${cap(P().s)} needs the Vet — fast.`);
  fireFact('stasis');
  refreshActions();
}
function cureSick(free){
  rab.sick=false; rab.health=clamp(Math.max(rab.health,68));
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
  if(rab.weight>145 || rab.weight<66) dh-=1.0*dt;
  if(dh===0 && !rab.sick) dh += 1.8*dt;   // recovers a touch quicker when cared for
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
  if(rab.maxAngerCount>=3){ takenAway('anger'); return; }
  toast(`💢 ${rab.name} is FURIOUS! Rage strike ${rab.maxAngerCount}/2 — 3 and RPS takes ${P().o}! Offer a banana. 🍌`);
}
function takenAway(reason){
  started=false; wipeSave();
  // tidy up any open minigame (losing Guess can trigger this mid-overlay)
  if(SN.timer){ clearInterval(SN.timer); SN.timer=null; } SN.on=false;
  if(PN.raf){ cancelAnimationFrame(PN.raf); PN.raf=null; } PN.on=false; GS.on=false;
  minigameActive=false;
  ['snake','pong','guess'].forEach(id=>{ const el=$(id); if(el) el.classList.remove('show'); });
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
  rab.legStomp=1; thumpFx=0.5; thumpTextT=0.9;
  const p=parts(); thumpRipples.push({x:p.cx,y:rab.baseY,t:0}); spawnSparkle(p.feet.x,p.feet.y);
}
function startBinky(){ rab.binkyT=rab.binkyDur; const p=parts();
  for(let i=0;i<5;i++) spawnHeart(p.head.x+rand(-24,24),p.head.y);
  stats.energy=clamp(stats.energy-4);
  incGoal('binky'); }
function hopTo(x){
  rab.hopToX=clamp(x, 80, W-80); rab.hopFromX=rab.x; rab.hopT0=now(); rab.hopping=true;
  rab.lookX=Math.sign(rab.hopToX-rab.x);
  stats.energy=clamp(stats.energy-1.5);
}
function wake(){ if(rab.state==='rest'){ rab.restUntil=0; } }

function giveHay(){
  if(rab.cold){ coldRefuse(); return; }
  wake();
  stats.hunger=clamp(stats.hunger-40);
  stats.happy=clamp(stats.happy+4);
  rab.thumps=clamp(rab.thumps-0.4,0,5);
  addWeight(-1.6);                          // hay is the healthy staple — trims weight
  hayFresh=6; addXP(3); addCarrots(1, rab.x, rab.baseY-70);
  incGoal('hay');
  hopTo(world.litter.x);
  rab.boxT = now() + 8;                     // hops over and climbs into the box to munch
  toast(`Fresh Timothy hay in the box! ${rab.name} climbs in to munch. 🌾`);
}
function givePellets(){
  if(rab.cold){ coldRefuse(); return; }
  wake();
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
  wake();
  stats.water=100;
  rab.thumps=clamp(rab.thumps-0.2,0,5);
  addXP(1); incGoal('water');
  spawnDrop(world.water.x, world.water.y-10);
  toast('Fresh, clean water. 💧');
}
function offerBanana(){
  wake(); rab.begUntil=0;
  const p=parts();
  bananas.push({x:rab.x+rand(-10,10), y:rab.baseY-10, life:3});
  if(rab.cold){
    rab.cold=false; rab.thumps=0; stats.happy=clamp(stats.happy+20);
    for(let i=0;i<6;i++) spawnHeart(p.head.x+rand(-20,20),p.head.y);
    startBinky();
    toast(`The apology banana! ${cap(P().s)} turns back around… forgiven. 🍌`);
    return;
  }
  if(rab.bananasToday>=2){
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
  toast(`Banana! A full-body binky of joy. (${rab.bananasToday}/2 today)`);
}
function cleanLitter(){
  wake();
  stats.hygiene=100; rab.thumps=clamp(rab.thumps-0.6,0,5);
  let bonus = owns('groom')? 10 : 4;
  stats.happy=clamp(stats.happy+bonus);
  addXP(owns('groom')?4:2); incGoal('clean');
  spawnSparkle(world.litter.x, world.litter.y);
  toast(owns('groom')
    ? 'Scooped & groomed — spotless coat, extra-happy bun. ✨🪮'
    : 'Litter box scooped & fresh. Hygiene restored. ✨');
}
function togglePetting(){
  pettingMode=!pettingMode;
  $('bPet').classList.toggle('armed',pettingMode);
  $('game').style.cursor = pettingMode ? 'grab' : 'default';   // hand cursor while petting
  toast(pettingMode? 'Petting ON — drag over the HEAD (never the feet!).' : 'Petting off.');
  // Day-1 bait: once she's been armed for petting, arm one scripted feet-out flop (item 3a)
  if(pettingMode && !rab.petArmedOnce){
    rab.petArmedOnce=true;
    if(rab.day===1 && !rab.baitDone) rab.baitAt = now()+rand(5,8);
  }
}
function restRabbit(){
  if(rab.cold){ coldRefuse(); return; }
  if(stats.energy>85){ toast(`${rab.name} isn't sleepy — plenty of energy right now.`); return; }
  if(owns('hammock')) hopTo(world.hammock.x);   // she settles by her hammock for the cushier nap
  rab.restUntil=now()+4.5; rab.state='rest'; rab.trick=null;
  spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r);
  toast(owns('hammock') ? `${rab.name} settles into the hammock for a deluxe nap. 😴🛏️`
                        : `${rab.name} curls into a cozy nap. 😴`);
}
function playToy(){
  if(rab.cold){ coldRefuse(); return; }
  if(rab.play) return;                       // already playing
  if(!(owns('ball')||owns('tunnel')||owns('tower'))){ toast('Buy a toy from the Shop 🛒 first, then Play!'); return; }
  if(stats.energy<12){ toast(`${rab.name} is too tired to play — try Rest 😴.`); return; }
  wake();
  startPlay();
  const type = rab.play.type, big = type!=='ball';
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
  const toys=['ball','tunnel','tower'].filter(owns);
  const type = toys.length? pick(toys) : 'ball';
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
    rab.lookX=Math.sign(bx-rab.x);
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
function callVet(){
  if(rab.sick){
    if(owns('medicine')){ rab.items.medicine=Math.max(0,(rab.items.medicine|0)-1);
      if(rab.items.medicine<=0) delete rab.items.medicine;
      cureSick(true); refreshActions(); return; }
    if(spendCarrots(45)){ cureSick(false); return; }
    toast(`An emergency vet visit is 45🥕 (you have ${rab.carrots})! Cheaper to keep Gut Medicine 💊 stocked.`);
    return;
  }
  // wellness checkup
  if(spendCarrots(10)){
    rab.health=clamp(rab.health+20); stats.happy=clamp(stats.happy+4);
    const ws=weightStatus();
    toast(`🩺 Checkup (−10🥕): ideal for a ${BREEDS[rab.breed].name} is ~${ws.ideal} lb. ${cap(P().s)} is ${ws.lbs} lb — ${ws.txt}.`);
  } else {
    toast(`A checkup is 10🥕 — you have ${rab.carrots}. Earn more by caring for ${P().o}.`);
  }
}
function doTrick(){
  if(rab.cold){ coldRefuse(); return; }
  if(rab.sick){ toast(`${rab.name} feels too poorly for tricks. See the Vet. 🩺`); return; }
  wake();
  if(rab.trick||rab.binkyT>0) return;
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
  incGoal('trick');
  // map each trick to a visible motion (unlockables reuse expressive poses)
  if(key==='binky' || key==='jump'){ startBinky(); }
  else if(key==='highfive'){ rab.trick={name:'beg', t:0, dur:T.dur}; }
  else rab.trick={name:key, t:0, dur:T.dur};
  const p=parts(); for(let i=0;i<4;i++) spawnHeart(p.head.x+rand(-20,20),p.head.y);
  toast(`${rab.name} performs ${T.name} ${T.emoji}  (mastery ${Math.round(nm)}% · +${reward}🥕)`);
}
function coldRefuse(){
  toast(`${cap(P().s)} has turned ${P().p} back. Only a banana will fix this. 🍌`);
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
      triggerThump(); toast('You touched the SACRED back feet! 😾 *THUMP*'); checkThreshold();
      fireFact('feet');
    }
    return;
  }
  if(dHead<p.head.r*1.3){
    if(tnow-lastPetGain>0.14){
      lastPetGain=tnow; wake();
      stats.happy=clamp(stats.happy+3); rab.thumps=clamp(rab.thumps-0.2,0,5);
      rab.petReact=0.6;                                   // obvious happy reaction
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
  if(rab.thumps>=3 && !wasAbove3){ wasAbove3=true; triggerThump(); }
  if(rab.thumps<2.6) wasAbove3=false;
  if(rab.thumps>=5 && !rab.cold){ rab.cold=true; onMaxAnger(); fireFact('cold'); }   // maxed anger → a rage strike
}

/* ---------------- Idle brain ---------------- */
let nextIdle=3;
function idleBrain(dt,t){
  if(rab.cold||rab.state==='tummy'||rab.state==='rest'||rab.hopping||rab.trick||rab.binkyT>0) return;
  if(pettingMode && pointer.down) return;
  if(stats.energy<18 && Math.random()<0.01){ rab.restUntil=now()+rand(2,4); rab.state='rest';
    spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r); return; }
  if(stats.happy>88 && stats.energy>25 && Math.random()<0.004){ startBinky(); return; }
  // occasionally asks for something with a speech bubble. What she wants is contextual
  // (real needs first; treats/attention only when content), and there's a proper
  // cooldown so she isn't a broken banana vending-machine ad.
  if(now()>=rab.begUntil && now()>=rab.begCooldown && Math.random()<0.0012){
    const wants=[];
    if(stats.water<45)   wants.push('💧');
    if(stats.hunger>60)  wants.push('🌾');
    if(stats.hygiene<40) wants.push('🧹');
    if(stats.energy<30)  wants.push('😴');
    if(!wants.length && stats.happy>35){                        // content → mischief asks
      wants.push('✋');
      if(owns('ball')||owns('tunnel')||owns('tower')) wants.push('🧸');
      if(rab.bananasToday<2) wants.push('🍌','🍌');             // still her favourite ask
    }
    if(wants.length){
      rab.begWant=pick(wants);
      rab.begUntil=now()+rand(4,6);
      rab.begCooldown=now()+rand(22,40);                        // quiet time between asks
    }
  }
  nextIdle-=dt;
  if(nextIdle<=0){
    nextIdle=rand(3.5,7);
    const roll=Math.random();
    if(roll<0.4){ hopTo(rand(world.rug.x-world.rug.rx*0.6, world.rug.x+world.rug.rx*0.6)); }
    else if(roll<0.62){ rab.groomUntil=t+rand(1.4,2.6); }
    else if(roll<0.74 && stats.happy>75 && stats.energy>30){ startBinky(); }
    else if(roll<0.82 && owns('hutch')){ hopTo(world.hutch.x); rab.denUntil=now()+rand(3.5,5.5); }  // pops into her hutch
    else if(roll<0.9){ hopTo(world.bed.x); }
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
      rab.lookX=clamp((pointer.x-p.head.x)/120,-1,1);
      rab.lookY=clamp((pointer.y-p.head.y)/120,-1,1);
    } else { rab.lookX=0; rab.lookY=0; }
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
  const sickMul = (rab.sick? 1.4 : 1) * (rab.cold? 1.5 : 1);   // a furious bun neglects itself
  stats.hunger=clamp(stats.hunger + stage.hunger*sickMul*dt);
  stats.hygiene=clamp(stats.hygiene - 0.72*sickMul*dt);
  stats.water=clamp(stats.water - 0.62*(owns('bottle')?0.6:1)*sickMul*dt);   // Deluxe Water Bottle: water lasts longer
  const happyDecay = 0.6 * (owns('castle')||owns('hutch')?0.82:1) * ((owns('ball')||owns('tunnel')||owns('tower'))?0.88:1);
  stats.happy=clamp(stats.happy - happyDecay*dt);
  if(rab.state==='rest'){ stats.energy=clamp(stats.energy + (owns('hammock')?15:11)*dt); }   // hammock = cushier naps
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
  if(pressure>0) rab.thumps=clamp(rab.thumps + pressure*0.11*dt,0,5);
  else if(!rab.cold) rab.thumps=clamp(rab.thumps - 0.12*dt,0,5);
  checkThreshold();

  // the 90%-happiness goal must be EARNED: it only arms after happiness dips below 85
  // during the day, so the big morning-joy boost can't auto-complete it at rollover
  if(stats.happy<85) happy90Armed=true;
  if(happy90Armed && stats.happy>=90 && rab.goals.some(g=>g.track==='happy90'&&!g.done)) incGoal('happy90');

  /* animation timers */
  rab.breath+=dt*2.2;
  rab.noseTwitch+=dt*(rab.state==='alert'?12:4);
  if(rab.legStomp>0) rab.legStomp=Math.max(0,rab.legStomp-dt*2.2);
  if(thumpFx>0) thumpFx=Math.max(0,thumpFx-dt);
  if(rab.binkyT>0){ rab.binkyT=Math.max(0,rab.binkyT-dt);
    const pr=1-rab.binkyT/rab.binkyDur; rab.binkyHop=-Math.sin(pr*Math.PI)*72*(Math.min(W,H)/560); }
  else rab.binkyHop=0;
  if(rab.trick){ rab.trick.t+=dt; if(rab.trick.t>=rab.trick.dur) rab.trick=null; }
  rab.nextBlink-=dt; if(rab.nextBlink<=0){ rab.blink=0.12; rab.nextBlink=rand(2.5,6); }
  if(rab.blink>0) rab.blink-=dt;
  if(rab.petReact>0) rab.petReact=Math.max(0,rab.petReact-dt);

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
      if(k>=1){rab.hopping=false;rab.hopOff=0;rab.x=rab.hopToX; rab.landSquash=1; rab.earJiggle=1;}   // touchdown → squash + ears bounce
      else{rab.x=lerp(rab.hopFromX,rab.hopToX,k); rab.hopOff=-Math.sin(k*Math.PI)*46*(Math.min(W,H)/560);}
    }
    idleBrain(dt,t);
    updateState(t);
  }
  tickEvent(dt,t);
  tickScript(t);

  /* owned-furniture interactions: she settles INTO the hammock for a nap, and fades
     into the hutch doorway when she pops in for a den visit */
  if(!rab.play){
    const hm=world.hammock;
    rab.inHammock = rab.state==='rest' && owns('hammock') && !rab.hopping && Math.abs(rab.x-hm.x)<hm.w*0.5;
    rab.playYOff = damp(rab.playYOff||0, rab.inHammock? (hm.nap - rab.baseY) : 0, 5, dt);
    const inDen = t<rab.denUntil && owns('hutch') && !rab.hopping && Math.abs(rab.x-world.hutch.x)<world.hutch.r*0.5;
    rab.playAlpha = damp(rab.playAlpha!==undefined?rab.playAlpha:1, inDen? 0.12 : 1, 5, dt);
  }

  /* squash/stretch impact + ear bounce settle back to rest */
  rab.landSquash = damp(rab.landSquash||0, 0, 11, dt);
  rab.earJiggle  = damp(rab.earJiggle||0, 0, 6, dt);

  /* loaf pose: content, fed, calm */
  const wantsLoaf = rab.state==='loaf' && !rab.hopping && stats.happy>60 && stats.hunger<55;
  rab.loaf = damp(rab.loaf, wantsLoaf?1:0, 3, dt);

  if((rab.state==='loaf'||rab.state==='rest') && stats.happy>70 && Math.random()<0.006){
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
  drawAmbient();
  if(rab.cold){ const a=0.13+0.08*Math.sin(now()*5); ctx.fillStyle=`rgba(205,35,25,${a})`; ctx.fillRect(0,0,W,H); }  // furious red aura
  if(hazardFlash>0){ ctx.fillStyle=`rgba(255,240,180,${hazardFlash})`; ctx.fillRect(-40,-40,W+80,H+80); hazardFlash=Math.max(0,hazardFlash-dt*1.5); }
  // the rabbit, drawn in front of the room
  ctx.save();
  ctx.globalAlpha = rab.playAlpha!==undefined?rab.playAlpha:1;
  if(rab.hidden) drawHideHint(t); else drawRabbit(t);
  ctx.restore();
  if(rab.inHammock && !rab.hidden) drawHammockFront();   // the sling's near lip wraps over her
  if(t < rab.boxT) drawLitterFront();         // box wall in front of the rabbit while it's inside
  drawBegBubble();                            // speech bubble on top of everything
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
  return v>55?'linear-gradient(90deg,#6fbf73,#8fd68f)'
       : v>28?'linear-gradient(90deg,#e2b23c,#f0c766)'
       :       'linear-gradient(90deg,#e0603a,#f0855f)';
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
  if(rab.sick){ hc.style.display='inline-flex'; hc.textContent='🤒 Sick'; hc.className='chip warn blink'; }
  else if(rab.health<45){ hc.style.display='inline-flex'; hc.textContent='❤ '+Math.round(rab.health); hc.className='chip warn'; }
  else { hc.style.display='none'; }
  // contextual action enabling
  $('bVet').classList.toggle('urgent', rab.sick);
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
  $('panelTitle').textContent = kind==='shop'?'🛒 Carrot Shop' : kind==='goals'?'🎯 Daily Goals' : '⚙️ Menu';
  if(kind==='shop') renderShop();
  else if(kind==='goals') renderGoals(true);
  else renderMenu();
}
function closePanel(){ panelOpen=null; $('panelWrap').classList.remove('show'); }

function renderShop(){
  const body=$('panelBody'); body.innerHTML='';
  const bal=document.createElement('div'); bal.className='balance';
  bal.innerHTML=`Balance: <b>${rab.carrots}🥕</b> &nbsp;·&nbsp; Bond Lv ${rab.bondLevel}`;
  body.appendChild(bal);
  SHOP.forEach(it=>{
    const locked = rab.bondLevel < it.unlock;
    const ownedPerm = (it.type==='toy'||it.type==='decor'||it.type==='tool') && owns(it.id);
    const row=document.createElement('div'); row.className='srow'+(locked?' locked':'');
    const stock = it.type==='cure' ? ` ×${rab.items[it.id]||0}` : '';
    row.innerHTML=`<div class="semoji">${it.emoji}</div>
      <div class="sinfo"><div class="sname">${it.name}${stock}</div><div class="sdesc">${it.desc}</div></div>`;
    const btn=document.createElement('button'); btn.className='sbuy';
    if(locked){ btn.textContent=`Lv ${it.unlock}`; btn.disabled=true; }
    else if(ownedPerm){ btn.textContent='Owned'; btn.disabled=true; }
    else { btn.textContent=`${it.cost}🥕`; btn.onclick=()=>buy(it.id); }
    row.appendChild(btn); body.appendChild(row);
  });
}
function buy(id){
  const it=shopItem(id); if(!it) return;
  if(rab.bondLevel<it.unlock) return;
  if((it.type==='toy'||it.type==='decor'||it.type==='tool') && owns(it.id)){ return; }
  if(!spendCarrots(it.cost)){ toast(`Not enough carrots — need ${it.cost}🥕, have ${rab.carrots}.`); return; }
  if(it.type==='feed'){
    if(id==='greens'){ stats.hunger=clamp(stats.hunger-30); stats.water=clamp(stats.water+18);
      rab.health=clamp(rab.health+8); addWeight(-2.5); }                              // second-best to hay
    else if(id==='oxbow'){ stats.hunger=clamp(stats.hunger-40); rab.health=clamp(rab.health+3);
      rab.pelletsToday++; addWeight(rab.pelletsToday<=2?2:6); }                        // premium pellets count too
    else if(id==='chews'){ stats.hunger=clamp(stats.hunger-8); stats.happy=clamp(stats.happy+10);
      stats.energy=clamp(stats.energy+6); addWeight(1.5); rab.thumps=clamp(rab.thumps-0.3,0,5); }   // treat
    stats.happy=clamp(stats.happy+6); spawnHeart(parts().head.x,parts().head.y);
    if(id==='oxbow' && rab.pelletsToday>2)
      { toast(`⚠️ That's ${P().p} ${ord(rab.pelletsToday)} scoop of pellets today — too many! Hay should be the main food.`); fireFact('pellet3'); }
    else toast(`Yum! ${it.name} served. 😋`);
  } else if(it.type==='cure'){
    rab.items[id]=(rab.items[id]||0)+1;
    toast(`Bought ${it.name}. The Vet will use it free when needed. 💊`);
  } else {
    rab.items[id]=1;
    if(id==='rug_rose') rab.decor.rug='rose';         // room customization
    if(id==='bed_cloud') rab.decor.bed='cloud';       // upgraded bed
    toast(`Bought ${it.name}! ${it.emoji}`);
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
    row.innerHTML=`<div class="gtext">${gg.done?'✅':'⬜'} ${gg.text}</div>
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
  const payload = { c:'thump', v:2, save:data, unlocks };
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
  const weightTxt = rab.weight>140?'Overweight ⚠️':rab.weight<75?'Underweight ⚠️':'Ideal 👌';
  const masteryList = Object.keys(TRICKS).map(k=>{
    const unlocked = TRICKS[k].unlock<=rab.bondLevel;
    const m = Math.round(rab.mastery[k]||0);
    return `<div class="mrow"><span>${TRICKS[k].emoji} ${TRICKS[k].name}${unlocked?'':` <i>(Lv ${TRICKS[k].unlock})</i>`}</span>
      <span>${unlocked? m+'%' : '🔒'}</span></div>`;
  }).join('');
  const achDone=Object.keys(rab.achievements).length, achTotal=Object.keys(ACHS).length;
  body.innerHTML=`
    <div class="vitals">
      <div><b>${rab.name}</b> · ${cap(rab.sex)} · ${coat.name}</div>
      <div>Age: ${rab.ageDays} day(s) · ${stageFor(rab.ageDays).name} ${stageFor(rab.ageDays).label}</div>
      <div>Bond: Lv ${rab.bondLevel} (${rab.bondXP}/${xpNeeded(rab.bondLevel)} XP)</div>
      <div>Health: ${Math.round(rab.health)}% ${rab.sick?'· 🤒 in stasis':''}</div>
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
function onDown(e){pointer.down=true;const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;pointer.moved=1;
  if(pettingMode) $('game').style.cursor='grabbing';
  if(findRabbit(p.x,p.y)) return;
  if(tapCord(p.x,p.y)) return;
  handlePet(p.x,p.y);}
function onMove(e){const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;pointer.moved=1;if(pointer.down)handlePet(p.x,p.y);}
function onUp(){pointer.down=false; if(pettingMode) $('game').style.cursor='grab';}
canvas.addEventListener('mousedown',onDown);
canvas.addEventListener('mousemove',onMove);
window.addEventListener('mouseup',onUp);
canvas.addEventListener('touchstart',e=>{e.preventDefault();onDown(e);},{passive:false});
canvas.addEventListener('touchmove',e=>{e.preventDefault();onMove(e);},{passive:false});
window.addEventListener('touchend',onUp);

function bind(id,fn){ const el=$(id); if(el) el.addEventListener('click',fn); }
bind('bHay',giveHay); bind('bPellets',givePellets); bind('bWater',giveWater);
bind('bBanana',offerBanana); bind('bPet',togglePetting); bind('bTrick',doTrick);
bind('bClean',cleanLitter); bind('bRest',restRabbit); bind('bPlay',playToy); bind('bVet',callVet);
bind('tbShop',()=>openPanel('shop')); bind('tbGoals',()=>openPanel('goals')); bind('tbMenu',()=>openPanel('menu'));

// Games tab stays hidden until it's revealed (day 2, or immediately for established saves) — item 5
function applyGamesTab(){ const t=$('tabGames'); if(t) t.style.display = rab.gamesRevealed ? '' : 'none'; }

// bottom-dock sub-tabs (Care / Play / Health)
function setTab(name){
  document.querySelectorAll('.atab').forEach(b=>b.classList.toggle('on', b.dataset.tab===name));
  document.querySelectorAll('.actrow').forEach(r=>{ r.hidden = r.dataset.group!==name; });
}
document.querySelectorAll('.atab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
bind('panelClose',closePanel);
$('panelWrap').addEventListener('click',e=>{ if(e.target===$('panelWrap')) closePanel(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
window.addEventListener('beforeunload',save);

/* ============================================================================ *
 *  START / ADOPTION SCREEN
 * ============================================================================ */
let chosenCoat='sableGrey', chosenSex='doe', chosenBreed='holland';
const EXAMPLE_NAMES = { holland:'Mowgli', netherland:'Elvis', lionhead:'Lionel' };
function renderSwatches(breed){
  const sw=$('swatches'); sw.innerHTML='';
  const keys = BREED_COATS[breed] || BREED_COATS.holland;
  chosenCoat = BREED_DEFAULT_COAT[breed] || keys[0];
  keys.forEach(key=>{
    const co=COATS[key];
    const d=document.createElement('div');
    d.className='swatch'+(key===chosenCoat?' on':'');
    // two-tone swatch: body colour + the point/marking colour that actually defines
    // the coat (so "Sable Point (Grey)" shows grey, "Black & Tan" shows its tan)
    d.style.background = co.tan
      ? `linear-gradient(135deg, ${co.body} 0 50%, ${co.tanCol} 50% 72%, ${co.point} 72% 100%)`
      : `linear-gradient(135deg, ${co.body} 0 55%, ${co.pointMid} 55% 78%, ${co.point} 78% 100%)`;
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
 *  GUESS MY NUMBER — a risk/reward minigame (you guess the bunny's number)
 *  Difficulty scales with anger: the madder she is, the bigger the range (→25).
 *  Win = +50🥕. Lose all 3 guesses = instant MAX thump (cold shoulder).
 * ============================================================================ */
const GS = { on:false, secret:0, max:10, guesses:0, done:false };
function openGuess(){
  if(rab.cold){ coldRefuse(); return; }
  GS.max = Math.min(25, 10 + Math.round(rab.thumps*3));    // calm 1–10 … furious 1–25
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
  addCarrots(50, rab.x, rab.baseY-60); addXP(15); stats.happy=clamp(stats.happy+14); rab.thumps=clamp(rab.thumps-1,0,5);
  startBinky();
  $('gFace').textContent='😻'; $('gBubble').textContent=`It WAS ${GS.secret}! You read my mind! 🥕`;
  guessEndCard(`<h3>Correct! +50🥕</h3>`); save();
}
function guessLose(){
  GS.done=true; GS.on=false;
  rab.thumps=5; checkThreshold(); triggerThump();     // maxed anger → cold shoulder
  $('gFace').textContent='😡'; $('gBubble').textContent=`It was ${GS.secret}! You'll NEVER guess me! 💢`;
  guessEndCard(`<h3>Wrong — ${rab.name} is FURIOUS 💢</h3>`); save();
}
bind('bGuess', openGuess);
bind('guessClose', closeGuess);
bind('rpsBtn', ()=>location.reload());

/* ============================================================================ *
 *  BUNNY PONG — the ball is a little rabbit head; first to 5 wins carrots
 * ============================================================================ */
const PN = { on:false, over:false, you:0, cpu:0, W:320, H:400, pad:76, px:160, ax:160,
             ball:{x:0,y:0,vx:0,vy:0}, raf:null, lastT:0 };
let pnCanvas=null, pnCtx=null;
function openPong(){
  if(rab.cold){ coldRefuse(); return; }
  pnCanvas=$('pongCanvas'); pnCtx=pnCanvas.getContext('2d');
  minigameActive=true; $('pong').classList.add('show'); $('pongOverlayMsg').className='mgmsg';
  PN.you=0; PN.cpu=0; $('pnYou').textContent=0; $('pnCpu').textContent=0;
  pnResize(); pnServe(true); PN.on=true; PN.over=false;
  PN.lastT=now(); PN.raf=requestAnimationFrame(pnFrame);
}
function closePong(){ PN.on=false; minigameActive=false; if(PN.raf) cancelAnimationFrame(PN.raf); $('pong').classList.remove('show'); last=now(); }
function pnResize(){
  const wCss=Math.min((window.innerWidth||360)*0.84, 330);
  PN.W=Math.round(wCss); PN.H=Math.round(wCss*1.28);
  const dpr=Math.min(window.devicePixelRatio||1,2);
  pnCanvas.style.width=PN.W+'px'; pnCanvas.style.height=PN.H+'px';
  pnCanvas.width=Math.round(PN.W*dpr); pnCanvas.height=Math.round(PN.H*dpr);
  pnCtx.setTransform(dpr,0,0,dpr,0,0);
  PN.pad=Math.round(PN.W*0.26); PN.px=PN.W/2; PN.ax=PN.W/2;
}
function pnServe(down){
  const b=PN.ball, sp=PN.H*0.62, ang=rand(-0.5,0.5);
  b.x=PN.W/2; b.y=PN.H/2; b.vx=Math.sin(ang)*sp; b.vy=(down?1:-1)*Math.cos(ang)*sp;
}
function pnScore(who){
  if(who==='you'){ PN.you++; } else { PN.cpu++; }
  $('pnYou').textContent=PN.you; $('pnCpu').textContent=PN.cpu;
  if(PN.you>=5 || PN.cpu>=5){ pnEnd(); return; }
  pnServe(who==='you');   // serve toward whoever just conceded
}
function pnEnd(){
  PN.over=true; PN.on=false;
  const won=PN.you>PN.cpu;
  if(won){ addCarrots(30, rab.x, rab.baseY-60); addXP(12); stats.happy=clamp(stats.happy+10); startBinky(); }
  else { rab.thumps=clamp(rab.thumps+0.8,0,5); }
  save();
  const m=$('pongOverlayMsg');
  m.innerHTML=`<div class="mgover"><h3>${won?'You win! +30🥕':`${rab.name} wins! 🐰`}</h3>
    <div class="mgbtns"><button id="pnAgain">Play again</button><button id="pnDone">Done</button></div></div>`;
  m.className='mgmsg show';
  $('pnAgain').onclick=()=>{ PN.you=0;PN.cpu=0;$('pnYou').textContent=0;$('pnCpu').textContent=0;
    $('pongOverlayMsg').className='mgmsg'; pnServe(true); PN.on=true; PN.over=false; PN.lastT=now(); PN.raf=requestAnimationFrame(pnFrame); };
  $('pnDone').onclick=closePong;
}
function pnFrame(){
  if(!PN.on) return;
  const t=now(); let dt=t-PN.lastT; PN.lastT=t; dt=Math.min(dt,0.033);
  const b=PN.ball, r=PN.W*0.05;
  // CPU paddle chases the ball (capped speed)
  const aiStep=PN.W*1.25*dt;
  PN.ax += clamp(b.x-PN.ax, -aiStep, aiStep);
  PN.ax = clamp(PN.ax, PN.pad/2, PN.W-PN.pad/2);
  // ball
  b.x+=b.vx*dt; b.y+=b.vy*dt;
  if(b.x<r){ b.x=r; b.vx=Math.abs(b.vx); }
  if(b.x>PN.W-r){ b.x=PN.W-r; b.vx=-Math.abs(b.vx); }
  const yYou=PN.H-24, yCpu=24;
  if(b.vy>0 && b.y>yYou-r && b.y<yYou+10 && Math.abs(b.x-PN.px)<PN.pad/2+r){
    b.y=yYou-r; b.vy=-Math.abs(b.vy)*1.03; b.vx += (b.x-PN.px)/(PN.pad/2)*PN.W*0.6; }
  if(b.vy<0 && b.y<yCpu+r && b.y>yCpu-10 && Math.abs(b.x-PN.ax)<PN.pad/2+r){
    b.y=yCpu+r; b.vy=Math.abs(b.vy)*1.03; b.vx += (b.x-PN.ax)/(PN.pad/2)*PN.W*0.6; }
  b.vx=clamp(b.vx,-PN.H*0.75,PN.H*0.75); b.vy=clamp(b.vy,-PN.H*0.9,PN.H*0.9);
  if(b.y>PN.H+r){ pnScore('cpu'); }
  else if(b.y<-r){ pnScore('you'); }
  pnDraw();
  if(PN.on) PN.raf=requestAnimationFrame(pnFrame);
}
function pnDraw(){
  const c=pnCtx, r=PN.W*0.05, b=PN.ball;
  c.fillStyle='#3a4a6a'; c.fillRect(0,0,PN.W,PN.H);
  c.strokeStyle='rgba(255,255,255,.2)'; c.setLineDash([6,8]); c.lineWidth=2;
  c.beginPath();c.moveTo(0,PN.H/2);c.lineTo(PN.W,PN.H/2);c.stroke(); c.setLineDash([]);
  c.fillStyle='#e6c078'; roundRectCtx(c, PN.px-PN.pad/2, PN.H-28, PN.pad, 11, 5); c.fill();
  c.fillStyle='#c98fb0'; roundRectCtx(c, PN.ax-PN.pad/2, 17, PN.pad, 11, 5); c.fill();
  // ball = rabbit head (ears, face, eyes, nose)
  c.fillStyle=coat.body;
  c.beginPath();c.ellipse(b.x-r*0.5, b.y-r*1.0, r*0.3, r*0.66, -0.2,0,7);c.fill();
  c.beginPath();c.ellipse(b.x+r*0.5, b.y-r*1.0, r*0.3, r*0.66,  0.2,0,7);c.fill();
  c.beginPath();c.arc(b.x, b.y, r, 0,7);c.fill();
  c.fillStyle='#140f0b';
  c.beginPath();c.arc(b.x-r*0.35, b.y-r*0.1, r*0.15,0,7);c.fill();
  c.beginPath();c.arc(b.x+r*0.35, b.y-r*0.1, r*0.15,0,7);c.fill();
  c.fillStyle='#c86a72'; c.beginPath();c.ellipse(b.x, b.y+r*0.28, r*0.13, r*0.1, 0,0,7);c.fill();
}
(function wirePong(){
  const cv=$('pongCanvas');
  const move=(clientX)=>{ if(!PN.on) return; const rct=cv.getBoundingClientRect();
    PN.px=clamp((clientX-rct.left)*(PN.W/rct.width), PN.pad/2, PN.W-PN.pad/2); };
  cv.addEventListener('mousemove',e=>move(e.clientX));
  cv.addEventListener('touchmove',e=>{ e.preventDefault(); move(e.touches[0].clientX); },{passive:false});
  window.addEventListener('keydown',e=>{ if(!PN.on) return;
    if(e.key==='ArrowLeft'){ PN.px=clamp(PN.px-PN.W*0.09,PN.pad/2,PN.W-PN.pad/2); e.preventDefault(); }
    else if(e.key==='ArrowRight'){ PN.px=clamp(PN.px+PN.W*0.09,PN.pad/2,PN.W-PN.pad/2); e.preventDefault(); } });
  window.addEventListener('resize',()=>{ if(pnCanvas && $('pong').classList.contains('show')){
    pnResize(); if(PN.on) pnServe(true); pnDraw(); } });   // re-fit the board; re-serve mid-rally
  bind('bPong', openPong); bind('pongClose', closePong);
})();

/* ---------------- Boot ---------------- */
loadUnlocks();
buildStart();
resize();

})();
