/* eslint-disable @typescript-eslint/no-explicit-any -- test harness loads route modules into a VM sandbox; their exports are untyped. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const req=createRequire(import.meta.url);
const owner={id:1,username:'owner',name:'owner',role:'superadmin',active:1,session_version:0};
const db={exec:()=>{},prepare:(sql:string)=>({all:()=>[],get:()=>sql.includes('COUNT(*)')?{n:1}:sql.includes('lower(username)')?null:owner,run:()=>({lastInsertRowid:1})})};
const mod={exports:{} as any};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/inventory/users.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,process,Buffer,require:(id:string)=>id==='./db'?{getDb:()=>db}:id==='./session'?{ROLES:['superadmin','admin','staff']}:req(id)});
const users=mod.exports;
test('ordinary admin cannot create a superadmin',()=>assert.throws(()=>users.createUser({username:'new',name:'new',role:'superadmin',password:'test-password'},'admin'),/permission|superadmin|administrador/i));
test('ordinary admin cannot reset the superadmin password',()=>assert.throws(()=>users.resetPassword(1,'new-password','admin'),/permission|superadmin|administrador/i));
