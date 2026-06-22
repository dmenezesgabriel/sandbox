const _URL = URL
const _URLSearchParams = URLSearchParams
export { _URL as URL, _URLSearchParams as URLSearchParams }

export function parse(urlStr: string) {
  const u = new URL(urlStr)
  return {
    href: u.href,
    protocol: u.protocol,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    auth: u.username ? u.username + (u.password ? ':' + u.password : '') : null,
  }
}

export function format(urlObj: URL | string): string {
  return typeof urlObj === 'string' ? urlObj : urlObj.href
}

export function fileURLToPath(url: string | URL): string {
  const u = typeof url === 'string' ? new URL(url) : url
  if (u.protocol !== 'file:') throw new TypeError(`Not a file URL: ${u.href}`)
  return decodeURIComponent(u.pathname)
}

export function pathToFileURL(p: string): URL {
  const abs = p.startsWith('/') ? p : '/' + p
  return new URL('file://' + abs)
}

export default { URL: _URL, URLSearchParams: _URLSearchParams, parse, format, fileURLToPath, pathToFileURL }
