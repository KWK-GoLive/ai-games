# Teaching guide: the four games

The site runs in this order: **Be the LLM → LLM Arena → Be the Agent → Agent Arena**. The learning games (1 and 3) have their own teaching guides in their folders. This guide covers the two arenas, which work as post-tests you can play as a class competition.

## A suggested session plan

| Session | Activity | Time |
|---|---|---|
| 1 | Be the LLM (solo or projected), then debrief | 35–45 min |
| 1 or 2 | LLM Arena as a class competition, board projected | about 20 min, plus 10 to discuss |
| 2 or 3 | Be the Agent, then debrief | 35–45 min |
| 2 or 3 | Agent Arena as a class competition | about 20 min, plus 10 to discuss |

All times are estimates. The arenas' timers can be stretched with `TIME_FACTOR` in `config.js`.

## Before class (5 minutes)

1. Open `board.html?class=YOURCODE&projector=1` on the projector. It shows "No results yet".
2. Play one stage yourself on your phone with the nickname `TEACHER-TEST`, check that you appear on the board, then delete its rows in the Sheet (a "joined" row and a stage row).
3. Once, when you first set up the Sheet: also test a class code such as `01` or `1-2` and check the board shows it (it must stay text, not become a number or a date).
4. Write the site link and the class code on the board.

## During the arena

- At the start, have everyone fill in "Who's playing?" on the front page (nickname, optional team, class code). Remind students to use a nickname, not their real name.
- Tell them the first full run is the one that counts, so it's worth reading each stage's rules card before pressing Start. The timer doesn't run on the rules card.
- A nickname is reserved as soon as a student signs in. A student who switches device or browser (or uses a private window) must pick a new nickname; stages already sent stay under the old one, and the CSV shows both.
- The board updates after every stage, so the ranking moves during play. That is part of the fun, but you can hide the projector until the end if it stresses the class.

## What each stage checks

**LLM Arena**

| Stage | The idea it tests |
|---|---|
| Count it | Training = counting what follows what; probability = count ÷ total |
| Greedy writer | Generation = repeat "pick the next word"; temperature 0 can loop |
| Dice master | Temperature reshapes the chances; T 0 = always the top word |
| Keyhole | The context window: change the window, change the answer; "never seen this" |
| Chat brain | A chat is "continue after A:"; back-off produces confident made-up answers |
| Boss | All of it: 2-word window with back-off, ties, [end] |

**Agent Arena**

| Stage | The idea it tests |
|---|---|
| Desk packer | The context window is limited; choose the right, newest, smallest facts |
| Search sniper | Reading files is often search + pieces; wrong piece means a confident wrong answer |
| Tool router | The model writes text; tools do exact work; risky actions need a human |
| Data detective | Agents answer data questions by writing and running small programs |
| Injection hunter | Text inside documents can try to give the AI orders; people's instructions are just content |
| Boss | Plan → permissions → run → check → deliver a real file |

## Debrief questions

- LLM Arena: "In Chat brain, why did the model never say 'I don't know'?" "When did a bigger keyhole make things worse?"
- Agent Arena: "In Desk packer, why could adding the whole handbook be a bad idea?" "Which planted order was hardest to spot, and why?" "In the boss, what would have happened if you had skipped the check step?"

## Things to know

- **Honesty about the toys.** The LLM Arena model counts words. Real models use tokens and neural networks, and see far more text. Agent Arena's search counts matching words; real tools often use smarter search. The games say this on screen.
- **Fair but not secure.** Scores are computed in the student's browser. The board is for motivation, not grading. The CSV lets you see stage-by-stage results and spot duplicate nicknames.
- **Hard on purpose.** A student who answers perfectly and fast scores about 5,500–5,700. Guessing at random scores roughly a third of that in our automated tests. Real students will be slower, so expect lower scores. These figures come from scripted players, not from a class.
