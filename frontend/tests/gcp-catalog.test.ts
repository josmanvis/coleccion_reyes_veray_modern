import {test} from 'node:test';import assert from 'node:assert/strict';import {readGcpCatalog,saveGcpInquiry} from '../src/lib/gcp-catalog';
const enabled=Boolean(process.env.ORC_DATABASE_URL);
test('GCP catalog reads the full verified client dataset',{skip:!enabled},async()=>{
 const index=await readGcpCatalog('/inventory?fields=artistIndex') as unknown[];assert.equal(index.length,3667);
 const artists=await readGcpCatalog('/artists') as unknown[];assert.equal(artists.length,591);
 const page=await readGcpCatalog('/pages/about') as {blocks:unknown[]};assert.ok(page.blocks.length>0);
});
test('GCP inquiry persists with the scoped website role',{skip:!enabled},async()=>{
 assert.equal(await saveGcpInquiry({email:'orc-gcp-verification@example.invalid',name:'ORC GCP Verification',message:'Identified deployment test; no customer action required.',source:'orc-gcp-deployment-verification'}),true);
});
test('retrying one submission records one inquiry while new submissions stay distinct',{skip:!enabled},async()=>{
 const {randomUUID}=await import('node:crypto');const {Client}=await import('pg');
 const id=randomUUID();const marker=`retry-check-${id}`;
 const payload={email:'orc-gcp-verification@example.invalid',message:marker,source:'orc-gcp-deployment-verification',submissionId:id};
 assert.equal(await saveGcpInquiry(payload),true);assert.equal(await saveGcpInquiry(payload),true);
 const c=new Client({connectionString:process.env.ORC_DATABASE_URL});await c.connect();
 try{const r=await c.query('SELECT notes FROM orc_public.contacts WHERE email=$1',[payload.email]);assert.equal(r.rows[0].notes.split(marker).length-1,1);}
 finally{await c.end();}
 assert.equal(await saveGcpInquiry({...payload,message:'A different inquiry',submissionId:randomUUID()}),true);
});
