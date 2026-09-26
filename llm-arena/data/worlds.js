/*
 * LLM Arena — the small training texts. All made up for this game.
 * Plain sentences: lower case, no punctuation. Each stage picks one world at random.
 */
window.LLMA_DATA = {
  worlds: [
    { id: "station", name: "Space station", text: [
      "the robot fixed the door",
      "the robot fixed the light",
      "the captain fixed the robot",
      "the robot opened the door",
      "the cat opened the box",
      "the captain opened the door",
      "the door was open",
      "the light was green"
    ] },
    { id: "pirates", name: "Pirate ship", text: [
      "the pirate found a map",
      "the pirate found a coin",
      "the parrot found a coin",
      "a map shows the island",
      "a coin shows the king",
      "the pirate lost the map",
      "the parrot lost a feather",
      "the king lost the island"
    ] },
    { id: "bakery", name: "Bakery", text: [
      "we bake bread every morning",
      "we bake cakes every friday",
      "we sell bread every morning",
      "they sell cakes every day",
      "the bread is warm",
      "the cake is sweet",
      "the bread is fresh",
      "we eat bread at night"
    ] },
    { id: "town", name: "Rainy town", text: [
      "it rains in the town",
      "it rains every day",
      "the town has a river",
      "the river is cold",
      "the river is wide",
      "the town is quiet",
      "a boat is on the river",
      "it snows in the hills"
    ] },
    { id: "zoo", name: "Zoo", text: [
      "the lion eats meat",
      "the panda eats bamboo",
      "the monkey eats fruit",
      "the monkey eats bananas",
      "the lion sleeps all day",
      "the panda sleeps in a tree",
      "the monkey climbs a tree",
      "the lion likes the sun"
    ] },
    { id: "football", name: "Football club", text: [
      "our team won the game",
      "our team lost the game",
      "their team won the cup",
      "our coach likes the game",
      "the game was long",
      "the cup was gold",
      "the fans love our team",
      "the fans sang a song"
    ] }
  ],

  /* Stage 5: example chats. The model learns them as  Q: question A: answer  and answers new questions by continuing after "A:". */
  chats: [
    { id: "library", name: "Sunny Library", qa: [
      ["when does the library open", "at nine am"],
      ["when does the library close", "at six pm"],
      ["when does the pool open", "at seven am"],
      ["where is the library", "next to the park"],
      ["where is the pool", "behind the school"],
      ["who runs the library", "miss lee"],
      ["who runs the pool", "mr tan"],
      ["is the library free", "yes it is free"],
      ["is the pool free", "no it costs two dollars"]
    ], ask: ["where is the pool", "when is the library open", "when is the pool open", "who runs the library",
      "when does the park open", "who runs the park", "is the park free", "when does the pool close",
      "who is at the library", "where is the park", "is the school free"] },
    { id: "clinic", name: "Hilltop Clinic", qa: [
      ["when does the clinic open", "at eight am"],
      ["when does the pharmacy open", "at ten am"],
      ["when does the pharmacy close", "at five pm"],
      ["where is the clinic", "on hill road"],
      ["where is the pharmacy", "inside the mall"],
      ["who is the doctor", "doctor ana"],
      ["who is the nurse", "nurse ben"],
      ["is the clinic open on sunday", "no it is closed"],
      ["is the pharmacy open on sunday", "yes until noon"]
    ], ask: ["where is the pharmacy", "when is the pharmacy open", "when is the clinic open", "who is the nurse",
      "when does the clinic close", "who is the dentist", "where is the mall", "when does the mall open",
      "is the mall open on sunday", "where is the doctor", "is the clinic open on monday", "where is the hospital"] }
  ],

  /* Stage 3: count tables for the temperature questions (chosen so the % come out cleanly). */
  diceCounts: [[9, 4, 1], [16, 4], [9, 1], [4, 1, 1], [36, 9, 4]],
  diceContexts: [
    { ctx: "my favourite pet is a", words: ["cat", "dog", "fish"] },
    { ctx: "for lunch we had", words: ["rice", "soup", "pizza"] },
    { ctx: "the weather today is", words: ["sunny", "rainy", "windy"] },
    { ctx: "on friday we will", words: ["rest", "study", "dance"] }
  ]
};
