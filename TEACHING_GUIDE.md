# Teaching guide: the six games

The site runs in this order: **Guess the Chatbot → Be the LLM → LLM Arena → Watch a Real Agent → Be the Agent → Agent Arena**. The learning games (2 and 5) have their own teaching guides in their folders. This guide covers the two warm-ups and the two arenas, which work as post-tests you can play as a class competition.

## A suggested session plan

| Session | Activity | Time |
|---|---|---|
| 1 | Guess the Chatbot (warm-up; good on the projector with a hand vote per guess) | 5–10 min |
| 1 | Be the LLM (solo or projected), then debrief | 35–45 min |
| 1 or 2 | LLM Arena as a class competition, board projected | about 20 min, plus 10 to discuss |
| 2 or 3 | Watch a Real Agent (warm-up) | 6–10 min |
| 2 or 3 | Be the Agent, then debrief | 35–45 min |
| 2 or 3 | Agent Arena as a class competition | about 20 min, plus 10 to discuss |

All times are estimates. The arenas' timers can be stretched with `TIME_FACTOR` in `config.js`.

## The warm-ups

- They are meant to raise questions, not answer them. Each ends with 3–4 "mysteries" and the level of the next game that answers each one. Collect the class's guesses before the learning game, and come back to them in the debrief.
- **Honesty:** the chatbot replies and the agent run are real recordings (see README, "The two warm-ups"). They come from one model on one day; another chatbot, or the same one tomorrow, may answer differently. That is itself a good discussion point.
- In the agent warm-up, the last round asks students to check four sentences from the agent's memo. Two are fine and two go beyond the data (a wrong detail about the missing row, and "margin", which the file can't show). Good debrief question: "The numbers were right. Why wasn't the memo?"

## Before class (5 minutes)

1. Open `board.html?class=YOURCODE&projector=1` on the projector. It shows "No results yet".
2. Play one stage yourself on your phone with the nickname `TEACHER-TEST`, check that you appear on the board, then delete its rows in the Sheet (a "joined" row and a stage row).
3. Once, when you first set up the Sheet: also test a class code such as `01` or `1-2` and check the board shows it (it must stay text, not become a number or a date).
4. Write the site link and the class code on the board.

## During the arena

- At the start, have everyone fill in "Who's playing?" on the front page (nickname, optional team, class code). Remind students to use a nickname, not their real name.
- Tell them the first full run is the one that counts, so it's worth reading each stage's rules card before pressing Start. The timer doesn't run on the rules card.
- A nickname is reserved as soon as a student signs in. A student who switches device or browser (or uses a private window) must pick a new nickname; stages already sent stay under the old one, and the CSV shows both.
- A student who changes computer mid-arena uses the **resume code** shown on each stage screen (arena → Continue on another computer). In the learning games they type the last **level code** they saw; you can also give out the teacher code `OPEN-ALL-LEVELS`.
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
| Search sniper | Reading files is often search + pieces; wrong piece means a confident wrong answer (players tap word cards; some are traps) |
| Tool router | The model writes text; tools do exact work; risky actions need a human |
| Data detective | Agents answer data questions by writing and running small programs (players build the question by tapping and tap the answer in the result; no code to type) |
| Injection hunter | Text inside documents can try to give the AI orders; people's instructions are just content |
| Boss | Plan → permissions → run (three guided questions) → check → deliver a real file |

## Debrief questions

- LLM Arena: "In Chat brain, why did the model never say 'I don't know'?" "When did a bigger keyhole make things worse?"
- Agent Arena: "In Desk packer, why could adding the whole handbook be a bad idea?" "Which planted order was hardest to spot, and why?" "In the boss, what would have happened if you had skipped the check step?"

## Things to know

- **Honesty about the toys.** The LLM Arena model counts words. Real models use tokens and neural networks, and see far more text. Agent Arena's search counts matching words; real tools often use smarter search. The games say this on screen.
- **Fair but not secure.** Scores are computed in the student's browser. The board is for motivation, not grading. The CSV lets you see stage-by-stage results and spot duplicate nicknames.
- **Hard on purpose.** A student who answers perfectly and fast scores about 5,500–5,700. Guessing at random scores roughly a third of that in our automated tests. Real students will be slower, so expect lower scores. These figures come from scripted players, not from a class.
