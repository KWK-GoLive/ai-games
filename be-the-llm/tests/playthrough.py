"""
Headless play-through of all seven levels (Playwright, Python).
Run from the project folder:  python3 tests/playthrough.py
Serves the folder on a local port, plays every level at phone and desktop width,
tests class mode and teacher mode, and fails on any console error.
"""
import http.server, socketserver, threading, os, sys, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("SHOTS", "")
PORT = 0  # set by serve()

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)  # any free port
    global PORT
    PORT = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def shot(page, name):
    if SHOTS:
        page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)

def start(page):
    page.get_by_role("button", name="Got it, let's play").click()

def next_level(page, n):
    page.get_by_role("button", name=f"Next: Level {n}").click()

def play_rounds(page, class_mode=False):
    while True:
        page.locator(".choice:not([disabled])").first.click()
        if class_mode:
            page.get_by_role("button", name="Reveal the answer").click()
        btn = page.locator("button:visible", has_text="Next round")
        if btn.count():
            btn.first.click()
            continue
        page.get_by_role("button", name="See results").click()
        break

def play_all(page, tag):
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    assert page.locator(".level-card").count() == 7, "7 level cards"
    assert page.locator(".level-card[disabled]").count() == 6, "6 locked at start"
    body = page.inner_text("body")
    for banned in ["Slide", "Week 1", "AI for Data Work", "Predict first", "Exit ticket"]:
        assert banned not in body, f"'{banned}' shown on home screen"
    shot(page, f"{tag}-00-home")

    # L1
    page.locator('[data-level="L1"]').click()
    assert page.get_by_text("How it works").count() == 1
    shot(page, f"{tag}-01-intro")
    start(page)
    assert "See you at the" in page.inner_text(".sentence"), "L1 opens with the phone-keyboard example"
    shot(page, f"{tag}-02-L1-round")
    play_rounds(page)
    page.get_by_text("Level 1 complete").wait_for()
    assert page.get_by_text("What you just saw").count() == 1
    shot(page, f"{tag}-03-L1-done")
    next_level(page, 2)

    # L2
    start(page)
    counts = {"airport": "2", "station": "1", "office": "0", "party": "0"}  # office wrong on purpose
    for w, v in counts.items():
        page.get_by_label(f"count for {w}").fill(v)
    page.get_by_role("button", name="Check my counts").click()
    assert page.locator(".tally-input.no").count() == 1, "wrong count flagged"
    page.get_by_label("count for office").fill("1")
    page.get_by_role("button", name="Check my counts").click()
    page.get_by_text("Correct. That's all training").wait_for()
    page.locator(".card:has-text('Step 2 of 3') .opt").first.click()
    page.get_by_role("button", name="Train on the other").click()
    page.get_by_text("Done. Training finished.").wait_for(timeout=20000)
    page.get_by_label("word to explore").select_option("my")
    shot(page, f"{tag}-04-L2-trained")
    page.locator(".card:has-text('Explore the trained model') .opt").first.click()
    page.get_by_text("Level 2 complete").wait_for()
    assert page.locator('.stars').count() == 0, 'no stars on the result card'
    next_level(page, 3)

    # L3
    start(page)
    shot(page, f"{tag}-05-L3-round")
    play_rounds(page)
    for _ in range(15):
        fin = page.get_by_role("button", name="Finish level")
        if fin.count():
            break
        page.locator(".choice").first.click()
    shot(page, f"{tag}-06-L3-built")
    page.get_by_role("button", name="Finish level").click()
    page.get_by_text("Level 3 complete").wait_for()
    next_level(page, 4)

    # L4 answer a question
    start(page)
    page.locator(".qbtn").first.click()
    page.get_by_text("It stopped.").or_(page.get_by_text("It didn't answer.")).wait_for()
    shot(page, f"{tag}-07-L4-before")
    page.get_by_role("button", name="Teach it to answer").click()
    page.get_by_role("button", name="Train on the ordinary sentences").click()
    page.get_by_role("button", name="Guess the next word").click()
    shot(page, f"{tag}-08-L4-step")
    page.get_by_role("button", name="Write the rest").click()
    assert page.locator(".chat .bubble.a").last.inner_text().strip().endswith("."), "answer written"
    page.locator(".opt", has_text="Continuing the text").click()
    page.get_by_label("your own question").fill("what time does the zoo open")
    page.get_by_role("button", name="Ask", exact=True).click()
    page.get_by_text("never seen these words").wait_for()
    shot(page, f"{tag}-09-L4-after")
    page.get_by_role("button", name="Finish level").click()
    page.get_by_text("Level 4 complete").wait_for()
    next_level(page, 5)

    # L5 temperature
    start(page)
    slider = page.get_by_label("temperature")
    def set_t(v):
        slider.evaluate("(el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }", v)
    set_t("0")
    page.get_by_role("button", name="Roll the dice once").click()
    page.get_by_role("button", name="Ask 5 times").click()
    assert page.get_by_text("1 different answer").count() == 1, "T=0 gives identical answers"
    set_t("1.6")
    page.get_by_role("button", name="Ask 5 times").click()
    shot(page, f"{tag}-10-L5")
    page.locator(".card:has-text('Step 3') .opt").first.click()
    page.locator(".card:has-text('Step 3') .opt:not([disabled])").first.click()
    page.get_by_role("button", name="Finish level").click()
    page.get_by_text("Level 5 complete").wait_for()
    next_level(page, 6)

    # L6 narrow window
    start(page)
    saw_no_data = False
    for r in range(10):
        for stage in range(3):
            page.locator(".choice:not([disabled])").first.click()
            if page.get_by_text("No data at all.").count():
                saw_no_data = True
            if stage < 2:
                page.get_by_role("button", name="Show one more word").click()
        if r == 0:
            shot(page, f"{tag}-11-L6")
        nb = page.get_by_role("button", name="Next round")
        if nb.count():
            nb.click()
        else:
            page.get_by_role("button", name="Finish level").click()
            break
    assert saw_no_data, "L6 always includes the 'never seen' round"
    page.get_by_text("Level 6 complete").wait_for()
    next_level(page, 7)

    # L7 fact-check
    start(page)
    rows = page.locator(".mark-row")
    assert rows.count() == 6, f"6 questions, got {rows.count()}"
    for i in range(rows.count()):
        rows.nth(i).get_by_role("button", name="Made up").click()
    page.get_by_role("button", name="Check my answers").click()
    srcs = page.get_by_role("button", name="Check the source")
    for i in range(srcs.count()):
        srcs.nth(i).click()
    assert page.get_by_text("Found in the training text").count() >= 1
    assert page.get_by_text("No training text says this.").count() >= 1
    shot(page, f"{tag}-12-L7")
    page.get_by_label("your own question").fill("where does my mother live")
    page.get_by_role("button", name="Ask", exact=True).click()
    page.get_by_text("Not backed: no example chat asks about exactly this").wait_for()
    page.get_by_role("button", name="Finish level").click()
    page.get_by_text("Level 7 complete").wait_for()
    shot(page, f"{tag}-13-L7-done")
    page.get_by_role("button", name="See my results").click()

    # Summary
    page.get_by_text("What this toy model gets wrong").wait_for()
    body = page.inner_text("body")
    for banned in ["Slide", "Week 1", "Exit ticket", "work-log"]:
        assert banned not in body, f"'{banned}' shown on results screen"
    assert page.get_by_text("Class leaderboard").count() == 0
    txt = page.inner_text("body").lower()
    for banned in [" pts", " stars", "points", "leaderboard"]:
        assert banned not in txt, f"score word '{banned}' on results screen"
    assert page.locator("a[href='../index.html']").count() >= 1, "link back to all games"
    assert "llm" in (page.evaluate("localStorage.getItem('ai-games-done')") or ""), "master-page tick recorded"
    shot(page, f"{tag}-14-summary")

    # Reload: progress kept, all unlocked
    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    assert page.locator(".level-card[disabled]").count() == 0, "all unlocked after finishing"
    sw = page.evaluate("document.documentElement.scrollWidth")
    cw = page.evaluate("document.documentElement.clientWidth")
    assert sw <= cw + 1, f"horizontal overflow {sw} > {cw}"
    return errors

