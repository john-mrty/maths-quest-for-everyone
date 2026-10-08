const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function audioHarness(deferred=false){
 const source=fs.readFileSync(new URL('../racer.js',`file://${__filename}`),'utf8');
 const timers=new Map(),delayed=[],frequencies=[],gains=[];let instance,resolve,notes=0;
 class Context{
  constructor(){instance=this;this.state='running';this.currentTime=0;this.destination={};}
  resume(){return deferred?new Promise(r=>resolve=r):Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  createOscillator(){notes++;return {frequency:{set value(v){frequencies.push(v)}},connect(){},start(){},stop(){this.onended?.()}};}
  createGain(){const node={gain:{value:1,setValueAtTime(v){this.value=v},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};gains.push(node);return node;}
 }
 const context={window:{AudioContext:Context},setInterval:fn=>{timers.set(1,fn);return 1},clearInterval:id=>timers.delete(id),setTimeout:fn=>delayed.push(fn)};
 vm.runInNewContext(source.slice(source.indexOf('function chipAudio()'),source.indexOf('export function openRacer'))+';globalThis.audio=chipAudio();',context);
 return {audio:context.audio,timers,delayed,frequencies,gains,notes:()=>notes,instance:()=>instance,resolve:()=>resolve()};
}
test('racer audio independently mutes music and effects, and cleans up on close',async()=>{
 const h=audioHarness();await h.audio.start(false);assert.equal(h.timers.size,1);
 h.audio.set(false,false);h.timers.get(1)();h.audio.sound('boost');assert.equal(h.notes(),0);assert.equal(h.gains[0].gain.value,0);
 h.audio.set(true,false);h.timers.get(1)();assert.ok(h.notes()>0);assert.equal(h.gains[0].gain.value,1);
 h.audio.set(false,true);const before=h.notes();h.audio.sound('boost');assert.ok(h.notes()>before);
 h.audio.close();assert.equal(h.timers.size,0);assert.equal(h.instance().state,'closed');
 const after=h.notes();h.delayed.forEach(fn=>fn());assert.equal(h.notes(),after);
});
test('original soundtrack varies across eight bars with broad melodic and bass range',async()=>{
 const h=audioHarness();await h.audio.start(false);
 for(let i=0;i<128;i++)h.timers.get(1)();
 assert.ok(new Set(h.frequencies).size>=20);
 assert.ok(Math.min(...h.frequencies)<100);assert.ok(Math.max(...h.frequencies)>1500);
 h.audio.close();
});
test('closing during audio activation cannot restart the soundtrack',async()=>{
 const h=audioHarness(true),pending=h.audio.start(false);h.audio.close();h.resolve();await pending;assert.equal(h.timers.size,0);
});
