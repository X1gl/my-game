import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { newGame, move, beginGame } from '../lib/game.ts';
import { recognizeTap } from '../lib/tap.ts';
const source = readFileSync(new URL('../lib/cpu.ts', import.meta.url), 'utf8')
 .replace("'./game'", JSON.stringify(new URL('../lib/game.ts', import.meta.url).href));
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { chooseCpuMove } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('CPU selects valid moves without changing the current game', () => {
 for (const seed of [1,7,20,47,100]) {
  const g = newGame(seed), original = structuredClone(g), choice = chooseCpuMove(g);
  assert.ok(Number.isInteger(choice.row) && choice.row >= 0 && choice.row <= 4);
  assert.ok(Number.isInteger(choice.col) && choice.col >= 0 && choice.col <= 4);
  assert.doesNotThrow(() => move(g,'blue',choice.row,choice.col,1000));
  assert.deepEqual(g,original);
 }
});
test('CPU does not peek at hidden refill tiles or the random generator', () => {
 const a = newGame(74), b = structuredClone(a);
 b.queue = [...b.queue.slice(0,12), ...Array(100).fill('red')]; b.rng = 987654; b.seed = 123;
 assert.deepEqual(chooseCpuMove(a),chooseCpuMove(b));
});
test('CPU competes through the same cooldown, scoring and end-time rules', () => {
 let g = beginGame(newGame(74),1000);
 for (let at=g.startsAt;at<g.endsAt;at+=2500) {
  const c=chooseCpuMove(g);g=move(g,'blue',c.row,c.col,at);
 }
 assert.equal(g.history.length,36);assert.ok(g.scores.blue>0);
 const c=chooseCpuMove(g);assert.throws(()=>move(g,'blue',c.row,c.col,g.endsAt));
});
test('double-tap fires once; adjacent taps and changed boards never fire', () => {
 const a={cell:7,at:100,revision:'room:1'};
 const once=recognizeTap(null,a);assert.equal(once.doubleTap,false);
 const twice=recognizeTap(once.next,{...a,at:260});assert.equal(twice.doubleTap,true);
 assert.equal(recognizeTap(twice.next,{...a,at:300}).doubleTap,false);
 assert.equal(recognizeTap(a,{...a,cell:8,at:200}).doubleTap,false);
 assert.equal(recognizeTap(a,{...a,revision:'room:2',at:200}).doubleTap,false);
 assert.equal(recognizeTap(a,{...a,at:900}).doubleTap,false);
});
