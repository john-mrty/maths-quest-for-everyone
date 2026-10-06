import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionFor,fitsBridge} from '../island.js';

test('every class and crossing has a solution using the offered pieces',()=>{
  for(let level=1;level<=6;level++)for(let round=0;round<3;round++){
    const m=missionFor(level,round);
    const piece=m.pieces.find(n=>m.target%n===0);
    assert.ok(piece);
    assert.ok(fitsBridge(m,Array(m.target/piece).fill(piece)));
  }
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
