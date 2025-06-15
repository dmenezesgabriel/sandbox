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

  generateModuleCode(compiledCode: string, currentCellId: string): string {
    console.log(this.declarations);
    const declarationBlocks = Object.entries(this.declarations)
      .filter(([cellId]) => cellId !== currentCellId)
      .flatMap(([, declarations]) =>
        declarations.map((declaration) =>
          this.generateDeclarationBlock(declaration)
        )
      );

    const moduleCode = `(
      async function() {
        ${declarationBlocks.join("\n\n")}
        ${compiledCode}
      }
    )();`;
    console.log(moduleCode);

    return moduleCode;
  }
}
