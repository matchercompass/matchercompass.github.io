'use strict';
const $=s=>document.querySelector(s);
const tasks=[
 ['rubik_vis_vis_reference','RUBIK','Visible–Visible · Viewpoint variation'],
 ['sthereo_day_night_vis_vis','STheReO · Day–Night','Visible–Visible'],
 ['sthereo_day_vis_thermal','STheReO · Day','Visible–Thermal'],
 ['sthereo_day_night_thermal_thermal','STheReO · Day–Night','Thermal–Thermal']
];
const taskPreviews={"rubik_vis_vis_reference":{"pair":"rubik_pair_fe2c00404ae681893436bfae","layout":{"width":400,"height":454,"a":{"original":[1600,900],"size":[400,225],"x":0,"y":0},"b":{"original":[1600,900],"size":[400,225],"x":0,"y":229}}},"sthereo_day_night_vis_vis":{"pair":"9473ca3c1535438338720724a7c4167b2eb0bae93e0516901b0bbd241be35fd3","layout":{"width":400,"height":354,"a":{"original":[1280,560],"size":[400,175],"x":0,"y":0},"b":{"original":[1280,560],"size":[400,175],"x":0,"y":179}}},"sthereo_day_vis_thermal":{"pair":"ce50ef4b926fb26809cc8fb86855c45c9ef5bd0a36122c0e964d777be4439fb3","layout":{"width":400,"height":439,"a":{"original":[1280,560],"size":[400,175],"x":0,"y":0},"b":{"original":[640,512],"size":[325,260],"x":37,"y":179}}},"sthereo_day_night_thermal_thermal":{"pair":"f003be634af1fa1c5e45356c6ffda4de0ae985997ecde9244b9473604e4aaf34","layout":{"width":325,"height":524,"a":{"original":[640,512],"size":[325,260],"x":0,"y":0},"b":{"original":[640,512],"size":[325,260],"x":0,"y":264}}}};
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
let caseResults=[], caseToken=0, caseContext=null;
const caseCache=new Map();
let galleryOpen=false;
let exampleMeta=null,exampleCategory="success",exampleIndex=0,drawToken=0;
let currentDrawing=null;
const overlayCache=new Map();
let transitionToken=0;
let motionControls=[];
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
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
function makeTile(x){
 const m=methods.find(m=>m.id===x.method), b=document.createElement('button');
 b.type='button'; b.className='tile'; b.style.setProperty('--color',m.color); b.dataset.key=id(x);
 b.addEventListener('click',()=>selectConfiguration(id(x))); nodes.set(id(x),b); return b;
}
base.forEach(makeTile);
function layoutTiles(mode,animate=false,origins=null){
 const board=$('#board'), previous=origins||new Map([...nodes].map(([key,b])=>[key,b.getBoundingClientRect()]));
 board.className='board '+mode;
 if(!board.querySelector('.board-labels')){
  const labels=document.createElement('div');labels.className='board-labels';board.replaceChildren(labels,...nodes.values());
 }
 const labels=board.querySelector('.board-labels');labels.replaceChildren();
 const compact=false;
 board.style.width=compact?Math.max(board.parentElement.clientWidth,methods.length*190)+'px':'100%';
 const width=board.clientWidth, rows=currentRows(), eligible=feasible();
 const positions=new Map(), groups=methods.map(m=>eligible.filter(x=>x.method===m.id)), tags=recommendations(eligible);
 const gap=compact?7:8;
 const boardTop=board.getBoundingClientRect().top+window.scrollY;
 const uiScale=Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'))||1;
 const rowFit=Math.floor(((innerHeight-boardTop)/uiScale-86)/methods.length)-6;
 const tile=compact?32:Math.max(28,Math.min(innerHeight<820?32:40,Math.floor((width-236)/15),mode==='rows'&&innerWidth>740?rowFit:40));
 const pitch=tile+gap;
 function label(text,x,y,cls,width){const e=document.createElement('div');e.className=cls;e.style.left=x+'px';e.style.top=y+'px';if(width)e.style.width=width+'px';e.innerHTML=text;labels.append(e);}
 if(mode==='rows'){
  const labelWidth=width>1100?230:190, columnWidth=(width-labelWidth-8)/4, top=48, rowHeight=tile+6;
  [128,256,512,1024].forEach((res,ri)=>{
   const left=labelWidth+ri*columnWidth+(columnWidth-3*pitch+gap)/2;
   label(res+' px',left,0,'resolution-heading',3*pitch-gap);
   ['FP32','MP','FP16'].forEach((p,pi)=>label(p,left+pi*pitch,24,'precision-heading',tile));
  });
  methods.forEach((m,mi)=>{
   const y=top+mi*rowHeight;
   label(m.name+(mi<2?'<small>Native</small>':''),4,y+(tile-18)/2,'matrix-label',labelWidth-12);
   base.filter(x=>x.method===m.id).forEach(x=>{
    const ri=[128,256,512,1024].indexOf(x.res), pi=x.precision==='native'?1:['fp32','mp','fp16'].indexOf(x.precision);
    positions.set(id(x),{x:labelWidth+ri*columnWidth+(columnWidth-3*pitch+gap)/2+pi*pitch,y});
   });
  });
  board.style.height=(top+methods.length*rowHeight)+'px';
 }else{
  const columns=compact?methods.length:(width<680?2:3), cellWidth=width/columns, perRow=compact?4:Math.min(6,Math.max(2,Math.floor((cellWidth-24+gap)/pitch)));
  let top=6;
  for(let row=0;row<Math.ceil(methods.length/columns);row++){
   let rowHeight=70;
   for(let col=0;col<columns;col++){
    const mi=row*columns+col, m=methods[mi];if(!m)continue;
    const group=groups[mi];group.sort(state.sort==='accuracy'?(a,b)=>b.auc[angleIndex()]-a.auc[angleIndex()]:state.sort==='runtime'?(a,b)=>a.runtime-b.runtime:order);
    const left=col*cellWidth+(compact?8:Math.max(12,(cellWidth-perRow*pitch+gap)/2));
    label(m.name+`<small>${group.length} configurations</small>`,left,top,'group-label'+(!group.length?' no-results':''),cellWidth-18);
    group.forEach((x,i)=>positions.set(id(x),{x:left+(i%perRow)*pitch,y:top+42+Math.floor(i/perRow)*pitch}));
    rowHeight=Math.max(rowHeight,42+Math.ceil(group.length/perRow)*pitch+18);
   }
   top+=rowHeight;
  }
  board.style.height=top+'px';
 }
 const box=board.getBoundingClientRect(), reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 rows.forEach(x=>{
  const b=nodes.get(id(x)),p=positions.get(id(x)),from=previous.get(id(x));
  b.hidden=!p;b.tabIndex=p?0:-1;b.style.width=tile+'px';b.style.height=tile+'px';
  b.classList.toggle('recommended',mode==='groups'&&tags.has(id(x)));
  if(p){b.style.left=p.x+'px';b.style.top=p.y+'px';}
  b.getAnimations().forEach(a=>a.cancel());
  if(p&&animate&&!reduce&&from?.width)b.animate([{transform:`translate(${(from.left-box.left)/uiScale-p.x}px,${(from.top-box.top)/uiScale-p.y}px)`},{transform:'translate(0,0)'}],{duration:500,easing:'cubic-bezier(.22,1,.36,1)'});
 });
 $('#empty').hidden=mode!=='groups'||eligible.length!==0;
}
function option(value,label,sub,current,variation=''){return `<button type="button" class="option ${variation?'task-option':''} ${current===value?'chosen':''}" data-value="${value}" aria-pressed="${current===value}"><strong>${label}</strong>${variation?`<span class="variation">${variation}</span>`:''}${sub?`<small>${sub}</small>`:''}${variation?`<canvas class="task-preview" data-task-preview="${value}" role="img" aria-label="${label}, ${variation}: example image pair"></canvas>`:''}</button>`;}
function drawTaskPreviews(){
 $('#question').querySelectorAll('[data-task-preview]').forEach(canvas=>{
  const preview=taskPreviews[canvas.dataset.taskPreview],L=preview.layout,img=new Image();
  canvas.width=2*L.width+4;canvas.height=Math.max(L.a.size[1],L.b.size[1]);
  img.onload=()=>{const ctx=canvas.getContext('2d');ctx.fillStyle='#fafbf9';ctx.fillRect(0,0,canvas.width,canvas.height);
   for(const [side,offset]of [['a',0],['b',L.width+4]]){const f=L[side];ctx.drawImage(img,f.x,f.y,f.size[0],f.size[1],offset+f.x,(canvas.height-f.size[1])/2,f.size[0],f.size[1]);}
  };img.src=`assets/pairs/${preview.pair}.webp`;
 });
}
function renderQuestion(){
 const s=state.step;
 if(s<5){
  const headings=['Which images will you match?','Which hardware will run the matcher?','What is your matching time budget?','Do you have a GPU memory limit?','Which pose error is acceptable?'];
  const descriptions=['Choose the closest evaluated condition.','','Median time per pair, excluding model loading and pose estimation.','Optional. Includes the model and matching allocations.','The threshold used to report pose AUC and successful pairs.'];
  let options;
  if(s===0){const labels=[['Visible–Visible','Viewpoint variation','RUBIK'],['Visible–Visible','Day–Night','STheReO'],['Visible–Thermal','Daytime','STheReO'],['Thermal–Thermal','Day–Night','STheReO']];options=tasks.map((x,i)=>option(x[0],labels[i][0],labels[i][2],isChosen(0)?state.task:undefined,labels[i][1])).join('');}
  if(s===1)options=platforms.map(x=>option(x[0],x[1],x[2],isChosen(1)?state.platform:undefined)).join('');
  if(s>=2){const choices=s===2?[10,20,50,100,null]:s===3?[0.5,1,2,null]:[5,10,20];const field=['','','budget','memory','angle'][s];options=choices.map(x=>option(x,x===null?'No limit':s===2?`${x} ms`:s===3?`${x} GiB`:`${x}°`,'',isChosen(s)?state[field]:undefined)).join('');}
  $('#question').innerHTML=`<div class="question-title"><h2>${headings[s]}</h2>${descriptions[s]?`<p>${descriptions[s]}</p>`:''}</div><div class="options">${options}</div><div class="actions">${s?'<button class="back" id="back" aria-label="Previous step">← Back</button>':''}<button class="primary" id="next" ${isChosen(s)?'':'disabled'}>${s===4?'Show results':'Continue'} →</button></div>`;
  $('#question').querySelectorAll('[data-value]').forEach(b=>b.onclick=()=>choose(b.dataset.value));if(s===0)drawTaskPreviews();$('#next').onclick=()=>go(s+1);if($('#back'))$('#back').onclick=()=>go(s-1);
 }else{
  $('#question').innerHTML=`<div class="result-controls"><div><label>Time budget</label><div class="quick-budgets">${[20,50,100,null].map(v=>`<button type="button" data-budget="${v}" class="${state.budget===v?'chosen':''}" aria-pressed="${state.budget===v}">${v===null?'No limit':v+' ms'}</button>`).join('')}</div></div><label>Pose threshold<select id="angle-filter">${[5,10,20].map(v=>`<option value="${v}">${v}°</option>`).join('')}</select></label><label>Sort within matcher<select id="sort"><option value="method">Resolution · precision</option><option value="accuracy">Highest pose AUC</option><option value="runtime">Lowest runtime</option></select></label><button class="text-button" id="edit">Change requirements</button><details class="more-filters"><summary>More filters</summary><div class="filter-fields"><label>Resolution<select id="res-filter"><option value="">All resolutions</option>${[128,256,512,1024].map(r=>`<option value="${r}">${r} px</option>`).join('')}</select></label><label>Precision<select id="precision-filter"><option value="">All supported modes</option>${['native','fp32','mp','fp16'].map(v=>`<option value="${v}">${v.toUpperCase()}</option>`).join('')}</select></label><label>Energy limit · J / pair<input id="energy-filter" type="number" min="0" step="0.1" placeholder="No limit"></label><button id="apply-filters" class="primary">Apply</button><a href="measurement.html#energy">Power measurement scope</a></div></details></div>`;
  $('#res-filter').value=state.resolution??'';$('#precision-filter').value=state.precision??'';$('#energy-filter').value=state.energy??'';
  $('#apply-filters').onclick=()=>{const input=$('#energy-filter');if(!input.reportValidity())return;state.resolution=Number($('#res-filter').value)||null;state.precision=$('#precision-filter').value||null;state.energy=input.value===''?null:Number(input.value);go(5);};
  $('#question').querySelectorAll('[data-budget]').forEach(b=>b.onclick=()=>{state.budget=b.dataset.budget==='null'?null:Number(b.dataset.budget);go(5);});
  $('#angle-filter').value=state.angle;$('#angle-filter').onchange=e=>{state.angle=Number(e.target.value);update();if(galleryOpen){renderSelection();caseContext.angle=state.angle;exampleIndex=-1;renderCases();}layoutTiles('groups');};
  $('#sort').value=state.sort;$('#sort').onchange=e=>{state.sort=e.target.value;layoutTiles('groups',true);};$('#edit').onclick=()=>go(0);
  const fold=document.createElement('details');fold.className='adjust-requirements';const label=document.createElement('summary');label.textContent='Adjust requirements';fold.append(label,...$('#question').children);$('#question').replaceChildren(fold);
 }
}
function choose(value){if(galleryOpen)closeGallery();if(!state.chosenSteps.includes(state.step))state.chosenSteps.push(state.step);const field=['task','platform','budget','memory','angle'][state.step];state[field]=state.step<2?value:value==='null'?null:Number(value);renderQuestion();update();}
function renderSteps(){
 const complete=state.step===5;
 $('#steps').innerHTML=`<span class="step-position">${complete?'Requirements set':`Step ${state.step+1} of 5`}</span><div class="step-track">${titles.slice(0,5).map((t,i)=>`<button type="button" class="step-segment ${i===state.step?'current':i<state.step?'done':''}" ${i>state.step?'disabled':''} data-step="${i}" aria-label="${t}${i<state.step?', completed':''}" ${i===state.step?'aria-current="step"':''} title="${t}"></button>`).join('')}</div>`;
 $('#steps').querySelectorAll('button').forEach(b=>b.onclick=()=>go(Number(b.dataset.step)));
}

