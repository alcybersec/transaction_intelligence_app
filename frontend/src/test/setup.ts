import '@testing-library/jest-dom'

// Polyfill localStorage / sessionStorage for jsdom under Node >= 22.
// Node now ships an experimental `localStorage` global that is `undefined`
// unless --localstorage-file is provided, which shadows jsdom's implementation.
// See https://github.com/jsdom/jsdom/issues/3492 for details.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window
  if (!w[name]) {
    const instance = new MemoryStorage()
    Object.defineProperty(globalThis, name, { value: instance, configurable: true, writable: true })
    if (win && !win[name]) {
      Object.defineProperty(win, name, { value: instance, configurable: true, writable: true })
    }
  }
}

ensureStorage('localStorage')
ensureStorage('sessionStorage')
