import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, rotate, matches, move, beginGame, view, replay } from '../lib/game.ts';

test('rotation preserves the four cells and returns after four turns', () => {
 const b = Array.from({length:36},(_,i)=>i); let x=b;
 for(let n=0;n<4;n++) x=rotate(x,2,3);
 assert.deepEqual(x,b); assert.throws(()=>rotate(b,5,0)); assert.throws(()=>rotate(b,1.5,2));
 const y=rotate(b,0,0); assert.deepEqual([y[0],y[1],y[6],y[7]],[6,0,7,1]); assert.equal(y[8],8);
});
test('overlapping squares count each tile once',()=>{
 const b=Array(36).fill(null); for(const i of [0,1,2,6,7,8]) b[i]='red';
 assert.deepEqual(matches(b),[0,1,2,6,7,8]);
});
test('blue can complete red and the points belong to red',()=>{
 const g=newGame(17); g.board=Array(36).fill(null);
 for(const [i,c] of [[0,'red'],[1,'blue'],[2,'blue'],[6,'red'],[7,'red'],[8,'red']])g.board[i]=c;
 g.queue=['gray','blue','red','gray',...Array(100).fill('gray')];
 const before=structuredClone(g), x=move(g,'blue',0,1,1000);
 assert.equal(x.scores.red,4); assert.equal(x.scores.blue,0);assert.deepEqual(g,before);
 assert.equal(x.board[2],'blue');assert.equal(x.board[8],'blue');
 assert.deepEqual([x.board[0],x.board[1],x.board[6],x.board[7]],['gray','blue','red','gray']);
});
test('gray squares clear without points',()=>{
 const g=newGame(5);g.board=Array(36).fill(null);for(const i of [0,1,6,7])g.board[i]='gray';
 g.queue=['red','blue','red','blue',...g.queue];const x=move(g,'red',0,0,1);
 assert.deepEqual(x.scores,{red:0,blue:0});assert.equal(x.last.cleared.length,4);
});
test('cooldowns are independent; server timestamps enforce start and end',()=>{
 const g=beginGame(newGame(20,'waiting'),1000);
 assert.throws(()=>move(g,'red',0,0,3999));const x=move(g,'red',0,0,4000);
 assert.throws(()=>move(x,'red',0,1,5999));assert.doesNotThrow(()=>move(x,'blue',1,1,4000));
 assert.doesNotThrow(()=>move(x,'red',0,1,6000));assert.throws(()=>move(x,'red',0,1,g.endsAt));
 assert.equal(view(x,g.endsAt).phase,'finished');assert.equal(x.phase,'playing');
});
test('initial boards are balanced, stable, symmetric, and playable',()=>{
 for(let s=1;s<=150;s++){
  const g=newGame(s);assert.equal(g.board.length,36);assert.equal(matches(g.board).length,0);
  for(const c of ['red','blue','gray'])assert.equal(g.board.filter(x=>x===c).length,12);
  for(let i=0;i<36;i++)assert.equal(g.board[35-i],g.board[i]==='red'?'blue':g.board[i]==='blue'?'red':'gray');
  const scoring={red:false,blue:false};
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){const b=rotate(g.board,r,c);for(const i of matches(b))if(b[i]!=='gray')scoring[b[i]]=true;}
  assert.ok(scoring.red&&scoring.blue);assert.deepEqual(newGame(s),g);
 }
});
test('long play remains settled and replay reconstructs every state',()=>{
 let g=newGame(874);
 for(let i=0;i<300;i++){
  const r=(i*7)%5,c=(i*3+Math.floor(i/5))%5;
  g=move(g,i%2?'blue':'red',r,c,1000+i*2000);
  assert.equal(matches(g.board).length,0);assert.ok(g.queue.length>=48);assert.equal(g.board.length,36);
 }
 const x=replay(g,g.history.length);assert.deepEqual(x.board,g.board);assert.deepEqual(x.scores,g.scores);assert.deepEqual(x.queue,g.queue);
});