function update(){
 const valid=feasible(),tags=state.step===5?recommendations(valid):new Map();
 currentRows().forEach(x=>{const b=nodes.get(id(x)), name=methods.find(m=>m.id===x.method).name; b.classList.toggle('off',!!rejection(x));b.classList.toggle('selected',galleryOpen&&state.selected===id(x));b.classList.toggle('recommended',tags.has(id(x)));b.setAttribute('aria-pressed',String(galleryOpen&&state.selected===id(x))); b.setAttribute('aria-label',`${name}, ${x.res}px, ${x.precision}, ${rejection(x)||'Eligible'}`);b.title=`${name} · ${x.res} px · ${x.precision.toUpperCase()}\nPose AUC@${state.angle}° ${fmt(x.auc[angleIndex()])}% · ${fmt(x.runtime)} ms${rejection(x)?'\n'+rejection(x):''}`;});
 $('#count').textContent=valid.length;$('#count-label').textContent=state.step<1?'evaluated':'eligible';
 const task=tasks.find(x=>x[0]===state.task),platform=platforms.find(x=>x[0]===state.platform);
 const answers=[
  (galleryOpen||isChosen(0))?{text:`${task[1]} · ${task[2]}`,step:0}:null,
  (galleryOpen||(state.step>=1&&isChosen(1)))?{text:platform[1],step:1}:null,
  state.step>=2&&isChosen(2)?{text:state.budget===null?'No time limit':`≤ ${state.budget} ms`,step:2}:null,
  state.step>=3&&isChosen(3)?{text:state.memory===null?'No memory limit':`≤ ${state.memory} GiB`,step:3}:null,
  (galleryOpen||(state.step>=4&&isChosen(4)))?{text:`Pose @ ${state.angle}°`,step:4}:null
 ].filter(Boolean);
 $('#summary').innerHTML=answers.map(a=>`<button type="button" data-edit-step="${a.step}" title="Change ${titles[a.step].toLowerCase()}">${a.text}</button>`).join('')+[state.resolution?`${state.resolution} px`:null,state.precision?state.precision.toUpperCase():null,state.energy!==null?`≤ ${state.energy} J`:null].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
 $('#summary').querySelectorAll('[data-edit-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.editStep)));

 $('#board-title').textContent=state.step===5?'Matching configurations':'Configurations';
 $('#evidence').hidden=state.step!==5;$('#announcement').textContent=`${titles[state.step]}, ${valid.length} configurations remaining`;
}
function closeGallery(){stopTransition();drawToken++;caseToken++;galleryOpen=false;state.selected=null;caseContext=null;$('#workspace').classList.remove('inspecting');$('#case-section').hidden=true;$('#all-configs').hidden=true;}
function go(step){if(step>state.step&&!isChosen(state.step))return;closeGallery();state.step=step;if((step===3||step===4)&&!isChosen(step))state.chosenSteps.push(step);document.body.dataset.step=String(step);renderSteps();renderQuestion();layoutTiles(step===5?'groups':'rows',true);update();if(!reducedMotion()&&window.Motion)Motion.animate('#question',{opacity:[0,1],y:[8,0]},{duration:.22});}
function reset(){closeGallery();state={step:0,task:tasks[0][0],platform:'thor',budget:50,memory:null,energy:null,resolution:null,precision:null,angle:10,sort:'method',selected:null,chosenSteps:[]};go(0);}
function stopTransition(){
 transitionToken++;motionControls.forEach(c=>c.stop());motionControls=[];
 document.querySelectorAll('.tile-transition').forEach(e=>e.remove());
 $('#selection-card').style.opacity='';$('#case-grid').style.opacity='';$('#inspect').style.opacity='';$('#inspect').style.transform='';
}
function selectConfiguration(key){
 stopTransition();state.selected=key;galleryOpen=true;
 $('#workspace').classList.add('inspecting');$('#case-section').hidden=false;$('#all-configs').hidden=false;
 const x=currentRows().find(x=>id(x)===key),m=methods.find(m=>m.id===x.method);
 $('#selection-card').style.setProperty('--selected-color',m.color);
 update();renderSelection();loadCases();
 if(window.Motion&&!reducedMotion())motionControls.push(Motion.animate('#inspect',{opacity:[0,1]},{duration:.16}));
}
function collapseSelection(){const key=state.selected;closeGallery();update();if(key)nodes.get(key).focus({preventScroll:true});}

function renderSelection(){
 const x=currentRows().find(x=>id(x)===state.selected);if(!x)return;
 const m=methods.find(m=>m.id===x.method), ai=angleIndex(),why=rejection(x),tags=recommendations(feasible()).get(id(x));
 $('#inspect').hidden=false;$('#inspect').innerHTML=`<div class="selection-name"><i style="background:${m.color}"></i><h2>${m.name}</h2><span>${x.res} px · ${x.precision.toUpperCase()}</span></div><p class="metric-line"><span><strong>${fmt(x.auc[ai])}%</strong> pose AUC@${state.angle}°</span><span><strong>${fmt(x.runtime)}</strong> ms</span><span><strong>${fmt(x.memory,2)}</strong> GiB</span><span><strong>${fmt(x.energy,2)}</strong> J / pair</span></p><p class="success-summary"><strong>${x.successes[ai]} / ${x.total}</strong> successful pairs · ${fmt(100*x.successes[ai]/x.total)}% at ${state.angle}°${tags?' <span class="best-note">Highest pose AUC</span>':''}</p>${why?`<p class="exclusion-note">${why}</p>`:''}`;
}
async function loadCases(){
 const x=currentRows().find(x=>id(x)===state.selected);if(!x)return;
 const token=++caseToken;drawToken++;caseContext={...x,angle:state.angle};caseResults=[];exampleMeta=null;currentDrawing=null;exampleIndex=-1;exampleCategory='success';
 $('#case-grid').replaceChildren();$('#case-status').textContent='Loading examples…';
 const key=`${x.task}--${x.method}--${x.res}--${x.precision}`;
 try{
  let data=caseCache.get(key);
  if(!data){const response=await fetch(`cases/${key}.json`);if(!response.ok)throw Error('Unavailable');data=await response.json();caseCache.set(key,data);}
  const response=await fetch(`correspondences/${key}.json`);if(!response.ok)throw Error('Unavailable');const meta=await response.json();
  if(token!==caseToken||!galleryOpen)return;caseResults=data;exampleMeta=meta;$('#case-status').textContent='';
  if(!meta.angles[state.angle].success.length)exampleCategory='failure';renderCases();
 }catch(error){if(token===caseToken&&galleryOpen){$('#case-status').innerHTML='Examples could not be loaded. <button class="text-button" id="retry-cases">Retry</button>';$('#retry-cases').onclick=loadCases;}}
}
function renderCases(){
 if(!exampleMeta||!caseContext)return;
 const sets=exampleMeta.angles[state.angle],passes=r=>r.error!==null&&r.error<=state.angle;
 if(!sets[exampleCategory].length)exampleCategory=sets.success.length?'success':'failure';
 const samples=sets[exampleCategory];exampleIndex=exampleIndex<0?Math.floor(samples.length/2):Math.min(exampleIndex,Math.max(0,samples.length-1));
 const success=caseResults.filter(passes).length;
 $('#case-grid').innerHTML=`<div class="example-tabs" role="tablist" aria-label="Example outcomes">${['success','failure'].map(cat=>`<button role="tab" aria-selected="${cat===exampleCategory}" data-category="${cat}" ${!sets[cat].length?'disabled':''}>${cat==='success'?'Success':'Failure'} <span>${cat==='success'?success:caseResults.length-success}</span></button>`).join('')}</div><button class="match-preview" id="match-preview" aria-label="Enlarge correspondence image"><canvas id="match-canvas"></canvas><span class="viewer-loading" id="viewer-loading">Loading correspondences…</span></button><div class="example-caption"><span id="example-error"></span><label><input type="checkbox" id="show-matches" checked> Matches</label></div><div class="example-thumbnails">${samples.map((uid,i)=>`<button data-example="${i}" aria-label="Example ${i+1} of ${samples.length}" aria-pressed="${i===exampleIndex}"><img src="assets/pairs/${uid}.webp" alt="Image pair example" loading="lazy"></button>`).join('')}</div><p class="example-count">${samples.length} examples · ${exampleCategory==='success'?`pose error ≤ ${state.angle}°`:`pose error > ${state.angle}° or not estimated`}</p><div class="match-legend" aria-label="Correspondence agreement with reference geometry"><span>Reference geometry:</span><span><i class="geometry-pass"></i>Consistent</span><span><i class="geometry-fail"></i>Inconsistent</span></div>`;
 $('#case-grid').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{exampleCategory=b.dataset.category;exampleIndex=-1;renderCases();});
 $('#case-grid').querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{exampleIndex=Number(b.dataset.example);renderCases();});
 $('#show-matches').onchange=()=>paintMatches();$('#match-preview').onclick=openMatchImage;
 drawExample(samples[exampleIndex]);
}
async function drawExample(uid){
 const token=++drawToken,info=exampleMeta.pairs[uid],record=caseResults.find(r=>r.pair===uid);
 currentDrawing=null;
 try{
  const img=new Image();img.src=`assets/pairs/${uid}.webp`;
  let bytes=overlayCache.get(info.file);
  if(!bytes){const response=await fetch(`correspondences/${info.file}?v=1`);if(!response.ok)throw Error('Unavailable');bytes=await response.arrayBuffer();overlayCache.set(info.file,bytes);}
  await img.decode();if(token!==drawToken||!galleryOpen)return;
  const count=new DataView(bytes).getUint32(0,true);if(count!==record.matches||bytes.byteLength!==4+count*9)throw Error('Invalid correspondence data');
  currentDrawing={img,info,record,xy:new Uint16Array(bytes,4,count*4),valid:new Uint8Array(bytes,4+count*8,count),count};
  $('#viewer-loading').hidden=true;
  $('#example-error').textContent=`${record.error===null?'Pose not estimated':fmt(record.error,2)+'° pose error'} · ${count.toLocaleString()} matches`;
  paintMatches();
 }catch(error){if(token===drawToken&&galleryOpen){$('#viewer-loading').textContent='Correspondences unavailable';$('#example-error').textContent='';}}
}
function paintMatches(){
 if(!currentDrawing)return;const {img,info,xy,valid,count}=currentDrawing,L=info.layout;
 const canvas=$('#match-canvas');if(!canvas)return;
 const width=L.width,height=Math.max(L.a.size[1],L.b.size[1]),gap=12;
 canvas.width=2*width+gap;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#f6f7f5';ctx.fillRect(0,0,canvas.width,height);
 for(const [side,offset] of [['a',0],['b',width+gap]]){const p=L[side];ctx.drawImage(img,p.x,p.y,p.size[0],p.size[1],offset+p.x,(height-p.size[1])/2,p.size[0],p.size[1]);}
 if(!$('#show-matches').checked)return;
 const alpha=count>2000?.13:count>500?.3:.7;
 for(let group=0;group<2;group++){
  ctx.strokeStyle=group?`rgba(29,190,78,${alpha})`:`rgba(234,68,67,${alpha})`;ctx.lineWidth=.7;ctx.beginPath();
  for(let i=0;i<count;i++){if(valid[i]!==group)continue;const j=i*4;
   const ax=xy[j]/65535*width,ay=xy[j+1]/65535*L.height+(height-L.a.size[1])/2;
   const bx=xy[j+2]/65535*width+width+gap,by=xy[j+3]/65535*L.height-L.b.y+(height-L.b.size[1])/2;
   ctx.moveTo(ax,ay);ctx.lineTo(bx,by);
  }ctx.stroke();
 }
}
function openMatchImage(){if(!currentDrawing)return;const r=currentDrawing.record;$('#pair-title').textContent=r.error!==null&&r.error<=state.angle?'Success':'Failure';$('#pair-image').src=$('#match-canvas').toDataURL('image/png');$('#pair-values').textContent=`Pose error: ${r.error===null?'not estimated':fmt(r.error,2)+'°'} · ${r.matches.toLocaleString()} correspondences`;$('#pair-dialog').showModal();}

