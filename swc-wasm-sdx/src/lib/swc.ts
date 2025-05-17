import { transformSync } from "@swc/wasm-web";
import { parse } from "acorn";
import type {
  Program,
  VariableDeclarator,
  Pattern,
  Identifier,
  ObjectPattern,
  ArrayPattern,
  RestElement,
  Property,
  Node,
  VariableDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
} from "acorn";

interface PatternIdentifierExtractor {
  extractIdentifiersFromPattern(pattern: Pattern): string[];
}

class IdentifierPatternExtractor implements PatternIdentifierExtractor {
  extractIdentifiersFromPattern(pattern: Pattern): string[] {
    if (pattern.type === "Identifier") {
      return [(pattern as Identifier).name];
    }
    return [];
  }
}

class ObjectPatternIdentifierExtractor implements PatternIdentifierExtractor {
  extractIdentifiersFromPattern(pattern: Pattern): string[] {
    if (pattern.type !== "ObjectPattern") return [];
    return (pattern as ObjectPattern).properties.flatMap((property) => {
      if (property.type === "Property") {
        return extractIdentifiersFromPattern(
          (property as Property).value as Pattern
        );
      }
      if (property.type === "RestElement") {
        return extractIdentifiersFromPattern(
          (property as RestElement).argument as Pattern
        );
      }
      return [];
    });
  }
}

class ArrayPatternIdentifierExtractor implements PatternIdentifierExtractor {
  extractIdentifiersFromPattern(pattern: Pattern): string[] {
    if (pattern.type !== "ArrayPattern") return [];
    return (pattern as ArrayPattern).elements.flatMap((element) =>
      element ? extractIdentifiersFromPattern(element as Pattern) : []
    );
  }
}

class RestElementPatternExtractor implements PatternIdentifierExtractor {
  extractIdentifiersFromPattern(pattern: Pattern): string[] {
    if (pattern.type !== "RestElement") return [];
    return extractIdentifiersFromPattern(
      (pattern as RestElement).argument as Pattern
    );
  }
}

class FallbackPatternIdentifierExtractor implements PatternIdentifierExtractor {
  extractIdentifiersFromPattern(): string[] {
    return [];
  }
}

const patternIdentifierExtractors: Record<string, PatternIdentifierExtractor> =
  {
    Identifier: new IdentifierPatternExtractor(),
    ObjectPattern: new ObjectPatternIdentifierExtractor(),
    ArrayPattern: new ArrayPatternIdentifierExtractor(),
    RestElement: new RestElementPatternExtractor(),
  };

function extractIdentifiersFromPattern(pattern: Pattern): string[] {
  const extractor =
    patternIdentifierExtractors[pattern.type] ||
    new FallbackPatternIdentifierExtractor();
  return extractor.extractIdentifiersFromPattern(pattern);
}

function transpileSourceCodeWithSwc(sourceCode: string): string {
  return transformSync(sourceCode, {
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
  }).code;
}

function parseSourceCodeToAst(sourceCode: string): Program {
  return parse(sourceCode, {
    ecmaVersion: 2018,
    sourceType: "module",
    locations: true,
  }) as Program;
}

interface SourceDeclarationInfo {
  code: string;
  type: "FunctionDeclaration" | "VariableDeclaration" | "ClassDeclaration";
  name: string | string[];
  kind: "var" | "let" | "const" | undefined;
}

interface SourceDeclarationExtractor {
  canExtractDeclaration(node: Node): boolean;
  extractDeclaration(node: Node, code: string): SourceDeclarationInfo | null;
}

class VariableDeclarationExtractor implements SourceDeclarationExtractor {
  canExtractDeclaration(node: Node): boolean {
    return node.type === "VariableDeclaration";
  }
  extractDeclaration(node: Node, code: string): SourceDeclarationInfo {
    const variableDeclarationNode = node as VariableDeclaration;
    const variableNames = variableDeclarationNode.declarations.flatMap(
      (declarator: VariableDeclarator) =>
        extractIdentifiersFromPattern(declarator.id)
    );
    return {
      code: code.slice(
        variableDeclarationNode.start,
        variableDeclarationNode.end
      ),
      type: variableDeclarationNode.type,
      name: variableNames,
      kind: variableDeclarationNode.kind,
    };
  }
}

class FunctionDeclarationExtractor implements SourceDeclarationExtractor {
  canExtractDeclaration(node: Node): boolean {
    return (
      node.type === "FunctionDeclaration" && !!(node as FunctionDeclaration).id
    );
  }
  extractDeclaration(node: Node, code: string): SourceDeclarationInfo | null {
    const functionDeclarationNode = node as FunctionDeclaration;
    if (!functionDeclarationNode.id) return null;
    return {
      code: code.slice(
        functionDeclarationNode.start,
        functionDeclarationNode.end
      ),
      type: functionDeclarationNode.type,
      name: functionDeclarationNode.id.name,
      kind: undefined,
    };
  }
}

class ClassDeclarationExtractor implements SourceDeclarationExtractor {
  canExtractDeclaration(node: Node): boolean {
    return node.type === "ClassDeclaration" && !!(node as ClassDeclaration).id;
  }
  extractDeclaration(node: Node, code: string): SourceDeclarationInfo | null {
    const classDeclarationNode = node as ClassDeclaration;
    if (!classDeclarationNode.id) return null;
    return {
      code: code.slice(classDeclarationNode.start, classDeclarationNode.end),
      type: classDeclarationNode.type,
      name: classDeclarationNode.id.name,
      kind: undefined,
    };
  }
}

class SourceDeclarationExtractionService {
  private declarationExtractors: SourceDeclarationExtractor[] = [
    new VariableDeclarationExtractor(),
    new FunctionDeclarationExtractor(),
    new ClassDeclarationExtractor(),
  ];

  extractAllTopLevelDeclarations(
    ast: Program,
    code: string
  ): SourceDeclarationInfo[] {
    const topLevelDeclarations: SourceDeclarationInfo[] = [];
    for (const node of ast.body) {
      const extractor = this.declarationExtractors.find(
        (declarationExtractor) =>
          declarationExtractor.canExtractDeclaration(node)
      );
      if (!extractor) continue;
      const declaration = extractor.extractDeclaration(node, code);
      if (!declaration) continue;
      topLevelDeclarations.push(declaration);
    }
    return topLevelDeclarations;
  }
}

export function compile(sourceCode: string) {
  const transpiledCode = transpileSourceCodeWithSwc(sourceCode);
  const ast = parseSourceCodeToAst(transpiledCode);
  const declarationExtractionService = new SourceDeclarationExtractionService();
  const declarations =
    declarationExtractionService.extractAllTopLevelDeclarations(
      ast,
      transpiledCode
    );
  return {
    code: transpiledCode,
    declarations,
  };
}
