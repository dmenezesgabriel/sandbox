---
id: notebook-1
title: My Notebook
kernel: typescript
---

This is a sample TS Notebook

```ts
function add(a: number, b: number) {
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

div.innerHTML = "Hello, world!" + add(1, 2);
```

```ts
console.log(add(1, 5));
console.dir(window);
const person = new Person("John", 30);
console.log(JSON.stringify(person));
console.log(x);
console.log(y);
```

```ts
const math = await import("https://cdn.jsdelivr.net/npm/mathjs@12.3.0/+esm");

const b: number = math.sqrt(16);
console.log(b);
```

```ts
const h: number = math.sqrt(16);
console.log(h);
```
