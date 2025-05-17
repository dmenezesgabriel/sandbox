import { useEffect, useMemo } from "react";
import { Notebook } from "../components/notebook";
import { useNotebooks } from "../contexts/notebooks-context";

export function Home() {
  const { notebooks, addNotebook } = useNotebooks();

  const notebook = useMemo(
    () => ({
      id: "notebook-1",
      title: "My Notebook",
      cells: [
        {
          id: "cell-1",
          cellType: "code",
          source: `function add(a: number, b:
           number) {
    return a + b;
}

const x = 1;
let y = 19;

class Person {
    name: string;
    age: number;
    constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
    }
}

add(1, 2);

for (let step = 0; step < 5; step++) {
  // Runs 5 times, with values of step 0 through 4.
  console.log("Walking east one step");
}

const div = document.createElement("div");
document.body.appendChild(div);

div.innerHTML = "Hello, world!" + add(1, 2)

`,
          type: "code",
        },
        {
          id: "cell-2",
          cellType: "code",
          source: `console.log(add(1, 5));
console.dir(window);
const person = new Person("John", 30);
console.log(person);
console.log(x);
console.log(y);


`,
          type: "code",
        },
      ],
      metadata: {
        kernelSpec: {
          language: "typescript",
          name: "typescript",
        },
      },
    }),
    []
  );

  useEffect(() => {
    addNotebook(notebook);
  }, [addNotebook, notebook]);

  return (
    <div>
      {notebooks.length > 0 ? (
        <Notebook notebook={notebooks[0]} />
      ) : (
        <div>No Notebooks</div>
      )}
    </div>
  );
}
