import { run } from "./hs2js.mjs";
import { renderGraph } from "./graph.mjs";
import { parse } from "./parser.mjs";
import { initStrudel, isPattern, reify } from "@strudel/web";
initStrudel({
  prebake: () => samples("github:tidalcycles/dirt-samples"),
});

const graphContainer = document.getElementById("graph");

const textarea = document.getElementById("code");
if (window.location.hash) {
  textarea.value = atob(window.location.hash.slice(1));
} else {
  textarea.value = 's "jvbass(3,8)"';
}
textarea.addEventListener("input", (e) => {
  window.location.hash = btoa(e.target.value);
  update();
});
update();

function getInfixOperators() {
  let operators = {
    ">": "set",
    "#": "set",
    "+": "add",
    "-": "sub",
    "*": "mul",
    "/": "div",
  };
  let alignments = {
    in: (s) => "|" + s,
    out: (s) => s + "|",
    mix: (s) => "|" + s + "|",
  };
  let ops = {};
  Object.entries(operators).forEach(([o, name]) => {
    // operator without alignment
    ops[o] = (l, r) => reify(l)[name](reify(r));
    Object.entries(alignments).forEach(([a, getSymbol]) => {
      // get symbol with alignment
      let symbol = getSymbol(o);
      ops[symbol] = (l, r) => reify(l)[name][a](reify(r));
    });
  });
  ops["~>"] = (l, r) => reify(l).late(reify(r));
  ops["<~"] = (l, r) => reify(l).early(reify(r));
  ops["<$>"] = (l, r) => reify(r).fmap(l).outerJoin(); // is this right?
  return ops;
}
const ops = getInfixOperators();

async function update() {
  let result, tree;
  try {
    tree = await parse(textarea.value);
  } catch (err) {
    console.warn("parse error");
    console.error(err);
  }
  console.log("parsed tree", tree);
  try {
    renderGraph(tree, graphContainer);
  } catch (err) {
    console.warn("could not render graph");
    console.error(err);
  }
  try {
    result = run(tree.rootNode, window, ops);
    if (isPattern(result)) {
      result.play();
      result = JSON.stringify(result.firstCycleValues);
    }
    console.log("result", result);
  } catch (err) {
    console.warn("eval error");
    console.error(err);
    result = "ERROR: " + err.message;
  }
  document.getElementById("result").innerHTML = "Result: " + result;
}
