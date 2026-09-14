'use strict';
const $=s=>document.querySelector(s);
const tasks=[
 ['rubik_vis_vis_reference','RUBIK','Visible–Visible · Viewpoint variation'],
 ['sthereo_day_night_vis_vis','STheReO · Day–Night','Visible–Visible'],
 ['sthereo_day_vis_thermal','STheReO · Day','Visible–Thermal'],
 ['sthereo_day_night_thermal_thermal','STheReO · Day–Night','Thermal–Thermal']
];
const platforms=[['rtx5070ti','RTX 5070 Ti','Workstation'],['rtx5060ti','RTX 5060 Ti','Workstation'],['thor','Jetson AGX Thor','Onboard'],['orin','Jetson Orin Nano','Onboard']];
const titles=['Visual condition','Hardware','Runtime','GPU memory','Accuracy','Results'];
const methods=BENCHMARK.methods;
const families=['Classical','Classical','Learned sparse','Learned sparse','Semi-dense','Semi-dense','Semi-dense · ELoFTR variant','Dense','Dense'];
const base=BENCHMARK.rows.filter(x=>x.task===tasks[0][0]&&x.platform==='thor');
const order=(a,b)=>methods.findIndex(m=>m.id===a.method)-methods.findIndex(m=>m.id===b.method)||a.res-b.res||['native','fp32','mp','fp16'].indexOf(a.precision)-['native','fp32','mp','fp16'].indexOf(b.precision);
base.sort(order);
const id=x=>`${x.method}:${x.res}:${x.precision}`;
const lookup=new Map(BENCHMARK.rows.map(x=>[`${x.task}|${x.platform}|${id(x)}`,x]));
let state={step:0,task:tasks[0][0],platform:'thor',budget:50,memory:null,energy:null,resolution:null,precision:null,angle:10,sort:'method',selected:null,chosenSteps:[]};
let caseResults=[], casePage=0, caseToken=0, caseContext=null;
const nodes=new Map();
const fmt=(x,n=1)=>x==null?'—':x.toFixed(n);
const escapeText=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentRows=()=>base.map(x=>lookup.get(`${state.task}|${state.platform}|${id(x)}`));
const angleIndex=()=>[5,10,20].indexOf(state.angle);
const isChosen=s=>!state.chosenSteps||state.chosenSteps.includes(s);
function rejection(x){
 if(state.step>=1&&isChosen(1)&&(x.oom||x.runtime===null||x.memory===null))return x.oom?'Out of memory during resource measurement.':'Required measurements are unavailable.';
 if(state.step>=1&&isChosen(1)&&state.resolution!==null&&x.res!==state.resolution)return 'Outside the selected resolution.';
 if(state.step>=1&&isChosen(1)&&state.precision!==null&&x.precision!==state.precision)return 'Outside the selected precision.';
 if(state.step>=3&&state.energy!==null&&(x.energy===null||x.energy>state.energy))return x.energy===null?'Energy measurement is unavailable.':`Energy of ${fmt(x.energy,2)} J exceeds the ${state.energy} J limit.`;
 if(state.step>=2&&isChosen(2)&&state.budget!==null&&x.runtime>state.budget)return `Runtime of ${fmt(x.runtime)} ms exceeds the ${state.budget} ms limit.`;
 if(state.step>=3&&isChosen(3)&&state.memory!==null&&x.memory>state.memory)return `GPU memory of ${fmt(x.memory,2)} GiB exceeds the ${state.memory} GiB limit.`;
 return null;
}
function feasible(){return currentRows().filter(x=>!rejection(x));}
function recommendations(rows){
 const tags=new Map(),ai=angleIndex();
 const candidates=rows.filter(x=>Number.isFinite(x.auc[ai])&&x.auc[ai]>0);
 if(!candidates.length)return tags;
 const maximum=Math.max(...candidates.map(x=>x.auc[ai]));
 candidates.filter(x=>Math.abs(x.auc[ai]-maximum)<1e-9).forEach(x=>tags.set(id(x),['Highest pose AUC']));
 return tags;
}
function makeTile(x){const m=methods.find(m=>m.id===x.method);const b=document.createElement('button');b.type='button';b.className='tile';b.style.setProperty('--color',m.color);b.dataset.key=id(x);b.innerHTML='';b.addEventListener('click',()=>{if(state.step<5)return;state.selected=id(x);renderSelection();});nodes.set(id(x),b);return b;}
base.forEach(makeTile);
let boardMode='rows';
let activeAnimations=[];
function ensureBoard(){
 const board=$('#board');
 if(!board.querySelector('.board-labels')){
  const labels=document.createElement('div');labels.className='board-labels';
  board.replaceChildren(labels,...nodes.values());
 }
 return board;
}
function layoutTiles(mode,animate=false){
 const board=ensureBoard();
 const origins=new Map([...nodes].map(([key,b])=>[key,{rect:b.getBoundingClientRect(),present:b.dataset.present!=='false'}]));
 activeAnimations.forEach(a=>a.cancel());activeAnimations=[];
 boardMode=mode;board.className='board '+(mode==='groups'?'results':'matrix');
 const width=board.clientWidth, wide=window.innerWidth>=1500, tile=wide?42:32, gap=wide?9:6, pitch=tile+gap;
 board.style.height=(wide?566:486)+'px';
 const labels=board.querySelector('.board-labels');labels.replaceChildren();
 const positions=new Map(), rows=currentRows(), eligible=feasible();
 const groups=methods.map(m=>eligible.filter(x=>x.method===m.id));
 const tags=recommendations(eligible),ai=angleIndex();
 function label(text,x,y,cls='matrix-label',extra=''){
  const e=document.createElement('div');e.className=cls;if(cls==='precision-heading')e.style.width=tile+'px';if(cls==='resolution-heading')e.style.width=(3*pitch-gap)+'px';e.style.left=x+'px';e.style.top=y+'px';
  e.innerHTML=text+extra;labels.append(e);return e;
 }
 if(mode==='rows'){
  const labelWidth=wide?245:174, extraGap=wide?20:12, matrixWidth=labelWidth+12*pitch-gap+3*extraGap;
  const origin=Math.max(8,(width-matrixWidth)/2), top=wide?68:62;
  [128,256,512,1024].forEach((res,ri)=>{
   const x=origin+labelWidth+ri*(3*pitch+extraGap);
   label(res+' px',x,9,'resolution-heading');
   ['FP32','MP','FP16'].forEach((p,pi)=>label(p,x+pi*pitch,31,'precision-heading'));
  });
  methods.forEach((m,mi)=>{
   const y=top+mi*(wide?53:44);
   label(m.name,origin,y+8,'matrix-label',mi<2?'<small>Native</small>':'');
   base.filter(x=>x.method===m.id).forEach(x=>{
    const ri=[128,256,512,1024].indexOf(x.res),pi=x.precision==='native'?1:['fp32','mp','fp16'].indexOf(x.precision);
    positions.set(id(x),{x:origin+labelWidth+ri*(3*pitch+extraGap)+pi*pitch,y,present:true});
   });
  });
 }else{
  const columns=3, cellWidth=width/columns;
  methods.forEach((m,mi)=>{
   const group=groups[mi];
   group.sort(state.sort==='accuracy'?(a,b)=>b.auc[ai]-a.auc[ai]:state.sort==='runtime'?(a,b)=>a.runtime-b.runtime:order);
   const left=mi%columns*cellWidth+Math.max(12,(cellWidth-4*pitch+gap)/2),top=22+Math.floor(mi/columns)*(wide?184:154);
   label(m.name,left,top,'group-label'+(group.length?'':' no-results'),`<small>${group.length} ${group.length===1?'configuration':'configurations'}</small>`);
   group.forEach((x,i)=>positions.set(id(x),{x:left+(i%4)*pitch,y:top+(wide?49:44)+Math.floor(i/4)*pitch,present:true}));
  });
 }
 const box=board.getBoundingClientRect(),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 rows.forEach(x=>{
  const key=id(x),b=nodes.get(key),from=origins.get(key),target=positions.get(key);
  const present=!!target;
  b.dataset.present=String(present);b.tabIndex=present?0:-1;b.setAttribute('aria-hidden',String(!present));
  b.style.pointerEvents=present?'auto':'none';b.style.opacity=present?'1':'0';
  b.style.width=tile+'px';b.style.height=tile+'px';b.style.setProperty('--delay','0ms');
  b.classList.toggle('recommended',mode==='groups'&&tags.has(key));
  if(target){b.style.left=target.x+'px';b.style.top=target.y+'px';}
  if(!animate||reduce||!from?.rect.width)return;
  const toX=target?box.left+target.x:from.rect.left,toY=target?box.top+target.y:from.rect.top;
  const dx=from.rect.left-toX,dy=from.rect.top-toY,mi=methods.findIndex(m=>m.id===x.method);
  let frames,options;
  if(present&&from.present){
   const delay=mode==='groups'?120+mi*26+[128,256,512,1024].indexOf(x.res)*16:mi*12;
   frames=[{transform:`translate(${dx}px,${dy}px)`,opacity:1},{transform:'translate(0,0)',opacity:1}];
   options={duration:1050,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'};
  }else if(present){
   frames=[{transform:'scale(.72)',opacity:0},{transform:'scale(1)',opacity:1}];
   options={duration:450,delay:100+mi*20,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'};
  }else if(from.present){
   frames=[{transform:'scale(1)',opacity:1},{transform:'scale(.65)',opacity:0}];
   options={duration:240,easing:'ease-in',fill:'backwards'};
  }
  if(frames)activeAnimations.push(b.animate(frames,options));
 });
 if(animate&&!reduce)labels.animate([{opacity:0},{opacity:1}],{duration:400,delay:mode==='groups'?680:150,fill:'backwards'});
 $('#empty').hidden=mode!=='groups'||eligible.length!==0;
}
function renderGrid(animate=false){layoutTiles('rows',animate);}
function renderResults(animate){layoutTiles('groups',animate);}
function option(value,label,sub,current){return `<button class="option ${current===value?'chosen':''}" data-value="${value}" aria-pressed="${current===value}"><strong>${label}</strong>${sub?`<small>${sub}</small>`:''}</button>`;}
function renderQuestion(){
 let h='',desc='',opts='',hint='';const s=state.step;
 if(s===0){h='Visual condition';desc='';opts=`<div class="options">${tasks.map(x=>option(x[0],x[1],x[2],isChosen(0)?state.task:undefined)).join('')}</div>`;hint='';}
 if(s===1){h='Hardware platform';desc='';opts=`<div class="options">${platforms.map(x=>option(x[0],x[1],x[2],isChosen(1)?state.platform:undefined)).join('')}</div>`;hint='';}
 if(s===2){h='Runtime limit';desc='Median matching time per image pair.';opts=`<div class="button-grid">${[10,20,50,100,null].map(x=>option(x,x===null?'No limit':`${x} ms`,'',isChosen(2)?state.budget:undefined)).join('')}</div>`;hint='Excludes model loading and pose estimation.';}
 if(s===3){h='GPU memory limit';desc='Median peak GPU memory, including the model.';opts=`<div class="button-grid">${[0.5,1,2,null].map(x=>option(x,x===null?'No limit':`${x} GiB`,'',isChosen(3)?state.memory:undefined)).join('')}</div>`;hint='';}
 if(s===4){h='Pose accuracy';desc='Choose the angle used for AUC and success rate.';opts=`<div class="button-grid">${[5,10,20].map(x=>option(x,`${x}°`,'',isChosen(4)?state.angle:undefined)).join('')}</div>`;hint='';}
 if(s<5){$('#question').innerHTML=`<h2>${h}</h2>${desc?`<p class="description">${desc}</p>`:""}${opts}${hint?`<p class="hint">${hint}</p>`:''}<div class="actions">${s?'<button class="back" id="back" aria-label="Previous step">←</button>':''}<button class="primary" id="next" ${isChosen(s)?'':'disabled'}>${s===4?'Show results':'Continue'} <span>→</span></button></div>`;
 $('#question').querySelectorAll('[data-value]').forEach(b=>b.onclick=()=>{choose(b.dataset.value);});$('#next').onclick=()=>{go(state.step+1);};if($('#back'))$('#back').onclick=()=>{go(state.step-1);};
 }else{const rows=feasible();$('#question').innerHTML=`<h2>Compare results</h2><p class="result-summary"><strong>${new Set(rows.map(x=>x.method)).size} matchers</strong> meet your limits.</p><p class="budget-label">Runtime limit</p><div class="quick-budgets">${[20,50,100,null].map(v=>`<button type="button" data-budget="${v}" class="${state.budget===v?'chosen':''}" aria-pressed="${state.budget===v}">${v===null?'No limit':v+' ms'}</button>`).join('')}</div><label class="sort-label" for="sort">Sort within each matcher</label><select id="sort"><option value="method">Resolution, then precision</option><option value="accuracy">Pose AUC, highest first</option><option value="runtime">Runtime, lowest first</option></select><div class="actions"><button class="primary" id="edit">Change limits</button></div>`;$('#question').insertAdjacentHTML('beforeend',`<details class="more-filters"><summary>Resolution, precision & energy</summary><label>Resolution<select id="res-filter"><option value="">All resolutions</option>${[128,256,512,1024].map(r=>`<option value="${r}">${r} px</option>`).join('')}</select></label><label>Precision<select id="precision-filter"><option value="">All supported modes</option>${['native','fp32','mp','fp16'].map(v=>`<option value="${v}">${v.toUpperCase()}</option>`).join('')}</select></label><label>Energy limit (J per pair)<input id="energy-filter" type="number" min="0" step="0.1" placeholder="No limit"></label><button id="apply-filters" class="text-button">Apply filters</button><p class="hint">Energy measurement scope varies by platform. <a href="measurement.html#energy">Measurement details</a></p></details>`);
 $('#res-filter').value=state.resolution??'';$('#precision-filter').value=state.precision??'';$('#energy-filter').value=state.energy??'';
 $('#apply-filters').onclick=()=>{state.resolution=$('#res-filter').value?Number($('#res-filter').value):null;state.precision=$('#precision-filter').value||null;state.energy=$('#energy-filter').value?Math.max(0,Number($('#energy-filter').value)):null;go(5);};
 $('#question').querySelectorAll('[data-budget]').forEach(b=>b.onclick=()=>{state.budget=b.dataset.budget==='null'?null:Number(b.dataset.budget);go(5);});
 $('#sort').value=state.sort;$('#sort').onchange=e=>{state.sort=e.target.value;renderResults(true);renderSelection();};$('#edit').onclick=()=>go(2);}
}
function choose(value){if(state.chosenSteps&&!state.chosenSteps.includes(state.step))state.chosenSteps.push(state.step);const field=['task','platform','budget','memory','angle'][state.step];state[field]=state.step<2?value:value==='null'?null:Number(value);state.selected=null;renderQuestion();update();}
function renderSteps(){$('#steps').innerHTML=titles.map((t,i)=>`<button class="step ${i===state.step?'current':i<state.step?'done':''}" ${i>state.step?'disabled':''} data-step="${i}" ${i===state.step?'aria-current="step"':''}><span class="num">${i<state.step?'✓':i+1}</span>${t}</button>`).join('');$('#steps').querySelectorAll('button').forEach(b=>b.onclick=()=>{go(Number(b.dataset.step));});}
function update(){
 const rows=currentRows(),valid=feasible(),tags=state.step===5?recommendations(valid):new Map();
 rows.forEach(x=>{const b=nodes.get(id(x));b.classList.toggle('off',!!rejection(x));b.classList.toggle('recommended',tags.has(id(x)));b.setAttribute('aria-label',`${methods.find(m=>m.id===x.method).name}, ${x.res}px, ${x.precision}, ${rejection(x)||'Eligible'}`);b.title=`${methods.find(m=>m.id===x.method).name} · ${x.res} px · ${x.precision.toUpperCase()}${rejection(x)?' — '+rejection(x):''}`;});
 $('#count').textContent=valid.length;$('#count-label').textContent=state.step<1?'evaluated':'eligible';
 const task=tasks.find(x=>x[0]===state.task),platform=platforms.find(x=>x[0]===state.platform);
 $('#summary').innerHTML=[isChosen(0)?`${task[1]} · ${task[2]}`:null,state.step>=1&&isChosen(1)?platform[1]:null,state.step>=2&&isChosen(2)?(state.budget===null?'No runtime limit':`≤ ${state.budget} ms`):null,state.step>=3&&isChosen(3)?(state.memory===null?'No memory limit':`≤ ${state.memory} GiB`):null,state.step>=4&&isChosen(4)?`Pose AUC @ ${state.angle}°`:null,state.resolution?`${state.resolution} px`:null,state.precision?state.precision.toUpperCase():null,state.energy!==null?`≤ ${state.energy} J`:null].filter(Boolean).map(x=>`<span class="chip">${x}</span>`).join('');
 $('#board-title').textContent=state.step===5?'Matching configurations':'Configurations';
 $('#board-label').textContent=state.step===5?'YOUR SHORTLIST':'CONFIGURATION SPACE';
 $('#evidence').hidden=state.step!==5;$('#announcement').textContent=`${titles[state.step]}, ${valid.length} configurations remaining`;
 renderSelection();
}
function renderSelection(){
 if(caseContext && (state.selected!==id(caseContext)||state.task!==caseContext.task||state.platform!==caseContext.platform||state.angle!==caseContext.angle))$('#case-section').hidden=true;
 [...nodes].forEach(([key,b])=>b.classList.toggle('selected',key===state.selected));
 const x=currentRows().find(x=>id(x)===state.selected);if(!x){$('#inspect').hidden=true;return;}const m=methods.find(m=>m.id===x.method),ai=angleIndex(),why=rejection(x),tags=recommendations(feasible()).get(id(x))||[];
 const explanation=why||((state.step===5&&tags.length)?'Highest pose AUC within your limits.':'Meets the selected limits.');
 const margin=state.step>=2&&state.budget!==null&&x.runtime!==null&&!why?`${fmt(state.budget-x.runtime)} ms below the ${state.budget} ms limit.`:'';
 const fp32=lookup.get(`${state.task}|${state.platform}|${x.method}:${x.res}:fp32`);
 let comparison='';if(x.precision!=='fp32'&&x.precision!=='native'&&fp32?.runtime&&x.runtime!==null){const change=(1-x.runtime/fp32.runtime)*100;comparison=`Against FP32 at the same resolution: runtime ${fmt(Math.abs(change))}% ${change>=0?'lower':'higher'}; pose AUC ${x.auc[ai]-fp32.auc[ai]>=0?'+':''}${fmt(x.auc[ai]-fp32.auc[ai])} pp.`;}
 $('#inspect').hidden=false;$('#inspect').innerHTML=`${why?'<p class="eyebrow">Excluded</p>':''}<h3>${m.name}<br>${x.res} px · ${x.precision.toUpperCase()}</h3><p class="reason">${explanation}</p>${margin?`<p>${margin}</p>`:""}<div class="metrics"><div>Runtime · ms<strong>${fmt(x.runtime)}</strong></div><div>GPU memory · GiB<strong>${fmt(x.memory,2)}</strong></div><div>Pose AUC @ ${state.angle}°<strong>${fmt(x.auc[ai])}%</strong></div><div>Energy per pair · J<strong>${fmt(x.energy,2)}</strong></div></div><p>${x.successes[ai]} / ${x.total} pairs within ${state.angle}° · ${fmt(100*x.successes[ai]/x.total)}% success.</p>${comparison?`<p>${comparison}</p>`:""}<button class="small-link" id="show-cases">View all 100 image pairs →</button>`;
}
function go(step){if(step>state.step&&!isChosen(state.step))return;const previous=state.step;state.step=step;document.body.dataset.step=String(step);state.selected=null;$('#case-section').hidden=true;if(step<5&&previous===5)renderGrid(true);renderSteps();renderQuestion();if(step===5){renderResults(true);const rows=feasible(),tags=recommendations(rows);const winner=rows.find(x=>tags.get(id(x))?.includes('Highest pose AUC'));state.selected=winner?id(winner):null;}update();}
function reset(){state={step:0,task:tasks[0][0],platform:'thor',budget:50,memory:null,energy:null,resolution:null,precision:null,angle:10,sort:'method',selected:null,chosenSteps:[]};renderGrid();go(0);}
function openEvidence(type){const task=tasks.find(x=>x[0]===state.task);$('#paper-ref').textContent=type==='figure4'?'FIGURE 4':'TABLE V';$('#paper-title').textContent=type==='figure4'?'Accuracy across resolutions and hardware':'Accuracy and runtime across precisions';$('#paper-image').src=`assets/${type}.png`;$('#paper-context').textContent=type==='figure4'?`Fig. 4(a): accuracy across four visual conditions and resolutions, FP32/Native. Fig. 4(b): hardware comparison on RUBIK at 256 and 512 px, FP32/Native. Current selection: ${task[1]}, ${task[2]}.`:`Table V compares precisions on RUBIK at 512 px. The current results use ${task[1]}, ${task[2]}, and are separate from the fixed RUBIK / 512 px table.`;$('#paper-dialog').showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('[data-evidence]');if(b)openEvidence(b.dataset.evidence);});$('#close-dialog').onclick=()=>$('#paper-dialog').close();$('#paper-dialog').addEventListener('click',e=>{if(e.target===$('#paper-dialog'))$('#paper-dialog').close();});$('#restart').onclick=()=>{reset();};$('#relax').onclick=()=>go(2);
let resizeFrame, observedBoardWidth=0;new ResizeObserver(()=>{const width=$('#board').clientWidth;if(width===observedBoardWidth)return;observedBoardWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>layoutTiles(state.step===5?'groups':'rows'));}).observe($('#board'));
window.demoState=()=>({...state,feasible:feasible().length});
reset();