function openEvidence(type){const task=tasks.find(x=>x[0]===state.task);$('#paper-ref').textContent=type==='figure4'?'FIGURE 4':'TABLE V';$('#paper-title').textContent=type==='figure4'?'Accuracy across resolutions and hardware':'Accuracy and runtime across precisions';$('#paper-image').src=`assets/${type}.png`;$('#paper-context').textContent=type==='figure4'?'Four visual conditions; RUBIK at 256 / 512 px. FP32 / Native.':'RUBIK · 512 px · FP32 / MP / FP16.';$('#paper-dialog').showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('[data-evidence]');if(b)openEvidence(b.dataset.evidence);});
$('#close-dialog').onclick=()=>$('#paper-dialog').close();$('#close-pair').onclick=()=>$('#pair-dialog').close();
[$('#paper-dialog'),$('#pair-dialog')].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();}));
$('#restart').onclick=reset;$('#relax').onclick=()=>go(2);$('#all-configs').onclick=collapseSelection;
let resizeFrame,observedBoardWidth=0;new ResizeObserver(()=>{const width=$('#board').clientWidth;if(width===observedBoardWidth)return;observedBoardWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>layoutTiles(state.step===5?'groups':'rows'));}).observe($('#board'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&galleryOpen&&!document.querySelector('dialog[open]'))collapseSelection();});
function updateUIScale(){
 const main=document.querySelector('main'),css=getComputedStyle(main);
 const currentWidth=main.getBoundingClientRect().width-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
 const previousWidth=Math.min(document.body.clientWidth,1800)-innerWidth*.06;
 const scale=innerWidth>740?Math.max(1,currentWidth/previousWidth):1;
 document.documentElement.style.setProperty('--ui-scale',String(scale));
 const top=$('#workspace').getBoundingClientRect().top+scrollY;
 document.documentElement.style.setProperty('--sidebar-limit',Math.max(260,(innerHeight-top-16)/scale)+'px');
}
window.addEventListener('resize',()=>{updateUIScale();cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>layoutTiles(state.step===5?'groups':'rows'));});
updateUIScale();
window.demoState=()=>({...state,feasible:feasible().length});
reset();
