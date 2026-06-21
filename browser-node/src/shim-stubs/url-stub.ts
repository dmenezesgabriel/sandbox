const _URL = globalThis.URL
const _URLSearchParams = globalThis.URLSearchParams
export { _URL as URL, _URLSearchParams as URLSearchParams }
export const parse = (u: string) => new _URL(u)
export const format = (u: URL | string) => String(u)
export const resolve = (base: string, rel: string) => new _URL(rel, base).toString()
export default { URL: _URL, URLSearchParams: _URLSearchParams, parse, format, resolve }
