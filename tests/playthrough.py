"""
AI games site — browser tests (Playwright + Chromium).
  python3 tests/playthrough.py            needs: pip install playwright && playwright install chromium; node
Covers: master page + ticks, both arenas played through the REAL widgets (every stage), a simulated class of 6 on
a local copy of the scoreboard script (tests/mock-server.js runs apps-script/Code.gs), offline queue + retry,
first-run lock + practice mode, nickname clash, resume after reload, time-outs, phone width, blocked storage,
the board (tabs, teams, CSV), and the real .xlsx from the Agent Arena boss.
"""
import functools, http.server, json, os, re, socket, socketserver, subprocess, sys, tempfile, threading, time, zipfile, io
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("SHOTS")

def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

def serve_static():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]

PORT = serve_static()
MOCK = free_port()
mock = subprocess.Popen(["node", os.path.join(ROOT, "tests", "mock-server.js"), str(MOCK)], stdout=subprocess.PIPE)
mock.stdout.readline()
MOCK_URL = f"http://127.0.0.1:{MOCK}/exec"
BASE = f"http://127.0.0.1:{PORT}"

import urllib.request
def mock_get(**params):
    q = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    return json.loads(urllib.request.urlopen(f"{MOCK_URL}?{q}").read())
def mock_ctl(path, body=None):
    req = urllib.request.Request(f"http://127.0.0.1:{MOCK}{path}", data=json.dumps(body or {}).encode(), method="POST")
    return urllib.request.urlopen(req).read()
import urllib.parse

def config_js(url="", factor=1):
    return f'window.AIG_CONFIG = {{ SCOREBOARD_URL: "{url}", BOARD_REFRESH_SECONDS: 3, TIME_FACTOR: {factor} }};'

def new_page(browser, url="", factor=1, viewport=None, block_storage=False):
    ctx = browser.new_context(viewport=viewport or {"width": 1100, "height": 900}, accept_downloads=True)
    ctx.route("**/config.js", lambda route: route.fulfill(status=200, content_type="application/javascript", body=config_js(url, factor)))
    if block_storage:
        ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.errors = errors
    return page

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)

def sign_in(page, nick, team="", cls=""):
    page.fill("#nick", nick)
    if team: page.fill("#team", team)
    if page.locator("#classCode").count(): page.fill("#classCode", cls)
    page.click("text=Start my run")

def info(page):
    page.wait_for_function("window.ARENA_TEST && !document.querySelector('.result-card')")
    return page.evaluate("""() => { const it = ARENA_TEST.item; return { kind: it.kind, key: it.key,
        tiles: it.tiles ? it.tiles.map(t => [t.value, t.label]) : null, stage: ARENA_TEST.run.stage, item: ARENA_TEST.run.item,
        ref: it.ref || null, bossCmd: it.bossCmd || null, docs: it.docs ? it.docs.length : 0 }; }""")

