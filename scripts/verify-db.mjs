import fs from 'node:fs';import {createRequire} from 'node:module';import {execFileSync,spawnSync} from 'node:child_process';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));const{Client}=require('pg');
const cfg=JSON.parse(fs.readFileSync(process.env.ORC_TEST_CONFIG || '/Users/admin/Developer/_gcp/_cutover/data/private/target-connections.json'));
const u=new URL(execFileSync('gcloud',['secrets','versions','access','1','--secret=orc-database-url','--project=gravy-meta'],{encoding:'utf8'}));u.search='';u.hostname='127.0.0.1';u.port='15439';
const result=spawnSync('frontend/node_modules/.bin/tsx',['--test','frontend/tests/gcp-catalog.test.ts'],{env:{...process.env,ORC_DATABASE_URL:u.href},stdio:'inherit'});
const c=new Client({host:'127.0.0.1',port:15439,user:cfg.admin.user,password:cfg.admin.password,database:'axxes_prod'});await c.connect();
try{
 const r=await c.query("SELECT id FROM contacts WHERE tenant_id=(SELECT id FROM tenants WHERE slug='coleccion-reyes-veray') AND email=$1 AND lead_source=$2",['orc-gcp-verification@example.invalid','orc-gcp-deployment-verification']);
 console.log(JSON.stringify({testInquiryPersisted:r.rowCount===1}));
 await c.query("DELETE FROM contacts WHERE tenant_id=(SELECT id FROM tenants WHERE slug='coleccion-reyes-veray') AND email=$1 AND lead_source=$2",['orc-gcp-verification@example.invalid','orc-gcp-deployment-verification']);
 process.exitCode=result.status || (r.rowCount===1?0:1);
}finally{await c.end();}