async function loadCases(){
 const x=currentRows().find(x=>id(x)===state.selected);if(!x)return;
 const token=++caseToken;caseContext={...x,angle:state.angle};casePage=0;
 $('#case-section').hidden=false;$('#case-grid').textContent='Loading image pairs…';
 try{const response=await fetch(`cases/${x.task}--${x.method}--${x.res}--${x.precision}.json`);if(!response.ok)throw Error('Unavailable');
 const data=await response.json();if(token!==caseToken)return;caseResults=data;$('#case-filter').value='all';renderCases();$('#case-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }catch(error){if(token===caseToken)$('#case-grid').textContent='Image-pair results could not be loaded. Please retry.';}
}
function renderCases(){
 const x=caseContext;if(!x)return;
 const passes=r=>r.error!==null&&r.error<=x.angle;
 const filter=$('#case-filter').value;
 const records=caseResults.filter(r=>filter==='all'||(filter==='success'?passes(r):!passes(r)));
 const success=caseResults.filter(passes).length,method=methods.find(m=>m.id===x.method).name;
 $('#case-title').textContent=`${method} · ${x.res} px · ${x.precision.toUpperCase()}`;
 $('#case-summary').textContent=`${success} / ${caseResults.length} successful pairs (${fmt(100*success/caseResults.length)}%) at ${x.angle}°. Success: pose error ≤ ${x.angle}°.`;
 casePage=Math.min(casePage,Math.max(0,Math.ceil(records.length/6)-1));
 $('#case-grid').innerHTML=records.slice(casePage*6,(casePage+1)*6).map(r=>`<article class="case-card"><img src="assets/pairs/${r.pair}.webp" loading="lazy" alt="Evaluated input image pair"><div><strong class="${passes(r)?'success':'failure'}">${passes(r)?'Success':'Failure'}</strong><span>Pose error: ${r.error===null?'not estimated':fmt(r.error,2)+'°'}</span><span>${r.matches.toLocaleString()} returned correspondences</span><small title="${r.pair}">Pair ${r.pair.slice(-12)}</small></div></article>`).join('')||'<p>No pairs in this category.</p>';
 $('#case-page').textContent=`${records.length?casePage*6+1:0}–${Math.min((casePage+1)*6,records.length)} / ${records.length} pairs`;
 $('#case-prev').disabled=casePage===0;$('#case-next').disabled=(casePage+1)*6>=records.length;
}
document.addEventListener('click',e=>{if(e.target.closest('#show-cases'))loadCases();});
$('#case-filter').onchange=()=>{casePage=0;renderCases();};$('#case-prev').onclick=()=>{casePage--;renderCases();};$('#case-next').onclick=()=>{casePage++;renderCases();};
