const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('../racer.js',`file://${__filename}`),'utf8');
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
