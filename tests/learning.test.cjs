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
const expose=`window.test={spokenMath,readingText,readAloud,stopReading,makeQuestion,makeChallengeQuestion,questionIdentity,selectedTopic,options,questPaused,startQuest,finishQuest,answer,renderHintVisual,renderHints,renderLearningSupport,learningStage,renderParent,
    begin(level=1){data=fresh();data.learners=[{id:"test",name:"Test",classLevel:level,plan:planFor(level),mastery:{},completedResults:[],sessions:0,totalCorrect:0,totalAttempts:0,helped:0,beat:{attempts:0,correct:0,tokens:0,best:0}}];activeId="test";selectedTables=new Set([2]);session={index:0,total:12,usedQuestions:new Set(),scratchpad:[],locked:false,correct:0,independent:0,score:0};},
    session:()=>session,learner,topics:TOPICS,mode:value=>playMode=value,topic:value=>questTopic=value,hint:value=>hintLevel=value};`;
  vm.runInContext(source.replace('setup();\n})();',expose+'\n})();'),context);
  return {api:context.window.test,elements,get,buttons,timeouts,intervals,context};
}

test('read-aloud is off by default and requires the learner opt-in',()=>{
 const h=harness(),spoken=[];h.api.begin();
 h.context.window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 h.context.window.speechSynthesis={cancel(){},speak(u){spoken.push(u)},getVoices(){return []}};
 h.api.readAloud('Question');assert.equal(spoken.length,0);
 h.api.learner().readAloud=true;h.api.readAloud('Question');assert.equal(spoken.length,1);
 h.api.learner().readAloud=false;h.api.stopReading();h.api.readAloud('Tip');assert.equal(spoken.length,1);
});

test('read-aloud expands maths symbols, units, fractions and visual references',()=>{
 const {api}=harness();
 assert.equal(api.spokenMath('5 × 7 = ?'),'5 times 7 equals what?');
 assert.equal(api.spokenMath('1/2 of 18 = ?'),'1 over 2 of 18 equals what?');
 assert.equal(api.spokenMath('25% of €80'),'25 percent of 80 euro');
 assert.equal(api.spokenMath('12 cm² and 3 cm³'),'12 square centimetres and 3 cubic centimetres');
 assert.equal(api.spokenMath('30 minutes after 1:00'),'30 minutes after 1 o\'clock');
 assert.match(api.readingText({text:'What is the value of the underlined digit?',visual:{kind:'place',number:73,digitIndex:0}}),/number is 73.*digit is 7/);
 assert.match(api.readingText({text:'What fraction?',visual:{kind:'fraction',parts:4,filled:1}}),/4 equal parts; 1 are coloured/);
});

test('reading pauses speed time, replays without queues and ignores stale completion',()=>{
 const h=harness(),spoken=[];let cancels=0;h.api.begin();h.api.learner().readAloud=true;h.api.session().beatMode='flow';
 h.context.window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 h.context.window.speechSynthesis={cancel(){cancels++},speak(u){spoken.push(u)},getVoices(){return [{lang:'en-IE',localService:true}]}};
 h.api.readAloud('First question');assert.equal(h.api.questPaused(),true);
 h.api.readAloud('Replay');assert.equal(spoken.length,2);assert.equal(cancels,2);
 spoken[0].onend();assert.equal(h.api.questPaused(),true);
 spoken[1].onend();assert.equal(h.api.questPaused(),false);
 h.api.readAloud('Tip');h.api.stopReading();assert.equal(h.api.questPaused(),false);
});

test('Practise gives more attention to topics with errors or frequent help',()=>{
 const {api}=harness();api.begin();api.mode('practice');
 const l=api.learner();
 for(const id of Object.keys(l.plan))l.plan[id]='later';
 for(const id of ['add20','sub20','place100'])l.plan[id]='practice';
 l.mastery.add20={attempts:10,correct:10,helped:0};
 l.mastery.sub20={attempts:10,correct:2,helped:0};
 l.mastery.place100={attempts:10,correct:10,helped:10};
 const counts={add20:0,sub20:0,place100:0};
 for(let i=0;i<3000;i++)counts[api.selectedTopic()]++;
 assert.ok(counts.sub20>counts.add20*1.5);assert.ok(counts.place100>counts.add20*1.5);
});

test('Challenge inverse arithmetic and practical contexts retain valid answers',()=>{
 const {api}=harness();api.begin();
 for(const topic of ['add20','add100','sub20','sub100','groups','tables12'])for(let i=0;i<150;i++){
  const question=api.makeChallengeQuestion(topic),numbers=question.text.match(/\d+/g).map(Number);
  if(question.text.includes('□')){
   const [a,total]=numbers;
   assert.equal(question.answer,question.text.includes('×')?total/a:question.text.includes('−')?a-total:total-a);
  }else assert.equal(question.answer,question.text.includes('bags')?numbers[0]*numbers[1]:question.text.includes('removed')?numbers[0]-numbers[1]:numbers[0]+numbers[1]);
 }
});

test('Challenge supplies twelve unique valid tasks for every selected topic',()=>{
 const {api}=harness();
 for(const topic of Object.keys(api.topics)){
  api.begin(6);let count=0;
  for(let attempts=0;attempts<400&&count<12;attempts++){
   const question=api.makeChallengeQuestion(topic);if(!question||api.session().usedQuestions.has(question.key))continue;
   api.session().usedQuestions.add(question.key);count++;
   assert.equal(question.topic,topic);assert.ok(api.options(question).some(x=>String(x)===String(question.answer)));
  }
  assert.equal(count,12,topic);
 }
});

test('parent learner rows separate name and class and put current status below identity',()=>{
  const {api,get}=harness();api.begin(6);api.renderParent();
  const html=get('#parentLearners').children[0].innerHTML;
  assert.match(html,/class="learner-name-line"><strong>Test<\/strong><span>6th Class<\/span><\/div><span class="small current-learner">Current learner<\/span>/);
  assert.doesNotMatch(html.split('class="learner-actions"')[1],/Current learner/);
});

test('Learn fades support and restores it after a struggle',()=>{
  const {api,get,buttons}=harness();api.begin();api.mode('learn');
  for(let stage=0;stage<3;stage++){
    const s=api.session();s.locked=false;s.q=api.makeQuestion('place100');api.renderLearningSupport();
    assert.equal(api.learningStage(),stage);assert.equal(s.q.helped,stage<2);
    assert.equal(get('#learningSupport').hidden,stage===2);
    api.answer(s.q.answer,buttons[0]);
  }
  assert.equal(api.session().independent,1);
  const s=api.session();s.locked=false;s.q=api.makeQuestion('place100');s.q.tries=1;
  api.answer(-1,buttons[0]);assert.equal(api.learningStage(),1);
  api.mode('practice');api.renderLearningSupport();assert.equal(get('#learningSupport').hidden,true);
});

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
