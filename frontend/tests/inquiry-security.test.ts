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

test('invalid and client-rejected requests do not spend the collection global budget',async()=>{
 const seen:string[]=[];const handler=createInquiryHandler(async(budgets)=>{seen.push(...budgets.map(x=>x[0]))},async()=>true);
 await handler(new Request('https://orc.axxes.app/api/inquiry',{method:'POST',body:'{}'}));
 assert.equal(seen.some(x=>x==='inquiry:global'),false);
});
test('an unfinished body has a total read deadline',async()=>{
 const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{'))}});
 const request=new Request('https://orc.axxes.app/api/inquiry',{method:'POST',body,duplex:'half'} as RequestInit);
 await assert.rejects(()=>readInquiryBody(request),e=>(e as {status:number}).status===408);
});

test('composite admission rolls back global spending and new rows when any bucket rejects',async()=>{
 const db=new PGlite();await db.exec(readFileSync(new URL('../db/security-admission.sql',import.meta.url),'utf8'));
 const admit=(budgets:[string,number,number][])=>db.transaction(async tx=>{for(const [id,limit,seconds] of budgets)await consume((sql,args)=>tx.query(sql,args),id,limit,seconds,1,'orc_security_rate_limits')});
 await admit([['global',10,600],['client',1,600]]);
 for(let i=0;i<3;i++)await assert.rejects(()=>admit([['global',10,600],['client',1,600]]));
 assert.equal((await db.query<{n:number}>('SELECT sum(hits)::int n FROM orc_security_rate_limits')).rows[0].n,2);
 await admit([['global',2,600],['new-client',1,600]]);
 await assert.rejects(()=>admit([['global',2,600],['must-not-exist',1,600]]));
 assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM orc_security_rate_limits')).rows[0].n,3);
 await db.close();
});
