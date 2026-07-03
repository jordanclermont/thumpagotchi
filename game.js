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

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

/* ---------------- Utility ---------------- */
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt));
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
const now=()=>performance.now()/1000;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
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
};
let coat = COATS.sableGrey;
let coatKey = 'sableGrey';

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
];
const shopItem = id => SHOP.find(s=>s.id===id);

/* Daily goal generators — 3 are rolled each new day */
const GOAL_POOL = [
  () => ({track:'hay',    target:2,  reward:7,  text:'Serve fresh hay ×2'}),
  () => ({track:'trick',  target:3,  reward:9,  text:'Perform ×3 tricks'}),
  () => ({track:'clean',  target:1,  reward:6,  text:'Scoop the litter box'}),
  () => ({track:'water',  target:1,  reward:5,  text:'Refill the water bowl'}),
  () => ({track:'pet',    target:15, reward:7,  text:'Give ×15 head pets'}),
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
  ctx.setTransform(DPR,0,0,DPR,0,0);
  world.floorY = H*0.58;
  world.rug   = {x:W*0.5,  y:H*0.80, rx:W*0.44, ry:H*0.155};
  world.litter= {x:W*0.13, y:H*0.70, w:Math.min(150,W*0.21), h:Math.min(78,H*0.13)};
  world.food  = {x:W*0.30, y:H*0.915,r:Math.min(30,W*0.045)};
  world.water = {x:W*0.42, y:H*0.925,r:Math.min(28,W*0.042)};
  world.tube  = {x:W*0.83, y:H*0.68, w:Math.min(150,W*0.22), h:Math.min(74,H*0.13)};
  world.bed   = {x:W*0.63, y:H*0.90, r:Math.min(58,W*0.09)};
  world.castle= {x:W*0.90, y:H*0.86, r:Math.min(60,W*0.10)};
  world.ball  = {x:W*0.20, y:H*0.90, r:Math.min(16,W*0.026)};
  world.win   = {x:W*0.5-W*0.11, y:H*0.07, w:W*0.22, h:H*0.30};
  rab.baseY = world.rug.y - 6;
  rab.x = clamp(rab.x||world.rug.x, world.rug.x-world.rug.rx*0.6, world.rug.x+world.rug.rx*0.6);
}
window.addEventListener('resize', resize);

/* ============================================================================ *
 *  GAME STATE
 * ============================================================================ */
