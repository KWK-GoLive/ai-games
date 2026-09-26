# AI games

Four browser games that teach beginners how chatbots and AI agents work. One site and one link, with a front page that lists the games in order:

| # | Game | Kind | Time | Folder |
|---|---|---|---|---|
| 1 | **Be the LLM** | learning game, 7 levels | 25–30 min | `be-the-llm/` |
| 2 | **LLM Arena** | timed challenge, 6 stages, class scoreboard | about 20 min | `llm-arena/` |
| 3 | **Be the Agent** | learning game, 6 levels | 25–30 min | `be-the-agent/` |
| 4 | **Agent Arena** | timed challenge, 6 stages, class scoreboard | about 20 min | `agent-arena/` |

- `index.html` is the front page. A ✓ appears next to each game a student has finished on that device.
- `board.html` is the teacher's scoreboard: two tabs (one per arena), live ranking, team averages and a CSV download.

Times are estimates, not yet measured with students.

Everything runs in the browser, with no build step and no libraries. The learning games have no scores. The arenas score every answer, and they are the only part that talks to the internet (to the class scoreboard, if you set one up).

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
- Students open the site on their own devices and play the arena. Each enters a nickname, an optional team name (teammates type the same one) and the class code.
- **Only the first complete run counts.** Later runs are practice runs and are not sent. The scoreboard also keeps only the first run for each nickname. If a nickname is already used in that class, the game asks for another one.
- A team's score is the average of its members, so team size doesn't matter.
- **Download results (CSV)** on the board gives one row per student per stage (plus the "joined" rows), for both arenas. The `counted` column marks first runs.
- Reloading the page carries on with the same item, and its timer keeps running.
- **No connection?** Stage results wait on the device and are sent automatically when the connection returns.
- **Limitation:** scores are computed in the browser, so a determined student could fake one, or start again under a new nickname. Treat the board as motivation, not as assessment evidence.

`config.js` also has:
- `BOARD_REFRESH_SECONDS`: raise it for very large classes. Google limits how often a script can be called; this game was not load-tested with a real class.
- `TIME_FACTOR`: for example, 1.5 gives everyone 50% more time.

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
- **Agent Arena** reuses Be the Agent's token counter, keyword search and file maker, and adds a table tool with `WHERE`, `MAX` and `MIN` (`agent-arena/js/tools.js`).
  - The data is a made-up bike-rental shop (`agent-arena/data/shop.js`).
  - The tool-choice and planted-order answers are marked by hand in that file, each with its reason.
- Each stage's items are shuffled per student from pools, so neighbours see different questions.

## Tests

```
node tests/check-backend.js            # the scoreboard script's logic (run on a fake sheet)
node llm-arena/tests/check-items.js    # recomputes every LLM Arena answer with separate code, 300 shuffles
node agent-arena/tests/check-items.js  # the same for Agent Arena, plus data checks
node be-the-llm/tests/check-corpus.js && node be-the-agent/tests/check-data.js
python3 tests/playthrough.py           # browser play-through: needs Playwright + Chromium
python3 be-the-llm/tests/playthrough.py && python3 be-the-agent/tests/playthrough.py
```

`tests/playthrough.py` checks the following in a browser:
- plays both arenas through their real widgets;
- simulates a class of 6 on `tests/mock-server.js`, which runs the real `Code.gs` on a fake sheet. The simulated class includes a player who goes offline, a practice run and a nickname clash;
- then checks the board, the teams and the CSV download;
- resuming after a reload, time-outs, phone width and blocked browser storage;
- the Excel file from the Agent Arena boss.

## Files

```
index.html  board.html  config.js      front page, scoreboard, settings
shared/                                arena shell (timer, scoring, send queue), widgets, board, styles
be-the-llm/  be-the-agent/             learning games (each has its own README and TEACHING_GUIDE)
llm-arena/   agent-arena/              challenges: data/, js/items.js (answer keys), js/stages.js (screens), tests/
apps-script/Code.gs                    the scoreboard backend (paste into Google Apps Script)
tests/                                 site-wide tests and the local scoreboard mock
TEACHING_GUIDE.md                      how to run the arenas in class
```

## License

MIT. See `LICENSE`.
