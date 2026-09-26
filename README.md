# AI games

Six browser games that teach beginners how chatbots and AI agents work. One site and one link, with a front page that lists the games in order, in two parts:

| # | Game | Kind | Time | Folder |
|---|---|---|---|---|
| 1 | **Guess the Chatbot** | warm-up, no score, real recorded chatbot replies | about 5 min | `pregame-llm/` |
| 2 | **Be the LLM** | learning game, 7 levels | 25–30 min | `be-the-llm/` |
| 3 | **LLM Arena** | timed challenge, 6 stages, class scoreboard | about 20 min | `llm-arena/` |
| 4 | **Watch a Real Agent** | warm-up, no score, replay of a real agent run | about 6 min | `pregame-agent/` |
| 5 | **Be the Agent** | learning game, 6 levels | 25–30 min | `be-the-agent/` |
| 6 | **Agent Arena** | timed challenge, 6 stages, class scoreboard, no typing | about 20 min | `agent-arena/` |

- `index.html` is the front page. A ✓ appears next to each game a student has finished on that device.
- `board.html` is the teacher's scoreboard: two tabs (one per arena), live ranking, team averages and a CSV download.

Times are estimates, not yet measured with students.

Everything runs in the browser, with no build step and no libraries. The warm-ups and learning games have no scores. The arenas score every answer, and they are the only part that talks to the internet (to the class scoreboard, if you set one up).

## Phones and iPads

- No typing in Agent Arena (after sign-in) or in the two warm-ups. Typing is still used for the one-time sign-in (nickname, team, class code), the carry-on and resume codes, the number boxes in LLM Arena stage 1 and Be the LLM Level 2, and Be the LLM's optional "ask your own question" box.
- Agent Arena: search by tapping word cards; ask the data questions with a tap-to-build question ("Add up total for each branch, only where bike is ebike"), and answer by tapping the number or name in your result. The command the agent would send is shown underneath in small grey text.
- Every file the games make (Be the Agent Level 4, the Agent Arena boss, the agent warm-up) has **👁 View here** and **⬇ Download**. "View here" shows the Excel sheets (with tabs) or the Word page on screen.
- Long explanations are shown as picture cards, flows and small diagrams; longer paragraphs keep their first sentence visible and the rest behind a **＋ More** fold. No teaching text was removed (see `tests/check-text-coverage.py`).

## The two warm-ups: where the "real" content comes from

- **Guess the Chatbot** shows 25 real replies (5 prompts × 5 runs) recorded on 26 Sep 2026 (UTC) from the Claude model `claude-sonnet-5`. Each run was a fresh session in an AI agent tool, told to reply as in a normal chat and not to use tools. The raw record is `pregames/data/raw/llm-runs.json`; replies are shown exactly as written. We did not re-run to get "better" answers: in all 5 runs about the invented "Zentrovia Cup" the model said it had no record, and the game says so. No next-word probabilities are shown, because we could not reach an open model to record them.
- **Watch a Real Agent** replays one real run (same model, same date): a Claude agent was given `sales.csv` (made up by us, with one row left incomplete on purpose) and the owner's request. The steps are shortened excerpts of the transcript (`pregames/data/raw/agent-run.json`; "…" marks a cut), and the Excel and Word files are the real outputs. The "check its work" round uses two real slips in its memo: it says the July 5 row is missing its price (the price is there) and it talks about margin (the file has no costs).
- `node tests/check-pregames.js` checks every reply and excerpt against the raw records, and recomputes the numbers the game states.

## Publish on GitHub Pages

1. Create a public repository named `ai-games` and upload everything in this folder, keeping the folders.
2. Go to **Settings → Pages → Deploy from a branch**, then choose `main` and `/ (root)`, and save.
3. After a minute or two the site is at `https://<your-username>.github.io/ai-games/`.

You can also double-click `index.html` to play offline. The arenas then keep scores on the device.

## Scoreboard (Google Sheet)

1. Create a Google Sheet, for example "AI games scoreboard".
2. Open **Extensions → Apps Script**. Replace the sample code with all of `apps-script/Code.gs`, then save.
3. Optional: run the function `testSetup` once and approve the permissions. An `arena` tab appears with one `TEST` row, which you can delete.
4. Choose **Deploy → New deployment → Web app**, with *Execute as*: **Me** and *Who has access*: **Anyone**. Then **Deploy**.
   - Google will warn that the app isn't verified. It's your own script, so choose *Advanced → Go to … (unsafe)* and then *Allow*.
5. Copy the web-app URL (it ends in `/exec`) into `config.js` → `SCOREBOARD_URL`, then upload `config.js` again.

**What is stored:** one "joined" row (stage 0) when a student signs in, which reserves their nickname in that class, then one row per finished stage, with these columns:
- time, class code, game, run id, nickname, team, stage, stage name;
- items, fully right, points, seconds, hints.

No names, emails or student IDs are stored.

**After editing `Code.gs`:** changes go live only with **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The URL stays the same.

**Organisation accounts:** some Google Workspace admins don't allow sharing with **Anyone**. If that option is missing, use a personal Google account.

## Running a class

