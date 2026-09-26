/* Be the LLM — pictures for each level: a diagram, icons for the "How it works" steps, and short headlines
 * for the "What you just saw" cards. The full teaching text stays in the level files. */
(function () {
  "use strict";
  var V = {
    L1: { diagram: "nextword", icons: ["📱", "🤖", "🎯"], points: [{ icon: "🔁", head: "Look → guess → add → repeat" }, { icon: "🎧", head: "Sounding likely is not the same as checked" }] },
    L2: { diagram: "counting", icons: ["🍼", "🔢", "📊"], points: [{ icon: "📚", head: "More text, better guesses" }, { icon: "🧠", head: "Real models: same task, far bigger" }, { icon: "🔒", head: "Training happens before you chat" }] },
    L3: { diagram: "nextword", icons: ["👀", "🎲", "🔁"], points: [{ icon: "🔁", head: "One word at a time" }, { icon: "🚫", head: "No plan first, no check at the end" }] },
    L4: { diagram: "chat", icons: ["📖", "💬", "🅰️"], points: [{ icon: "🅰️", head: "An answer is just what comes after “A:”" }, { icon: "🏋️", head: "Real chatbots: ordinary text first, then example chats" }, { icon: "🧩", head: "Why your answer? It matched your whole question" }, { icon: "⚠️", head: "It did not check a fact" }] },
    L5: { diagram: "dice", icons: ["🎲", "🌡️", "🔁"], points: [{ icon: "🔀", head: "Different answers are normal" }, { icon: "📌", head: "Many good answers → more variety" }] },
    L6: { diagram: "keyhole", icons: ["🔑", "🔓", "🪟"], points: [{ icon: "🔍", head: "Each extra word narrows it down" }, { icon: "↩️", head: "Never seen those words? Back off" }, { icon: "🧠", head: "Real chatbots learn patterns instead" }, { icon: "📏", head: "Big windows can still overflow" }] },
    L7: { diagram: "likely", icons: ["🤷", "↩️", "🕵️"], points: [{ icon: "🗣️", head: "Fluent even when it's wrong" }, { icon: "📉", head: "Rarer in real chatbots, same cause" }, { icon: "✅", head: "Check facts that matter" }] }
  };
  (window.BTL.levels || []).forEach(function (l) { if (V[l.id]) l.vis = V[l.id]; });
})();