def drive_ui(page, downloads):
    """Answer the current item correctly through the real widgets."""
    i = info(page)
    k, key = i["kind"], i["key"]
    box = page.locator(".item-box")
    if k == "mcq":
        box.locator(f".choice[data-value=\"{key}\"]").click()
    elif k == "number":
        box.locator("input").fill(str(key)); box.locator("button[type=submit]").click()
    elif k == "tiles":
        label = dict(i["tiles"])
        for w in key:
            box.locator(".tile", has_text=re.compile("^" + re.escape(label[w]) + "$")).first.click()
        box.get_by_role("button", name="Submit").click()
    elif k == "chat":
        box.locator(f".choice[data-value=\"{key['answer']}\"]").click()
        box.get_by_role("button", name=key["support"], exact=True).click()
        box.get_by_role("button", name="Submit").click()
    elif k == "desk":
        for cid in key: box.locator(f".pick[data-id=\"{cid}\"]").click()
        box.get_by_role("button", name="Hand the desk to the model").click()
    elif k == "search":
        box.locator("input").fill(key[0]); box.get_by_role("button", name="Search").click()
    elif k == "data":
        box.locator("input.mono").fill(i["ref"]); box.get_by_role("button", name="Run").click()
        box.locator(".card.soft").first.wait_for()
        box.locator("input[aria-label='your answer']").fill(key["answer"]); box.get_by_role("button", name="Submit answer").click()
    elif k == "docs":
        cards = box.locator(".doc")
        for n in range(i["docs"]):
            cards.nth(n).get_by_role("button", name="Planted order" if key[n] else "Fine", exact=True).click()
        box.get_by_role("button", name="Submit").click()
    elif k == "boss":
        for pid in key["order"]: box.locator(f".tile[data-id=\"{pid}\"]").click()
        rows = box.locator("section:has(h3:text-matches('^B\\\\.')) .row")
        for n, p in enumerate(key["perms"]):
            rows.nth(n).get_by_role("button", name=p, exact=True).click()
        box.locator("input.mono").fill(i["bossCmd"]); box.get_by_role("button", name="Run").click()
        box.get_by_text("That's the e-bike revenue").wait_for()
        box.locator(f".choice[data-value=\"{key['flagged']}\"]").click()
        with page.expect_download() as dl:
            box.locator("button.unlock-ok").click()
        path = dl.value.path(); downloads.append(open(path, "rb").read())
        box.get_by_role("button", name="Finish the job").click()
    else:
        raise AssertionError("unknown kind " + k)
    page.locator(".result-card").wait_for()

def answer_fast(page, mode="key", seed=0):
    info(page)
    if mode == "key": page.evaluate("ARENA_TEST.submit(ARENA_TEST.item.key)")
    else: page.evaluate(f"(() => {{ let a = {seed} || 1; const r = () => ((a = (a * 16807) % 2147483647) / 2147483647); ARENA_TEST.submit(ARENA_TEST.item.sample(r)); }})()")
    page.locator(".result-card").wait_for()

def next_btn(page):
    b = page.locator(".result-card button"); label = b.inner_text(); b.click(); return label

def play_run(page, driver, tag=None, ui_first_only=False, downloads=None):
    """Play all 6 stages. driver(page) answers one item."""
    for s in range(6):
        page.click("text=/Start stage/")
        n = 0
        while True:
            if tag and n == 0: shot(page, f"{tag}-s{s+1}")
            driver(page) if not (ui_first_only and n > 0) else answer_fast(page)
            n += 1
            label = next_btn(page)
            if "Next item" not in label: break
        if s < 5: page.click("text=/Next: stage/")
    page.click("text=See my results")
    page.locator(".big-points").wait_for()
    return int(page.inner_text(".big-points").split()[0])

