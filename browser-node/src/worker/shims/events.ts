export class EventEmitter {
  private _events: Map<string, ((...args: unknown[]) => void)[]> = new Map()

  on(event: string, listener: (...args: unknown[]) => void): this {
    const arr = this._events.get(event) ?? []
    arr.push(listener)
    this._events.set(event, arr)
    return this
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    const wrapper = (...args: unknown[]) => { this.off(event, wrapper); listener(...args) }
    return this.on(event, wrapper)
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    const arr = this._events.get(event)
    if (arr) this._events.set(event, arr.filter(l => l !== listener))
    return this
  }

  removeAllListeners(event?: string): this {
    if (event) this._events.delete(event)
    else this._events.clear()
    return this
  }

  emit(event: string, ...args: unknown[]): boolean {
    const arr = this._events.get(event)
    if (!arr?.length) return false
    for (const fn of [...arr]) fn(...args)
    return true
  }

  listeners(event: string): ((...args: unknown[]) => void)[] {
    return [...(this._events.get(event) ?? [])]
  }

  listenerCount(event: string): number {
    return this._events.get(event)?.length ?? 0
  }

  addListener = this.on
  removeListener = this.off
}
