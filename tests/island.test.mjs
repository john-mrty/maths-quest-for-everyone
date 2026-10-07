import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionFor,fitsBridge,minimumBoards,flowerMission,fitsBouquet} from '../island.js';

test('flower chapters have achievable age-appropriate colour goals',()=>{
 for(let level=1;level<=6;level++)for(let seed=0;seed<30;seed++){
  const m=flowerMission(level,seed),correct=[...Array(m.yellow).fill('yellow'),...Array(m.pink).fill('pink')];
  assert.ok(m.yellow<=9&&m.pink<=9);assert.equal(m.yellow+m.pink,m.total);
  assert.equal(fitsBouquet(m,correct),true);assert.equal(fitsBouquet(m,correct.slice(1)),false);
  assert.equal(fitsBouquet(m,Array(m.total).fill('yellow')),false);
 }
});

test('every class and crossing has a solution using the offered pieces',()=>{
  for(let level=1;level<=6;level++)for(let round=0;round<3;round++){
    const m=missionFor(level,round);
    function solve(sum=0,pieces=[]){if(sum===m.target)return fitsBridge(m,pieces);if(sum>m.target)return false;return m.pieces.some(n=>solve(sum+n,[...pieces,n]))}
    assert.ok(solve());
  }
});
test('varied missions have solvable build, repair and efficient goals for every class',()=>{
 for(let level=1;level<=6;level++)for(let seed=1;seed<=30;seed++)for(let round=0;round<3;round++){
  const m=missionFor(level,round,seed),best=minimumBoards(m);
  assert.ok(Number.isFinite(best));assert.equal(m.kind,['build','repair','efficient'][round]);
  if(m.starter)assert.ok(m.pieces.includes(m.starter)&&m.target>=m.starter);
  if(m.equal)assert.ok(m.pieces.some(n=>m.target%n===0&&m.target/n===best));
 }
});
test('early crossings omit one-unit boards and repair gaps remain solvable',()=>{
 for(let level=1;level<=2;level++)for(let seed=0;seed<=30;seed++)for(let round=0;round<3;round++){
  const m=missionFor(level,round,seed);assert.equal(m.pieces.includes(1),false);
  function reachable(left){return left===0||left>0&&m.pieces.some(n=>reachable(left-n))}
  assert.ok(reachable(m.target-m.starter));
 }
});
test('efficient bridges reject a correct length made with excess boards',()=>{
 const m=missionFor(1,2,1);
 assert.equal(fitsBridge(m,Array(m.target).fill(1)),false);
 assert.ok(minimumBoards(m)<m.target);
});
test('equal groups reject mixed lengths even when the total fits',()=>{
  const m=missionFor(3,0);
  assert.equal(fitsBridge(m,[2,3,3,4]),false);
  assert.equal(fitsBridge(m,[3,3,3,3]),true);
});
test('fraction bridges require an exact total with valid quarter-unit pieces',()=>{
  const m=missionFor(6,0);
  assert.equal(fitsBridge(m,[1,2,3]),true);
  for(const pieces of [[],[1,2],[3,3,1],[6],[.5,2.5,3]])assert.equal(fitsBridge(m,pieces),false);
});
