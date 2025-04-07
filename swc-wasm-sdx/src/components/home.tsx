import { useEffect } from "react";
import { Notebook } from "../components/notebook";
import { useNotebooks } from "../contexts/notebooks-context";

export function Home() {
  const { notebooks, addNotebook } = useNotebooks();

  const notebook = {
    id: "notebook-1",
    title: "My Notebook",
    cells: [
      {
        id: "cell-1",
        cellType: "code",
        source: `function add(a: number, b: number) {
    return a + b;
}

add(1, 2);

const div = document.createElement("div");
document.body.appendChild(div);

div.innerHTML = "Hello, world!" + add(1, 2)

for (let i = 0; i < 10; i++) {
    console.log(i);
}

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
  };

  useEffect(() => {
    addNotebook(notebook);
  }, []);

  return (
    <div>
      {notebooks.length > 0 ? (
        <Notebook notebook={notebooks[0]} />
      ) : (
        <div>No Notebooks</div>
      )}
      {JSON.stringify(notebooks, null, 2)}
    </div>
  );
}
