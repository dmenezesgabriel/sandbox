export { URL, URLSearchParams }

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

export default { URL, URLSearchParams, parse, format }
