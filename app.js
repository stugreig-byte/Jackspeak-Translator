(function () {
  "use strict";

  const phraseRules = [
    [/(please )?call (him|her|them|me|us)/gi, "get $2 on the blower"],
    [/go to bed/gi, "turn in to your pit"],
    [/go to sleep/gi, "turn in"],
    [/have a look/gi, "have a shufti"],
    [/very good/gi, "tiddly"],
    [/well done/gi, "BZ"],
    [/right away/gi, "at the rush"],
    [/as soon as possible/gi, "at the rush"],
    [/understand/gi, "twig"],
    [/do you understand/gi, "d'you twig"],
    [/I understand/gi, "I twig"],
    [/goodbye/gi, "see you in the offing"],
    [/go ashore/gi, "step ashore"],
    [/get ready/gi, "square yourself away"],
    [/tidy up/gi, "square away"],
    [/hurry up/gi, "get a wiggle on"],
    [/wait a moment/gi, "stand by"],
    [/be quiet/gi, "pipe down"],
    [/stop complaining/gi, "stop dripping"],
    [/complaining/gi, "dripping"],
    [/a lot of/gi, "a shed-load of"]
  ];

  const wordRules = [
    [/telephone/gi, "blower"], [/phone/gi, "blower"],
    [/paperwork/gi, "bumph"], [/documents/gi, "bumph"],
    [/food/gi, "scran"], [/meal/gi, "scran"], [/dinner/gi, "scran"],
    [/bed/gi, "pit"], [/friends?/gi, "oppos"], [/friend/gi, "oppo"],
    [/captain/gi, "skipper"], [/navy/gi, "Andrew"],
    [/beard/gi, "fungus farm"], [/tea/gi, "wet"],
    [/coffee/gi, "kai"], [/toilet/gi, "heads"], [/bathroom/gi, "heads"],
    [/clothes/gi, "rig"], [/uniform/gi, "rig"],
    [/work/gi, "toil"], [/job/gi, "number"],
    [/excellent/gi, "tiddly"], [/good/gi, "smart"],
    [/broken/gi, "duff"], [/useless/gi, "gash"],
    [/person/gi, "hand"], [/people/gi, "hands"]
  ];

  function preserveInitialCase(original, replacement) {
    return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
  }

  function applyRules(text, rules) {
    return rules.reduce((result, rule) => result.replace(rule[0], function (match) {
      const args = Array.prototype.slice.call(arguments);
      let replacement = rule[1];
      replacement = replacement.replace(/\$(\d+)/g, function (_, n) { return args[Number(n)] || ""; });
      return preserveInitialCase(match, replacement);
    }), text);
  }

  function translate(text, mode) {
    let result = text.trim().replace(/\s+/g, " ");
    result = applyRules(result, phraseRules);
    result = applyRules(result, wordRules);

    if (mode === "medium") {
      result = "Right, " + result.replace(/[.!?]+$/, "") + ", oppo.";
    } else if (mode === "heavy") {
      result = "Right then, shipmate—" + result.replace(/[.!?]+$/, "") + ". Get that squared away at the rush, aye?";
    }
    return result;
  }

  function ready() {
    const input = document.getElementById("inputText");
    const output = document.getElementById("outputText");
    const mode = document.getElementById("mode");
    const status = document.getElementById("status");
    const translateBtn = document.getElementById("translateBtn");
    const clearBtn = document.getElementById("clearBtn");
    const copyBtn = document.getElementById("copyBtn");

    translateBtn.addEventListener("click", function () {
      if (!input.value.trim()) {
        output.textContent = "Your translation will appear here.";
        status.textContent = "Enter some text first, shipmate.";
        input.focus();
        return;
      }
      output.textContent = translate(input.value, mode.value);
      status.textContent = "Translation complete.";
      output.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      output.textContent = "Your translation will appear here.";
      status.textContent = "Cleared.";
      input.focus();
    });

    copyBtn.addEventListener("click", async function () {
      const text = output.textContent;
      if (!text || text === "Your translation will appear here.") {
        status.textContent = "Nothing to copy yet.";
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = "Copied to the clipboard.";
      } catch (_) {
        const range = document.createRange();
        range.selectNodeContents(output);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = "Text selected—tap Copy in the iPhone menu.";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
