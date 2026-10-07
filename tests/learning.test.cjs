const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const source=fs.readFileSync(new URL('../app.js',`file://${__filename}`),'utf8');

function harness(){
  const elements=new Map(),timeouts=[],intervals=[];
  function element(){return {hidden:false,open:false,disabled:false,textContent:'',innerHTML:'',style:{},children:[],className:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(child){this.children.push(child);return child},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},close(){this.open=false},showModal(){this.open=true},get firstChild(){return this},getContext(){return {clearRect(){}}},querySelector(){return element()},getBoundingClientRect(){return {width:500,height:400}},addEventListener(){},focus(){}}}
  const get=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)};
  const buttons=Array.from({length:4},element);
  const context={console,Date,Math:Object.create(Math),crypto:{randomUUID},navigator:{},matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null,setItem(){}},Event:class {},scrollTo(){},requestAnimationFrame(){},setTimeout:fn=>{timeouts.push(fn);return timeouts.length},clearTimeout(){},setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){},window:{addEventListener(){},dispatchEvent(){},questAdventure:{journey(){},award:()=>null,results(){}}},document:{hidden:false,querySelector:get,querySelectorAll:s=>s==='.answer'?buttons:[],createElement:element,createElementNS:element}};
  vm.createContext(context);
  let seed=41;context.Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const expose=`window.test={makeQuestion,questionIdentity,selectedTopic,options,questPaused,startQuest,finishQuest,answer,renderHintVisual,renderHints,
    begin(level=1){data=fresh();data.learners=[{id:"test",name:"Test",classLevel:level,plan:planFor(level),mastery:{},completedResults:[],sessions:0,totalCorrect:0,totalAttempts:0,helped:0,beat:{attempts:0,correct:0,tokens:0,best:0}}];activeId="test";selectedTables=new Set([2]);session={index:0,total:12,usedQuestions:new Set(),scratchpad:[],locked:false,correct:0,independent:0,score:0};},
    session:()=>session,learner,topics:TOPICS,mode:value=>playMode=value,topic:value=>questTopic=value,hint:value=>hintLevel=value};`;
  vm.runInContext(source.replace('setup();\n})();',expose+'\n})();'),context);
  return {api:context.window.test,elements,get,buttons,timeouts,intervals,context};
}

test('place-value digits exist, have an unambiguous position and the correct value',()=>{
  const {api}=harness();api.begin();
  for(const topic of ['place100','place1000','place10000','place100000'])for(let i=0;i<500;i++){
    const q=api.makeQuestion(topic),v=q.visual,digits=String(v.number);
    assert.ok(v.digitIndex>=0&&v.digitIndex<digits.length);
    assert.equal(v.place,10**(digits.length-v.digitIndex-1));
    assert.equal(q.answer,Number(digits[v.digitIndex])*v.place);
    assert.equal(q.key,`${topic}:${v.number}:${v.digitIndex}`);
  }
});
test('every selectable topic can supply a full 12-question round without duplicate tasks',()=>{
  const {api}=harness();
  for(const topic of Object.keys(api.topics)){
    api.begin(6);api.topic(topic);
    for(let i=0;i<12;i++){
      let q;
      for(let retry=0;retry<400;retry++){q=api.makeQuestion(topic);if(q&&!api.session().usedQuestions.has(api.questionIdentity(q)))break;}
      assert.ok(q,`${topic} exhausted at question ${i+1}`);
      assert.equal(q.topic,topic);
      assert.ok(!api.session().usedQuestions.has(api.questionIdentity(q)),`${topic} repeated at question ${i+1}`);
      const answers=api.options(q);assert.ok(answers.some(value=>String(value)===String(q.answer)));
      assert.ok(answers.length>=2&&answers.length<=4);
      if(typeof q.answer==='number')assert.ok(Number.isFinite(q.answer));
      api.session().usedQuestions.add(api.questionIdentity(q));
    }
  }
});
test('fraction identity includes the model and quantity, not shared prompt text',()=>{
  const {api}=harness();api.begin();
  const identities=new Set();
  for(let i=0;i<12;i++){const q=api.makeQuestion('fractionsBasic');assert.ok(q);identities.add(api.questionIdentity(q));api.session().usedQuestions.add(q.key);}
  assert.equal(identities.size,12);
});
test('Learn all includes switched-off class topics; Practise respects the plan',()=>{
  const {api}=harness();api.begin();api.topic('all');
  for(const id of Object.keys(api.learner().plan))api.learner().plan[id]='later';
  api.learner().plan.add20='practice';api.mode('practice');
  for(let i=0;i<50;i++)assert.equal(api.selectedTopic(),'add20');
  api.mode('learn');const seen=new Set(Array.from({length:150},()=>api.selectedTopic()));
  assert.ok(seen.has('fractionsBasic'));assert.ok(seen.has('place100'));
});
test('speed countdown pauses for help, feedback and backgrounding',()=>{
  const h=harness();h.api.begin();h.api.startQuest({beatMode:'flow'});const tick=h.intervals.at(-1),s=h.api.session();
  h.get('#scratchpadDialog').open=true;tick();assert.equal(s.timeLeft,60);
  h.get('#scratchpadDialog').open=false;h.context.document.hidden=true;tick();assert.equal(s.timeLeft,60);
  h.context.document.hidden=false;s.locked=true;tick();assert.equal(s.timeLeft,60);
  s.locked=false;tick();assert.equal(s.timeLeft,59);
});
test('ending a lesson closes the question workspace',()=>{
  const h=harness();h.api.begin();h.get('#scratchpadDialog').open=true;h.api.finishQuest();
  assert.equal(h.get('#scratchpadDialog').open,false);assert.equal(h.api.session(),null);
});
test('second wrong answer stays available until Continue and keeps help usable',()=>{
  const h=harness();h.api.begin();const s=h.api.session();s.q=h.api.makeQuestion('add20');
  h.api.answer(-999,h.buttons[0]);h.api.answer(-998,h.buttons[1]);
  assert.equal(s.locked,true);assert.equal(h.timeouts.length,0);
  assert.equal(h.get('#nextQuestionButton').hidden,false);
  assert.equal(h.get('#scratchpadButton').disabled,false);
});
test('correct answers still automatically advance after the feedback pause',()=>{
  const h=harness();h.api.begin();h.api.session().q=h.api.makeQuestion('add20');
  h.api.answer(h.api.session().q.answer,h.buttons[0]);assert.equal(h.timeouts.length,1);
});
test('fraction, place-value and shape help retain the question model',()=>{
  const h=harness();h.api.begin();h.api.hint(0);
  for(const topic of ['fractionsBasic','place100','shapeEarly']){
    const q=h.api.makeQuestion(topic),model=h.api.renderHintVisual(q);
    assert.ok(model);assert.ok(model.children.length>0);
  }
});
test('reference model is visible before a learner asks for a tip',()=>{
  const h=harness();h.api.begin();h.api.hint(-1);
  h.api.session().q=h.api.makeQuestion('place100');h.api.renderHints();
  assert.ok(h.get('#scratchpadHintContent').children.length>0);
  assert.equal(h.get('#scratchpadMoreHelp').textContent,'Show a tip');
});
test('arithmetic hint captions reveal the result only at the final level',()=>{
  const h=harness();h.api.begin();
  const q={text:'8 + 5 = ?',visual:null};
  h.api.hint(0);let model=h.api.renderHintVisual(q);
  assert.ok(!model.children.at(-1).textContent.includes('13'));
  h.api.hint(2);model=h.api.renderHintVisual(q);
  assert.ok(model.children.at(-1).textContent.includes('13'));
});
