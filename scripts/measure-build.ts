import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const html = readFileSync(resolve('dist/index.html'), 'utf8');
const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1]))];
if (!assets.length) throw new Error('No initial assets found; run npm run build first');
const measurements = assets.map(url => {
  const path = resolve('dist', `.${url}`);
  if (!path.startsWith(`${resolve('dist/assets')}${sep}`)) throw new Error('Unexpected asset path');
  const data = readFileSync(path);
  return { file: url, bytes: data.length, gzipBytes: gzipSync(data).length };
});
console.log(JSON.stringify(measurements, null, 2));
