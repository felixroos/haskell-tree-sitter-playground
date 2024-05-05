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

export function run(node, scope) {
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

export async function evaluate(haskellCode, scope = globalThis) {
  const ast = await parse(haskellCode);
  return run(ast, scope);
}