const stats = { happy:80, hunger:30, water:85, hygiene:90, energy:75 };
const rab = {
  name:'Mowgli', sex:'doe',
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
  play:null, playAlpha:1, playYOff:0,
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

/* ============================================================================ *
 *  SAVE / LOAD  (localStorage)
 * ============================================================================ */
const SAVE_KEY = 'thumpagotchi.save.v2';
function save(){
  if(!started) return;
  try{
    const data = {
      v:2, name:rab.name, sex:rab.sex, coatKey,
      stats:{...stats},
      thumps:rab.thumps, cold:rab.cold, bananasToday:rab.bananasToday,
      day:rab.day, ageDays:rab.ageDays, timeOfDay,
      bondLevel:rab.bondLevel, bondXP:rab.bondXP, carrots:rab.carrots,
      weight:rab.weight, health:rab.health, sick:rab.sick,
      items:rab.items, mastery:rab.mastery, achievements:rab.achievements,
      goals:rab.goals, goalDay:rab.goalDay, goalCounters:rab.goalCounters,
      lifetimePets:rab.lifetimePets,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){/* storage unavailable — play unsaved */}
}
function loadRaw(){
  try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){ return null; }
}
function applySave(d){
  rab.name=d.name||'Mowgli'; rab.sex=d.sex||'doe';
  coatKey=d.coatKey&&COATS[d.coatKey]?d.coatKey:'sableGrey'; coat=COATS[coatKey];
  Object.assign(stats, d.stats||{});
  if(stats.energy===undefined) stats.energy=70;
  rab.thumps=d.thumps||0; rab.cold=!!d.cold; rab.bananasToday=d.bananasToday||0;
  rab.day=d.day||1; rab.ageDays=d.ageDays||0; timeOfDay=d.timeOfDay??0.05;
  rab.bondLevel=d.bondLevel||1; rab.bondXP=d.bondXP||0; rab.carrots=d.carrots??12;
  rab.weight=d.weight??100; rab.health=d.health??100; rab.sick=!!d.sick;
  rab.items=d.items||{}; rab.mastery=d.mastery||{}; rab.achievements=d.achievements||{};
  rab.goals=d.goals||[]; rab.goalDay=d.goalDay||0; rab.goalCounters=d.goalCounters||{};
  rab.lifetimePets=d.lifetimePets||0;
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
  if(lv>=5) unlockAch('bond5');
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
  const pool=[...GOAL_POOL]; const chosen=[];
  for(let i=0;i<3 && pool.length;i++){
    const idx=Math.floor(Math.random()*pool.length);
    const g=pool.splice(idx,1)[0]();
    g.prog=0; g.done=false; g.text=g.text.replace('{name}',rab.name);
    chosen.push(g);
  }
  rab.goals=chosen; rab.goalDay=rab.day; rab.goalCounters={};
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
 *  Rabbit geometry
 * ============================================================================ */
function parts(){
  const s = rab.curScale * Math.min(W,H)/560;
  const cx = rab.x;
  const cy = rab.baseY + rab.hopOff + rab.binkyHop + (rab.playYOff||0);
  const loaf = rab.loaf;
  const bodyRx = 96*s*(1+0.06*loaf), bodyRy = 74*s*(1-0.10*loaf);
  const bodyCy = cy - bodyRy*0.82;
  const headR  = 52*s;
  const beg = rab.trick && rab.trick.name==='beg';
  const alert = rab.state==='alert';
  const headCx = cx + (alert? 6*s:0);
  const headCy = bodyCy - bodyRy*0.55 - headR*0.35 + (alert? -8*s:4*s) + (beg? -34*s:0) + loaf*headR*0.18;
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
  const wall=ctx.createLinearGradient(0,0,0,world.floorY);
  wall.addColorStop(0,'#dcc6d8'); wall.addColorStop(1,'#c9b0cf');
  ctx.fillStyle=wall; ctx.fillRect(0,0,W,world.floorY);
  // warm daylight bloom washing in from the window (fades at dusk)
  const bloom=ctx.createRadialGradient(win.x+win.w/2,win.y+win.h*0.6,8,win.x+win.w/2,win.y+win.h*0.6,win.w*1.6);
  bloom.addColorStop(0,`rgba(255,244,214,${0.30*light})`);
  bloom.addColorStop(1,'rgba(255,244,214,0)');
  ctx.fillStyle=bloom; ctx.fillRect(0,0,W,world.floorY);

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

function drawRoom(){
  // wainscot highlight + soft shadow where the wall meets the floor
  ctx.fillStyle='rgba(255,255,255,.16)'; ctx.fillRect(0,world.floorY-14,W,5);
  ctx.fillStyle='rgba(0,0,0,.08)'; ctx.fillRect(0,world.floorY-8,W,8);
  const floor=ctx.createLinearGradient(0,world.floorY,0,H);
  floor.addColorStop(0,'#c99b6a'); floor.addColorStop(1,'#a97a4c');
  ctx.fillStyle=floor; ctx.fillRect(0,world.floorY,W,H-world.floorY);
  ctx.strokeStyle='rgba(90,55,25,.22)'; ctx.lineWidth=2;
  for(let i=1;i<7;i++){const y=world.floorY+(H-world.floorY)*i/7;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  const r=world.rug;
  const rg=ctx.createRadialGradient(r.x,r.y,4,r.x,r.y,r.rx);
  rg.addColorStop(0,'#7bb0a4');rg.addColorStop(.7,'#5f958c');rg.addColorStop(1,'#4d7d75');
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx,r.ry,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx*0.82,r.ry*0.82,0,0,7);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx*0.55,r.ry*0.55,0,0,7);ctx.stroke();

  drawTube(); drawBed(); drawLitter(); drawFoodBowl(); drawWaterBowl();
  if(owns('castle')) drawCastle();
  if(owns('ball'))   drawBall();
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
  ctx.fillStyle='#b5546a'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*0.55,0,0,7);ctx.fill();
  ctx.strokeStyle='#c96a80'; ctx.lineWidth=b.r*0.28;
  ctx.beginPath();ctx.ellipse(b.x,b.y,b.r*0.86,b.r*0.46,0,0,7);ctx.stroke();
  ctx.fillStyle='#e79fae'; ctx.beginPath();ctx.ellipse(b.x,b.y,b.r*0.6,b.r*0.32,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.ellipse(b.x-b.r*0.2,b.y-b.r*0.06,b.r*0.28,b.r*0.12,0,0,7);ctx.fill();
}
function drawTube(){
  const tb=world.tube;
  const g=ctx.createLinearGradient(0,tb.y-tb.h/2,0,tb.y+tb.h/2);
  g.addColorStop(0,'#7ea9d6'); g.addColorStop(0.5,'#5b83b4'); g.addColorStop(1,'#3f5f8c');
  ctx.fillStyle=g; roundRect(tb.x-tb.w/2,tb.y-tb.h/2,tb.w,tb.h,tb.h*0.5); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=3;
  for(let i=1;i<6;i++){const x=tb.x-tb.w/2+i*tb.w/6;
    ctx.beginPath();ctx.ellipse(x,tb.y,tb.h*0.16,tb.h*0.5,0,-1.4,1.4);ctx.stroke();}
  ctx.fillStyle='#241a2a';
  ctx.beginPath();ctx.ellipse(tb.x-tb.w/2+tb.h*0.14,tb.y,tb.h*0.22,tb.h*0.46,0,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(tb.x+tb.w/2-tb.h*0.14,tb.y,tb.h*0.22,tb.h*0.46,0,0,7);ctx.fill();
}
function drawCastle(){
  const c=world.castle, r=c.r;
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
  ctx.fillStyle=`rgba(0,0,0,${0.22*shSc})`;
  ctx.beginPath();ctx.ellipse(p.cx, rab.baseY+(rab.playYOff||0)+6, p.body.rx*0.95*shSc, 15*s*shSc, 0,0,7);ctx.fill();

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

  if(rab.loaf<0.75){
    const stomp=rab.legStomp;
    drawFoot(p.cx - p.body.rx*0.55, p.cy-4*s, s, 0);
    drawFoot(p.cx + p.body.rx*0.5,  p.cy-4*s + stomp*10*s, s, stomp);
  }

  const bg=ctx.createRadialGradient(p.body.x-p.body.rx*0.3,p.body.y-p.body.ry*0.4,p.body.ry*0.2,
                                    p.body.x,p.body.y,p.body.rx*1.15);
  bg.addColorStop(0,coat.hi);bg.addColorStop(0.6,coat.body);bg.addColorStop(1,coat.bodySh);
  ctx.fillStyle=bg;
  ctx.beginPath();ctx.ellipse(p.body.x,p.body.y+breath,p.body.rx,p.body.ry-breath*0.4,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.26)';
  ctx.beginPath();ctx.ellipse(p.body.x-p.body.rx*0.18,p.body.y-p.body.ry*0.25,p.body.rx*0.5,p.body.ry*0.4,0,0,7);ctx.fill();

  if(rab.sick){
    ctx.fillStyle='rgba(120,180,90,.18)';
    ctx.beginPath();ctx.ellipse(p.body.x,p.body.y,p.body.rx,p.body.ry,0,0,7);ctx.fill();
  }
  if(rab.state==='tummy'){
    ctx.fillStyle='rgba(120,180,90,.30)';
    ctx.beginPath();ctx.ellipse(p.body.x,p.body.y+breath+8*s,p.body.rx*0.7,p.body.ry*0.55,0,0,7);ctx.fill();
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
  const hx=p.head.x, hy=p.head.y, r=p.head.r, s=p.s;
  const look = rab.state==='alert' ? {x:rab.lookX*8*s, y:rab.lookY*5*s} : {x:0,y:0};
  const droop = rab.sick? 8*s : 0;   // sick/tired → ears hang lower

  drawLopEar(hx, hy+droop, r, s, -1, t);
  drawLopEar(hx, hy+droop, r, s,  1, t);

  const hg=ctx.createRadialGradient(hx-r*0.3+look.x,hy-r*0.35,r*0.2,hx+look.x,hy,r*1.1);
  hg.addColorStop(0,coat.hi);hg.addColorStop(0.6,coat.body);hg.addColorStop(1,coat.bodySh);
  ctx.fillStyle=hg;
  ctx.beginPath();ctx.ellipse(hx,hy,r,r*0.94,0,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(hx-r*0.7,hy+r*0.3,r*0.42,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(hx+r*0.7,hy+r*0.3,r*0.42,0,7);ctx.fill();

  const nmx=hx+look.x, nmy=hy+r*0.32;
  if(coat.sable){
    const mg=ctx.createRadialGradient(nmx,nmy-r*0.05,2,nmx,nmy,r*0.72);
    mg.addColorStop(0,'rgba(60,52,46,.9)');
    mg.addColorStop(0.45,'rgba(90,80,70,.5)');
    mg.addColorStop(1,'rgba(120,110,100,0)');
    ctx.fillStyle=mg;
    ctx.beginPath();ctx.ellipse(nmx,nmy,r*0.6,r*0.64,0,0,7);ctx.fill();
  }

  const eyeY=hy-r*0.02, eyeDX=r*0.46;
  ctx.strokeStyle=coat.point; ctx.fillStyle='#140f0b'; ctx.lineWidth=3*s;
  for(const dir of [-1,1]){
    const ex=hx+dir*eyeDX+look.x*0.6, ey=eyeY+look.y*0.6;
    if(tummy){
      ctx.strokeStyle='#140f0b';
      ctx.beginPath();ctx.moveTo(ex-5*s,ey-5*s);ctx.lineTo(ex+5*s,ey+5*s);
      ctx.moveTo(ex+5*s,ey-5*s);ctx.lineTo(ex-5*s,ey+5*s);ctx.stroke();
    } else if(closedEyes || rab.blink>0){
      ctx.strokeStyle='#140f0b';
      ctx.beginPath();ctx.arc(ex,ey,6*s,0.15*Math.PI,0.85*Math.PI);ctx.stroke();
    } else {
      ctx.beginPath();ctx.ellipse(ex,ey,6.5*s,7.5*s,0,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.85)';
      ctx.beginPath();ctx.arc(ex-2*s,ey-3*s,2.2*s,0,7);ctx.fill();
      ctx.fillStyle='#140f0b';
    }
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
  for(let i=-1;i<=1;i++){
    ctx.beginPath();ctx.moveTo(nx-6*s,ny+tw*0.4+i*3*s);ctx.lineTo(nx-40*s,ny-4*s+i*7*s+tw);ctx.stroke();
    ctx.beginPath();ctx.moveTo(nx+6*s,ny+tw*0.4+i*3*s);ctx.lineTo(nx+40*s,ny-4*s+i*7*s+tw);ctx.stroke();
  }
}

function drawLopEar(hx,hy,r,s,dir,t){
  const sway = Math.sin(t*1.4 + dir)*3*s + (rab.state==='alert'? -6*s:0);
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

function drawParticles(dt){
  for(const pl of particles){
    pl.t+=dt; pl.x+=pl.vx*dt; pl.y+=pl.vy*dt; pl.vy+=20*dt;
    const a=Math.max(0,1-pl.t/pl.life);
    ctx.globalAlpha=a;
    if(pl.type==='heart'){ctx.font='20px system-ui';ctx.fillText('💗',pl.x,pl.y);}
    else if(pl.type==='spark'){ctx.fillStyle='#ffe9a8';ctx.beginPath();ctx.arc(pl.x,pl.y,3,0,7);ctx.fill();}
    else if(pl.type==='drop'){ctx.fillStyle='#8fd0f0';ctx.beginPath();ctx.arc(pl.x,pl.y,3,0,7);ctx.fill();}
    else if(pl.type==='star'){ctx.font='16px system-ui';ctx.fillText('⭐',pl.x,pl.y);}
    else if(pl.type==='z'){ctx.fillStyle='#fff';ctx.font='18px system-ui';ctx.fillText('z',pl.x,pl.y);}
    else if(pl.type==='carrot'){ctx.font='bold 16px system-ui';ctx.fillStyle='#e8863a';
      ctx.fillText(`+${pl.n}🥕`,pl.x,pl.y);}
    ctx.globalAlpha=1;
  }
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
  rab.day++; rab.ageDays++; rab.bananasToday=0;
  $('dayLbl').textContent='Day '+rab.day;
  // overnight: she's starving but rested and refreshed
  stats.hunger=clamp(stats.hunger+52, 55, 100);
  stats.water=clamp(stats.water-16);
  stats.happy=clamp(stats.happy+18);
  stats.energy=clamp(stats.energy+55, 40, 100);
  rab.cold=false; rab.thumps=clamp(rab.thumps-1,0,5);
  rab.x=world.rug.x;
  // life-stage growth check
  const st=stageFor(rab.ageDays);
  if(st.key!=='kit' && stageFor(rab.ageDays-1).key!==st.key){
    toast(`🎂 ${rab.name} grew up — now a ${st.name}! ${st.label}`);
    if(st.key==='senior') unlockAch('senior');
  }
  if(rab.ageDays>=7) unlockAch('week');
  // fresh daily goals + a login bonus
  rollGoals();
  addCarrots(6);
  startBinky();
  toast(`☀️ Good morning! Day ${rab.day} — ${rab.name} is STARVING but binkying with joy. (+6🥕 daily bonus)`);
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

/* ============================================================================ *
 *  ACTIONS
 * ============================================================================ */
function toast(msg){
  const el=$('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),3000);
}
function triggerThump(){
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
  addWeight(-1.2);                          // hay is the healthy staple
  hayFresh=6; addXP(3); addCarrots(1, rab.x, rab.baseY-70);
  incGoal('hay');
  hopTo(world.litter.x + world.litter.w*0.2);
  toast(`Fresh Timothy hay in the box! ${rab.name} settles in to munch.`);
}
function givePellets(){
  if(rab.cold){ coldRefuse(); return; }
  wake();
  stats.hunger=clamp(stats.hunger-28);
  stats.happy=clamp(stats.happy+6);
  addWeight(3); addXP(2);
  hopTo(world.food.x);
  spawnHeart(parts().head.x, parts().head.y);
  toast(`A scoop of dry pellets. ${cap(P().s)} does a happy nose-dive into the bowl. 🥣`);
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
  wake();
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
  toast(pettingMode? 'Petting ON — drag over the HEAD (never the feet!).' : 'Petting off.');
}
function restRabbit(){
  if(rab.cold){ coldRefuse(); return; }
  if(stats.energy>85){ toast(`${rab.name} isn't sleepy — plenty of energy right now.`); return; }
  rab.restUntil=now()+4.5; rab.state='rest'; rab.trick=null;
  spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r);
  toast(`${rab.name} curls into a cozy nap. 😴`);
}
function playToy(){
  if(rab.cold){ coldRefuse(); return; }
  if(rab.play) return;                       // already playing
  if(!owns('ball') && !owns('tunnel')){ toast('Buy a toy from the Shop 🛒 first, then Play!'); return; }
  if(stats.energy<12){ toast(`${rab.name} is too tired to play — try Rest 😴.`); return; }
  wake();
  startPlay();
  const big = rab.play.type==='tunnel';
  stats.happy=clamp(stats.happy + (big?20:15));
  stats.energy=clamp(stats.energy - (big?7:9));
  addWeight(-1.6); rab.thumps=clamp(rab.thumps-0.5,0,5);
  addXP(5); addCarrots(2, rab.x, rab.baseY-70); incGoal('play');
  toast(big ? `Tunnel zoomies! ${cap(P().s)} bolts through the tube. 🕳️`
            : `${cap(P().s)} bats the treat ball around the rug. 🧸`);
}

/* --- Toy-play animation: she actually chases the ball / runs the tunnel --- */
function startPlay(){
  const canBall=owns('ball'), canTun=owns('tunnel');
  const type = (canBall&&canTun) ? (Math.random()<0.5?'ball':'tunnel') : (canTun?'tunnel':'ball');
  rab.play = {type, t:0, dur:type==='ball'?4.2:3.8, binked:false};
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
  } else {
    // she darts up to the tunnel, ducks in one end and pops out the other
    const tb=world.tube;
    const leftX=tb.x-tb.w*0.30, rightX=tb.x+tb.w*0.30;
    const tunOff=world.tube.y-rab.baseY;                        // lift her up to tube height
    rab.playYOff=lerp(rab.playYOff, (k<0.82?tunOff:0), Math.min(1,dt*5));
    const tx = k<0.30?leftX : k<0.64?rightX : world.rug.x;
    rab.x=lerp(rab.x, tx, Math.min(1,dt*5));
    let a=1;
    if(k>=0.30&&k<0.46) a=1-(k-0.30)/0.16;      // vanish into the near opening
    else if(k>=0.46&&k<0.64) a=0;               // travelling through, hidden
    else if(k>=0.64&&k<0.80) a=(k-0.64)/0.16;   // reappear at the far opening
    rab.playAlpha=clamp(a,0,1);
    rab.hopOff = (k<0.30||k>=0.64)? -Math.abs(Math.sin(pl.t*10))*15*sc : 0;
    if(k>=0.46&&k<0.64 && Math.random()<dt*4) spawnSparkle(k<0.55?leftX:rightX, tb.y);
    if(k>=0.66 && !pl.binked){ pl.binked=true; startBinky(); }   // triumphant pop-out
    if(k>=1) endPlay();
  }
}
function callVet(){
  if(rab.sick){
    if(owns('medicine')){ rab.items.medicine=Math.max(0,(rab.items.medicine|0)-1);
      if(rab.items.medicine<=0) delete rab.items.medicine;
      cureSick(true); refreshActions(); return; }
    if(spendCarrots(25)){ cureSick(false); return; }
    toast(`The vet costs 25🥕 (you have ${rab.carrots}). Or keep Gut Medicine 💊 on hand.`);
    return;
  }
  // wellness checkup
  if(spendCarrots(10)){
    rab.health=clamp(rab.health+20); stats.happy=clamp(stats.happy+4);
    const w = rab.weight>140?'a touch overweight':rab.weight<75?'a little underweight':'a perfect weight';
    toast(`🩺 Checkup done (−10🥕): health up, and ${P().s} is ${w}.`);
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
    }
    return;
  }
  if(dHead<p.head.r*1.15){
    if(tnow-lastPetGain>0.12){
      lastPetGain=tnow; wake();
      stats.happy=clamp(stats.happy+2.2); rab.thumps=clamp(rab.thumps-0.15,0,5);
      rab.lifetimePets++; if(rab.lifetimePets%40===0) addXP(4);
      if(rab.lifetimePets===100) unlockAch('pets100');
      if(rab.lifetimePets%6===0){ incGoal('pet',1); addXP(1); }
      if(Math.random()<0.5) spawnHeart(px+rand(-8,8),py-6);
      if(!rab.trick) rab.state='loaf';
    }
  }
}

/* ---------------- Thump thresholds ---------------- */
let wasAbove3=false;
function checkThreshold(){
  if(rab.thumps>=3 && !wasAbove3){ wasAbove3=true; triggerThump(); }
  if(rab.thumps<2.6) wasAbove3=false;
  if(rab.thumps>=5){ rab.cold=true; }
}

/* ---------------- Idle brain ---------------- */
let nextIdle=3;
function idleBrain(dt,t){
  if(rab.cold||rab.state==='tummy'||rab.state==='rest'||rab.hopping||rab.trick||rab.binkyT>0) return;
  if(pettingMode && pointer.down) return;
  if(stats.energy<18 && Math.random()<0.01){ rab.restUntil=now()+rand(2,4); rab.state='rest';
    spawnZ(parts().head.x+parts().head.r*0.6, parts().head.y-parts().head.r); return; }
  if(stats.happy>88 && stats.energy>25 && Math.random()<0.004){ startBinky(); return; }
  nextIdle-=dt;
  if(nextIdle<=0){
    nextIdle=rand(3.5,7);
    const roll=Math.random();
    if(roll<0.4){ hopTo(rand(world.rug.x-world.rug.rx*0.6, world.rug.x+world.rug.rx*0.6)); }
    else if(roll<0.62){ rab.groomUntil=t+rand(1.4,2.6); }
    else if(roll<0.74 && stats.happy>75 && stats.energy>30){ startBinky(); }
    else if(roll<0.86){ hopTo(world.bed.x); }
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
  const near = Math.hypot(pointer.x-p.head.x,pointer.y-p.head.y) < p.head.r*3 && pointer.moved>0;
  const needy = stats.hunger>62 || stats.hygiene<32 || stats.water<28 || stats.energy<20 || rab.thumps>=2;
  if(rab.hopping || rab.binkyT>0 || near || needy){
    rab.state='alert';
    rab.lookX=clamp((pointer.x-p.head.x)/120,-1,1);
    rab.lookY=clamp((pointer.y-p.head.y)/120,-1,1);
    return;
  }
  rab.state='loaf';
}

/* ============================================================================ *
 *  MAIN LOOP
 * ============================================================================ */
let last=now();
function frame(){
  const t=now(); let dt=t-last; last=t; dt=Math.min(dt,0.05);

  ctx.clearRect(0,0,W,H);

  if(cutscene){ drawNight(dt); requestAnimationFrame(frame); return; }

  const stage = stageFor(rab.ageDays);
  rab.curScale = damp(rab.curScale, stage.scale, 1.5, dt);

  timeOfDay += dt/DAY_LEN;
  if(timeOfDay>=1){ timeOfDay=1; startNight(); requestAnimationFrame(frame); return; }
  $('clockLbl').textContent =
    timeOfDay<0.15?'🌅': timeOfDay<0.45?'☀️': timeOfDay<0.75?'🌤️': timeOfDay<0.9?'🌇':'🌆';

  /* stat decay (stage-scaled hunger + energy) */
  const sickMul = rab.sick? 1.4 : 1;
  stats.hunger=clamp(stats.hunger + stage.hunger*sickMul*dt);
  stats.hygiene=clamp(stats.hygiene - 0.72*sickMul*dt);
  stats.water=clamp(stats.water - 0.62*sickMul*dt);
  const happyDecay = 0.6 * (owns('castle')?0.82:1) * ((owns('ball')||owns('tunnel'))?0.88:1);
  stats.happy=clamp(stats.happy - happyDecay*dt);
  if(rab.state==='rest'){ stats.energy=clamp(stats.energy + 11*dt); }
  else { stats.energy=clamp(stats.energy - stage.energy*0.5*dt); }
  if(hayFresh>0) hayFresh-=dt;

  tickHealth(dt);

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

  if(stats.happy>=90 && rab.goals.some(g=>g.track==='happy90'&&!g.done)) incGoal('happy90');

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

  if(rab.play){
    updatePlay(dt);
  } else {
    if(rab.hopping){
      const k=(t-rab.hopT0)/rab.hopDur;
      if(k>=1){rab.hopping=false;rab.hopOff=0;rab.x=rab.hopToX;}
      else{rab.x=lerp(rab.hopFromX,rab.hopToX,k); rab.hopOff=-Math.sin(k*Math.PI)*46*(Math.min(W,H)/560);}
    }
    idleBrain(dt,t);
    updateState(t);
  }

  /* loaf pose: content, fed, calm */
  const wantsLoaf = rab.state==='loaf' && !rab.hopping && stats.happy>60 && stats.hunger<55;
  rab.loaf = damp(rab.loaf, wantsLoaf?1:0, 3, dt);

  if((rab.state==='loaf'||rab.state==='rest') && stats.happy>70 && Math.random()<0.006){
    const p=parts(); spawnZ(p.head.x+p.head.r*0.6,p.head.y-p.head.r);
  }

  /* render */
  ctx.save();
  if(thumpFx>0){const m=thumpFx*8;ctx.translate(rand(-m,m),rand(-m,m));}
  drawSky();
  drawRoom();
  drawParticles(dt);
  ctx.save(); ctx.globalAlpha = rab.playAlpha!==undefined?rab.playAlpha:1; drawRabbit(t); ctx.restore();
  drawThumpFx(dt);
  drawAmbient();
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
  const paws=document.querySelectorAll('.paw'); const n=Math.round(rab.thumps);
  paws.forEach((pw,i)=>pw.classList.toggle('on',i<n));
  // progression chips
  $('carrotN').textContent=rab.carrots;
  $('bondN').textContent=rab.bondLevel;
  $('bondBar').style.width=(rab.bondXP/xpNeeded(rab.bondLevel)*100)+'%';
  const st=stageFor(rab.ageDays);
  $('stageChip').textContent=`${st.label} ${st.name}`;
  // health warning pip
  const hc=$('healthChip');
  if(rab.sick){ hc.style.display='inline-flex'; hc.textContent='🤒 Sick'; hc.className='chip warn blink'; }
  else if(rab.health<45){ hc.style.display='inline-flex'; hc.textContent='❤ '+Math.round(rab.health); hc.className='chip warn'; }
  else { hc.style.display='none'; }
  // contextual action enabling
  $('bVet').classList.toggle('urgent', rab.sick);
}

/* Buttons that appear/disable based on ownership & state */
function refreshActions(){
  const play=$('bPlay');
  if(play) play.style.display = (owns('ball')||owns('tunnel')) ? 'flex' : 'none';
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
      rab.health=clamp(rab.health+8); addWeight(-2); }
    else if(id==='oxbow'){ stats.hunger=clamp(stats.hunger-40); addWeight(1.5); rab.health=clamp(rab.health+3); }
    stats.happy=clamp(stats.happy+6); spawnHeart(parts().head.x,parts().head.y);
    toast(`Yum! ${it.name} served. 😋`);
  } else if(it.type==='cure'){
    rab.items[id]=(rab.items[id]||0)+1;
    toast(`Bought ${it.name}. The Vet will use it free when needed. 💊`);
  } else {
    rab.items[id]=1;
    toast(`Bought ${it.name}! ${it.emoji}`);
    if(it.type==='toy'||it.type==='decor'){
      const toys=['ball','tunnel','castle'].filter(owns).length;
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
    <div class="mhdr">Trick mastery</div>${masteryList}
    <div class="mbtns">
      <button id="mSave" class="mbtn">💾 Save now</button>
      <button id="mReset" class="mbtn danger">🗑️ Rehome (reset)</button>
    </div>
    <div class="mtip">Tip: hay keeps weight healthy; bananas are treats (max 2/day). Neglect risks GI&nbsp;stasis — keep the Vet 🩺 and Gut Medicine 💊 in mind.</div>`;
  $('mSave').onclick=()=>{ save(); toast('Game saved. 💾'); };
  $('mReset').onclick=()=>{
    if(confirm('Rehome your rabbit and start over? This erases your save.')){
      wipeSave(); location.reload();
    }
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
function onDown(e){pointer.down=true;const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;pointer.moved=1;handlePet(p.x,p.y);}
function onMove(e){const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;pointer.moved=1;if(pointer.down)handlePet(p.x,p.y);}
function onUp(){pointer.down=false;}
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
let chosenCoat='sableGrey', chosenSex='doe';
function buildStart(){
  const sw=$('swatches');
  Object.keys(COATS).forEach(key=>{
    const co=COATS[key];
    const d=document.createElement('div');
    d.className='swatch'+(key==='sableGrey'?' on':'');
    d.style.background=`radial-gradient(circle at 35% 30%, ${co.hi}, ${co.body} 55%, ${co.point})`;
    d.title=co.name; d.dataset.key=key;
    d.addEventListener('click',()=>{
      chosenCoat=key;
      document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('on'));
      d.classList.add('on');
      $('coatName').textContent=co.name;
    });
    sw.appendChild(d);
  });
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
  initPaws(); refreshActions(); setTab('care'); resize();
  rab.baseY=world.rug.y-6;
  renderGoals(); updateHUD();
  last=now();
  requestAnimationFrame(frame);
}
function startGame(fromSave, saved){
  if(started) return;
  started=true;
  if(fromSave && saved){
    applySave(saved);
    $('petName').textContent=rab.name;
    $('dayLbl').textContent='Day '+rab.day;
    if(!rab.goals.length || rab.goalDay!==rab.day) rollGoals();
    beginLoop();
    toast(`Welcome back! ${rab.name} missed you. 🐰`);
    return;
  }
  coat = COATS[chosenCoat] || COATS.sableGrey; coatKey=chosenCoat;
  rab.sex = chosenSex;
  const nm=($('nameInput').value||'').trim();
  rab.name = nm || pick(['Mowgli','Nutmeg','Clover','Waffles','Mochi','Pip','Biscuit','Bramble','Poppy']);
  $('petName').textContent=rab.name;
  rab.curScale=stageFor(0).scale;
  rollGoals();
  unlockAch('firstDay');
  beginLoop();
  rab.x=world.rug.x;
  startBinky();
  toast(`Welcome home, ${rab.name}! ${cap(P().s)} does a happy binky. Care for ${P().o} to earn 🥕 and grow your Bond.`);
  save();
}

/* ---------------- Boot ---------------- */
buildStart();
resize();

})();
