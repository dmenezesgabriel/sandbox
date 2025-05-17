interface WindowWithEval extends Window {
  eval: (code: string) => unknown;
}

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
  declarations: Declaration[] = [];

  constructor() {}

  addDeclaration(declaration: Declaration) {
    this.declarations.push(declaration);
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

  private evaluateWithBlockScope(
    declaration: Declaration,
    strategy: AssignmentStrategy,
    iframeWindow: Window
  ) {
    (iframeWindow as WindowWithEval).eval(
      `(function() {\n${strategy.generate(declaration).join("\n")}\n})();`
    );
  }

  private evaluateInGlobalScope(
    declaration: Declaration,
    strategy: AssignmentStrategy,
    iframeWindow: Window
  ) {
    (iframeWindow as WindowWithEval).eval(declaration.code);
    strategy.generate(declaration).forEach((assignment) => {
      (iframeWindow as WindowWithEval).eval(assignment);
    });
  }

  assignObjects(iframeWindow: Window) {
    this.declarations.forEach((declaration) => {
      const strategy = this.getAssignmentStrategy(declaration);
      if (strategy.requiresBlockScope) {
        this.evaluateWithBlockScope(declaration, strategy, iframeWindow);
        return;
      }
      this.evaluateInGlobalScope(declaration, strategy, iframeWindow);
    });
  }
}
