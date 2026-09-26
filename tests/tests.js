/* ============================================================================ *
 *  THUMPAGOTCHI TEST SUITE
 *  Never shipped. tests/run_tests.py copies the game to a temp folder, splices this
 *  file into game.js's closure (so it can reach the game's internals), and loads the
 *  page once per group as index.html#<group> in headless Chrome. Each group starts
 *  from a fresh adoption and reports JSON into <pre id="thump-test-results">.
 *
 *  Add a check:   check('what should be true', condition, 'detail shown on failure')
 *  Add a group:   group('name', async () => { fresh(); ... })
 * ============================================================================ */
const __T = { groups:{}, results:[], errors:[] };
function group(name, fn){ __T.groups[name]=fn; }
function check(name, cond, detail){ __T.results.push({name, ok:!!cond, detail: cond ? undefined : String(detail ?? '')}); }
window.addEventListener('error', e=>__T.errors.push(`${e.message} @${e.lineno}`));
const wait = ms => new Promise(r=>setTimeout(r,ms));

// fresh adoption, with the daily events that would hide the rabbit switched off
function fresh(){
  try{ localStorage.clear(); }catch(e){}
  loadNotes();
  startGame(false);
  calm();
}
function calm(){ rab.hidden=false; dayEvent=null; rab.cold=false; rab.sick=false; rab.trick=null; rab.binkyT=0; rab.hopping=false; rab.play=null; rab.tummyUntil=0; rab.restUntil=0; rab.state='loaf'; }
function nextDay(){ startNight(); endNight(); calm(); }
const finite = v => typeof v==='number' && Number.isFinite(v);
const hexOK = s => /^#[0-9a-f]{6}$/i.test(s);

/* ------------------------------------------------------------------ adoption */
group('adoption', async ()=>{
  fresh();
  check('game starts', started);
  check('favourite treat rolled', !!FAV_TREATS[rab.favTreat], rab.favTreat);
  check('preferences rolled and valid', PET_SPOTS[rab.prefs.pet] && TOYS[rab.prefs.toy] && NAP_SPOTS[rab.prefs.nap] && DISLIKES[rab.prefs.dislike], JSON.stringify(rab.prefs));
  check('never dislikes the favourite toy', rab.prefs.dislike!==rab.prefs.toy);
  check('kits start on alfalfa hay', rab.hayType==='alfalfa', rab.hayType);
  check('day 1 has 3 goals', rab.goals.length===3, rab.goals.length);
  check('no temperament before adulthood', rab.temper===null);
  // roll many preference sets: the favourite toy is never the dislike
  let clash=0; for(let i=0;i<300;i++){ const p=rollPrefs(); if(p.dislike===p.toy) clash++; }
  check('rollPrefs never makes the favourite toy a dislike (300 rolls)', clash===0, clash);
  await wait(1500);
});

