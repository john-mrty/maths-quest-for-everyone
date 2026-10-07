const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../math-models.js',`file://${__filename}`),'utf8'),context);const {steps,render}=context.window.mathsModels;
test('subtraction models preserve the exact quantity in both strategies',()=>{
 for(let a=2;a<=100;a++)for(let b=1;b<a;b++){
  const back=steps(a,b,'back'),up=steps(a,b,'difference');
  assert.equal(back[0],a);assert.equal(back.at(-1),a-b);assert.ok(back.length<=3);
  assert.equal(up[0],b);assert.equal(up.at(-1),a);assert.ok(up.length<=4);
  assert.equal(up.slice(1).reduce((sum,n,i)=>sum+n-up[i],0),a-b);
 }
});
test('ten-frames preserve each part and do not label the answer',()=>{
 for(let a=2;a<20;a++)for(let b=1;b<=20-a;b++){
  const html=render({a,b,op:'+'});
  assert.equal((html.match(/fill="#7655e8"/g)||[]).length,a);
  assert.equal((html.match(/fill="#28b99a"/g)||[]).length,b);
  assert.equal((html.match(/<circle/g)||[]).length,Math.ceil((a+b)/10)*10);
 }
 assert.match(render({a:24,b:13,op:'+'}),/Parts 24 and 13, whole unknown/);
 assert.match(render({a:15,b:8,op:'−'},true),/Count up from 8 to 15/);
});
