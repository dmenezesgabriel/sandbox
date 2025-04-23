import { Module } from "./module";

export class Runtime {
  public module: Module;

  constructor() {
    this.module = new Module();
  }
}
