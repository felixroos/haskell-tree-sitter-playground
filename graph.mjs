import { parse } from "./parser.mjs";
import { Graphviz } from "@hpcc-js/wasm";
import toDot from "jgf-dot";

const graphvizLoaded = Graphviz.load();

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

export async function renderGraph(tree, container) {
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
}
