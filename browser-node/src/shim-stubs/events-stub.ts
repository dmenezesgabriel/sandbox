export class EventEmitter {
  private _e: Map<string, ((...a: unknown[]) => void)[]> = new Map()
  on(ev: string, fn: (...a: unknown[]) => void) { const a = this._e.get(ev) ?? []; a.push(fn); this._e.set(ev, a); return this }
  off(ev: string, fn: (...a: unknown[]) => void) { this._e.set(ev, (this._e.get(ev) ?? []).filter(f => f !== fn)); return this }
  emit(ev: string, ...args: unknown[]) { (this._e.get(ev) ?? []).forEach(f => f(...args)); return this._e.has(ev) }
  once(ev: string, fn: (...a: unknown[]) => void) { const w = (...a: unknown[]) => { this.off(ev, w); fn(...a) }; return this.on(ev, w) }
  removeAllListeners(ev?: string) { ev ? this._e.delete(ev) : this._e.clear(); return this }
  addListener = this.on; removeListener = this.off
}
export default { EventEmitter }
