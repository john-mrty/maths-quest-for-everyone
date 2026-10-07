/* Question-specific, non-interactive maths models. No answer label is revealed. */
(()=>{
function steps(a,b,method){
 if(method==="difference"){
  const points=[b];let at=b;
  const next=Math.min(a,Math.ceil((at+1)/10)*10);
  if(next>at){points.push(next);at=next}
  const tens=Math.floor((a-at)/10)*10;if(tens){at+=tens;points.push(at)}
  if(at<a)points.push(a);
  return points;
 }
 const points=[a];let at=a,remaining=b;
 const tens=Math.floor(remaining/10)*10;if(tens){at-=tens;remaining-=tens;points.push(at)}
 if(remaining)points.push(at-remaining);
 return points;
}
function render(v,more=false){
 const {a,b,op}=v;
 if(v.kind==="group-strategy"){
  const total=op==="×"?a*b:a,method=v.method||"sharing";
  const groups=op==="×"?a:method==="grouping"?a/b:b,each=op==="×"?b:method==="grouping"?b:a/b;
  if(!Number.isInteger(groups)||!Number.isInteger(each)||groups<1||each<1||total>144)return "";
  const array=op==="×"&&!more,rows=array?Math.min(a,b):groups,cols=array?Math.max(a,b):each;
  let drawing="",height;
  if(array){height=rows*19+22;drawing=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>`<circle cx="${34+c*24}" cy="${18+r*19}" r="7" fill="#7655e8"/>`).join("")).join("")}
  else{const across=groups>2?3:groups,cardWidth=360/across,insideCols=Math.min(each,4),insideRows=Math.ceil(each/insideCols),cardHeight=insideRows*18+23;height=Math.ceil(groups/across)*cardHeight+8;
   drawing=Array.from({length:groups},(_,g)=>{const left=(g%across)*cardWidth,top=Math.floor(g/across)*cardHeight;return `<rect x="${left+4}" y="${top+3}" width="${cardWidth-8}" height="${cardHeight-6}" rx="12" fill="#fff" stroke="#dacced" stroke-width="2"/>${Array.from({length:each},(_,i)=>`<circle cx="${left+cardWidth/2+(i%insideCols-(insideCols-1)/2)*19}" cy="${top+17+Math.floor(i/insideCols)*18}" r="6" fill="#7655e8"/>`).join("")}`}).join("");
  }
  const title=op==="×"?(array?"An array of equal groups":"See the equal groups"):method==="grouping"?"Make groups of a given size":"Share equally between groups";
  const caption=op==="×"?`${a} groups of ${b}. Count in ${b}s to find the total.`:method==="grouping"?`Put ${b} counters in each group. Count how many groups use all ${a} counters.`:`Share ${a} counters between ${b} groups. Count the counters in one group.`;
  return `<div class="math-model"><strong>${title}</strong><svg viewBox="0 0 360 ${height}" role="img" aria-label="${caption}">${drawing}</svg><p>${caption}</p></div>`;
 }
 if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>100||b>100||op==="−"&&b>a)return "";
 const wrap=(title,svg,caption)=>`<div class="math-model"><strong>${title}</strong>${svg}<p>${caption}</p></div>`;
 if(op==="+"){
  if(a+b>20||more){
   const svg=`<svg viewBox="0 0 360 130" role="img" aria-label="Part–whole model. Parts ${a} and ${b}, whole unknown."><path d="M180 40 90 93M180 40l90 53" stroke="#c5b4e5" stroke-width="6"/><circle cx="180" cy="32" r="27" fill="#fff3bd"/><circle cx="90" cy="98" r="27" fill="#e9dfff"/><circle cx="270" cy="98" r="27" fill="#d7f5ed"/><g text-anchor="middle" fill="#211b3a" font-size="23" font-family="system-ui" font-weight="700"><text x="180" y="40">?</text><text x="90" y="106">${a}</text><text x="270" y="106">${b}</text></g></svg>`;
return wrap("Two parts make a whole",svg,"Split a part into friendly pieces. Make ten, or add tens and ones.");
  }
  const frames=Math.ceil((a+b)/10),svg=`<svg viewBox="0 0 360 ${frames*65+8}" role="img" aria-label="${a} purple counters and ${b} green counters in ten-frames. Each frame holds ten.">${Array.from({length:frames},(_,f)=>`<rect x="44" y="${f*65+4}" width="272" height="58" rx="10" fill="#fff" stroke="#ded3ed" stroke-width="2"/>${Array.from({length:10},(_,i)=>{const n=f*10+i,x=72+(i%5)*54,y=f*65+19+Math.floor(i/5)*28;return `<circle cx="${x}" cy="${y}" r="10" fill="${n<a?"#7655e8":n<a+b?"#28b99a":"#f0ebf6"}"/>`}).join("")}`).join("")}</svg>`;
  return wrap(a+b<10?"Use a ten-frame":"Make ten, then count on",svg,"Purple is the first part; green is the added part. A full frame makes ten.");
 }
 if(op==="−"){
  const method=more?"difference":"back",points=steps(a,b,method),low=Math.min(...points),high=Math.max(...points),x=n=>36+(method==="back"?points.length-1-points.indexOf(n):points.indexOf(n))/Math.max(1,points.length-1)*288;
  const jumps=points.slice(1).map((n,i)=>{const from=points[i],left=Math.min(x(from),x(n)),right=Math.max(x(from),x(n)),mid=(left+right)/2;return `<path d="M${x(from)} 72Q${mid} 12 ${x(n)} 72" stroke="#7655e8" stroke-width="3" fill="none" marker-end="url(#jump-arrow)"/><text x="${mid}" y="30" text-anchor="middle" fill="#5336c1" font-size="14">${method==="difference"?"+":"−"}${Math.abs(n-from)}</text>`}).join("");
  const ticks=points.map((n,i)=>`<path d="M${x(n)} 67v14" stroke="#aa91ce" stroke-width="2"/><text x="${x(n)}" y="108" text-anchor="middle" fill="#211b3a" font-size="17">${method==="back"&&i===points.length-1?"?":n}</text>`).join("");
  const svg=`<svg viewBox="0 0 360 122" role="img" aria-label="${method==="back"?`Count back ${b} from ${a}. Find the landing number.`:`Count up from ${b} to ${a}. Add the jumps to find the difference.`}"><defs><marker id="jump-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="#7655e8"/></marker></defs><path d="M24 74h312" stroke="#cdbde3" stroke-width="4"/>${jumps}${ticks}</svg>`;
  return wrap(method==="back"?"Count back in friendly jumps":"Find the difference by counting up",svg,method==="back"?"Start at the larger number. Jump left in tens, then ones. Where do you land?":"Start at the smaller number. Jump up to the larger one. Add the jump sizes.");
 }
 return "";
}
window.mathsModels={render,steps};
})();
