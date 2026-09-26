/*
 * Be the LLM — corpus (everything the toy models learn from)
 *
 * All sentences are short, synthetic, everyday English written for this game.
 * Rules if you edit:
 *   - lower case, no punctuation, no contractions ("i am", not "I'm")
 *   - "train": plain sentences. Levels 1-3 and 6 use a model trained on these only.
 *   - the first 4 training sentences are the Level 2 hand-tally sentences
 *   - "test": held-out sentences for Levels 1 and 3. "k" = index of the hidden word (0 = first word)
 *   - "qa": example questions with answers ("chat examples"). The chat model in Levels 4, 5 and 7
 *           learns from "train" + these. A question may appear more than once with different answers.
 *   - "unanswerable": questions whose answer is NOT in any training text (Level 7 "made up" answers)
 *   - "context": Level 6 rounds (the narrow window)
 *   - After editing, run:  node tests/check-corpus.js
 */
window.BTL_CORPUS = {
  train: [
    // --- used for the Level 2 hand tally (keep these four first) ---
    "see you at the airport tomorrow",
    "meet me at the station at six",
    "i left my phone at the office",
    "see you at the airport tonight",

    // --- meeting places ---
    "see you at the airport at eight",
    "see you at the party tonight",
    "see you at the station tomorrow",
    "see you at the office on monday",
    "see you at the airport on friday",
    "meet me at the station after work",
    "meet me at the station tomorrow",
    "meet me at the cafe after class",
    "meet me at the gym at seven",
    "i left my bag at the gym",
    "i left my keys at the cafe",
    "we had lunch at the mall",
    "we watched a movie at the mall",
    "the kids are playing at the park",
    "we had a picnic at the park",
    "i will wait for you at the station",

    // --- travel and simple facts ---
    "the train to chiang mai leaves at eight",
    "the bus to the airport leaves at nine",
    "the first bus leaves at six",
    "the last train leaves at eleven",
    "the shop opens at ten",
    "the bank closes at four",
    "the shop closes at nine",
    "the library opens at eight",
    "the museum is closed on monday",
    "the pool is closed on sunday",
    "my sister lives in bangkok",
    "my brother lives in london",
    "my best friend lives in chiang mai",
    "my teacher lives near the school",
    "the flight to tokyo takes six hours",
    "the drive to the beach takes two hours",
    "the train to the city takes one hour",
    "my brother works at the bank",
    "my sister works at the hospital",
    "my mother works at the school",
    "my father works from home",

    // --- daily routine ---
    "i wake up at six every morning",
    "i wake up late on sunday",
    "i brush my teeth before bed",
    "i brush my teeth every morning",
    "i drink a cup of coffee every morning",
    "i drink a cup of tea after lunch",
    "she drinks a cup of coffee after lunch",
    "i take the bus to work",
    "i take the train to school",
    "she takes the bus to school",
    "we walk to school together",
    "i go to bed at eleven",
    "i go to the gym after work",
    "i am going to bed now",
    "i am going to the airport now",
    "i am on my way home",
    "i am on my way to work",
    "i am on the bus now",
    "i am stuck in traffic",
    "sorry i am late",
    "sorry i am stuck in traffic",
    "i will be there in five minutes",
    "i will be there in ten minutes",
    "i will call you later",
    "i will call you tonight",
    "i will call you back in five minutes",
    "i will text you later",
    "call me when you get home",
    "text me when you get home",
    "let me know when you get there",
    "let me know when you are free",

    // --- chat phrases ---
    "thank you so much",
    "thank you for your help",
    "thank you for the gift",
    "thanks for your help",
    "thanks a lot",
    "happy birthday to you",
    "happy birthday my friend",
    "happy new year",
    "good morning everyone",
    "good night and sweet dreams",
    "have a nice day",
    "have a nice weekend",
    "have a good trip",
    "how are you today",
    "how was your day",
    "how was the movie",
    "what time is it",
    "what time does the shop open",
    "what time does the bus leave",
    "where are you now",
    "where is the station",
    "are you free tonight",
    "are you coming to the party",
    "are you hungry",
    "do you want to get lunch",
    "do you want to watch a movie",
    "do you want to come with us",
    "i miss you so much",
    "i love you so much",
    "i am so tired today",
    "i am so hungry",
    "it was so good",
    "no problem at all",
    "see you soon",
    "see you later",
    "see you tomorrow",
    "talk to you later",
    "take care",

    // --- food, weather, school, work ---
    "it is raining again today",
    "it is so hot today",
    "it is cold this morning",
    "the weather is nice today",
    "the food was really good",
    "the movie was really good",
    "the coffee here is really good",
    "let us get lunch",
    "let us get some coffee",
    "we ordered pizza for dinner",
    "we ordered chicken rice for lunch",
    "i had noodles for lunch",
    "i had rice and soup for dinner",
    "the exam is on friday",
    "the class starts at nine",
    "the class is cancelled today",
    "the meeting starts at ten",
    "the meeting is on monday",
    "i have an exam tomorrow",
    "i have a meeting at ten",
    "i forgot my homework at home",
    "can you send me the file",
    "can you help me with my homework",
    "can you pick me up at the station",
    "can you call me back",
    "please send me the photos",
    "please call me back"
  ],

  // Level 2: the first four training sentences (hand tally of the word after "the")
  tallyCount: 4,
  tallyWord: "the",
  tallyRows: ["airport", "station", "office", "party"],

  // Levels 4, 5 and 7: chat examples [question, answer, source]. Answers only restate facts already in "train";
  // the third item is the training sentence that states the fact (Level 7 "Check the source").
  // Everyday questions with several good answers have no source.
  qa: [
    ["what time does the shop open", "it opens at ten", "the shop opens at ten"],
    ["what time does the shop close", "it closes at nine", "the shop closes at nine"],
    ["what time does the bank close", "it closes at four", "the bank closes at four"],
    ["what time does the library open", "it opens at eight", "the library opens at eight"],
    ["what time does the class start", "it starts at nine", "the class starts at nine"],
    ["what time does the meeting start", "it starts at ten", "the meeting starts at ten"],
    ["what time does the first bus leave", "it leaves at six", "the first bus leaves at six"],
    ["what time does the last train leave", "it leaves at eleven", "the last train leaves at eleven"],
    ["what time does the train to chiang mai leave", "it leaves at eight", "the train to chiang mai leaves at eight"],
    ["what time does the bus to the airport leave", "it leaves at nine", "the bus to the airport leaves at nine"],
    ["where does my sister live", "she lives in bangkok", "my sister lives in bangkok"],
    ["where does my brother live", "he lives in london", "my brother lives in london"],
    ["where does my best friend live", "they live in chiang mai", "my best friend lives in chiang mai"],
    ["where does my brother work", "he works at the bank", "my brother works at the bank"],
    ["where does my sister work", "she works at the hospital", "my sister works at the hospital"],
    ["where does my mother work", "she works at the school", "my mother works at the school"],
    ["where does my father work", "he works from home", "my father works from home"],
    ["when is the museum closed", "it is closed on monday", "the museum is closed on monday"],
    ["when is the pool closed", "it is closed on sunday", "the pool is closed on sunday"],
    ["when is the exam", "it is on friday", "the exam is on friday"],
    ["when is the meeting", "it is on monday", "the meeting is on monday"],
    ["how long is the flight to tokyo", "it takes six hours", "the flight to tokyo takes six hours"],
    ["how long is the drive to the beach", "it takes two hours", "the drive to the beach takes two hours"],
    ["how long is the train to the city", "it takes one hour", "the train to the city takes one hour"],
    ["where did i leave my keys", "you left your keys at the cafe", "i left my keys at the cafe"],
    ["where did i leave my bag", "you left your bag at the gym", "i left my bag at the gym"],
    ["where did i leave my phone", "you left your phone at the office", "i left my phone at the office"],
    ["what did i have for lunch", "you had noodles", "i had noodles for lunch"],
    // everyday questions with several natural answers (Level 5, temperature)
    ["how are you", "i am fine thank you"],
    ["how are you", "i am fine thank you"],
    ["how are you", "i am good thanks"],
    ["how are you", "not bad"],
    ["how are you", "i am so tired today"],
    ["what should we have for dinner", "how about pizza"],
    ["what should we have for dinner", "how about pizza"],
    ["what should we have for dinner", "let us get chicken rice"],
    ["what should we have for dinner", "noodles sound good"],
    ["what should we have for dinner", "i want soup"],
    ["what is the weather like today", "it is sunny"],
    ["what is the weather like today", "it is sunny"],
    ["what is the weather like today", "it is raining again"],
    ["what is the weather like today", "it is so hot today"],
    ["what is the weather like today", "it is cold this morning"]
  ],

  // Level 7: nothing in any training text answers these. The model answers anyway.
  unanswerable: [
    "what time does the museum open",
    "what time does the pool open",
    "what time does the pool close",
    "where does my mother live",
    "where does my teacher work",
    "when is the library closed",
    "what time does the bus to the city leave"
  ],

  // Level 4: questions offered as buttons (must be in "qa")
  l4Questions: [
    "what time does the bank close",
    "where does my sister live",
    "what time does the last train leave",
    "how long is the flight to tokyo",
    "where did i leave my keys"
  ],

  // Level 5: same question asked 5 times (must be in "qa")
  l5Questions: [
    "what should we have for dinner",
    "how are you",
    "what is the weather like today",
    "what time does the shop open"
  ],

  // Level 5 dial: the answer's first word after this question
  l5DialQuestion: "what should we have for dinner",

  // Levels 1 and 3: held-out sentences (not in "train"). k = position of the hidden word.
  test: [
    { s: "see you at the airport on monday", k: 4, anchor: true }, // phone-keyboard example: always round 1 of Level 1
    { s: "meet me at the station at eight", k: 4 },
    { s: "i will call you later tonight", k: 4 },
    { s: "i brush my teeth after lunch", k: 3 },
    { s: "i drink a cup of tea every morning", k: 5 },
    { s: "happy birthday to you my friend", k: 3 },
    { s: "thank you so much for the gift", k: 3 },
    { s: "i am stuck in traffic again", k: 4 },
    { s: "she will be there in ten minutes", k: 5 },
    { s: "the bus to the airport leaves at ten", k: 7 },
    { s: "the class starts at ten", k: 2 },
    { s: "it is so cold today", k: 2 },
    { s: "good morning my friend", k: 1 },
    { s: "have a nice weekend everyone", k: 3 },
    { s: "what time does the class start", k: 4 },
    { s: "do you want to watch the movie", k: 4 },
    { s: "please send me the file", k: 4 },
    { s: "i am on my way to school", k: 6 },
    { s: "sorry i am late again", k: 3 },
    { s: "my sister works at the bank", k: 2 },
    { s: "the shop opens at nine", k: 2 },
    { s: "we had pizza for dinner", k: 4 },
    { s: "i take the train to work", k: 3 },
    { s: "how was your day today", k: 3 },
    { s: "i left my keys at the office", k: 3 }
  ],

  // Level 6: the student guesses while seeing only the last 1, then 2, then 3 words.
  context: [
    { prefix: "see you at the", answer: "airport" },
    // "unseen: true" = the 3-word context never appears in training, so the 3-word column shows "no data".
    // Level 6 always includes one of these.
    { prefix: "can we meet at the", answer: "station", unseen: true },
    { prefix: "the bank closes at", answer: "four" },
    { prefix: "my brother lives in", answer: "london" },
    { prefix: "happy birthday to", answer: "you" },
    { prefix: "i brush my", answer: "teeth" },
    { prefix: "meet me at the", answer: "station" },
    { prefix: "thank you so", answer: "much" },
    { prefix: "good night and sweet", answer: "dreams" }
  ]
};
