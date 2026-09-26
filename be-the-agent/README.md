# Be the Agent

A six-level browser game about what happens *around* a language model: how an AI assistant reads your files, uses tools, makes real Excel and Word files, and how you stay in charge. It's the sequel to **Be the LLM** (which shows how the model itself works), but it also works on its own. It's written for people with no background in AI.

Everything runs in the browser with no libraries; it needs no internet once loaded. The running story is **Moonbean Café**, a made-up business.

| Level | Name | Player's role | The idea |
|---|---|---|---|
| 1 | The desk | the app | Context window and tokens: the desk fills up, old messages fall off, a new chat starts empty, and "memory" is saved notes pasted back in |
| 2 | Reading your files | the app | A file becomes text on the desk; if it's too big, search picks pieces. The wrong piece gives a confident wrong answer |
| 3 | Tools | the model, then the app | The model writes a tool request; the app (harness) runs the calculator, table tool or search and pastes the result back. Knowledge cutoff |
| 4 | The agent loop | model, app and human | Plan → act → check → fix, on the job "Excel summary + Word memo from sales.csv". The files are **real**: view them on screen (sheet tabs, memo page) or download them |
| 5 | Files that give orders | the human | Prompt injection: find instructions hidden in an email and a web page |
| 6 | You're the boss | the human | Approve or deny 8 agent requests; permissions and privacy |

Each level opens with a "How it works" card and closes with a "What you just saw" recap and short glossary. The results screen shows how a chatbot app fits together (you ⇄ app ⇄ model) and five habits to take away. A full playthrough takes about 25–30 minutes; this is an estimate, not yet timed with players.

**What is real and what is replayed.** The agent's decisions are pre-written, and the game says it is "a simplified replay". The tools are real:
- the calculator and table tool really compute;
- the Excel and Word files are genuine `.xlsx` and `.docx` files built in the browser (`js/files.js`).

The web search result is made up and labelled as such.

## Run it on your own computer

Double-click `index.html`. No install, no internet, no build step.

## Publish on GitHub Pages

Publish the whole `ai-games` folder (see its README). This game is then at `https://<your-username>.github.io/ai-games/be-the-agent/`. It is game 3 of 4: its results screen links to the **Agent Arena** challenge, and the top bar links back to all games. There are no points or stars.

| Link | What it does |
|---|---|
| `…/ai-games/be-the-agent/?mode=class` | **Class mode**: larger text for a projector |
| `…/ai-games/be-the-agent/?teacher=1` | Unlocks every level |

## Change the content

Everything about the café is in `data/cafe.js`:

- `salesCsv`: the sales file used in Levels 3–4.
- `systemNote`, `chat`, `memoryNotes`: Level 1. The first chat message holds the user's name and must fall off the desk.
- `handbook`: the file pieces for Level 2. `fileQuestions` gives each question with its right piece (`need`), a look-alike piece (`trap`), and the three possible answers.
- `emails`, `webPage`: Level 5 (one hidden instruction each).
- `requests`: Level 6 (`ok` is the safe choice, `why` the explanation).

The toy desk size is `DESK_TOKENS` in `config.js`. After editing, run the checks:

```
node tests/check-data.js      # data, calculator, desk overflow, search ranking, file signatures
python3 tests/playthrough.py  # full play-through; also opens the downloaded .xlsx/.docx and checks the numbers
                              # needs: pip install playwright openpyxl python-docx && playwright install chromium
```

## How it works (for maintainers)

| File | What it does |
|---|---|
| `js/engine.js` | Token estimate (words × 4/3, labelled approximate); a calculator parser (no `eval`); a tiny table language (`SHOW 5 ROWS`, `COUNT ROWS`, `TOTAL col`, `TOTAL col BY col`); keyword search over handbook pieces |
| `js/files.js` | Writes Office Open XML by hand and packs it into an uncompressed ZIP. Handles text, numbers, percentages and formulas (`=SUM(...)`) in `.xlsx`; headings, paragraphs, bullets and a table in `.docx`. Checked with openpyxl, python-docx and LibreOffice; not yet opened in Microsoft Office by the author |
| `js/widgets.js` | The desk with token meter, tool-call boxes, tables, chat bubbles |
| `js/levels/L1-L6.js` | One file per level |

## License

MIT. See `LICENSE` in the `ai-games` folder.