def main():
    results = []
    with sync_playwright() as p:
        br = p.chromium.launch()

        # ---------- 1. master page ----------
        pg = new_page(br)
        pg.goto(BASE + "/index.html")
        assert pg.locator("#games .game").count() == 4
        hrefs = pg.eval_on_selector_all("#games .game", "els => els.map(e => e.getAttribute('href'))")
        assert hrefs == ["be-the-llm/index.html", "llm-arena/index.html", "be-the-agent/index.html", "agent-arena/index.html"], hrefs
        assert pg.locator(".done").count() == 0 and pg.locator(".go").count() == 1
        for h in hrefs + ["board.html"]:
            r = pg.request.get(BASE + "/" + h); assert r.ok, h
        shot(pg, "site-01-master")
        results.append("master page: 4 games in order + board link")

        # front-page sign-in is picked up by the arena ("Playing as ..."), and "Change" still works
        pg = new_page(br, MOCK_URL)
        pg.goto(BASE + "/index.html")
        pg.fill("#p-nick", "Front Kid"); pg.fill("#p-team", "Blue"); pg.fill("#p-class", "sec-9")
        pg.get_by_role("button", name="Save").click()
        pg.get_by_text("Playing as").wait_for()
        assert "class SEC-9" in pg.inner_text("#signin")
        pg.goto(f"{BASE}/llm-arena/index.html?test=1")
        pg.get_by_text("Playing as").wait_for()
        assert "Front Kid" in pg.inner_text("#app") and "class SEC-9" in pg.inner_text("#app")
        pg.get_by_role("button", name="Start my run").first.click()
        pg.get_by_text("Start stage 1").wait_for()
        pg.goto(f"{BASE}/agent-arena/index.html?test=1")
        pg.get_by_role("button", name="Change").click()
        assert pg.input_value("#nick") == "Front Kid" and pg.input_value("#classCode") == "SEC-9"
        pg.fill("#nick", "Front Kid2"); pg.get_by_role("button", name="Start my run").click()
        pg.get_by_text("Start stage 1").wait_for()
        pg.goto(BASE + "/index.html")
        assert "Front Kid2" in pg.inner_text("#signin"), "a change in the arena updates the front page"
        assert not pg.errors, pg.errors
        results.append("front-page sign-in: both arenas pick it up; Change works and syncs back")

        # ---------- 2. both arenas through the real widgets, offline mode (no scoreboard) ----------
        for game in ["llm-arena", "agent-arena"]:
            pg = new_page(br)
            pg.goto(f"{BASE}/{game}/index.html?test=1")
            assert pg.locator("#classCode").count() == 0, "no class code field without a scoreboard"
            sign_in(pg, "Uitest")
            dls = []
            pts = play_run(pg, lambda q: drive_ui(q, dls), tag=f"{game}-ui")
            assert pts > 0
            body = pg.inner_text("body")
            assert "Practice run" in body and "stays on this device" in body
            shot(pg, f"{game}-ui-final")
            if dls:
                wb = zipfile.ZipFile(io.BytesIO(dls[0]))
                sheet = wb.read("xl/worksheets/sheet1.xml").decode()
                for v in ["144", "60", "24", "SUM(B2:B4)", "<v>228</v>"]: assert v in sheet, v
                import openpyxl
                ws = openpyxl.load_workbook(io.BytesIO(dls[0])).active
                assert [ws.cell(r, 2).value for r in range(2, 5)] == [144, 60, 24], "xlsx holds the tool result, not the draft"
            pg.goto(BASE + "/index.html")
            tick = pg.locator(f".game[data-id='{game.replace('-arena','')}-arena'] .done")
            assert tick.count() == 1, "tick on the master page"
            assert not pg.errors, pg.errors
            results.append(f"{game}: every stage answered through the real widgets, all right ({pts} pts)" + (", xlsx verified with openpyxl" if dls else ""))

        # ---------- 3. a simulated class of 6 on the mock scoreboard ----------
        mock_ctl("/__reset")
        players = [("Ann", "Red", "key"), ("Bob", "red", "rand"), ("Cat", "", "key"), ("Dan", "Blue", "rand"), ("Eve", "Blue", "rand"), ("Fay", "", "rand")]
        totals = {}
        for i, (nick, team, mode) in enumerate(players):
            pg = new_page(br, MOCK_URL)
            pg.goto(f"{BASE}/llm-arena/index.html?test=1")
            sign_in(pg, nick, team, "sec-1")
            if nick == "Dan":  # goes offline after stage 2, comes back at the end
                for s in range(6):
                    if s == 2: mock_ctl("/__offline", {"on": True})
                    pg.click("text=/Start stage/")
                    while True:
                        answer_fast(pg, mode, seed=i * 100 + s)
                        if "Next item" not in next_btn(pg): break
                    if s < 5: pg.click("text=/Next: stage/")
                pg.click("text=See my results")
                assert "Waiting to send" in pg.inner_text("body"), "queue shown while offline"
                mock_ctl("/__offline", {"on": False})
                pg.wait_for_function("document.body.innerText.includes('Scoreboard up to date')", timeout=30000)
                totals[nick] = int(pg.inner_text(".big-points").split()[0])
            else:
                totals[nick] = play_run(pg, (lambda q, m=mode, s=i: answer_fast(q, m, seed=s * 7 + 1)))
                pg.wait_for_function("document.body.innerText.includes('Scoreboard up to date')", timeout=20000)
            if nick == "Eve":  # practice run afterwards must not be sent
                pg.click("text=Practice run (not scored)")
                play_run(pg, lambda q: answer_fast(q, "key"))
                assert "practice run (not on the scoreboard)" in pg.inner_text("body").lower()
            assert not pg.errors, pg.errors
        # nickname clash from another device
        pg = new_page(br, MOCK_URL)
        pg.goto(f"{BASE}/llm-arena/index.html?test=1")
        sign_in(pg, "ann", "", "SEC-1")
        pg.get_by_text("is already taken in").wait_for()
        # two students choosing the same nickname at the same moment: the second is refused at once
        pa = new_page(br, MOCK_URL); pa.goto(f"{BASE}/llm-arena/index.html?test=1")
        pb = new_page(br, MOCK_URL); pb.goto(f"{BASE}/llm-arena/index.html?test=1")
        sign_in(pa, "Twin", "", "SEC-1"); pa.get_by_text("Start stage 1").wait_for()
        sign_in(pb, "twin", "", "SEC-1"); pb.get_by_text("is already taken in").wait_for()
        results.append("a nickname already used in the class is refused, even before any stage is finished")

        b = mock_get(action="board", game="llm", classCode="SEC-1")
        board = {r["nickname"]: r for r in b["players"] if r["nickname"] != "Twin"}
        assert set(board) == {n for n, _, _ in players}, board.keys()
        for n, _, _ in players:
            assert board[n]["points"] == totals[n], (n, board[n]["points"], totals[n])
            assert board[n]["done"] == 6
        order = [r["nickname"] for r in b["players"] if r["nickname"] != "Twin"]
        assert order == sorted(order, key=lambda n: (-totals[n], -board[n]["correct"], board[n]["seconds"])), order
        teams = {t["team"].lower(): t for t in b["teams"]}
        half_up = lambda x: int(x + 0.5)  # like JavaScript Math.round, not Python round()
        assert teams["red"]["members"] == 2 and teams["red"]["average"] == half_up((totals["Ann"] + totals["Bob"]) / 2)
        assert teams["blue"]["average"] == half_up((totals["Dan"] + totals["Eve"]) / 2)
        rows = mock_get(action="rows", classCode="SEC-1")["rows"]
        rows = [r for r in rows if r[4] != "Twin"]
        assert len(rows) == 42, len(rows)  # 6 players x (1 "joined" row + 6 stages); Eve's practice run not sent
        results.append(f"class of 6: board totals = players' own totals, ranking + team averages right, 42 CSV rows (joins + stages), offline player caught up; scores {sorted(totals.values())}")

        # Agent Arena: stage 3 alone can pass 2,000 points; the board must show exactly what the devices show
        agent_totals = {}
        for nick in ["Ace", "Bea"]:
            pg = new_page(br, MOCK_URL)
            pg.goto(f"{BASE}/agent-arena/index.html?test=1")
            sign_in(pg, nick, "", "sec-1")
            agent_totals[nick] = play_run(pg, lambda q: answer_fast(q, "key"))
            pg.wait_for_function("document.body.innerText.includes('Scoreboard up to date')", timeout=20000)
        ab = {r["nickname"]: r["points"] for r in mock_get(action="board", game="agent", classCode="SEC-1")["players"]}
        assert ab == agent_totals, (ab, agent_totals)
        results.append(f"Agent Arena board totals equal the devices' totals {agent_totals}")

        # the board page itself
        pg = new_page(br, MOCK_URL)
        pg.goto(f"{BASE}/board.html?class=sec-1&game=llm")
        pg.locator("table.board").first.wait_for()
        first = pg.locator("table.board tbody tr").first.inner_text()
        assert order[0] in first, first
        assert pg.get_by_text("Teams").count() >= 1
        shot(pg, "site-02-board")
        pg.get_by_role("tab", name="Agent Arena").click()
        pg.get_by_text("Agent Arena · SEC-1 · 2 players").wait_for()
        with pg.expect_download() as dl:
            pg.get_by_role("button", name="Download results (CSV)").click()
        csv = open(dl.value.path(), encoding="utf-8-sig").read().splitlines()
        assert csv[0].startswith("time,classCode,game,runId,nickname") and len(csv) == 58, len(csv)  # header + 42 + Twin's join + Ace/Bea (2 x 7)
        assert not pg.errors, pg.errors
        results.append("board page: live ranking, teams, tabs, CSV download (58 lines)")

        # ---------- 3b. carry-on codes (learning games), reset everything, arena resume on another computer ----------
        pg = new_page(br)
        pg.goto(BASE + "/be-the-llm/index.html")
        assert pg.locator(".level-card[disabled]").count() == 6
        pg.fill("#carryCode", "llm3 9rqj"); pg.get_by_role("button", name="Use code").click()
        pg.wait_for_timeout(200)
        assert pg.locator(".level-card[disabled]").count() == 3, "code for Level 3 unlocks Level 4"
        assert pg.locator('[data-level="L4"]').is_enabled() and not pg.locator('[data-level="L5"]').is_enabled()
        pg.fill("#carryCode", "AGT2-28M4"); pg.get_by_role("button", name="Use code").click()
        pg.get_by_text("That code is for the other game").wait_for()
        pg.fill("#carryCode", "nope"); pg.get_by_role("button", name="Use code").click()
        pg.get_by_text("doesn't match").wait_for()
        pg.fill("#carryCode", "open-all-levels"); pg.get_by_role("button", name="Use code").click()
        pg.wait_for_timeout(200)
        assert pg.locator(".level-card[disabled]").count() == 0, "teacher code unlocks everything"
        pg.goto(BASE + "/be-the-agent/index.html")
        pg.fill("#carryCode", "AGT6-QTV5"); pg.get_by_role("button", name="Use code").click()
        pg.wait_for_timeout(200)
        assert pg.get_by_role("button", name="See my results").is_enabled(), "last level's code finishes the game"
        pg.goto(BASE + "/index.html")
        assert pg.locator(".game[data-id='agent'] .done").count() == 1, "tick on the front page"
        pg.on("dialog", lambda d: d.accept())
        pg.get_by_role("button", name="Reset everything on this device").click()
        pg.wait_for_load_state()
        pg.wait_for_timeout(300)
        left = pg.evaluate("Object.keys(localStorage).filter(k => /be-the|aig-|ai-games/.test(k))")
        assert left == [], left
        assert pg.locator(".done").count() == 0
        assert not pg.errors, pg.errors
        results.append("carry-on codes: level code, wrong-game code, bad code, teacher code; front-page reset clears everything")

        mock_ctl("/__reset")
        pa = new_page(br, MOCK_URL)
        pa.goto(f"{BASE}/agent-arena/index.html?test=1")
        sign_in(pa, "Mover", "Green", "sec-7")
        for s_ in range(2):
            pa.click("text=/Start stage/")
            while True:
                answer_fast(pa, "key")
                if "Next item" not in next_btn(pa): break
            if s_ == 0: pa.click("text=/Next: stage/")
        pa.get_by_text("Stage 2 complete").wait_for()
        pa.wait_for_function("document.body.innerText.includes('Scoreboard up to date')", timeout=20000)
        code = re.search(r"resume code is ([A-Z0-9]{4}-[A-Z0-9]{4})", pa.inner_text("body")).group(1)
        pts_a = int(re.search(r"Total so far: (\d+) points", pa.inner_text("body")).group(1))
        pb = new_page(br, MOCK_URL)
        pb.goto(f"{BASE}/agent-arena/index.html?test=1")
        pb.get_by_text("Continue on another computer").click()
        pb.fill("#rNick", "mover"); pb.fill("#rClass", "SEC-7"); pb.fill("#rCode", code.lower().replace("-", " "))
        pb.get_by_role("button", name="Continue my run").click()
        pb.get_by_text("Stage 3 of 6").wait_for()
        pb.click("text=/Start stage/")
        answer_fast(pb, "key")
        assert f"{pts_a + 0}" in pb.inner_text(".hud") or True
        hud_pts = int(re.search(r"(\d+) pts", pb.inner_text(".hud")).group(1))
        assert hud_pts == pts_a, (hud_pts, pts_a)
        while "Next item" in next_btn(pb):
            answer_fast(pb, "key")
        pb.wait_for_function("document.body.innerText.includes('Scoreboard up to date')", timeout=20000)
        brd = mock_get(action="board", game="agent", classCode="SEC-7")["players"]
        assert len(brd) == 1 and brd[0]["done"] == 3 and brd[0]["team"] == "Green", brd
        # wrong code is refused
        pc = new_page(br, MOCK_URL)
        pc.goto(f"{BASE}/agent-arena/index.html?test=1")
        pc.get_by_text("Continue on another computer").click()
        pc.fill("#rNick", "Mover"); pc.fill("#rClass", "SEC-7"); pc.fill("#rCode", "AAAA-BBBB")
        pc.get_by_role("button", name="Continue my run").click()
        pc.get_by_text("No run found").wait_for()
        assert not pa.errors and not pb.errors and not pc.errors
        results.append(f"arena resume code: stages 1-2 on one computer, stage 3 on another ({code}); points carried over, one player on the board")

        # ---------- 4. resume after reload + time-outs ----------
        pg = new_page(br, "", factor=0.03)  # ~1-3 s per item
        pg.goto(f"{BASE}/agent-arena/index.html?test=1")
        sign_in(pg, "Slow")
        pg.click("text=/Start stage/")
        answer_fast(pg); next_btn(pg)
        pg.reload()
        pg.get_by_text("item 2").wait_for()
        pg.click("text=Continue")
        pg.locator(".result-card").wait_for(timeout=10000)  # nobody answers: the timer runs out
        assert "Time's up" in pg.inner_text(".result-card h2")
        assert "+0 points" in pg.inner_text(".result-card")
        # the timer keeps running across a reload, and a hint stays used
        pg = new_page(br, "")
        pg.goto(f"{BASE}/llm-arena/index.html?test=1")
        sign_in(pg, "Tricky")
        pg.click("text=/Start stage/")
        info(pg)
        pg.get_by_role("button", name=re.compile("^Hint")).click()
        time.sleep(3)
        pg.reload(); pg.click("text=Continue")
        info(pg)
        left = int(pg.inner_text(".hud + .row b").rstrip("s"))
        assert left <= 43, f"timer restarted after reload ({left}s left)"
        assert pg.get_by_role("button", name=re.compile("^Hint")).count() == 0 and pg.get_by_text("Hint:").count() == 1, "hint still used"
        answer_fast(pg)
        assert "÷ 2 hint" in pg.inner_text(".result-card")
        results.append("reload resumes at the same item; the timer keeps running and a used hint stays used; time-out scores 0")

        # ---------- 5. phone width + blocked storage ----------
        pg = new_page(br, "", viewport={"width": 360, "height": 740}, block_storage=True)
        pg.goto(f"{BASE}/llm-arena/index.html?test=1")
        sign_in(pg, "Phone")
        pts = play_run(pg, lambda q: drive_ui(q, []), ui_first_only=True, tag="llm-phone")
        sw = pg.evaluate("document.documentElement.scrollWidth")
        assert sw <= 360, f"no sideways scroll on a phone ({sw})"
        assert not pg.errors, pg.errors
        pg2 = new_page(br, "", viewport={"width": 360, "height": 740})
        pg2.goto(f"{BASE}/agent-arena/index.html?test=1")
        sign_in(pg2, "Phone")
        play_run(pg2, lambda q: drive_ui(q, []), tag="agent-phone")
        assert pg2.evaluate("document.documentElement.scrollWidth") <= 360
        results.append("phone width (360 px) without sideways scroll; works with storage blocked")
        br.close()
    for r in results: print("  " + r)
    print("All site play-through checks passed")

try:
    main()
finally:
    mock.terminate()
