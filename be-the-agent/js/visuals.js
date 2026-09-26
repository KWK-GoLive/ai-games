/* Be the Agent — pictures for each level: a diagram, icons for the "How it works" steps, and short headlines
 * for the "What you just saw" cards. The full teaching text stays in the level files. */
(function () {
  "use strict";
  var V = {
    L1: { diagram: "desk", icons: ["🗂️", "🪙", "⚙️"], points: [{ icon: "🧽", head: "No memory between replies" }, { icon: "🆕", head: "A new chat starts with an empty desk" }, { icon: "📏", head: "Big desks still fill up" }] },
    L2: { diagram: "files", icons: ["🔤", "🗂️", "✂️"], points: [{ icon: "📄", head: "It reads text, not your file" }, { icon: "🔍", head: "Search can pick the wrong piece" }, { icon: "🔖", head: "Ask for the exact quote" }] },
    L3: { diagram: "harness", icons: ["✍️", "🧰", "⚙️"], points: [{ icon: "🙋", head: "The model asks; the harness does" }, { icon: "🧰", head: "The tools decide what it can do" }, { icon: "🐍", head: "Real agents write and run code" }] },
    L4: { recapDiagram: "loop", icons: ["🤖", "🔁", "💼"], points: [{ icon: "🪜", head: "Small, checked steps" }, { icon: "⚠️", head: "The quiet mistake is the dangerous one" }, { icon: "📂", head: "Real files — still check them" }] },
    L5: { diagram: "inject", icons: ["🗂️", "🕵️", "🧑‍⚖️"], points: [{ icon: "🎭", head: "Planted orders can steer it" }, { icon: "🛡️", head: "Defences help, but there's no full fix" }, { icon: "✋", head: "Your habits" }] },
    L6: { recapDiagram: "permissions", icons: ["🔐", "🚦", "🧑‍💼"], points: [{ icon: "🧑‍💼", head: "You carry the consequences" }, { icon: "📤", head: "What you paste is sent to the company" }, { icon: "🏢", head: "Use approved tools for work data" }] }
  };
  (window.BTA.levels || []).forEach(function (l) { if (V[l.id]) l.vis = V[l.id]; });
})();
