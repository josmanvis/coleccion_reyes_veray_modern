/** One-time GCP catalog image migration. Run only after all asset checks pass. */
import fs from 'node:fs';import{randomUUID}from'node:crypto';import{createRequire}from'node:module';import{canonicalPath}from'./asset-paths.mjs';
const require=createRequire(new URL('../frontend/package.json',import.meta.url)),{Client}=require('pg');
const cfg=JSON.parse(fs.readFileSync(process.env.ORC_TEST_CONFIG || '/Users/admin/Developer/_gcp/_cutover/data/private/target-connections.json'));
const manifest=JSON.parse(fs.readFileSync(new URL('../frontend/src/data/image-manifest.json',import.meta.url)));
function mapped(s){return manifest.aliases[s]??manifest.paths[canonicalPath(s)]??s}
function rewrite(v){if(typeof v==='string')return mapped(v).replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,(_,a,u,b)=>a+mapped(u)+b);if(Array.isArray(v))return v.map(rewrite);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rewrite(x)]));return v}
const dryRun=process.argv.includes('--dry-run');
if(!dryRun){const verification=JSON.parse(fs.readFileSync('.superpowers/orc/asset-verification.json'));if(verification.missing||verification.mismatch||verification.localObjects!==42420)throw Error('Verify the complete remote asset set first');}
const db=new Client({host:'127.0.0.1',port:15439,user:cfg.admin.user,password:cfg.admin.password,database:'axxes_prod',connectionTimeoutMillis:10000,query_timeout:120000});await db.connect();let changed=0;
try{await db.query('BEGIN');const tenant=(await db.query('SELECT id FROM tenants WHERE slug=$1',['coleccion-reyes-veray'])).rows[0].id;const backup={};for(const[table,id,fields]of[['products','id',['images']],['page_blocks','id',['content','settings']],['pages','id',['og_image']],['website_settings','tenant_id',['default_og_image']]]){
const scope=table==='pages'?' AND is_published=true':table==='page_blocks'?' AND is_visible=true AND EXISTS (SELECT 1 FROM pages p WHERE p.id=t.page_id AND p.tenant_id=$1 AND p.is_published=true)':'';
const rows=(await db.query(`SELECT ${id},${fields.join(',')} FROM ${table} t WHERE tenant_id=$1${scope} FOR UPDATE`,[tenant])).rows;backup[table]=rows;
const groups=new Map();
for(const row of rows){const changedFields=fields.filter(f=>JSON.stringify(rewrite(row[f]))!==JSON.stringify(row[f]));if(!changedFields.length)continue;const key=changedFields.join(',');const group=groups.get(key)??{fields:changedFields,rows:[]};group.rows.push(Object.fromEntries([[id,row[id]],...changedFields.map(f=>[f,rewrite(row[f])])]));groups.set(key,group);}
for(const group of groups.values()){const types=group.fields.map(f=>`${f} ${['images','content','settings'].includes(f)?'jsonb':'text'}`);await db.query(`UPDATE ${table} AS t SET ${group.fields.map(f=>`${f}=r.${f}`).join(',')} FROM jsonb_to_recordset($1::jsonb) AS r(${id} uuid,${types.join(',')}) WHERE t.${id}=r.${id} AND t.tenant_id=$2`,[JSON.stringify(group.rows),tenant]);changed+=group.rows.length;}}

if(!dryRun)fs.writeFileSync(`.superpowers/orc/catalog-image-refs-before-${randomUUID()}.json`,JSON.stringify(backup),{flag:'wx'});await db.query(dryRun?'ROLLBACK':'COMMIT');console.log(JSON.stringify({dryRun,gcpImageReferencesUpdated:changed}));}catch(e){await db.query('ROLLBACK');console.error(e.code??e.message);process.exitCode=1}finally{await db.end()}