/* ------------------------------------------------------------------ save */
group('save', async ()=>{
  fresh();
  rab.favKnown=true; rab.prefKnown.pet=true; rab.temper='bold'; rab.hayType='mixed'; rab.haySwitchDay=3;
  save(); const d=loadRaw();
  check('save keeps realism fields', d && d.temper==='bold' && d.favKnown===true && d.prefKnown.pet===true && d.hayType==='mixed' && d.haySwitchDay===3, JSON.stringify(d&&{t:d.temper,h:d.hayType}));
  // an old save written before any of the realism fields existed
  const old={...d}; ['temper','upbringing','favTreat','favKnown','prefs','prefKnown','prefCount','hayType','haySwitchDay','quizPaidDay','safePaidDay'].forEach(k=>delete old[k]);
  old.ageDays=12; old.maxAngerCount=1;
  applySave(old);
  check('old adult save gets a temperament', rab.temper==='skittish', rab.temper);
  check('old save gets a favourite and preferences', !!FAV_TREATS[rab.favTreat] && !!TOYS[rab.prefs.toy]);
  check('old adult save counts as on Timothy hay', rab.hayType==='timothy', rab.hayType);
  const oldKit={...old, ageDays:2}; applySave(oldKit);
  check('old kit save stays on alfalfa', rab.hayType==='alfalfa', rab.hayType);
  // corrupt / hostile values never produce NaN
  const bad={...d, stats:{happy:'x', hunger:null, water:1e9, hygiene:-50, energy:NaN}, bondXP:'lots', weight:'fat', carrots:-10, prefs:{pet:'nose', toy:'boat', nap:7, dislike:'ball'}, upbringing:{mistakes:'a'}};
  applySave(bad);
  check('corrupt stats become finite numbers in range', Object.values(stats).every(v=>finite(v) && v>=0 && v<=100), JSON.stringify(stats));
  check('corrupt bond/weight/carrots become finite', finite(rab.bondXP) && finite(rab.weight) && rab.carrots>=0);
  check('invalid preferences are replaced', PET_SPOTS[rab.prefs.pet] && TOYS[rab.prefs.toy] && NAP_SPOTS[rab.prefs.nap] && DISLIKES[rab.prefs.dislike], JSON.stringify(rab.prefs));
  check('invalid upbringing becomes numbers', finite(rab.upbringing.mistakes));
  // coats
  applySave({...d, breed:'holland', coatKey:'sableSepia'}); check('retired Sepia coat still loads', coatKey==='sableSepia');
  applySave({...d, breed:'lionhead', coatKey:'lhChestnut'}); check('retired Chestnut Lionhead still loads', coatKey==='lhChestnut');
  applySave({...d, breed:'holland', coatKey:'nope'});        check('unknown coat falls back to the breed default', coatKey==='sableGrey', coatKey);
  // save codes
  save(); const code=buildSaveCode();
  const parsed=parseSaveCode(code);
  check('save code round-trips', parsed.ok && parsed.payload.save.name===rab.name);
  check('save code carries Rabbit Notes', parsed.ok && typeof parsed.payload.notes==='object');
  check('junk save code is rejected', !parseSaveCode('not a code').ok);
  check('empty save code is rejected', !parseSaveCode('').ok);
  await wait(1500);
});

/* ------------------------------------------------------------------ health */
group('health', async ()=>{
  fresh();
  rab.health=30; check('below 45 health counts as unwell', unwell());
  rab.favTreat='banana'; rab.favKnown=true; const b0=rab.bananasToday; offerBanana();
  check('unwell rabbit refuses a known favourite', rab.bananasToday===b0);
  feedLock.hay=0; stats.hunger=80; giveHay();
  check('unwell rabbit only nibbles hay', stats.hunger>=64 && stats.hunger<80, stats.hunger);
  rab.carrots=100; buy('chews');
  check('refused shop treat costs no carrots', rab.carrots===100, rab.carrots);
  rab.health=5; getSick(); feedLock.hay=0; const h0=stats.hunger; giveHay();
  check('sick rabbit refuses hay', stats.hunger===h0);
  rab.sick=false; rab.health=30; rab.carrots=50; callVet();
  check('a vet visit while unwell is a cheap early catch', rab.health>=78 && !unwell() && rab.carrots>=40, `${rab.health} ${rab.carrots}`);
  // weight
  rab.weight=170; rab.health=100; Object.assign(stats,{hunger:30, hygiene:90, water:90, energy:90});
  for(let i=0;i<200;i++) tickHealth(0.05);
  check('overweight does not drain health (weight is a welfare issue, not illness)', rab.health>=99, rab.health);
  rab.weight=50; rab.health=100; for(let i=0;i<200;i++) tickHealth(0.05);
  check('underweight still drains health', rab.health<99, rab.health);
  await wait(1500);
});

