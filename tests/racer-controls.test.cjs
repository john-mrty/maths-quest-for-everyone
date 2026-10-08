const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('../racer.js',`file://${__filename}`),'utf8');
test('driving style restores per learner and emits preference changes',()=>{
 const start=source.indexOf(" $('#raceMode').value=learner.turboDrivingStyle"),end=source.indexOf(" $('.race-audio>span')",start),snippet=source.slice(start,end);
 function load(learner){const mode={value:''};const h={learner,$:()=>mode,hooks:{onDrivingStyle:value=>learner.turboDrivingStyle=value}};vm.createContext(h);vm.runInContext(snippet,h);return mode;}
 const alice={turboDrivingStyle:'race'},bob={};
 const a=load(alice),b=load(bob);assert.equal(a.value,'race');assert.equal(b.value,'cruise');
 a.value='cruise';a.onchange();assert.equal(alice.turboDrivingStyle,'cruise');assert.equal(bob.turboDrivingStyle,undefined);
 assert.equal(load({turboDrivingStyle:'invalid'}).value,'cruise');
 const integration=fs.readFileSync(new URL('../adventure.js',`file://${__filename}`),'utf8');
 assert.match(integration,/onDrivingStyle:style=>\{l.turboDrivingStyle=style;save\(\);\}/);
});
test('questions reveal positioned answer numbers immediately without a timer gate',()=>{
 const start=source.indexOf(' function nextQuestion()'),end=source.indexOf(' function resolve()',start),body=source.slice(start,end);
 assert.match(body,/gateRoot.visible=true/);
 assert.match(body,/\$\('\.race-gates'\).hidden=false/);
 assert.match(body,/positionAnswers\(0\)/);
 assert.doesNotMatch(source,/clock\s*[<>]=?\s*\.55/);
});
test('Space toggles pause from buttons and form controls without repeated toggles',()=>{
 const start=source.indexOf(' function key(e)'),end=source.indexOf(" document.addEventListener('keydown',key",start);
 const h={dialog:{open:true},phase:'drive',toggles:0};
 h.togglePause=()=>{h.toggles++;h.phase=h.phase==='pause'?'drive':'pause'};
 vm.createContext(h);vm.runInContext(source.slice(start,end),h);
 for(const tagName of ['BUTTON','INPUT','SELECT','CANVAS']){
  h.phase='drive';const before=h.toggles;let prevented=0,stopped=0;
  const event={code:'Space',key:' ',target:{tagName},repeat:false,preventDefault(){prevented++},stopPropagation(){stopped++}};
  h.key(event);assert.equal(h.phase,'pause');assert.equal(h.toggles,before+1);
  h.key({...event,repeat:true});assert.equal(h.toggles,before+1);
  h.key(event);assert.equal(h.phase,'drive');assert.equal(h.toggles,before+2);
  assert.equal(prevented,3);assert.equal(stopped,3);
 }
 assert.match(source,/addEventListener\('keydown',key,true\)/);
 assert.match(source,/removeEventListener\('keydown',key,true\)/);
});