- Give each class a **class code**, for example `AI-SEC1`.
- Project `board.html?class=AI-SEC1` (add `&projector=1` for big text). It refreshes every few seconds.
- Students open the site on their own devices and sign in once on the front page ("Who's playing?"): a nickname, an optional team name (teammates type the same one) and the class code. Both arenas pick it up and show "Playing as …", with a **Change** button.
- **Only the first complete run counts.** Later runs are practice runs and are not sent. The scoreboard also keeps only the first run for each nickname. If a nickname is already used in that class, the game asks for another one.
- A team's score is the average of its members, so team size doesn't matter.
- **Download results (CSV)** on the board gives one row per student per stage (plus the "joined" rows), for both arenas. The `counted` column marks first runs.
- Reloading the page carries on with the same item, and its timer keeps running.
- **Switching computers (arenas):** every stage screen shows a resume code (e.g. `K7Q2-XPMA`). On the other computer, the student opens the arena, chooses **Continue on another computer**, and types the same nickname, class code and that code. Finished stages keep their points (read back from the scoreboard, so they can't be inflated); a stage left half-way starts again with new questions.
- **Speed:** the Sheet saves about one result per second. If a whole class finishes a stage at the same moment, some results take up to half a minute to appear, and any that time out are re-sent automatically. (Tested live with 30 results sent at once: all arrived.)
- **No connection?** Stage results wait on the device and are sent automatically when the connection returns.
- **Limitation:** scores are computed in the browser, so a determined student could fake one, or start again under a new nickname. Treat the board as motivation, not as assessment evidence.

`config.js` also has:
- `BOARD_REFRESH_SECONDS`: raise it for very large classes. Google limits how often a script can be called; this game was not load-tested with a real class.
- `TIME_FACTOR`: for example, 1.5 gives everyone 50% more time.

## Carry-on codes and reset (learning games and whole site)

- **Level codes:** finishing a level in Be the LLM or Be the Agent shows a code (e.g. `LLM3-9RQJ`). Typing it in the **Carrying on from another computer?** box on that game's level map marks that level and all earlier ones done. The list is in `shared/codes.js`.
- **Teacher code:** `OPEN-ALL-LEVELS` unlocks every level of both learning games (change it in `shared/codes.js`). The link option `?teacher=1` does the same without a code.
- These codes are public in the repository. That's fine because the learning games have no scores; the arenas use the per-run resume code checked by the scoreboard.
- **Reset everything on this device** (front-page footer) clears all six games, the ticks and the saved nickname. It warns if arena results are still waiting to be sent. Each game also has its own reset link.

## Scoring (both arenas)

| Rule | Detail |
|---|---|
| Base | 100 points × how right the answer was (some items give part marks) |
| Speed | up to +50, shrinking as the item's timer runs down |
| Streak | ×1.5 from the 3rd fully right answer in a row |
| Hint | halves that item's points |
| Time-out | whatever was entered is marked; no speed bonus |
| Ranking | total points, then number fully right, then less time |

## How the arenas check answers

- **LLM Arena** reuses the toy model from Be the LLM (`be-the-llm/js/model.js`). The model runs on small training texts invented for this game (`llm-arena/data/worlds.js`), and every answer key is computed by it.
- **Agent Arena** reuses Be the Agent's token counter, keyword search and file maker, and adds a table tool with `WHERE`, `MAX` and `MIN` (`agent-arena/js/tools.js`). Players build its commands by tapping (`shared/querybuilder.js`); the search word cards are listed in `data/shop.js`, and the tests check that each set has cards that win and cards that are traps.
  - The data is a made-up bike-rental shop (`agent-arena/data/shop.js`).
  - The tool-choice and planted-order answers are marked by hand in that file, each with its reason.
- Each stage's items are shuffled per student from pools, so neighbours see different questions.

## Tests

```
node tests/check-backend.js            # the scoreboard script's logic (run on a fake sheet)
node tests/check-pregames.js           # warm-ups: every "real" reply and excerpt matches the raw record
python3 tests/check-text-coverage.py <old-copy>   # lists teaching sentences that changed wording
node llm-arena/tests/check-items.js    # recomputes every LLM Arena answer with separate code, 300 shuffles
node agent-arena/tests/check-items.js  # the same for Agent Arena, plus data checks
node be-the-llm/tests/check-corpus.js && node be-the-agent/tests/check-data.js
python3 tests/playthrough.py           # browser play-through: needs Playwright + Chromium
python3 be-the-llm/tests/playthrough.py && python3 be-the-agent/tests/playthrough.py
```

`tests/playthrough.py` checks the following in a browser:
- both warm-ups played by tapping at phone and iPad width, with the real files viewed and downloaded;
- plays both arenas through their real widgets;
- simulates a class of 6 on `tests/mock-server.js`, which runs the real `Code.gs` on a fake sheet. The simulated class includes a player who goes offline, a practice run and a nickname clash;
- then checks the board, the teams and the CSV download;
- resuming after a reload, time-outs, phone width and blocked browser storage;
- the Excel file from the Agent Arena boss.

## Files

```
index.html  board.html  config.js      front page, scoreboard, settings
shared/                                arena shell (timer, scoring, send queue), widgets, board, styles,
                                       visual.js/.css (cards, flows, diagrams, file viewer), querybuilder.js
pregame-llm/  pregame-agent/           the two warm-ups (data.js = real recorded replies / agent steps; files/)
pregames/data/raw/                     the unedited recordings the warm-ups are built from
be-the-llm/  be-the-agent/             learning games (each has its own README and TEACHING_GUIDE)
llm-arena/   agent-arena/              challenges: data/, js/items.js (answer keys), js/stages.js (screens), tests/
apps-script/Code.gs                    the scoreboard backend (paste into Google Apps Script)
tests/                                 site-wide tests and the local scoreboard mock
TEACHING_GUIDE.md                      how to run the arenas in class
```

## License

MIT. See `LICENSE`.