/* ------------------------------------------------------------------ cold shoulder */
group('coldshoulder', async ()=>{
  fresh();
  rab.favTreat='chews'; rab.favKnown=false; rab.cold=true;
  offerBanana(); check('banana does not forgive a rabbit whose favourite is apple chews', rab.cold===true);
  rab.carrots=50; buy('greens'); check('a non-favourite shop treat is refused and costs nothing', rab.cold && rab.carrots===50);
  buy('chews'); check('the favourite ends the sulk, costs its price, and is discovered', !rab.cold && rab.favKnown && rab.carrots===40, rab.carrots);
  rab.favTreat='banana'; rab.cold=true; feedLock.banana=0; offerBanana(); check('banana forgives a banana-lover', !rab.cold);
  rab.cold=true; nextDay(); check('a new day always clears the Cold Shoulder (no soft-lock)', !rab.cold);
  await wait(1500);
});

/* ------------------------------------------------------------------ temperament */
group('temperament', async ()=>{
  fresh();
  const settle=u=>{ rab.upbringing=u; rab.temper=null; settleTemperament(); return rab.temper; };
  check('many mistakes → skittish', settle({mistakes:7,affection:0,play:0})==='skittish');
  check('more affection → cuddly',  settle({mistakes:0,affection:50,play:10})==='cuddly');
  check('more play → bold',          settle({mistakes:0,affection:5,play:40})==='bold');
  rab.temper=null; rab.ageDays=6; rab.upbringing={mistakes:0,affection:1,play:0}; nextDay();
  check('temperament is set on the morning she turns Adult', rab.temper==='cuddly' && rab.ageDays===7, `${rab.temper} day ${rab.ageDays}`);
  const a=rab.upbringing.affection; raiseAffection(5);
  check('the upbringing tally is frozen after adulthood', rab.upbringing.affection===a);
  await wait(1500);
});

/* ------------------------------------------------------------------ preferences */
group('preferences', async ()=>{
  fresh();
  rab.prefs.pet='forehead'; rab.prefs.dislike='nose'; pettingMode=true; stats.happy=80;
  const p=parts();
  for(let i=0;i<60;i++){ lastPetGain=-1; handlePet(p.head.x, p.head.y-p.head.r*0.5); }
  check('favourite rub spot is discovered by stroking it', rab.prefKnown.pet===true);
  const th=rab.thumps; rab.lastAnnoyed=-9; handlePet(p.head.x, p.head.y+p.head.r*0.35);
  check('touching a disliked nose annoys and is discovered', rab.prefKnown.dislike && rab.thumps>th);
  pettingMode=false;
  rab.items.ball=1; rab.items.tunnel=1; rab.prefs.toy='tunnel'; rab.prefs.dislike='ball'; rab.prefKnown.dislike=false; rab.prefKnown.toy=false;
  for(let i=0;i<40;i++){ calm(); stats.energy=90; playToy(); }
  check('favourite toy is discovered by playing', rab.prefKnown.toy===true);
  check('disliked toy is discovered by playing', rab.prefKnown.dislike===true);
  let offeredDisliked=0; for(let i=0;i<40;i++){ calm(); stats.energy=90; playToy(); if(rab.play && rab.play.type==='ball') offeredDisliked++; }
  check('once the dislike is known, Play stops offering it', offeredDisliked===0, offeredDisliked);
  rab.prefs.nap='bed'; rab.prefKnown.nap=false; rab.prefCount.nap=0;
  for(let i=0;i<2;i++){ calm(); rab.state='loaf'; rab.restCooldown=0; stats.energy=50; restRabbit(); }   // two separate naps
  check('favourite nap spot is discovered', rab.prefKnown.nap===true);
  await wait(1500);
});

/* ------------------------------------------------------------------ hay */
group('hay', async ()=>{
  fresh();
  rab.carrots=100; buy('timothy'); check('Timothy Hay is locked for kits', rab.hayType==='alfalfa');
  rab.ageDays=6; rab.temper=null; nextDay(); check('now an adult', isAdult());
  feedLock.hay=0; const w0=rab.weight; giveHay(); check('an adult on alfalfa gains weight', rab.weight>w0);
  buy('timothy'); check('buying Timothy starts a gradual mix', rab.hayType==='mixed');
  nextDay(); check('still mixing after one night', rab.hayType==='mixed');
  nextDay(); check('fully on Timothy after two nights', rab.hayType==='timothy');
  feedLock.hay=0; const w1=rab.weight; giveHay(); check('Timothy hay trims weight', rab.weight<w1);
  const c=rab.carrots; buy('timothy'); check('Timothy cannot be bought twice', rab.carrots===c);
  await wait(1500);
});

