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

function runInfix(infixNode, scope) {
  const [a, op, b] = infixNode.children;
  const [left, right] = [run(a, scope), run(b, scope)];
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

function run(node, scope) {
  let runInScope = (node, scp = scope) => run(node, scp);
  //console.log("node", node.type, node.text);
  switch (node.type) {
    case "declarations":
      let result;
      node.children.forEach((declaration) => {
        result = runInScope(declaration);
      });
      return result;
    case "integer":
      return Number(node.text);
    case "string":
      return String(node.text);
    case "function":
      const [fvariable, fpatterns, fbody] = node.children;
      function curry(patterns, body, scope) {
        const [variable, ...rest] = patterns;
        return (arg) => {
          let _scope = { ...scope, [variable.text]: arg };
          if (patterns.length === 1) {
            const result = runInScope(body, _scope);
            return result;
          }
          return curry(rest, body, _scope);
        };
      }
      scope[fvariable.text] = curry(fpatterns.children, fbody, scope);
      return scope[fvariable.text];
    case "match":
      if (node.children[0].text !== "=" || node.children.length !== 2) {
        throw new Error("match node so far only support simple assignments");
      }
      return runInScope(node.children[1]);
    case "bind":
      if (node.children.length !== 2)
        throw new Error("expected 2 children for node type bind");
      if (node.children[0].type !== "variable")
        throw new Error("expected variable as first child of bind node");
      if (node.children[1].type !== "match")
        throw new Error("expected match as first child of bind node");
      const [bvariable, bmatch] = node.children;
      const value = runInScope(bmatch);
      scope[bvariable.text] = value;
      return value;
    case "variable":
      return scope[node.text];
    case "infix":
      return runInfix(node, scope);
    case "apply":
      if (node.children.length !== 2)
        throw new Error("expected 2 children for node type apply");
      const [fn, arg] = node.children.map((child) => runInScope(child));
      // only works if fn is curried!
      return fn(arg);
    case "parens":
      if (node.children.length !== 3)
        throw new Error("expected 3 children for node type parens");
      return runInScope(node.children[1]);
    default:
      if (node.children.length === 0) {
        throw new Error("unhandled leaf type " + node.type);
      }
      if (node.children.length > 1) {
        throw new Error("unhandled branch type " + node.type);
      }
      return runInScope(node.children[0]);
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
    result = run(tree.rootNode, {});
  } catch (err) {
    console.error(err);
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
