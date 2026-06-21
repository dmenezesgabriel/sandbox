// Uses Web Crypto API available in Worker scope
export const crypto = {
  randomBytes: (size: number): Uint8Array => {
    const buf = new Uint8Array(size)
    self.crypto.getRandomValues(buf)
    return buf
  },

  randomUUID: (): string => self.crypto.randomUUID(),

  createHash: (algorithm: string) => {
    const chunks: Uint8Array[] = []
    return {
      update(data: string | Uint8Array) {
        chunks.push(typeof data === 'string' ? new TextEncoder().encode(data) : data)
        return this
      },
      async digest(encoding?: string): Promise<string | Uint8Array> {
        const merged = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0))
        let offset = 0
        for (const c of chunks) { merged.set(c, offset); offset += c.length }
        const alg = algorithm.replace('-', '').toUpperCase()
        const hashBuf = await self.crypto.subtle.digest(alg, merged)
        const bytes = new Uint8Array(hashBuf)
        if (encoding === 'hex') return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
        if (encoding === 'base64') return btoa(String.fromCharCode(...bytes))
        return bytes
      },
    }
  },

  createHmac: (_algorithm: string, _key: string | Uint8Array) => ({
    update(_data: string | Uint8Array) { return this },
    digest(_encoding?: string): string { return '' },
  }),

  pbkdf2Sync: (_password: string, _salt: string, _iterations: number, _keylen: number): Buffer => {
    throw new Error('pbkdf2Sync not supported — use pbkdf2 async variant')
  },
}
