import { transformSync } from "@swc/wasm-web";
import { parse } from "acorn";

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
    // .filter(
    //   (node) =>
    //     node.type === "VariableDeclaration" ||
    //     node.type === "FunctionDeclaration" ||
    //     node.type === "ClassDeclaration"
    // )
    .map((node) => {
      return { code: result.code.slice(node.start, node.end), type: node.type };
    });

  return {
    code: result.code,
    declarations,
  };
}
