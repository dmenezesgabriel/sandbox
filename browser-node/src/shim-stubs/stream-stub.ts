export class Readable { pipe(dest: unknown) { return dest } }
export class Writable { write(_c: unknown) { return true } end() { return this } }
export class Transform extends Writable {}
export class PassThrough extends Transform {}
export default { Readable, Writable, Transform, PassThrough }