/* ------------------------------------------------------------------ notes & copy */
group('notes', async ()=>{
  fresh();
  const all=NOTES.map(n=>n.text+' '+n.hint+' '+n.title).join(' ');
  check('Rabbit Notes are gender-neutral', !/\b(she|her|hers|he|him|his)\b/i.test(all), (all.match(/\b(she|her|hers|he|him|his)\b/gi)||[]).join(','));
  check('Rabbit Notes never refer to rabbits as sporting animals', !/sport|compet|hurdl|show-?jump/i.test(all));
  check('every Rabbit Note has a quiz question', NOTES.every(n=>QUIZ_NOTES[n.id]), NOTES.filter(n=>!QUIZ_NOTES[n.id]).map(n=>n.id).join(','));
  check('note ids are unique', new Set(NOTES.map(n=>n.id)).size===NOTES.length);
  learnNote('thump', true); const n1=Object.keys(notes).length; learnNote('thump', true);
  check('learning a note twice changes nothing', Object.keys(notes).length===n1);
  learnNote('not-a-note', true); check('unknown note ids are ignored', !notes['not-a-note']);
  // user text never becomes markup
  rab.name='<img src=x id=pwned>'; openPanel('notes');
  check('rabbit name is escaped in the Notebook', !document.getElementById('pwned'));
  closePanel(); openPanel('menu'); check('rabbit name is escaped in the Menu', !document.getElementById('pwned')); closePanel();
  await wait(1500);
});