def main():
    httpd = serve()
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for tag, vp in [("phone", {"width": 375, "height": 800}), ("desktop", {"width": 1280, "height": 900})]:
            ctx = browser.new_context(viewport=vp)
            page = ctx.new_page()
            try:
                errs = play_all(page, tag)
                if errs:
                    failures.append(f"{tag}: console errors: {errs}")
                print(f"{tag}: full play-through OK")
            except Exception as e:
                failures.append(f"{tag}: {e}")
                page.screenshot(path=f"/tmp/fail-{tag}.png", full_page=True)
            ctx.close()

        # Class mode + teacher mode + dark mode
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(f"http://127.0.0.1:{PORT}/index.html?mode=class&teacher=1")
        try:
            assert page.locator(".level-card[disabled]").count() == 0, "teacher unlocks all"
            assert page.get_by_text("Class mode").count() >= 1
            shot(page, "class-00-home-dark")
            page.locator('[data-level="L1"]').click()
            start(page)
            page.locator(".choice").first.click()
            assert page.locator(".choice.correct").count() == 0, "class mode waits for reveal"
            shot(page, "class-01-vote")
            page.get_by_role("button", name="Reveal the answer").click()
            assert page.locator(".choice.correct").count() == 1
            fs = page.evaluate("getComputedStyle(document.documentElement).fontSize")
            assert fs == "22px", f"class mode font size {fs}"
            page.locator('[data-level="L1"]')  # noop
            print("class/teacher mode OK")
        except Exception as e:
            failures.append(f"class mode: {e}")
        if errs:
            failures.append(f"class mode errors: {errs}")
        ctx.close()

        # Teacher jumps straight into L3 and L6; double-clicking Finish adds one result only
        ctx = browser.new_context(viewport={"width": 375, "height": 800})
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(f"http://127.0.0.1:{PORT}/index.html?mode=class&teacher=1")
        try:
            sw = page.evaluate("document.documentElement.scrollWidth")
            assert sw <= 376, f"class+teacher at 375px overflows: {sw}"
            page.locator('[data-level="L7"]').click()
            start(page)
            rows = page.locator(".mark-row")
            for i in range(rows.count()):
                rows.nth(i).get_by_role("button", name="Supported").click()
            page.get_by_role("button", name="Check my answers").click()
            page.get_by_role("button", name="Finish level").dblclick()
            page.wait_for_timeout(300)
            n = page.get_by_text("Level 7 complete").count()
            assert n == 1, f"double-click gave {n} result blocks"
            page.get_by_role("button", name="Level map", exact=True).click()
            page.locator('[data-level="L3"]').click()
            start(page)
            play_rounds(page, class_mode=True)
            print("teacher jump + double-click guard OK")
        except Exception as e:
            failures.append(f"teacher jump: {e}")
            page.screenshot(path="/tmp/fail-teacher.png", full_page=True)
        if errs:
            failures.append(f"teacher jump errors: {errs}")
        ctx.close()

        # Blocked storage: game must still run
        ctx = browser.new_context()
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });")
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        if page.locator(".level-card").count() != 7 or errs:
            failures.append(f"blocked storage: {errs}")
        else:
            print("blocked localStorage OK")
        ctx.close()
        browser.close()
    httpd.shutdown()
    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        sys.exit(1)
    print("All play-through checks passed")

if __name__ == "__main__":
    main()
