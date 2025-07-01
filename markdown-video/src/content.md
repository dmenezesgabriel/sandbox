# TypeScript Basics Tutorial

Welcome to this quick-start guide to TypeScript! Below you'll find examples that introduce key TypeScript features, syntax, and type safety benefits.

## 1. Hello World

```ts
const greet = (name: string): string => {
  return `Hello, ${name}!`;
};

console.log(greet("TypeScript"));
```

## 2. Type Annotations

```ts
let age: number = 30;
let username: string = "ts_user";
let isLoggedIn: boolean = true;
```

## 3. Arrays and Tuples

```ts
let numbers: number[] = [1, 2, 3];
let mixed: [string, number] = ["Score", 42];
```

## 4. Interfaces

```ts
interface User {
  id: number;
  name: string;
  isActive: boolean;
}

const user: User = {
  id: 1,
  name: "Alice",
  isActive: true,
};
```

## 5. Type Aliases & Unions

```ts
type ID = string | number;

function printId(id: ID): void {
  console.log(`Your ID is: ${id}`);
}

printId(101);
printId("abc123");
```

## 6. Enums

```ts
enum Status {
  Pending,
  InProgress,
  Completed,
}

let taskStatus: Status = Status.InProgress;
console.log(taskStatus); // 1
```

## 7. Functions with Optional & Default Params

```ts
function multiply(a: number, b: number = 2): number {
  return a * b;
}

console.log(multiply(5)); // 10
```

## 8. Classes

```ts
class Animal {
  constructor(public name: string) {}

  speak(): void {
    console.log(`${this.name} makes a sound.`);
  }
}

const dog = new Animal("Dog");
dog.speak();
```

## 9. Generics

```ts
function identity<T>(value: T): T {
  return value;
}

console.log(identity<string>("hello"));
console.log(identity<number>(42));
```

## 10. TypeScript + DOM

```ts
const button = document.querySelector("button");

button?.addEventListener("click", () => {
  alert("Button clicked!");
});
```

## Next Steps

- Learn advanced types (e.g., `Record`, `Partial`, `Pick`)
- Explore utility types and mapped types
- Dive into TypeScript + React or Node.js projects

Happy coding! 🚀
