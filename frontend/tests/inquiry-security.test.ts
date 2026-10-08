import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readInquiryBody,createInquiryHandler} from '../src/lib/inquiry-security';
import {consume,clientIp} from '../src/lib/security/admission-core.mjs';
import {readFileSync} from 'node:fs';
test('streamed bodies are capped even without content-length',async()=>{
 const r=new Request('https://orc.axxes.app/api/inquiry',{method:'POST',body:JSON.stringify({email:'x@example.invalid',message:'x'.repeat(17000)})});
 await assert.rejects(()=>readInquiryBody(r),e=>(e as {status:number}).status===413);
});
test('inquiry limits run before persistence and database outages fail closed',async()=>{
 let persisted=0;const handler=createInquiryHandler(async()=>{throw Error('offline')},async()=>{persisted++;return true});
 const response=await handler(new Request('https://orc.axxes.app/api/inquiry',{method:'POST',body:'{"email":"x@example.invalid"}'}));
 assert.equal(response.status,503);assert.equal(persisted,0);
});
test('valid requests persist while malformed fields never persist',async()=>{
 let persisted=0;const handler=createInquiryHandler(async()=>{},async()=>{persisted++;return true});
 const req=(v:unknown)=>new Request('https://orc.axxes.app/api/inquiry',{method:'POST',body:JSON.stringify(v)});
 assert.equal((await handler(req({email:'x@example.invalid',message:'Hello'}))).status,201);
 assert.equal((await handler(req({email:'x@example.invalid',message:'x'.repeat(4001)}))).status,400);
 assert.equal((await handler(req({email:'x@example.invalid\r\n'}))).status,400);assert.equal(persisted,1);
});
test('shared SQL counter admits exactly five concurrent requests and bounds cleanup',async()=>{
 const db=new PGlite();await db.exec(readFileSync(new URL('../db/security-admission.sql',import.meta.url),'utf8'));
 const query=async(sql:string,args:unknown[])=>db.query(sql,args);
 const results=await Promise.allSettled(Array.from({length:40},()=>consume(query,'same',5,600,1,'orc_security_rate_limits')));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,5);
 await db.exec("INSERT INTO orc_security_rate_limits SELECT 'stale-'||i,1,now()-interval '2 hours',now()-interval '2 hours' FROM generate_series(1,30)i");
 await consume(query,'new',5,600,1,'orc_security_rate_limits');
 assert.equal((await db.query<{n:number}>("SELECT count(*)::int n FROM orc_security_rate_limits WHERE key LIKE 'stale-%'")).rows[0].n,10);
 await db.exec("UPDATE orc_security_rate_limits SET hits=2147483647 WHERE key NOT LIKE 'stale-%'");
 await assert.rejects(()=>consume(query,'same',5,600,1,'orc_security_rate_limits'),e=>(e as {status:number}).status===429);
 await db.close();
});

test('forwarding headers are trusted only behind a configured exact LB tail',()=>{
 assert.equal(clientIp(new Headers({'x-forwarded-for':'1.2.3.4, 8.8.8.8'}),['136.81.161.193']),'untrusted');
 assert.equal(clientIp(new Headers({'x-forwarded-for':'fake, 1.2.3.4, 136.81.161.193'}),['136.81.161.193']),'1.2.3.4');
});