/* ------------------------------------------------------------------ games */
group('games', async ()=>{
  fresh();
  rab.day=4; rab.gamesRevealed=true; applyGamesTab();
  $('tabGames').click();
  check('the Games tab opens the games menu', panelOpen==='games' && $('panelBody').querySelectorAll('.srow').length===GAMES.length);
  const playable=[...$('panelBody').querySelectorAll('.sbuy')].filter(b=>!b.disabled).length;
  check('on day 4, 7 games are playable and the quiz is locked', playable===7, playable);
  closePanel();
  // Forage: pick the cup the treat is under
  openForage();
  for(let r=0;r<3;r++){ for(let k=0;k<80 && FG.busy;k++) await wait(100); $('fCup'+FG.treatCup).click(); await wait(1500); }
  check('Forage: following the treat wins 3/3', FG.won===3, FG.won);
  closeForage(); check('closing Forage resumes the pet sim', !minigameActive);
  openForage(); for(let k=0;k<80 && FG.busy;k++) await wait(100); $('fCup'+((FG.treatCup+1)%3)).click(); await wait(1500);
  check('Forage: a miss ends the game', FG.won===0);
  closeForage();
  // Dig Box
  const c0=rab.carrots; openDig();
  check('Dig Box has a 4×4 grid', $('dGrid').children.length===16);
  const kids=[...$('dGrid').children]; const e=DG.cells.indexOf('empty'); kids[e].click();
  const n=digNeighbours(e).filter(j=>DG.cells[j]==='treat').length;
  check('an empty spot shows how many treats are next to it', kids[e].textContent===(n?`👃${n}`:'·'), kids[e].textContent);
  DG.cells.forEach((c,i)=>{ if(c==='treat') kids[i].click(); });
  check('finding every treat ends the round and pays', DG.over && DG.found===5 && rab.carrots>c0);
  closeDig(); openDig(); DG.time=1; await wait(1400);
  check('running out of time ends the round', DG.over); closeDig();
  // Safe or Not?
  const c1=rab.carrots; openSafe();
  for(let i=0;i<SF.list.length;i++){ const f=SF.list[SF.i]; $(f.ok?'sYes':'sNo').click(); $('sNext').click(); }
  check('Safe or Not?: 10/10 pays 20 carrots', SF.right===10 && rab.carrots===c1+20, rab.carrots-c1);
  const c2=rab.carrots; $('sAgain').click();
  for(let i=0;i<SF.list.length;i++){ const f=SF.list[SF.i]; $(f.ok?'sNo':'sYes').click(); $('sNext').click(); }
  check('Safe or Not?: a second round the same day pays nothing', rab.carrots===c2);
  closeSafe();
  check('Safe or Not?: every food has a name and a reason', SAFE_FOODS.every(f=>f.n && f.why));
  check('Safe or Not?: 10 safe and 10 not-safe foods', SAFE_FOODS.filter(f=>f.ok).length===10 && SAFE_FOODS.filter(f=>!f.ok).length===10);
  // Quiz
  ['thump','binky','purr','hay'].forEach(id=>learnNote(id,true)); rab.favKnown=true; rab.day=5; applyGamesTab();
  check('the quiz unlocks on day 5 once there is enough to ask', gameUnlocked('quiz'));
  const pool=quizPool();
  check('every quiz question has its answer among 3 distinct options', pool.every(q=>!q.w.includes(q.a) && new Set([q.a,...q.w]).size===q.w.length+1 && q.w.length>=1));
  const c3=rab.carrots; openQuiz();
  for(let i=0;i<QZ.qs.length;i++){ const Q=QZ.qs[QZ.i]; [...$('qOpts').querySelectorAll('button')].find(x=>x.textContent===Q.a).click(); $('qNext').click(); }
  check('a perfect quiz pays', rab.carrots>c3 && QZ.right===QZ.qs.length);
  const c4=rab.carrots; $('qAgain').click();
  for(let i=0;i<QZ.qs.length;i++){ const Q=QZ.qs[QZ.i]; [...$('qOpts').querySelectorAll('button')].find(x=>x.textContent===Q.a).click(); $('qNext').click(); }
  check('a second quiz the same day pays nothing', rab.carrots===c4);
  closeQuiz();
  check('no minigame left the pet sim paused', !minigameActive);
  await wait(800);
});

