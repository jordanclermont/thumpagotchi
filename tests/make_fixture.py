#!/usr/bin/env python3
"""Make an old-save fixture for the 'migrate' test group.

Usage:   python3 tests/make_fixture.py <commit> <name>
         e.g. python3 tests/make_fixture.py cb5a088 2026-09-25-close-up-live

Runs the game as it was at <commit> in headless Chrome, plays a lived-in rabbit (day 6, 73 carrots,
bond 3, 2 Gut Medicine, a Treat Ball), saves, and writes what that version stored to
tests/fixtures/save-<name>.json. Do this with the last commit before every SAVE_VERSION bump.
"""
import json, os, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as R

GEN = r"""
window.addEventListener('load',()=>setTimeout(()=>{
  const errs=[]; const T=(n,f)=>{ try{ f(); }catch(e){ errs.push(n+': '+e.message); } };
  T('clear',()=>localStorage.clear());
  T('start',()=>startGame(false));
  T('hide',()=>{ rab.hidden=false; }); T('hay',()=>giveHay()); T('water',()=>giveWater());
  T('age',()=>{ rab.day=6; rab.ageDays=5; rab.carrots=73; rab.bondLevel=3; rab.bondXP=20; rab.lifetimePets=42; });
  T('items',()=>{ rab.items.medicine=2; rab.items.ball=1; });
  T('notes',()=>{ learnNote('thump',true); learnNote('binky',true); });
  T('save',()=>save());
  const g=k=>{ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };
  const pre=document.createElement('pre'); pre.id='thump-test-results';
  pre.textContent=JSON.stringify({save:g('thumpagotchi.save.v2'), notes:g('thumpagotchi.notes'), unlocks:g('thumpagotchi.unlocks'), errs});
  document.body.appendChild(pre);
},900));
"""


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    commit, name = sys.argv[1:]
    tmp = tempfile.mkdtemp(prefix='thump-fx-')
    for f in ('index.html', 'style.css', 'game.js'):
        open(os.path.join(tmp, f), 'wb').write(subprocess.check_output(['git', 'show', f'{commit}:{f}'], cwd=R.ROOT))
    game = open(os.path.join(tmp, 'game.js'), encoding='utf-8').read()
    end = game.rstrip().rfind('})();')
    open(os.path.join(tmp, 'game.js'), 'w', encoding='utf-8').write(game[:end] + GEN + game[end:])
    out = R.load(tmp, 'fixture')
    if isinstance(out, str) or not out.get('save'):
        sys.exit(f'No save came out of {commit}: {out}')
    errs = out.pop('errs')
    out['from_commit'] = commit
    path = os.path.join(R.ROOT, 'tests', 'fixtures', f'save-{name}.json')
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'wrote {path}' + (f'  (setup steps that did not exist in that version: {errs})' if errs else ''))


if __name__ == '__main__':
    main()
