import {readFile,writeFile,access} from 'node:fs/promises';import {canonicalPath,variantPath} from './asset-paths.mjs';
const file='.superpowers/orc/asset-manifest.json';const data=JSON.parse(await readFile(file,'utf8'));const refs=JSON.parse(await readFile('.superpowers/orc/live-image-refs.json','utf8'));
for(const path of Object.keys(data.paths)){
 try{for(const width of data.widths)await access('.superpowers/orc/assets/v1'+variantPath(path,width));}
 catch{delete data.paths[path];if(!data.missing.some(x=>x.path===path))data.missing.push({path,reason:'incomplete variants'});}
}
for(const ref of refs){const path=canonicalPath(ref);if(path&&data.paths[path])data.aliases[ref]=data.paths[path];else if(!path&&!data.missing.some(x=>x.path===ref))data.missing.push({path:ref,reason:'unrecognized reference'});}
for(const[key,value]of Object.entries(data.aliases))if(!Object.values(data.paths).includes(value))delete data.aliases[key];
const{files,...publicData}=data;
await writeFile(file,JSON.stringify(data,null,2));await writeFile('frontend/src/data/image-manifest.json',JSON.stringify(publicData));
console.log(JSON.stringify({ready:Object.keys(data.paths).length,aliases:Object.keys(data.aliases).length,missing:data.missing}));