/* ------------------------------------------------------------------ coats */
group('coats', async ()=>{
  fresh();
  const listed=Object.values(BREED_COATS).flat();
  check('every listed coat is defined', listed.every(k=>COATS[k]), listed.filter(k=>!COATS[k]).join(','));
  check('every coat colour is a valid hex', Object.values(COATS).every(c=>['body','bodySh','hi','point','pointMid'].every(f=>hexOK(c[f]))));
  check('every breed default is in its list', Object.entries(BREED_DEFAULT_COAT).every(([b,k])=>BREED_COATS[b].includes(k)));
  check('no made-up coat names remain', !Object.values(COATS).some(c=>/\(Grey\)|Fawn \//.test(c.name)));
  // draw every coat on every breed it belongs to for a few real frames
  for(const [b,ks] of Object.entries(BREED_COATS)) for(const k of ks){ rab.breed=b; coat=COATS[k]; coatKey=k; await wait(60); }
  check('every coat draws without errors', __T.errors.length===0, __T.errors.join(' ; '));
});

/* ------------------------------------------------------------------ review fixes (2026-09-26) */
// One check per code-review finding; each fails on the code as it was before the fix.
group('fixes', async ()=>{
  fresh();
  const toasts=[]; const realToast=toast; toast=m=>{ toasts.push(m); realToast(m); };
  // 1. the Cold Shoulder can't starve her
  rab.cold=true; rab.favTreat='chews'; rab.carrots=0; stats.hunger=90; feedLock.hay=0; giveHay();
  check('a sulking rabbit still eats hay', stats.hunger<=50 && rab.cold, stats.hunger);
  rab.cold=true; rab.carrots=10; rab.sick=true; rab.health=0; collapse();
  check('a collapse ends the sulk', !rab.cold);
  rab.cold=true; rab.lastSeen=Date.now()-2*864e5; welcomeBack();
  check('coming back after a long absence ends an old sulk', !rab.cold);
  // 2. imported saves can't inject markup or crash
  save(); const d=loadRaw();
  applySave({...d, sex:'<img src=x id=pwned>'}); openPanel('menu');
  check('a hostile sex field is rejected', rab.sex==='buck' && !document.getElementById('pwned')); closePanel();
  applySave({...d, items:'x', firedCards:'x', decor:'x', goalCounters:'x', mastery:{spin:'50'}, achievements:{fake:1, firstDay:1}});
  let threw=null; try{ rab.carrots=100; buy('ball'); rab.firedCards.cold; fireFact('cold'); }catch(e){ threw=e.message; }
  check('wrong-typed save fields can’t crash buying or fact cards', !threw, threw);
  check('mastery values are numbers', rab.mastery.spin===50, typeof rab.mastery.spin);
  check('unknown achievements are dropped', !rab.achievements.fake && rab.achievements.firstDay===1);
  // 4. obesity strikes don't stack on reload
  applySave({...d, weight:170, weightStrikes:1}); check('reload mid-obesity keeps the episode flag', rab._obeseWarned===true);
  applySave({...d, weight:100, weightStrikes:0});
  // 5. diet can't starve her underweight
  rab.weight=100; rab.bondLevel=6; rab.items.ball=1; rab.items.tunnel=1;
  for(let i=0;i<30;i++){ calm(); stats.energy=90; stats.hunger=80; feedLock.hay=0; giveHay(); playToy(); }
  for(let i=0;i<400;i++) tickHealth(0.5);
  check('hay, play and resting never push weight below ideal', rab.weight>=100, rab.weight);
  rab.weight=130; feedLock.hay=0; stats.hunger=80; giveHay(); check('hay still trims extra weight', rab.weight<130);
  // 6. 120Hz screens behave like 60Hz
  check('per-frame chances scale with frame time', typeof perFrame==='function' && Math.abs(perFrame(0.01,1/120)*120 - perFrame(0.01,1/60)*60) < 1e-9);
  // 7. illness is never hidden
  calm(); rab.sick=true; const hp=stats.happy; playToy(); check('a sick rabbit won’t play', !rab.play && stats.happy===hp);
  rab.sick=false; rab.health=30; calm(); playToy(); check('an unwell rabbit won’t play', !rab.play); rab.health=100;
  toasts.length=0; rab.nextCheckupDay=rab.day-2; rab.sick=false; const rnd=Math.random; Math.random=()=>0; startNight(); endNight(); Math.random=rnd;
  const sickOvernight=rab.sick; calm();
  await wait(12000);
  check('stasis that begins overnight is announced after the morning toast', sickOvernight && toasts.some(m=>/GI stasis overnight/.test(m)), toasts.join(' | '));
  rab.sick=false; rab.health=100;
  // 8. personality fairness
  rab.temper=null; rab.ageDays=3; rab.upbringing={mistakes:0,affection:0,play:0};
  rab.day=2; timeOfDay=0.5; rab.thumpSeen=false; rab.thumps=0; tickScript(now());
  check('the scripted demo thump is not an upbringing mistake', rab.thumpSeen && rab.upbringing.mistakes===0, rab.upbringing.mistakes);
  rab.thumps=2.8; for(let i=0;i<10;i++){ rab.lastAnnoyed=-9; annoyed('nose','x'); }
  check('a dislike alone never tips into a THUMP', rab.thumps<3, rab.thumps);
  rab.thumps=0; rab.bananasToday=2; rab.health=100; feedLock.banana=0; calm(); rab.favTreat='greens';
  offerBanana(); offerBanana(); offerBanana();
  check('double-tapping a 3rd banana is penalised once', rab.health===92, rab.health);
  // 9. hide-and-seek
  calm(); rab.hidden=true; pettingMode=true; stats.happy=50; const p=parts(); const h0=stats.happy; lastPetGain=-1; handlePet(p.head.x, p.head.y);
  check('you can’t pet an invisible rabbit', stats.happy===h0); pettingMode=false;
  const c0=rab.carrots; buy('greens'); check('the shop waits until you find her', rab.carrots===c0); calm();
  // 10–14. farms
  openDig(); const kids=[...$('dGrid').children]; let clicked=0;
  DG.cells.forEach((c,i)=>{ if(c==='empty' && clicked<5){ kids[i].click(); clicked++; } });
  check('Dig Box ends after 5 empty digs', DG.over && DG.misses===5); closeDig();
  calm(); rab.state='loaf'; rab.restCooldown=0; stats.energy=50; restRabbit(); const firstUntil=rab.restUntil;
  await wait(300); rab.state='loaf'; stats.energy=50; restRabbit();
  check('Rest can’t be chained back-to-back', rab.restUntil===firstUntil);
  calm(); stats.happy=90; stats.energy=90; rab.bondLevel=6; let comeSet=false;
  for(let i=0;i<30 && !comeSet;i++){ calm(); doTrick(); if(rab.trick && rab.trick.name==='come') comeSet=true; }
  check('the Come trick counts as a trick in progress', comeSet);
  calm(); stats.hunger=10; const cx=rab.carrots, xp=rab.bondXP; feedLock.hay=0; giveHay();
  check('hay for a full rabbit earns nothing', rab.carrots===cx && rab.bondXP===xp);
  stats.hygiene=95; const xp2=rab.bondXP; feedLock.clean=0; cleanLitter(); check('scooping a clean box earns nothing', rab.bondXP===xp2);
  stats.water=95; const xp3=rab.bondXP; feedLock.water=0; giveWater(); check('topping up a full bowl earns nothing', rab.bondXP===xp3);
  rab.guessPaidDay=0; const g0=rab.carrots; openGuess(); guessWin(); closeGuess(); openGuess(); guessWin(); closeGuess();
  check('Guess My Number pays once a day', rab.carrots===g0+30, rab.carrots-g0);
  rab.tttPaidDay=0; const t0=rab.carrots; openTtt(); tttEndGame('c'); closeTtt(); openTtt(); tttEndGame(null); closeTtt();
  check('Tic-Tac-Toe pays its first win or draw each day only', rab.carrots===t0+20, rab.carrots-t0);
  ['thump','binky','purr','hay'].forEach(id=>learnNote(id,true)); rab.favKnown=true; rab.quizPaidDay=0;
  openQuiz(); closeQuiz(); openQuiz(); check('peeking at a quiz uses up the paid round', QZ.paid===false); closeQuiz();
  // Forage: close mid-shuffle and reopen; old timers must not touch the new game
  openForage(); await wait(1600); closeForage(); openForage();
  const reopened=now(); for(let k=0;k<80 && FG.busy;k++) await wait(50);
  const readyAfter=now()-reopened;
  // a fresh round 1 needs ~3.5s (reveal + hide + 4 swaps) before you may pick; a stale chain unlocks it early
  check('Forage: a reopened game isn’t unlocked early by the closed round’s timers', readyAfter>3.2, readyAfter.toFixed(2)+'s');
  for(let r=0;r<3;r++){ for(let k=0;k<80 && FG.busy;k++) await wait(100); $('fCup'+FG.treatCup).click(); await wait(1500); }
  check('Forage survives close/reopen mid-shuffle (no extra wins)', FG.won===3 && FG.round===3, `won ${FG.won} round ${FG.round}`);
  closeForage();
  openTtt(); tttPlay(0); closeTtt(); openTtt(); await wait(700);
  check('Tic-Tac-Toe: a pending move can’t land on a new board', TTT.board.every(c=>c===''), TTT.board.join(','));
  closeTtt();
  // small things
  rab.carrots=95; delete rab.achievements.rich; delete rab.achievements.bond5; unlockAch('bond5');
  check('achievement carrots count toward Carrot Tycoon', !!rab.achievements.rich);
  openDig(); await wait(50); check('controls behind a minigame are inert', $('controls').inert===true);
  closeDig(); await wait(50); check('…and usable again after closing', $('controls').inert===false);
  rab.prefs.toy='tower'; rab.prefKnown.toy=false; rab.items.ball=1; rab.items.tunnel=1; delete rab.items.tower;
  notesTab='about'; openPanel('notes');
  check('About hints can’t reveal the favourite by elimination', !/toy you don't have yet/.test($('panelBody').textContent)); closePanel();
  toast=realToast;
});

/* ------------------------------------------------------------------ soak (fuzz) */
// Random play for a while: the game must never throw, and no stat may go NaN or out of range.
group('soak', async ()=>{
  fresh();
  rab.carrots=500; rab.bondLevel=6;
  const acts=[giveHay, givePellets, giveWater, offerBanana, cleanLitter, restRabbit, playToy, doTrick, callVet,
    ()=>buy(pick(SHOP).id), ()=>{ pettingMode=true; const p=parts(); lastPetGain=-1; handlePet(p.head.x+rand(-60,60), p.head.y+rand(-60,90)); pettingMode=false; },
    ()=>{ groomMode=true; const p=parts(); lastGroomGain=-1; handleGroom(p.body.x+rand(-90,90), p.body.y+rand(-60,60)); groomMode=false; },
    ()=>{ openPanel(pick(['shop','goals','menu','notes','games'])); closePanel(); },
    ()=>{ if(Math.random()<0.15) nextDay(); },
    ()=>{ rab.health=rand(0,100); }, ()=>{ stats.hunger=rand(0,100); stats.hygiene=rand(0,100); },
  ];
  const bad=[];
  for(let i=0;i<500;i++){
    Object.keys(feedLock).forEach(k=>feedLock[k]=0);
    rab.maxAngerCount=0; rab.weightStrikes=0;   // random care can legitimately earn a game over; that isn't a bug
    try{ pick(acts)(); }catch(e){ bad.push(e.message); }
    if(!started){ bad.push('rabbit was taken away (game over) during soak'); break; }
    if(i%25===0) await wait(80);
    const badStat=Object.entries(stats).find(([k,v])=>!finite(v)||v<0||v>100);
    if(badStat){ bad.push('stat out of range: '+badStat.join('=')); break; }
    if(!finite(rab.weight)||!finite(rab.health)||!finite(rab.thumps)||!finite(rab.carrots)){ bad.push('rabbit value became non-finite'); break; }
  }
  check('500 random actions: no exceptions, no NaN, stats stay 0–100', bad.length===0, bad.slice(0,3).join(' | '));
  check('no runtime errors during the soak', __T.errors.length===0, __T.errors.slice(0,3).join(' ; '));
});

/* ------------------------------------------------------------------ runner hook */
window.addEventListener('load', ()=>setTimeout(async ()=>{
  const g=decodeURIComponent(location.hash.slice(1));
  if(g==='list'){ const pre=document.createElement('pre'); pre.id='thump-test-results'; pre.textContent=JSON.stringify({groups:Object.keys(__T.groups)}); document.body.appendChild(pre); return; }
  try{
    if(!__T.groups[g]) throw new Error('unknown test group: '+g);
    await __T.groups[g]();
  }catch(e){ __T.results.push({name:'group ran to the end', ok:false, detail:e.message+' '+String(e.stack||'').split('\n')[1]}); }
  await wait(200);
  if(__T.errors.length) __T.results.push({name:'no uncaught runtime errors', ok:false, detail:__T.errors.slice(0,5).join(' ; ')});
  const pre=document.createElement('pre'); pre.id='thump-test-results';
  pre.textContent=JSON.stringify({group:g, results:__T.results}); document.body.appendChild(pre);
}, 600));
