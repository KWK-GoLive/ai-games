# Teaching guide: Be the LLM

For anyone introducing chatbots and large language models to learners with no technical background. No prior lesson is needed; the game explains every term it uses.

## What players should leave with

1. A chatbot writes by guessing a likely next word, adding it, and repeating (Levels 1, 3).
2. Training means learning from lots of example text; chatting doesn't retrain the model (Level 2).
3. Answering a question is still "continue the text": the model has learned from example chats that an answer follows a question (Level 4).
4. Temperature is why the same question can get different answers (Level 5).
5. The context window is how much text the model can see at once (Level 6).
6. A fluent, confident answer can be made up, so check facts that matter (Level 7).

## Ways to use it

| Option | How | Time |
|---|---|---|
| **Whole class, projected** | `?mode=class&teacher=1`. Play Levels 1, 4 and 7 together with hand votes; players do the rest alone | 45–60 min including discussion (or two sittings) |
| **Solo, then discuss** | Everyone plays all 7 levels, then a 10-minute debrief using the prompts below | 50–60 min (or two sittings: Levels 1–4, then 5–7) |
| **Homework** | Full playthrough before a class on AI tools | 40–50 min (can be split: Levels 1–4, then 5–7) |

## Suggested moves

**1. Start with Level 1 before any explanation.** Two minutes of guessing, then: "You just did what a chatbot does." Experience first, name second.

**2. Count Level 2 together.** Put the four sentences on screen and have the class call out the counts after "the". Then press *Train on the other 133 sentences*: the top word changes from "airport" to "station". Ask: "Did the model understand anything, or did it just see more text?"

**3. Make Level 4 the centrepiece.** Ask the class first: "How do you think a chatbot answers a question?" Collect guesses (usually "it searches" or "it looks it up"). Then show the plain model failing, add the example chats, and step through the answer with *Guess the next word*. The point to land: this model looked nothing up; it continued the text after "A:". Even chatbots that search the web write the answer this way: the search results are added to the text, and the model still writes word by word.

**4. In Level 7, open the made-up answers together.** Press *Check the source* on "What time does the museum open?". The model recognised only "… open A:" and borrowed the shop's answer. Ask: "Would you have noticed if you hadn't checked?"

**5. Always show the closing card "What this toy model gets wrong".** Without it, players may leave thinking a chatbot is a big table of word counts. Real models use tokens, far larger context windows, neural networks and vastly more training.

## Discussion prompts

- After Level 1: "Where did the counting model beat you? Where did reading the whole sentence help you?"
- After Level 3: "The model picked the highest % and still missed. Is that a bug?"
- After Level 4: "If a chatbot doesn't look anything up, where does its answer come from?"
- After Level 5: "A friend got two different answers to the same question. What would you tell them?"
- After Level 6: "Why did the chat model need to see 8 words, not 3?"
- After Level 7: "Which made-up answer would you have believed? What will you check next time you use a chatbot?"

## Things to know before you play

- Level 1 always opens with "See you at the ___"; the other rounds, and Level 3, are drawn at random from 25 held-out sentences.
- Level 4's "before" model either stops at once, keeps writing the question as a sentence (for example "How long is the flight to Tokyo takes six hours"), or has no data at all because a word such as "close" never appeared in its training text (it has only seen "closes"). All three show that it doesn't answer.
- Level 5: fact questions such as "What time does the shop open?" stay the same even at high temperature, because the model has seen only one answer; everyday questions ("What should we have for dinner?") vary.
- Level 6 always includes one round ("can we meet at the ___") where the 3-word view was never seen in training, so the counting model has no data at all.
- Level 7 answers are generated, not scripted: every made-up answer comes from the model backing off to a question ending it recognises. Players can open the list of facts in the training text to check; a reworded question counts as Supported only if it is about exactly the same thing (same person or place, same verb).
- The simplification to mention if asked: real chatbots are trained first on huge amounts of text, then on many example conversations, and are tuned further with feedback from people. The game shows only the "example conversations" idea.
- All text is synthetic everyday English (140 sentences, 45 example chats). Edit `data/corpus.js` and run `node tests/check-corpus.js` to check changes.
- Timing is an estimate. Adjust `ROUNDS` in `config.js`.
