import{readFile,writeFile}from'node:fs/promises';import{createRequire}from'node:module';import{createHash}from'node:crypto';import{canonicalPath}from'./asset-paths.mjs';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));const sharp=require('sharp');
const file='.superpowers/orc/asset-manifest.json';const data=JSON.parse(await readFile(file,'utf8'));const remaining=[];
for(const item of data.missing){
 const path=canonicalPath(item.path);if(!path){remaining.push(item);continue;}let recovered=false;
 for(const host of ['https://i0.wp.com/coleccionreyesveray.com','https://coleccionreyesveray.com'])try{
  const encoded=path.split('/').map(encodeURIComponent).join('/');const r=await fetch(host+encoded,{signal:AbortSignal.timeout(12000)});if(!r.ok)continue;
  const bytes=Buffer.from(await r.arrayBuffer());await sharp(bytes).metadata();const dest='.superpowers/orc/assets/v1'+path;await writeFile(dest,bytes);
  for(const width of data.widths)await sharp(bytes).rotate().resize({width,withoutEnlargement:true}).webp({quality:78,effort:4}).toFile(dest+`.w${width}.webp`);
  data.paths[path]=`https://storage.googleapis.com/${data.bucket}/v1${encoded}`;data.recovered.push({path,source:host});data.files=data.files.filter(x=>x.path!=='v1'+path);data.files.push({path:'v1'+path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});recovered=true;console.log('Recovered corrupt original:',path);break;
 }catch{}
 if(!recovered)remaining.push(item);
}
data.missing=remaining;
const local=JSON.parse(await readFile('frontend/src/data/artworks.json','utf8'));const refs=[...JSON.parse(await readFile('.superpowers/orc/live-image-refs.json','utf8')),...local.flatMap(x=>x.images)];
for(const ref of refs){const path=canonicalPath(ref.startsWith('../wp-content/')?ref.slice(2):ref);if(path&&data.paths[path])data.aliases[ref]=data.paths[path];}
const{files,...publicData}=data;await writeFile(file,JSON.stringify(data,null,2));await writeFile('frontend/src/data/image-manifest.json',JSON.stringify(publicData));console.log('Remaining unavailable source images:',remaining.length);
