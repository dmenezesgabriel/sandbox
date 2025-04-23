interface WindowWithEval extends Window {
  eval: (code: string) => unknown;
}

export class Module {
  declarations: string[] = [];

  constructor() {}

  addDeclaration(code: string) {
    this.declarations.push(code);
  }

  assignObjects(iframeWindow: Window) {
    this.declarations.forEach((code) => {
      (iframeWindow as WindowWithEval).eval(code);
    });
  }
}
