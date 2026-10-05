const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/delete-account/index.ts'),'utf8')
  .replace(/^import .*;\n/m,'').replace(/Deno\.env\.get\(([^)]+)\)!/g,'Deno.env.get($1)');
function fixture({invalid=false,cleanupFails=false}={}){
  let handler,listed=false;
  const calls=[];
  const admin={auth:{getUser:async token=>({data:{user:invalid?null:{id:'caller'}},error:invalid?Error('invalid'):null}),
    admin:{signOut:async(token,scope)=>{calls.push(['revoke',scope]);return {error:null};},
      deleteUser:async id=>{calls.push(['deleteUser',id]);return {error:null};}}},
    storage:{from:bucket=>({list:async prefix=>{calls.push(['list',prefix]);const result=listed?[]:[{name:'test.jpg'}];listed=true;return {data:result,error:null};},
      remove:async files=>{calls.push(['remove',files]);return {error:cleanupFails?Error('failed'):null};}})}};
  vm.runInNewContext(source,{Deno:{env:{get:()=> 'server-only'},serve:fn=>handler=fn},createClient:()=>admin,Response,JSON});
  return {handler,calls};
}
const request=authorization=>new Request('https://example.test/delete-account',{method:'POST',headers:authorization?{Authorization:authorization}:{},body:JSON.stringify({user_id:'someone-else'})});
test('missing bearer cannot invoke privileged operations',async()=>{
  const f=fixture();const result=await f.handler(request());assert.equal(result.status,401);assert.deepEqual(f.calls,[]);
});
test('invalid bearer cannot invoke privileged operations',async()=>{
  const f=fixture({invalid:true});const result=await f.handler(request('Bearer invalid'));assert.equal(result.status,401);assert.deepEqual(f.calls,[]);
});
test('deletion uses verified caller, revokes sessions, removes photos, then deletes user',async()=>{
  const f=fixture();const result=await f.handler(request('Bearer test'));
  assert.equal(result.status,200);
  assert.deepEqual(f.calls.map(call=>JSON.parse(JSON.stringify(call))),[
    ['revoke','global'],['list','caller'],['remove',['caller/test.jpg']],['list','caller'],['deleteUser','caller']
  ]);
});
test('failed photo cleanup prevents auth deletion so cleanup can be retried',async()=>{
  const f=fixture({cleanupFails:true});const result=await f.handler(request('Bearer test'));
  assert.equal(result.status,500);assert.equal(f.calls.some(call=>call[0]==='deleteUser'),false);
});
