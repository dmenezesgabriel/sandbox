import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.yaml?raw') || specifier.endsWith('.yaml')) {
    return nextResolve(specifier.replace(/\?raw$/, ''), { ...context, conditions: ['import'] });
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  const urlStr = String(url);
  const pathname = urlStr.includes('?') ? urlStr.slice(0, urlStr.indexOf('?')) : urlStr;
  if (pathname.endsWith('.yaml')) {
    const text = readFileSync(fileURLToPath(pathname), 'utf8');
    return {
      format: 'module',
      source: `export default ${JSON.stringify(text)}`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
