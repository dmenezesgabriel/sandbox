export { URL, URLSearchParams }
export const parse = (u: string) => new URL(u)
export const format = (u: URL | string) => String(u)
export const resolve = (base: string, rel: string) => new URL(rel, base).toString()
export default { URL, URLSearchParams, parse, format, resolve }
