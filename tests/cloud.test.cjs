const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../cloud.js'),'utf8');
const empty = () => ({learners:[],settings:{sound:true}});
const profile = name => ({id:name,name,photo:'',completedResults:[]});
const settle = async () => { for(let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve)); };

async function fixture({remote=null,readError=null,cached=null,meta=null,offline=false,saveError=null,ownerBefore=null}={}) {
  const elements = new Map(), storage = new Map(), calls = [], events = {}, timers=[];
  const userId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  let current = cached || {learners:[profile('guest')],settings:{sound:true}}, activeOwner=ownerBefore;
  const caches = new Map([[null,{learners:[profile('guest')],settings:{sound:true}}]]);
  if(cached) caches.set(userId,cached);
  if(meta) storage.set(`mathsQuestCloudMeta:${userId}`,JSON.stringify(meta));
  const bridge={snapshot:()=>structuredClone(current),owner:()=>activeOwner,
    cached:id=>structuredClone(caches.get(id)||null),empty,inQuest:()=>false,endQuest:()=>{},
    replace:(payload,id)=>{current=structuredClone(payload);activeOwner=id;caches.set(id,structuredClone(payload));},
    clearGuest:()=>caches.delete(null),clearAccount:id=>caches.delete(id)};
  const client={
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:remote,error:readError})})})}),
    rpc:async(name,args)=>{calls.push({name,args});return {data:remote?remote.revision+1:1,error:saveError};},
    auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:{user:{id:userId,email:"parent@example.test"}}}}),signOut:async()=>({error:null}),
      signInWithOAuth:async args=>{calls.push(args);return {error:null};}},
    storage:{from:()=>({upload:async()=>({error:null}),download:async()=>({error:Error('not found')})})},
    functions:{invoke:async()=>({error:null})}
  };
  const context={document:{addEventListener:(name,fn)=>events[name]=fn,querySelector:()=>({inert:false}),getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    navigator:{onLine:!offline},location:{origin:'https://example.test',pathname:'/maths/'},
    setInterval:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},structuredClone,
    confirm:()=>true,console:{warn:()=>{}},crypto:require('node:crypto').webcrypto};
  context.window={mathsQuest:bridge,MATHS_QUEST_CLOUD:{url:'https://project.test',publishableKey:'public',providers:{google:true,apple:true}},
    supabase:{createClient:()=>client},addEventListener:(name,fn)=>events[name]=fn};
  vm.runInNewContext(source,context);
  await settle();
  return {elements,storage,calls,bridge,events,timers,userId,caches,client};
}

