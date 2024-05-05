import Parser from "web-tree-sitter";
import toDot from "jgf-dot";
import { Graphviz } from "@hpcc-js/wasm";

const base = import.meta.env.BASE_URL;

const graphvizLoaded = Graphviz.load();
const parserLoaded = loadParser();
const graphContainer = document.getElementById("graph");

const textarea = document.getElementById("code");
if (window.location.hash) {
  textarea.value = atob(window.location.hash.slice(1));
} else {
  textarea.value = 'd1 $ s "hh(3,8)"';
}
textarea.addEventListener("input", (e) => {
  window.location.hash = btoa(e.target.value);
  renderGraph(e.target.value, graphContainer);
});
renderGraph(textarea.value, graphContainer);

function walk(node, branch = [0], parent) {
  let nodes = [];
  let edges = [];
  const current = { id: branch.join("-"), label: node.type };
  nodes.push(current);
  parent && edges.push({ source: parent.id, target: current.id });
  if (node.children.length) {
    node.children.forEach((child, j) => {
      const { nodes: childNodes, edges: childEdges } = walk(
        child,
        branch.concat([j]),
        current
      );
      nodes = nodes.concat(childNodes || []);
      edges = edges.concat(childEdges || []);
    });
  }
  return { nodes, edges };
}

function runInfix(infixNode) {
  const [a, op, b] = infixNode.children;
  const [left, right] = [run(a), run(b)];
  switch (op.text) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    default:
      throw new Error("unexpected infix operator " + op.text);
  }
}

// just some functions for testing apply
window.add = (a) => (b) => a + b;
window.mul = (a) => (b) => a * b;

function run(node) {
  console.log("node", node.type, node.text);
  switch (node.type) {
    case "declarations":
      let result;
      node.children.forEach((top_splice) => {
        result = run(top_splice);
      });
      return result;
    case "integer":
      return Number(node.text);
    case "string":
      return String(node.text);
    case "variable":
      console.log("variable", node.text, ":", globalThis[node.text]);
      return globalThis[node.text];
    case "infix":
      return runInfix(node);
    case "apply":
      if (node.children.length !== 2)
        throw new Error("expected 2 children for node type apply");
      const [fn, arg] = node.children.map(run);
      // only works if fn is curried!
      return fn(arg);
    case "parens":
      if (node.children.length !== 3)
        throw new Error("expected 3 children for node type parens");
      return run(node.children[1]);
    default:
      if (node.children.length === 0) {
        throw new Error("unhandled leaf type " + node.type);
      }
      if (node.children.length > 1) {
        throw new Error("unhandled branch type " + node.type);
      }
      return run(node.children[0]);
  }
}

async function renderGraph(code, container) {
  const parser = await parserLoaded;
  const tree = parser.parse(code);
  const { nodes, edges } = walk(tree.rootNode);
  const graphviz = await graphvizLoaded;
  const dot = toDot({
    graph: {
      nodes,
      edges,
    },
  });
  const svg = await graphviz.layout(dot, "svg", "dot");
  container.innerHTML = svg;
  let result;
  try {
    result = run(tree.rootNode);
  } catch (err) {
    result = "ERROR: " + err.message;
  }
  document.getElementById("result").innerHTML = "Result: " + result;
}

async function loadParser() {
  await Parser.init({
    locateFile(scriptName, scriptDirectory) {
      return `${base}${scriptName}`;
    },
  });
  const parser = new Parser();
  const Lang = await Parser.Language.load(`${base}tree-sitter-haskell.wasm`);
  parser.setLanguage(Lang);
  return parser;
}
