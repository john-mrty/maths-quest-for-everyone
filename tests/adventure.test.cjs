const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function api(){const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../adventure.js',`file://${__filename}`),'utf8'),context);return context.window.questAdventure}
test('partial rounds earn no decoration or world progress',()=>{const a=api(),l={};assert.equal(a.award(l,{index:4,total:8}),null);assert.equal(l.adventure,undefined)});
test('full rounds earn unique decorations, including rounds completed with help',()=>{const a=api(),l={};for(let i=0;i<12;i++)a.award(l,{index:8,total:8,correct:2,helped:6});assert.equal(l.adventure.unlocked.length,9);assert.equal(new Set(l.adventure.unlocked).size,9);assert.equal(l.adventure.placed.length,5);assert.equal(l.adventure.rounds,12)});
test('invalid stored decorations and destinations are repaired',()=>{const a=api(),l={adventure:{destination:'unknown',unlocked:['tree','tree','bad'],placed:['bad','rocket','tree'],rounds:-3}};a.state(l);assert.equal(l.adventure.destination,'meadow');assert.equal(l.adventure.unlocked.join(','),'tree');assert.equal(l.adventure.placed.join(','),'tree');assert.equal(l.adventure.rounds,0)});
test('rerendering preserves selection references and serialised progress',()=>{const a=api(),l={};const first=a.state(l);a.state(l);first.destination='harbour';a.award(l,{index:3,total:3});const restored=JSON.parse(JSON.stringify(l));a.state(restored);assert.equal(restored.adventure.destination,'harbour');assert.equal(restored.adventure.unlocked[0],'tree');assert.equal(restored.adventure.rounds,1)});
