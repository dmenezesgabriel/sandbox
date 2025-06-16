interface Declaration {
  code: string;
  type: "FunctionDeclaration" | "VariableDeclaration" | "ClassDeclaration";
  name: string | string[];
  kind: "var" | "let" | "const" | undefined;
}

interface AssignmentStrategy {
  requiresBlockScope: boolean;
  generate: (declaration: Declaration) => string[];
}

function createVariableBindingStatements(declaration: Declaration): string[] {
  if (!Array.isArray(declaration.name)) {
    return [
      `${declaration.code}\nwindow.${declaration.name} = ${declaration.name};`,
    ];
  }
  const assignments = declaration.name
    .map((name) => `window.${name} = ${name};`)
    .join("\n");
  return [`${declaration.code}\n${assignments}`];
}

class VarAssignmentStrategy implements AssignmentStrategy {
  requiresBlockScope = false;
  generate(declaration: Declaration): string[] {
    return createVariableBindingStatements(declaration);
  }
}

class LetAssignmentStrategy implements AssignmentStrategy {
  requiresBlockScope = true;
  generate(declaration: Declaration): string[] {
    return createVariableBindingStatements(declaration);
  }
}

class ConstAssignmentStrategy implements AssignmentStrategy {
  requiresBlockScope = true;
  generate(declaration: Declaration): string[] {
    return createVariableBindingStatements(declaration);
  }
}

class FunctionAssignmentStrategy implements AssignmentStrategy {
  requiresBlockScope = false;
  generate(declaration: Declaration): string[] {
    return [`window.${declaration.name} = ${declaration.name};`];
  }
}

class ClassAssignmentStrategy implements AssignmentStrategy {
  requiresBlockScope = true;
  generate(declaration: Declaration): string[] {
    return [
      `${declaration.code}\nwindow.${declaration.name} = ${declaration.name};`,
    ];
  }
}

const assignmentStrategies: Record<string, AssignmentStrategy> = {
  var: new VarAssignmentStrategy(),
  let: new LetAssignmentStrategy(),
  const: new ConstAssignmentStrategy(),
  FunctionDeclaration: new FunctionAssignmentStrategy(),
  ClassDeclaration: new ClassAssignmentStrategy(),
};

export class Module {
  declarations: Record<string, Declaration[]> = {};
  statements: Record<string, string[]> = {};

  constructor() {}

  addDeclaration(cellId: string, declaration: Declaration) {
    if (!this.declarations[cellId]) {
      this.declarations[cellId] = [];
    }

    const declarationNames = Array.isArray(declaration.name)
      ? declaration.name
      : [declaration.name];

    const existingIndex = this.declarations[cellId].findIndex((existing) => {
      const existingNames = Array.isArray(existing.name)
        ? existing.name
        : [existing.name];

      return declarationNames.some((name) => existingNames.includes(name));
    });

    if (existingIndex !== -1) {
      this.declarations[cellId][existingIndex] = declaration;
    } else {
      this.declarations[cellId].push(declaration);
    }
  }

  addStatements(cellId: string, statements: { code: string }[]) {
    if (!this.statements[cellId]) {
      this.statements[cellId] = [];
    }

    this.statements[cellId] = statements.map((statement) => statement.code);
  }

  private getAssignmentStrategy(declaration: Declaration): AssignmentStrategy {
    if (declaration.type !== "VariableDeclaration") {
      return assignmentStrategies[declaration.type];
    }
    if (declaration.kind === undefined) {
      return assignmentStrategies["var"];
    }
    return assignmentStrategies[declaration.kind];
  }

  private generateDeclarationBlock(declaration: Declaration): string {
    const strategy = this.getAssignmentStrategy(declaration);
    if (strategy.requiresBlockScope) {
      return strategy.generate(declaration).join("\n");
    }
    return `${declaration.code}\n${strategy.generate(declaration).join("\n")}`;
  }

  generateModuleCode(currentCellId: string): string {
    const declarationBlocks = Object.entries(this.declarations).flatMap(
      ([, declarations]) =>
        declarations.map((declaration) =>
          this.generateDeclarationBlock(declaration)
        )
    );

    console.log(declarationBlocks);

    const statementBlocks = Object.entries(this.statements)
      .filter(([cellId]) => cellId === currentCellId)
      .flatMap(([, statements]) => statements);

    console.log(statementBlocks);

    const moduleCode = `(
      async function() {
        ${declarationBlocks.join("\n\n")}
        ${statementBlocks.join("\n\n")}
      }
    )();`;
    console.log(moduleCode);

    return moduleCode;
  }
}
