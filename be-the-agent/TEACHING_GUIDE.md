# Teaching guide: Be the Agent

For anyone teaching beginners how AI assistants really work. It follows **Be the LLM** (the model guesses the next word, and "likely" isn't "true"), but players new to both can start here.

## What players should leave with

1. The model only sees what's on its desk (context window). The desk is limited, a new chat starts empty, and "memory" is saved notes pasted back in (Level 1).
2. A chatbot "reads" a file as text on the desk, often only the pieces a search picked. The answer can only be as good as those pieces (Level 2).
3. The model can't calculate exactly, browse or open files by itself. It writes tool requests; the app (harness) runs them (Level 3).
4. An agent works in a loop: plan, act, check, fix. Its results still need a human check (Level 4).
5. Files and web pages can hide instructions for the AI (prompt injection) (Level 5).
6. You decide what the agent may do, and what data leaves your computer (Level 6).

## Ways to use it

| Option | How | Time |
|---|---|---|
| **Projected, together** | `?mode=class&teacher=1`. Do Levels 1, 4 and 5 together; players do 2, 3 and 6 alone | 50–65 min with discussion (or two sittings) |
| **Solo, then discuss** | Everyone plays all 6, then a debrief with the prompts below | 55–65 min (or two sittings: Levels 1–3, then 4–6) |
| **Homework** | Full playthrough; open the files (view on screen or download) | 45–55 min (can be split: Levels 1–3, then 4–6) |

## Suggested moves

**1. Level 1: ask before the reveal.** When the chat reaches "what's my name?", pause and ask the room to predict. Most people expect the chatbot to remember. Then show the strike-through messages at the bottom of the desk.

**2. Level 2: dwell on question 2.** The search tool's top result is the wrong piece (opening hours, not discounts). Ask: "Why did search pick it?" (it matched the words "pm", "before" and "close"). Real search tools are better than ours, but they can still pick the wrong passage.

**3. Level 3: point at the tool request.** The black box is the key image of the game: the model writes text, and the app does the work. Ask: "Who multiplied 1,284 by 37?"

**4. Level 4: open the files in class.** Have everyone open `sales_summary.xlsx` and `memo.docx` (👁 View here works on phones and iPads; ⬇ Download gives the real files) and check the memo total against the Excel file. Then discuss the wrong number in the draft: nothing crashed, it just looked right.

**5. Level 5: show the two answers side by side.** "Every customer is delighted" vs the real list of complaints. Both are fluent and confident.

**6. Level 6: connect to your own rules.** Ask what your organisation allows people to paste into AI tools. The "upload customer emails" request is the one to discuss.

## Discussion prompts

- After Level 1: "Why might a chatbot forget something you said an hour ago in the same chat?"
- After Level 2: "The chatbot answered from your file. How would you check it?"
- After Level 3: "A chatbot tells you the average of your data. How do you know a tool calculated it?"
- After Level 4: "Which mistake was more dangerous: the error message or the wrong total? Why?"
- After Level 5: "Where might hidden instructions show up in your work: emails, CVs, web pages, shared documents?"
- After Level 6: "Which permission would you never give an AI agent, and which are fine?"

## Things to know before you play

- **What's simulated.** The agent's choices are pre-written replays, and the game says so. The calculator and table tool really compute, and the files are real. The web search result comes from a made-up site, labelled as such.
- **Tokens.** The game estimates tokens as words × 4/3, a common rule of thumb for English. Real tokenizers differ by model and language, so the game always says "roughly". Thai and many other languages need more tokens for the same meaning, and the game says so in Level 1.
- **The desk size.** The toy desk holds 200 tokens so it fills quickly. The game says real chatbots hold far more without giving a number, because sizes differ between products and change often.
- **Simplifications to mention if asked:**
  - Real apps may summarise old messages rather than drop them.
  - Real agents usually write code (for example Python) in a sandbox, not our tiny table language.
  - Some apps can read images and scanned pages directly.
- **Files were tested** with openpyxl, python-docx and LibreOffice. Please open one of each in Microsoft Excel and Word once before class. Excel opens downloaded files in Protected View (normal: click "Enable Editing"), and it may ask "Save changes?" when you close the workbook, because it recalculates the total. Both are harmless.
- **Timing** is an estimate.
