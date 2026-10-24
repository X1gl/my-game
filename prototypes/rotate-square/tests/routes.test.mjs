import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
test('room API validates tokens, time and atomic joins/moves using real SQLite',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY,state TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,red_token TEXT NOT NULL,blue_token TEXT,created_at INTEGER NOT NULL)');
 globalThis.__squareTestEnv = {
  DB: { prepare(sql) {
   return { bind(...args) {
    return {
     async first() { return db.prepare(sql).get(...args) || null; },
     async run() { return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; },
    };
   } };
  } },
 };
 const source=readFileSync(new URL('../app/api/rooms/[[...path]]/route.ts',import.meta.url),'utf8').replace("import { env } from 'cloudflare:workers';","const env = globalThis.__squareTestEnv;").replace("'../../../../lib/game'",JSON.stringify(new URL('../lib/game.ts',import.meta.url).href));
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const api=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const originalNow=Date.now;let now=1800000000000;Date.now=()=>now;
 try{
 async function post(id,body,token){const r=await api.POST(new Request('http://test/api/rooms'+(id?'/'+id:''),{method:'POST',headers:{'content-type':'application/json',...(token?{'x-player-token':token}:{})},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
 const a=await post('',{action:'create'});assert.equal(a.status,201);const id=a.data.id,red=a.data.token;
 const joins=await Promise.all([post(id,{action:'join'}),post(id,{action:'join'})]);assert.deepEqual(joins.map(x=>x.status).sort(),[200,409]);const blue=joins.find(x=>x.status===200).data.token;
 assert.equal((await post(id,{action:'start',version:1})).status,403);assert.equal((await post(id,{action:'start',version:1},blue)).status,400);
 const start=await post(id,{action:'start',version:1},red);assert.equal(start.status,200);
 assert.equal((await post(id,{action:'move',version:2,row:0,col:0},red)).status,400);now+=3000;
 const race=await Promise.all([post(id,{action:'move',version:2,row:0,col:0,player:'blue'},red),post(id,{action:'move',version:2,row:4,col:4},blue)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
 const accepted=race.find(x=>x.status===200);assert.equal(accepted.data.game.history.length,1);const who=accepted.data.game.last.player;
 assert.equal((await post(id,{action:'move',version:3,row:0,col:0},who==='red'?red:blue)).status,400);
 assert.equal((await post(id,{action:'move',version:3,row:1,col:1},who==='red'?blue:red)).status,200);
 const read=await api.GET(new Request('http://test/api/rooms/'+id));const visible=await read.text();assert.ok(!visible.includes(red)&&!visible.includes(blue));
 now=start.data.game.endsAt;assert.equal((await post(id,{action:'move',version:4,row:0,col:0},red)).status,400);
 const ready=await post(id,{action:'rematch',version:4},red);assert.equal(ready.status,200);assert.equal(ready.data.game.phase,'finished');
 const again=await post(id,{action:'rematch',version:5},blue);assert.equal(again.status,200);assert.equal(again.data.game.round,2);assert.deepEqual(again.data.game.scores,{red:0,blue:0});
 }finally{Date.now=originalNow;delete globalThis.__squareTestEnv;db.close();}
});
