import { run } from "./hs2js.mjs";
import { renderGraph } from "./graph.mjs";
import { parse } from "./parser.mjs";
import { initStrudel, isPattern } from "@strudel/web";
initStrudel({
  prebake: () => samples("github:tidalcycles/dirt-samples"),
});

const graphContainer = document.getElementById("graph");

const textarea = document.getElementById("code");
if (window.location.hash) {
  textarea.value = atob(window.location.hash.slice(1));
} else {
  textarea.value = 'd1 $ s "hh(3,8)"';
}
textarea.addEventListener("input", (e) => {
  window.location.hash = btoa(e.target.value);
  update();
});
update();

async function update() {
  let result;
  try {
    const tree = await parse(textarea.value);
    renderGraph(tree, graphContainer);
    console.log("tree", tree);
    result = run(tree.rootNode, window);
    if (isPattern(result)) {
      result = JSON.stringify(result.firstCycleValues)
    }
    console.log("result", result);
  } catch (err) {
    console.error(err);
    result = "ERROR: " + err.message;
  }
  document.getElementById("result").innerHTML = "Result: " + result;
}
