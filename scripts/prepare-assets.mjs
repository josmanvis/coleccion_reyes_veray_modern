/** Run from the repository root. Assets and downloads stay in ignored scratch. */
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { resolve, dirname, extname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { canonicalPath, variantPath } from './asset-paths.mjs';
const require = createRequire(resolve('frontend/package.json'));
const sharp = require('sharp');
sharp.concurrency(1);
const archive = resolve(process.env.ORC_ARCHIVE || '/Users/admin/Developer/coleccion_reyes_veray_modern/coleccionreyesveray.com');
const scratch = resolve('.superpowers/orc');
const output = resolve(scratch, 'assets/v1');
const widths = [320,640,960,1600];
const catalog = JSON.parse(await readFile('frontend/src/data/artworks.json','utf8'));
const extra = JSON.parse(await readFile(resolve(scratch,'live-image-refs.json'),'utf8').catch(()=> '[]'));
const refs = [...new Set([...catalog.flatMap(a=>a.images || []), ...extra])];
const assetPath = input => canonicalPath(input.startsWith("../wp-content/uploads/") ? input.slice(2) : input);
const exists = async p => { try { await access(p); return true; } catch { return false; } };
const manifest = { version:'v1', bucket:'gravy-meta-orc-web', widths, paths:{}, aliases:{}, missing:[], recovered:[], files:[] };
let cursor=0, done=0;
const unique = [...new Set(refs.map(assetPath).filter(Boolean))].sort();
for (const ref of refs) if (!assetPath(ref)) manifest.missing.push({path:ref,reason:"unrecognized reference"});
await mkdir(output,{recursive:true});
async function sourceFor(path) {
 const direct = resolve(archive,'.'+path);
 if (await exists(direct)) return direct;
 const raw = refs.find(r=>assetPath(r)===path && r.startsWith('/'));
 if (raw && await exists(resolve(archive,'.'+raw))) return resolve(archive,'.'+raw);
 const cached = resolve(scratch,'recovered','.'+path);
 if (await exists(cached)) return cached;
 const encoded = path.split('/').map(encodeURIComponent).join('/');
 for (const base of ['https://i0.wp.com/coleccionreyesveray.com','https://coleccionreyesveray.com']) {
  try {
   const response=await fetch(base+encoded,{signal:AbortSignal.timeout(12000)});
   if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue;
   const bytes=Buffer.from(await response.arrayBuffer());
   await sharp(bytes).metadata();
   await mkdir(dirname(cached),{recursive:true});await writeFile(cached,bytes);
   manifest.recovered.push({path,source:base});return cached;
  } catch { /* Try the other original source; report final missing below. */ }
 }
 const thumb=direct.slice(0,-extname(direct).length)+'-thumb'+extname(direct);
 if (await exists(thumb)) {manifest.recovered.push({path,source:'local-thumbnail'});return thumb;}
 return null;
}
async function prepare(path) {
 const source=await sourceFor(path);
 if (!source) {manifest.missing.push({path,reason:'original unavailable'});return;}
 try {
  const bytes=await readFile(source);
  const metadata=await sharp(bytes).metadata();
  const destination=resolve(output,'.'+path);
  await mkdir(dirname(destination),{recursive:true});
  if (!await exists(destination)) await copyFile(source,destination);
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  manifest.files.push({path:`v1${path}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  for (const width of widths) {
   const file=resolve(output,'.'+variantPath(path,width));
   if (!await exists(file)) await sharp(bytes).rotate().resize({width,withoutEnlargement:true}).webp({quality:78,effort:4}).toFile(file);
  }
  manifest.paths[path]=`https://storage.googleapis.com/${manifest.bucket}/v1${encoded}`;
  // Browser-incompatible archive formats must render as WebP even without the loader.
  if (!['jpeg','png','webp','gif','avif','svg'].includes(metadata.format)) manifest.paths[path]+='.w1600.webp';
 } catch(error) {manifest.missing.push({path,reason:String(error.message).slice(0,160)});}
}
await Promise.all(Array.from({length:12},async()=>{
 while(cursor<unique.length) {
  const path=unique[cursor++];await prepare(path);done++;
  if(done%200===0) console.log(JSON.stringify({done,total:unique.length,ready:Object.keys(manifest.paths).length,missing:manifest.missing.length}));
 }
}));
for (const art of catalog) for (const key of ['ut_high','ut_thumb']) if (art[key] && art.images?.[0]) {
 const target=manifest.paths[assetPath(art.images[0])];if(target)manifest.aliases[art[key]]=target;
}
for(const ref of refs) {const path=assetPath(ref);if(path&&manifest.paths[path])manifest.aliases[ref]=manifest.paths[path];}
const { files, ...publicManifest }=manifest;
await writeFile('frontend/src/data/image-manifest.json',JSON.stringify(publicManifest));
await writeFile(resolve(scratch,'asset-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({complete:true,references:refs.length,unique:unique.length,ready:Object.keys(manifest.paths).length,recovered:manifest.recovered.length,missing:manifest.missing.length}));
