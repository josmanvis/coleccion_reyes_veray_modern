/* eslint-disable @typescript-eslint/no-explicit-any -- test harness loads route modules into a VM sandbox; their exports are untyped. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const mod={exports:{} as any};
let calls=0;
const stubs:any={
 'next/server':{NextResponse:{json:(body:unknown,opts?:{status:number})=>new Response(JSON.stringify(body),{status:opts?.status??200})}},
 '@/lib/inventory/users':{authenticate:()=>null},
 '@/lib/inventory/session':{},'@/lib/inventory/session-server':{},
 '@/lib/inventory/audit':{record:()=>{}},'@/lib/inventory/network':{isIntranetRequest:()=>false},'@/lib/inventory/presence':{},
 '@/lib/inventory/login-rate-limit':{loginAllowed:()=>++calls<=5},
};
const policy={exports:{} as any};
runInNewContext(ts.transpileModule(readFileSync('src/lib/site-config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:policy,exports:policy.exports,process,URL});
stubs['@/lib/site-config']=policy.exports;
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/app/api/auth/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,process,Request,Response,require:(id:string)=>stubs[id]??{}});
process.env.CRVMGMT_SECRET='synthetic-session-secret';
test('password guesses are rejected before password verification once budget is exhausted',async()=>{
 let response:Response;
 for(let i=0;i<6;i++)response=await mod.exports.POST(new Request('https://orc.axxes.app/api/auth',{method:'POST',headers:{origin:'https://orc.axxes.app','content-type':'application/json',host:'orc.axxes.app'},body:JSON.stringify({username:'owner',password:'wrong'})}));
 assert.equal(response!.status,429);
});
