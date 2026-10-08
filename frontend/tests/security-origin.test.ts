import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const m={exports:{} as any};let authenticated=0;
const stubs:any={'next/server':{NextResponse:{json:(v:unknown,o?:{status:number})=>new Response(JSON.stringify(v),{status:o?.status??200})}},'@/lib/inventory/users':{authenticate:()=>{authenticated++;return null}},'@/lib/inventory/session':{},'@/lib/inventory/session-server':{},'@/lib/inventory/audit':{record:()=>{}},'@/lib/inventory/network':{isIntranetRequest:()=>false},'@/lib/inventory/presence':{},'@/lib/inventory/login-rate-limit':{loginAllowed:()=>true}};
const policy={exports:{} as any};
runInNewContext(ts.transpileModule(readFileSync('src/lib/site-config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:policy,exports:policy.exports,process,URL});
stubs['@/lib/site-config']=policy.exports;
runInNewContext(ts.transpileModule(readFileSync('src/app/api/auth/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,process,Request,Response,URL,require:(id:string)=>stubs[id]??{}});
process.env.CRVMGMT_SECRET='synthetic-session-secret';
test('sibling-origin sign-in is refused before credentials are processed',async()=>{
 const r=await m.exports.POST(new Request('https://orc.axxes.app/api/auth',{method:'POST',headers:{origin:'https://sibling.axxes.app',host:'orc.axxes.app'},body:JSON.stringify({username:'owner',password:'guess'})}));
 assert.equal(r.status,403);assert.equal(authenticated,0);
});
