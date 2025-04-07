export interface Cell {
  id: string;
  cellType: string;
  source: string; // written code
  output?: string; // compiled code
  logs?: string[]; // console.log
}

export interface KernelSpec {
  language: string;
  name: string;
}

export interface Metadata {
  kernelSpec: KernelSpec;
}

export interface Notebook {
  id: string;
  title: string;
  metadata: Metadata;
  cells: Cell[];
}