test('new account migrates guest profiles and clears guest copy only after successful save',async()=>{
  const f=await fixture();
  assert.equal(f.calls.length,1);
  assert.equal(f.elements.get('cloudIdentity').textContent,'Signed in as parent@example.test');
  assert.equal(f.elements.get('cloudIdentity').hidden,false);
  assert.equal(f.elements.get('cloudImportGuest').hidden,true);
  assert.equal(f.calls[0].args.expected_revision,null);
  assert.equal(f.calls[0].args.new_payload.learners[0].name,'guest');
  assert.equal(f.caches.has(null),false);
  assert.equal(JSON.parse(f.storage.get(`mathsQuestCloudMeta:${f.userId}`)).dirty,false);
});
test('existing account loads cloud profiles without silently merging guest data',async()=>{
  const f=await fixture({remote:{revision:3,payload:{learners:[profile('saved')],settings:{sound:false}}}});
  assert.equal(f.bridge.snapshot().learners[0].name,'saved');
  assert.equal(f.calls.length,0);
  assert.equal(f.caches.has(null),true);
  assert.match(f.elements.get('profileSaving').textContent,/Your parent account/);
  assert.match(f.elements.get('accountSaving').textContent,/automatically/);
});
test('new account keeps guest data if cloud save fails',async()=>{
  const f=await fixture({saveError:Error('network')});
  assert.equal(f.caches.has(null),true);
  assert.equal(JSON.parse(f.storage.get(`mathsQuestCloudMeta:${f.userId}`)).dirty,true);
});
test('failed initial cloud read never uploads guest profiles to an unknown account',async()=>{
  const f=await fixture({readError:Error('network')});
  assert.equal(f.calls.length,0);
  assert.equal(f.bridge.owner(),null);
  assert.equal(f.bridge.snapshot().learners[0].name,'guest');
});
test('offline same-account cache and dirty changes are preserved',async()=>{
  const f=await fixture({readError:Error('offline'),offline:true,ownerBefore:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    cached:{learners:[profile('offline')],settings:{}},meta:{revision:2,dirty:true}});
  assert.equal(f.bridge.snapshot().learners[0].name,'offline');
  assert.equal(f.calls.length,0);
});
test('dirty stale device refuses to overwrite a newer cloud revision',async()=>{
  const f=await fixture({cached:{learners:[profile('local')],settings:{}},meta:{revision:2,dirty:true},
    remote:{revision:3,payload:{learners:[profile('remote')],settings:{}}}});
  assert.equal(f.bridge.snapshot().learners[0].name,'local');
  assert.equal(f.calls.length,0);
  assert.equal(f.elements.get('cloudLoad').hidden,false);
  assert.match(f.elements.get('cloudStatus').textContent,/newer save/);
});
test('matching revision retries pending changes with compare-and-save',async()=>{
  const f=await fixture({cached:{learners:[profile('local')],settings:{}},meta:{revision:2,dirty:true},
    remote:{revision:2,payload:{learners:[profile('remote')],settings:{}}}});
  assert.equal(f.calls[0].args.expected_revision,2);
  assert.equal(f.calls[0].args.new_payload.learners[0].name,'local');
});
test('server conflict retains local changes and disables further automatic saves',async()=>{
  const f=await fixture({saveError:Error('SAVE_CONFLICT')});
  assert.equal(f.elements.get('cloudLoad').hidden,false);
  assert.equal(JSON.parse(f.storage.get(`mathsQuestCloudMeta:${f.userId}`)).dirty,true);
  assert.equal(f.caches.has(null),true);
});
test('sign out removes account cache and restores guest use',async()=>{
  const f=await fixture({remote:{revision:1,payload:{learners:[profile('saved')],settings:{}}}});
  await f.elements.get('cloudSignOut').onclick();
  assert.equal(f.bridge.owner(),null);
  assert.equal(f.elements.get('cloudIdentity').hidden,true);
  assert.equal(f.elements.get('cloudIdentity').textContent,'');
  assert.equal(f.caches.has(f.userId),false);
  assert.equal(f.bridge.snapshot().learners[0].name,'guest');
  assert.match(f.elements.get('profileSaving').textContent,/Play without an account/);
  assert.match(f.elements.get('avatarPhotoSaving').textContent,/Photos stay on this device/);
});
test('adding guest profiles uses new IDs and keeps account preferences',async()=>{
  const f=await fixture({remote:{revision:1,payload:{learners:[profile('saved')],settings:{sound:false}}}});
  f.elements.get('cloudImportGuest').onclick();
  assert.equal(f.bridge.snapshot().learners.length,2);
  assert.notEqual(f.bridge.snapshot().learners[1].id,'guest');
  assert.equal(f.bridge.snapshot().settings.sound,false);
  assert.equal(f.caches.has(null),true); // Not discarded before a successful save.
});
test('edits made while a save is in flight remain dirty for the next save',async()=>{
  const f=await fixture({remote:{revision:1,payload:{learners:[profile('saved')],settings:{}}}});
  let finishSave;
  f.client.rpc=()=>new Promise(resolve=>{finishSave=resolve;});
  f.events['mathsquest:changed']();
  const pending=f.timers.at(-1)();
  await settle();
  const changed=f.bridge.snapshot(); changed.learners[0].name='changed during save';
  f.bridge.replace(changed,f.userId); f.events['mathsquest:changed']();
  finishSave({data:2,error:null}); await pending;
  const meta=JSON.parse(f.storage.get(`mathsQuestCloudMeta:${f.userId}`));
  assert.equal(meta.revision,2); assert.equal(meta.dirty,true);
  assert.equal(f.bridge.snapshot().learners[0].name,'changed during save');
});

test('foreground check automatically loads a newer save on a clean device',async()=>{
  const f=await fixture({remote:{revision:1,payload:{learners:[profile('saved')],settings:{}}}});
  f.client.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{revision:2,payload:{learners:[profile('updated elsewhere')],settings:{}}},error:null})})})});
  await f.events.focus();
  assert.equal(f.bridge.snapshot().learners[0].name,'updated elsewhere');
  assert.equal(f.elements.get('cloudLoad').hidden,true);
});
test('foreground download never replaces edits made while fetching',async()=>{
  const f=await fixture({remote:{revision:1,payload:{learners:[profile('saved')],settings:{}}}});
  let finishRead;
  f.client.from=()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(resolve=>{finishRead=resolve;})})})});
  const pending=f.events.focus();
  const changed=f.bridge.snapshot();changed.learners[0].name='local edit';f.bridge.replace(changed,f.userId);f.events['mathsquest:changed']();
  finishRead({data:{revision:2,payload:{learners:[profile('remote edit')],settings:{}}},error:null});await pending;
  assert.equal(f.bridge.snapshot().learners[0].name,'local edit');
  assert.equal(JSON.parse(f.storage.get(`mathsQuestCloudMeta:${f.userId}`)).dirty,true);
});
