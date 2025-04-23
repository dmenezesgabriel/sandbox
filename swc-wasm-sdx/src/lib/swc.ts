import { transformSync } from "@swc/wasm-web";
import { parse } from "acorn";
import type { Node } from "acorn";

function getVariableDeclarationName(node: Node) {
  return node.declarations[0].id.name;
}

function getFunctionDeclarationName(node: Node) {
  return node.id.name;
}

function getClassDeclarationName(node: Node) {
  return node.id.name;
}

const getDeclarationName = {
  VariableDeclaration: getVariableDeclarationName,
  FunctionDeclaration: getFunctionDeclarationName,
  ClassDeclaration: getClassDeclarationName,
};

export function compile(code: string) {
  const result = transformSync(code, {
    isModule: true,
    jsc: {
      target: "es2018",
      parser: {
        syntax: "typescript",
        tsx: true,
      },
      transform: {
        decoratorMetadata: true,
        legacyDecorator: true,
      },
    },
  });

  const ast = parse(result.code, {
    ecmaVersion: 2018,
    sourceType: "module",
    locations: true,
  });

  const declarations = ast.body
    .filter(
      (node) =>
        node.type === "VariableDeclaration" ||
        node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration"
    )
    .map((node) => {
      const code = result.code.slice(node.start, node.end);

      return {
        code,
        type: node.type,
        name: getDeclarationName[node.type](node),
        kind: node.type === "VariableDeclaration" ? node.kind : undefined,
      };
    });

  return {
    code: result.code,
    declarations,
  };
}
