#!/usr/bin/env python3
"""Thumpagotchi test runner.

Usage:   python3 tests/run_tests.py            # run every group
         python3 tests/run_tests.py health hay # run just these groups

Copies index.html / game.js / style.css to a temp folder, splices tests/tests.js
into game.js's closure (the shipped files are never modified), then loads
index.html#<group> in headless Chrome once per group and reads the JSON results
the page writes into <pre id="thump-test-results">. Exits 1 if anything fails.

Needs Google Chrome (set CHROME=/path/to/chrome to override).
"""
import html, json, os, re, shutil, signal, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
PER_GROUP_TIMEOUT = 90          # real seconds before a group is declared hung
VIRTUAL_TIME_MS = 120000        # virtual time Chrome may fast-forward through per group


def build(tmp):
    for f in ('index.html', 'game.js', 'style.css'):
        shutil.copy(os.path.join(ROOT, f), tmp)
    game = open(os.path.join(tmp, 'game.js'), encoding='utf-8').read()
    tests = open(os.path.join(ROOT, 'tests', 'tests.js'), encoding='utf-8').read()
    end = game.rstrip().rfind('})();')          # the closure's final line
    if end < 0:
        sys.exit('Could not find the end of the game.js closure to splice tests into.')
    open(os.path.join(tmp, 'game.js'), 'w', encoding='utf-8').write(game[:end] + tests + '\n' + game[end:])


def load(tmp, fragment):
    """Load index.html#fragment headlessly; return the parsed results JSON (or an error string)."""
    profile = tempfile.mkdtemp(prefix='thump-chrome-')
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
           f'--user-data-dir={profile}', '--window-size=1100,760',
           f'--virtual-time-budget={VIRTUAL_TIME_MS}', f'--timeout={PER_GROUP_TIMEOUT*1000}',
           '--dump-dom', f'file://{tmp}/index.html#{fragment}']
    # Chrome often doesn't exit after --dump-dom, so write its output to a file, watch for the
    # end of the page, and kill Chrome (its whole process group) as soon as the page is out.
    dump = os.path.join(profile, 'dom.html')
    with open(dump, 'wb') as fh:
        proc = subprocess.Popen(cmd, stdout=fh, stderr=subprocess.DEVNULL, start_new_session=True)
    deadline = time.time() + PER_GROUP_TIMEOUT
    out = b''
    while time.time() < deadline:
        time.sleep(0.25)
        out = open(dump, 'rb').read()
        if b'</html>' in out or proc.poll() is not None:
            time.sleep(0.2); out = open(dump, 'rb').read()
            break
    try: os.killpg(proc.pid, signal.SIGKILL)
    except OSError: pass                # already gone (macOS may report EPERM for a finished group)
    proc.wait()
    shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r'<pre id="thump-test-results">(.*?)</pre>', out.decode('utf-8', 'replace'), re.S)
    if not m:
        return 'no results (page crashed, hung, or the group never finished)'
    return json.loads(html.unescape(m.group(1)))


def main():
    if not os.path.exists(CHROME):
        sys.exit(f'Chrome not found at {CHROME}. Set CHROME=/path/to/chrome.')
    tmp = tempfile.mkdtemp(prefix='thump-test-')
    try:
        build(tmp)
        listed = load(tmp, 'list')
        if isinstance(listed, str):
            sys.exit('Could not list test groups: ' + listed)
        groups = sys.argv[1:] or listed['groups']
        unknown = [g for g in groups if g not in listed['groups']]
        if unknown:
            sys.exit(f'Unknown group(s): {", ".join(unknown)}. Available: {", ".join(listed["groups"])}')
        passed = failed = 0
        started = time.time()
        for g in groups:
            res = load(tmp, g)
            if isinstance(res, str):
                print(f'\n[{g}]\n  FAIL  {res}'); failed += 1; continue
            print(f'\n[{g}]')
            for r in res['results']:
                if r['ok']:
                    passed += 1; print(f'  pass  {r["name"]}')
                else:
                    failed += 1; print(f'  FAIL  {r["name"]}' + (f'  —  {r["detail"]}' if r.get('detail') else ''))
        print(f'\n{passed} passed, {failed} failed  ({len(groups)} groups, {time.time()-started:.0f}s)')
        sys.exit(1 if failed else 0)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
