import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,readSession} from '../src/lib/inventory/session';
process.env.CRVMGMT_SECRET='synthetic-signing-secret-for-security-tests';
test('deactivated account cannot reuse a signed session',async()=>{
 const token=await createSession(1,'admin',0);
 assert.equal(await readSession(token,async()=>({active:0,role:'admin',session_version:0})),null);
});
test('password-reset session version revokes old credentials',async()=>{
 const token=await createSession(1,'admin',0);
 assert.equal(await readSession(token,async()=>({active:1,role:'admin',session_version:1})),null);
});
test('demotion revokes cached admin authority',async()=>{
 const token=await createSession(1,'admin',0);
 assert.equal(await readSession(token,async()=>({active:1,role:'staff',session_version:0})),null);
});
