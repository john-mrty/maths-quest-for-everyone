const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('../racer.js',`file://${__filename}`),'utf8');
test('control hints distinguish touch and keyboard devices and update on layout changes',()=>{
 const start=source.indexOf(' function defaultSteeringCopy()'),end=source.indexOf(' touchControls.addEventListener',start);
 const copy={},h={phase:'drive',touchControls:{matches:true},tiltLabel:{},tiltStatus:{},tiltEnabled:false,$:()=>copy};vm.createContext(h);vm.runInContext(source.slice(start,end),h);h.syncControlHints();
 assert.match(copy.textContent,/Swipe up/);assert.doesNotMatch(copy.textContent,/Spacebar|A \/ D/);assert.equal(h.tiltLabel.hidden,false);
 h.touchControls.matches=false;h.syncControlHints();assert.match(copy.textContent,/Spacebar/);assert.doesNotMatch(copy.textContent,/Swipe/);assert.equal(h.tiltLabel.hidden,true);assert.doesNotMatch(h.tiltStatus.textContent,/Tap|tilt/);
});
test('tilt calibrates, maps portrait and landscape, ignores pauses and invalid samples',()=>{
 const start=source.indexOf(' function onTilt(e)'),end=source.indexOf(" $('#raceTilt').onchange",start);
 const h={tiltEnabled:true,disposed:false,document:{hidden:false},phase:'drive',tiltZero:null,tiltAngle:null,tiltFiltered:0,tiltTimer:0,tiltStatus:{},lane:1,window:{screen:{orientation:{angle:0}}},clearTimeout(){}};
 h.steer=n=>h.lane=n;vm.createContext(h);vm.runInContext(source.slice(start,end),h);
 const sample=(gamma,beta=0)=>{for(let i=0;i<16;i++)h.onTilt({gamma,beta});};
 sample(10);assert.equal(h.lane,1);sample(30);assert.equal(h.lane,2);sample(10);assert.equal(h.lane,1);sample(-10);assert.equal(h.lane,0);
 h.phase='pause';sample(30);assert.equal(h.lane,0);h.phase='drive';sample(null);assert.equal(h.lane,0);
 h.window.screen.orientation.angle=90;sample(0,20);sample(0,40);assert.equal(h.lane,2);sample(0,0);assert.equal(h.lane,0);
 h.tiltEnabled=false;sample(0,40);assert.equal(h.lane,0);
});
test('tilt requests motion permission only on opt-in and provides denial, unavailable and missing-sensor fallbacks',async()=>{
 const start=source.indexOf(' let tiltEnabled=false'),end=source.indexOf(" const pace=",start),snippet=source.slice(start,end);
 async function setup(orientation){const checkbox={checked:true},status={},events=new Map();let timer,requests=0;const h={tiltLabel:{},window:{matchMedia:()=>({matches:true,addEventListener(){}}),isSecureContext:true,DeviceOrientationEvent:orientation,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},document:{hidden:false},dialog:{classList:{add(){},remove(){}}},disposed:false,phase:'ready',tiltStatus:status,$:()=>checkbox,clearTimeout(){},setTimeout:fn=>{timer=fn;return 1;},steer(){},pause(){}};vm.createContext(h);vm.runInContext(snippet,h);assert.equal(events.size,0);await checkbox.onchange();return {checkbox,status,events,timeout:()=>timer?.(),h};}
 const denied=await setup({requestPermission:async()=> 'denied'});assert.equal(denied.checkbox.checked,false);assert.match(denied.status.textContent,/not allowed/);
 const absent=await setup(undefined);assert.equal(absent.checkbox.checked,false);assert.match(absent.status.textContent,/unavailable/);
 const granted=await setup({requestPermission:async()=> 'granted'});assert.equal(granted.events.size,1);granted.timeout();assert.equal(granted.checkbox.checked,false);assert.equal(granted.events.size,0);
 const enabled=await setup({});enabled.checkbox.checked=false;await enabled.checkbox.onchange();assert.equal(enabled.events.size,0);
});
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
