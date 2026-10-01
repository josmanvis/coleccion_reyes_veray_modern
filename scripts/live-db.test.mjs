import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));const {Client}=require('pg');
const enabled=Boolean(process.env.ORC_TEST_CONFIG);
async function websiteClient(){const u=new URL(execFileSync('gcloud',['secrets','versions','access','1','--secret=orc-database-url','--project=gravy-meta'],{encoding:'utf8'}));const c=new Client({host:'127.0.0.1',port:15439,user:u.username,password:u.password,database:'axxes_prod'});await c.connect();return c;}
async function client(){const cfg=JSON.parse(fs.readFileSync(process.env.ORC_TEST_CONFIG));const c=new Client({host:'127.0.0.1',port:15439,user:cfg.admin.user,password:cfg.admin.password,database:'axxes_prod'});await c.connect();return c;}
test('GCP published catalog matches all 3667 live artworks',{skip:!enabled},async()=>{const c=await client();try{const r=await c.query('SELECT count(*) FROM orc_public.products');assert.equal(Number(r.rows[0].count),3667);}finally{await c.end();}});
test('website database role cannot read private tables or change another tenant',{skip:!enabled},async()=>{
 const c=await websiteClient();try{
  await assert.rejects(c.query('SELECT * FROM public.contacts LIMIT 1'),{code:'42501'});
  await c.query('BEGIN');
  await assert.rejects(c.query("UPDATE orc_public.contacts SET tenant_id='00000000-0000-0000-0000-000000000001' WHERE id=(SELECT id FROM orc_public.contacts LIMIT 1)"),{code:'44000'});
  await c.query('ROLLBACK');
 }finally{await c.end();}
});
