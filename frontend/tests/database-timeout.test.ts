import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer,Socket} from 'node:net';
import {readGcpCatalog} from '../src/lib/gcp-catalog';
test('an established database connection that never answers reaches a client deadline',async()=>{
 const sockets=new Set<Socket>();
 const server=createServer(socket=>{sockets.add(socket);socket.once('data',()=>socket.write(Buffer.from([82,0,0,0,8,0,0,0,0,90,0,0,0,5,73])));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
 process.env.ORC_DATABASE_URL=`postgresql://test:test@127.0.0.1:${port}/test`;
 let timer:ReturnType<typeof setTimeout>;
 try{await assert.rejects(Promise.race([readGcpCatalog('/artists'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Probe deadline exceeded')),10500);})]),/Query read timeout/);}
 finally{clearTimeout(timer!);for(const socket of sockets)socket.destroy();await new Promise<void>(r=>server.close(()=>r()));await (globalThis as unknown as {orcPool?:{end:()=>Promise<void>}}).orcPool?.end();}
});
