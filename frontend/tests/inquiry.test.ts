import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
test('inquiry succeeds only when the CRM confirms persistence, never on HTML or redirects',async()=>{
 let mode='html';
 const server=createServer((req,res)=>{
  if(mode==='redirect'){res.writeHead(302,{Location:'/login'});res.end();return;}
  if(mode==='html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html>Sign in</html>');return;}
  res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,contactId:'contact-test'}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as {port:number};
 process.env.MAC_API_BASE=`http://127.0.0.1:${address.port}`;
 const {submitInquiry}=await import('../src/lib/mac');
 try{
  assert.equal(await submitInquiry({email:'gcp-test@example.invalid'}),false);
  mode='redirect';assert.equal(await submitInquiry({email:'gcp-test@example.invalid'}),false);
  mode='success';assert.equal(await submitInquiry({email:'gcp-test@example.invalid'}),true);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
