# Be the LLM

A seven-level browser game about how chatbots work, for people with no background in AI. Players guess the next word, train a tiny language model by counting, and then find out how "guess the next word" turns into a chatbot that answers questions, and why it can sound sure and still be wrong.

Everything runs in the browser. The model is small enough to be fully see-through: every guess shows the counts behind it.

| Level | Name | What players do | The idea |
|---|---|---|---|
| 1 | Guess the next word | Guess from 4 choices; You vs Model | A chatbot's only job is to guess the next word |
| 2 | Train the model | Count word pairs by hand, then train on all 137 sentences | Training = learning from lots of example text |
| 3 | Build a sentence | Guess with the model's %, then write a sentence word by word | Whole answers are many guesses in a row |
| 4 | Answer a question | See a plain model ramble; add 43 example chats; watch the same kind of model answer word by word | A chat is still "continue the text after A:" |
| 5 | Same question, different answers | Temperature dial; ask one question 5 times at low and high settings | Why answers vary |
| 6 | How much can it see? | Guess with only 1, then 2, then 3 words visible; then a back-off round | The context window, and what the counting model does with words it has never seen together |
| 7 | Fact-check the chatbot | Mark answers Supported or Made up, then check the source | Hallucinations: sounding sure is not being right |

Each level opens with a short "How it works" card and closes with a "What you just saw" recap that explains new terms in everyday words. A full playthrough takes about 25–30 minutes; this is an estimate, not yet timed with players. Change the number of rounds in `config.js`.

## Part of the AI games site

This game is folder 1 of 4 in the `ai-games` site (see the README one folder up). Its results screen links to the **LLM Arena** challenge, and the top bar links back to the list of all games. There are no points or stars: players just unlock levels in order.

## Run it on your own computer

Double-click `index.html`. No install, no internet, no build step.

## Publish on GitHub Pages

Publish the whole `ai-games` folder (see its README). This game is then at `https://<your-username>.github.io/ai-games/be-the-llm/`.

Useful links:

| Link | What it does |
|---|---|
| `…/ai-games/be-the-llm/` | Normal play |
| `…/ai-games/be-the-llm/?mode=class` | **Class mode**: large text, and in Levels 1 and 3 the answer only shows when you press *Reveal*, so a class can vote first |
| `…/ai-games/be-the-llm/?teacher=1` | Unlocks every level |
| `…/ai-games/be-the-llm/?mode=class&teacher=1` | Both |

Progress from the earlier 6-level version is not carried over; players start fresh.

## Change the text the models learn from

Everything is in `data/corpus.js`:

- `train`: ordinary sentences, in lower case with no punctuation or contractions. The **first four** are the Level 2 hand-tally sentences.
- `test`: held-out sentences for Levels 1 and 3. `k` is the position of the hidden word (0 = first word). The item marked `anchor: true` ("see you at the ___") is always round 1 of Level 1.
- `qa`: example chats `[question, answer, source]`. For fact questions, `source` is the training sentence that states the fact; Level 7 uses it for "Supported" and for its list of facts. Everyday questions with several good answers (how are you, dinner, weather) have no source and may appear more than once; at temperature 0 the most frequent answer wins.
- `unanswerable`: questions that nothing in the training text answers (Level 7). Use only words the model knows.
- `l4Questions`, `l5Questions`, `l5DialQuestion`: which questions Levels 4 and 5 offer (must be in `qa`).
- `context`: Level 6 rounds. The item marked `unseen: true` has a 3-word view that never appears in training; Level 6 always includes it.

After editing, run the checks:

```
node tests/check-corpus.js
python3 tests/playthrough.py     # needs: pip install playwright && playwright install chromium
```

`check-corpus.js` confirms, among other things, that every chat question gets its correct answer at temperature 0, that every unanswerable question still gets a fluent (made-up) answer, and that the plain model does not already answer the Level 4 questions.

## How the toy models work

`js/model.js` is a word n-gram model: for the last few words, it counts which word came next in its training text; probability = count ÷ total. If it has never seen the last *k* words, it falls back to fewer words ("backoff").

- **Plain model** (Levels 1–3, 6, and "before" in Level 4): ordinary sentences, up to 3 words of memory.
- **Chat model** (Levels 4, 5, 7): the same sentences plus the example chats, each stored as `Q: question A: answer`, with up to 8 words of memory so it can keep track of the question. Answering a question = generating the words that follow `A:`.
- **Temperature** reshapes the probabilities as p ∝ count^(1/T) (softmax with temperature on log-probabilities); T = 0 always takes the top word.
- **Made-up answers (Level 7)** happen naturally: for a question it has never seen, the model backs off to the ending it recognises (e.g. "… open A:") and continues with the answer to a similar question. Nothing is hard-coded.

Real chatbots differ in important ways: they use tokens rather than words, have far larger context windows, learn patterns with a neural network rather than keeping a count table, and are trained on vastly more text and conversations. The game's results screen says this to players.

## Files

```
index.html            page shell
config.js             rounds per level
data/corpus.js        sentences, example chats and questions (synthetic, written for this game)
js/model.js           the n-gram model (plain and chat)
js/facts.js           Level 7: is an answer backed by the training text?
js/ui.js              shared UI, saved progress, guessing rounds, chat bubbles
js/levels/L1-L7.js    one file per level
js/summary.js         results, "what the toy gets wrong", link to the LLM Arena
tests/                corpus checks (Node) and a full play-through (Playwright)
TEACHING_GUIDE.md     how to run it with a class
```

Progress is saved in the browser's local storage on each device. In a private window, progress lasts only for that session.

## License

MIT. See `LICENSE` in the `ai-games` folder.
