/* Level 6 — You're the boss: permissions, human checkpoints, privacy. */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};
  BTA.levels = BTA.levels || [];

  BTA.levels.push({
    id: "L6", num: 6,
    name: "You're the boss",
    desc: "The agent asks permission. Approve or deny.",
    goal: "Agents that can use real tools on real files can also make real mistakes. Good agent apps ask before risky actions. You're the human who decides.",
    intro: [
      { title: "An agent should only be able to touch what it's allowed to.", text: "The app gives it permissions: which folders it may read, whether it may send emails, delete files or use the internet. Many apps ask you before risky steps." },
      { title: "A simple rule of thumb:", text: "approve things that are needed for the job and easy to undo. Be very careful with anything permanent, anything that leaves your computer, and anything involving other people's data.", ex: "read · create a new file  →  usually fine\nsend · delete · buy · upload  →  stop and check" },
      { title: "Your job:", text: "the Moonbean agent is doing the sales job from Level 4 and asks for 8 permissions. Approve or deny each one." }
    ],
    recap: {
      title: "You stay in charge",
      text: [
        "The agent's requests weren't evil. It was trying to help (tidying files, sharing the memo). But it doesn't carry the consequences; you do. Give it only what the job needs, and keep a human check on anything that is permanent or goes outside.",
        "Privacy: whatever you paste or upload into an online chatbot is sent to the company that runs it, may be stored, and depending on the product and your settings may be used to improve future models. Before sharing personal data (names, phone numbers, student records) or confidential work files, check your organisation's rules and use only approved tools. Never share passwords.",
        "If your organisation offers an approved AI tool with data protection, use that one for work data, and still don't paste more than the task needs."
      ],
      words: [["Permission", "What the app allows an agent to do: read, write, send, delete, go online."], ["Human in the loop", "A person who approves important steps before the agent carries them out."]]
    },
    run: function (container, done) {
      var ui = BTA.ui, h = ui.h, w = BTA.w, D = window.BTA_DATA;
      var reqs = D.requests;
      var i = 0, right = 0;
      var sec = h("section", { class: "card stack" }, h("div", { class: "row" }, w.roleTag("human")));
      var box = h("div", { class: "stack" });
      sec.appendChild(box);
      container.appendChild(sec);

      function show() {
        var r = reqs[i];
        ui.clear(box);
        box.appendChild(h("div", { class: "row" },
          h("span", { class: "muted small", text: "Request " + (i + 1) + " of " + reqs.length }),
          h("span", { style: "flex:1" }),
          h("span", { class: "muted small", text: "Good calls: " + right })));
        box.appendChild(h("div", { class: "progress" }, h("i", { style: "width:" + (i / reqs.length) * 100 + "%" })));
        var card = h("div", { class: "card soft stack", tabindex: "-1", "data-focus": "" },
          h("b", { text: "The agent asks:" }),
          h("p", { style: "font-size:1.15rem;margin:0", text: "“May I " + r.act.charAt(0).toLowerCase() + r.act.slice(1) + "?”" }));
        box.appendChild(card);
        var fb = h("p", { class: "feedback", "aria-live": "polite" });
        var yes = h("button", { class: "btn", type: "button", text: "✓ Approve" });
        var no = h("button", { class: "btn", type: "button", text: "✗ Deny" });
        var next = h("button", { class: "btn primary hidden", type: "button", text: i + 1 < reqs.length ? "Next request" : "See results" });
        function answer(approve) {
          yes.disabled = true; no.disabled = true;
          var ok = approve === r.ok;
          if (ok) right++;
          (approve ? yes : no).classList.add(ok ? "on-good" : "on-bad");
          fb.className = "feedback " + (ok ? "good" : "bad");
          fb.textContent = (ok ? "✓ Good call. " : "✗ Think again. ") + r.why;
          next.classList.remove("hidden");
          next.focus();
        }
        yes.addEventListener("click", function () { if (!yes.disabled) answer(true); });
        no.addEventListener("click", function () { if (!no.disabled) answer(false); });
        next.addEventListener("click", function () {
          if (next.disabled) return;
          next.disabled = true;
          i++;
          if (i < reqs.length) show(); else finish();
        });
        box.appendChild(h("div", { class: "row" }, yes, no));
        box.appendChild(fb);
        box.appendChild(h("div", { class: "row end" }, next));
        if (i > 0) card.focus({ preventScroll: true });
      }
      show();

      function finish() {
        ui.clear(box);
        box.appendChild(h("h3", { text: "You made " + right + " good calls out of " + reqs.length + "." }));
        box.appendChild(ui.mcq({
          q: "You want an online chatbot to tidy up a spreadsheet of students' names, phone numbers and grades. What should you do first?",
          options: [
            "Upload it: the chatbot deletes files after answering",
            "Check whether your organisation allows that tool for personal data; if not, remove the personal columns or use an approved tool",
            "Paste it in pieces, so no single message contains everything"
          ],
          answer: 1,
          explain: "Anything you upload is sent to the company running the chatbot. Personal data needs an approved tool, or should be left out of what you share."
        }, function (k, ok) {
          box.appendChild(h("div", { class: "row end" }, w.onceBtn("Finish level", function () {
            var score = right + (ok ? 1 : 0);
            done({ stars: score >= 8 ? 3 : score >= 6 ? 2 : 1, points: right * 10 + (ok ? 20 : 0), summary: "Good calls: " + right + " of " + reqs.length + "." });
          })));
        }));
      }
    }
  });
})();
