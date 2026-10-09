import {AdmissionError,clientIp} from './security/admission-core.mjs';
import type {InquiryPayload} from './gcp-catalog';
const MAX_BYTES=16384;
class InputError extends Error {constructor(public status=400){super('Invalid inquiry')}}
export async function readInquiryBody(request:Request):Promise<InquiryPayload>{
 const size=request.headers.get('content-length');
 if(size && (!/^\d+$/.test(size)||Number(size)>MAX_BYTES))throw new InputError(413);
 if(!request.body)throw new InputError();
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let total=0;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new InputError(408));void reader.cancel().catch(()=>{})},5000)});
 try{while(true){const {value,done}=await Promise.race([reader.read(),timeout]);if(done)break;total+=value.byteLength;if(total>MAX_BYTES){void reader.cancel().catch(()=>{});throw new InputError(413)}chunks.push(value)}}finally{clearTimeout(timer);reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 let body:Record<string,unknown>;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new InputError()}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new InputError();
 if(typeof body.email!=='string'||body.email.length>254||/[\r\n]/.test(body.email)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))throw new InputError();
 const payload:InquiryPayload={email:body.email.trim().toLowerCase()};
 const limits={name:200,phone:40,message:4000,artworkTitle:200,artworkSlug:200,artworkImage:2048,source:80};
 for(const [field,max] of Object.entries(limits)){const value=body[field];if(value!==undefined){if(typeof value!=='string'||value.length>max)throw new InputError();Object.assign(payload,{[field]:value})}}
 if(body.submissionId!==undefined){if(typeof body.submissionId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.submissionId))throw new InputError();payload.submissionId=body.submissionId}
 return payload;
}
export function createInquiryHandler(admit:(budgets:[string,number,number][])=>Promise<void>,persist:(payload:InquiryPayload)=>Promise<boolean>){
 return async(request:Request):Promise<Response>=>{
  try{
   await admit([['inquiry:requests',600,60],['inquiry:client:'+clientIp(request.headers),5,600]]);
   const payload=await readInquiryBody(request);
   await admit([['inquiry:global',120,3600],['inquiry:email:'+payload.email,5,86400]]);
   if(!await persist(payload))return Response.json({error:'Could not submit inquiry'},{status:502});
   return Response.json({ok:true},{status:201});
  }catch(error){const status=error instanceof InputError?error.status:error instanceof AdmissionError?error.status:503;
   return Response.json({error:status===429?'Request limit exceeded':status===413?'Request too large':status===400?'Invalid inquiry':'Inquiry temporarily unavailable'},{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'600'}:{})}})
  }
 };
}
