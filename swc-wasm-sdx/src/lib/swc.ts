import { transformSync } from "@swc/wasm-web";
import { parse } from "acorn";
import type { Program, VariableDeclarator, Pattern } from "acorn";

function extractIdentifiers(pattern: Pattern): string[] {
  if (pattern.type === "Identifier") {
    return [pattern.name];
  }
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.flatMap((prop: any) => {
      if (prop.type === "Property") {
        return extractIdentifiers(prop.value);
      }
      if (prop.type === "RestElement") {
        return extractIdentifiers(prop.argument);
      }
      return [];
    });
  }
  if (pattern.type === "ArrayPattern") {
    return pattern.elements.flatMap((el: any) =>
      el ? extractIdentifiers(el) : []
    );
  }
  if (pattern.type === "RestElement") {
    return extractIdentifiers(pattern.argument);
  }
  return [];
}

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
  }) as Program;

  const declarations: Array<{
    code: string;
    type: "FunctionDeclaration" | "VariableDeclaration" | "ClassDeclaration";
    name: string | string[];
    kind: "var" | "let" | "const" | undefined;
  }> = [];

  for (const node of ast.body) {
    if (node.type === "VariableDeclaration") {
      const names = node.declarations.flatMap((decl: VariableDeclarator) =>
        extractIdentifiers(decl.id)
      );
      declarations.push({
        code: result.code.slice(node.start, node.end),
        type: node.type,
        name: names,
        kind: node.kind,
      });
    } else if (node.type === "FunctionDeclaration" && node.id) {
      declarations.push({
        code: result.code.slice(node.start, node.end),
        type: node.type,
        name: node.id.name,
        kind: undefined,
      });
    } else if (node.type === "ClassDeclaration" && node.id) {
      declarations.push({
        code: result.code.slice(node.start, node.end),
        type: node.type,
        name: node.id.name,
        kind: undefined,
      });
    }
  }

  return {
    code: result.code,
    declarations,
  };
}
