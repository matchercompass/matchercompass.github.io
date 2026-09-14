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
let caseResults=[], caseToken=0, caseContext=null;
const caseCache=new Map();
let shown={success:12,failure:12};
let galleryOpen=false;
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
function layoutTiles(mode,animate=false){
 const board=$('#board'), previous=new Map([...nodes].map(([key,b])=>[key,b.getBoundingClientRect()]));
 board.className='board '+mode;
 if(!board.querySelector('.board-labels')){
  const labels=document.createElement('div');labels.className='board-labels';board.replaceChildren(labels,...nodes.values());
 }
 const labels=board.querySelector('.board-labels');labels.replaceChildren();
 const width=board.clientWidth, compact=galleryOpen, rows=currentRows(), eligible=feasible();
 const positions=new Map(), groups=methods.map(m=>eligible.filter(x=>x.method===m.id)), tags=recommendations(eligible);
 const gap=compact?7:10;
 const tile=compact?Math.min(44,Math.floor((width-38)/4)):Math.max(34,Math.min(56,Math.floor((width-236)/15)));
 const pitch=tile+gap;
 function label(text,x,y,cls,width){const e=document.createElement('div');e.className=cls;e.style.left=x+'px';e.style.top=y+'px';if(width)e.style.width=width+'px';e.innerHTML=text;labels.append(e);}
 if(mode==='rows'){
  const labelWidth=width>1100?230:190, columnWidth=(width-labelWidth-8)/4, top=62, rowHeight=tile+12;
  [128,256,512,1024].forEach((res,ri)=>{
   const left=labelWidth+ri*columnWidth+(columnWidth-3*pitch+gap)/2;
   label(res+' px',left,0,'resolution-heading',3*pitch-gap);
   ['FP32','MP','FP16'].forEach((p,pi)=>label(p,left+pi*pitch,28,'precision-heading',tile));
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
  const columns=compact?1:(width<680?2:3), cellWidth=width/columns, perRow=compact?4:Math.min(6,Math.max(2,Math.floor((cellWidth-24+gap)/pitch)));
  let top=6;
  for(let row=0;row<Math.ceil(methods.length/columns);row++){
   let rowHeight=70;
   for(let col=0;col<columns;col++){
    const mi=row*columns+col, m=methods[mi];if(!m)continue;
    const group=groups[mi];group.sort(state.sort==='accuracy'?(a,b)=>b.auc[angleIndex()]-a.auc[angleIndex()]:state.sort==='runtime'?(a,b)=>a.runtime-b.runtime:order);
    const left=col*cellWidth+(compact?5:Math.max(12,(cellWidth-perRow*pitch+gap)/2));
    label(m.name+`<small>${group.length} configurations</small>`,left,top,'group-label'+(!group.length?' no-results':''),cellWidth-18);
    group.forEach((x,i)=>positions.set(id(x),{x:left+(i%perRow)*pitch,y:top+48+Math.floor(i/perRow)*pitch}));
    rowHeight=Math.max(rowHeight,48+Math.ceil(group.length/perRow)*pitch+24);
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
  if(p&&animate&&!reduce&&from?.width)b.animate([{transform:`translate(${from.left-box.left-p.x}px,${from.top-box.top-p.y}px)`},{transform:'translate(0,0)'}],{duration:500,easing:'cubic-bezier(.22,1,.36,1)'});
 });
 $('#empty').hidden=mode!=='groups'||eligible.length!==0;
}
function option(value,label,sub,current){return `<button type="button" class="option ${current===value?'chosen':''}" data-value="${value}" aria-pressed="${current===value}"><strong>${label}</strong>${sub?`<small>${sub}</small>`:''}</button>`;}
function renderQuestion(){
 const s=state.step;
 if(s<5){
  const headings=['Visual condition','Hardware platform','Time budget','GPU memory limit','Pose accuracy'];
  const descriptions=['','','Median matching time per pair; model loading and pose estimation excluded.','Peak allocated memory, including the model.','Angle threshold for pose AUC and success rate.'];
  let options;
  if(s<2)options=(s===0?tasks:platforms).map(x=>option(x[0],x[1],x[2],isChosen(s)?state[s===0?'task':'platform']:undefined)).join('');
  else {const choices=s===2?[10,20,50,100,null]:s===3?[0.5,1,2,null]:[5,10,20];const field=['','','budget','memory','angle'][s];options=choices.map(x=>option(x,x===null?'No limit':s===2?`${x} ms`:s===3?`${x} GiB`:`${x}°`,'',isChosen(s)?state[field]:undefined)).join('');}
  $('#question').innerHTML=`<div class="question-title"><h2>${headings[s]}</h2>${descriptions[s]?`<p>${descriptions[s]}</p>`:''}</div><div class="options">${options}</div><div class="actions">${s?'<button class="back" id="back" aria-label="Previous step">←</button>':''}<button class="primary" id="next" ${isChosen(s)?'':'disabled'}>${s===4?'Show results':'Continue'} →</button></div>`;
  $('#question').querySelectorAll('[data-value]').forEach(b=>b.onclick=()=>choose(b.dataset.value));$('#next').onclick=()=>go(s+1);if($('#back'))$('#back').onclick=()=>go(s-1);
 }else{
  $('#question').innerHTML=`<div class="result-controls"><div><label>Time budget</label><div class="quick-budgets">${[20,50,100,null].map(v=>`<button type="button" data-budget="${v}" class="${state.budget===v?'chosen':''}" aria-pressed="${state.budget===v}">${v===null?'No limit':v+' ms'}</button>`).join('')}</div></div><label>Sort within matcher<select id="sort"><option value="method">Resolution · precision</option><option value="accuracy">Highest pose AUC</option><option value="runtime">Lowest runtime</option></select></label><button class="text-button" id="edit">Change requirements</button><details class="more-filters"><summary>More filters</summary><div class="filter-fields"><label>Resolution<select id="res-filter"><option value="">All resolutions</option>${[128,256,512,1024].map(r=>`<option value="${r}">${r} px</option>`).join('')}</select></label><label>Precision<select id="precision-filter"><option value="">All supported modes</option>${['native','fp32','mp','fp16'].map(v=>`<option value="${v}">${v.toUpperCase()}</option>`).join('')}</select></label><label>Energy limit · J / pair<input id="energy-filter" type="number" min="0" step="0.1" placeholder="No limit"></label><button id="apply-filters" class="primary">Apply</button><a href="measurement.html#energy">Power measurement scope</a></div></details></div>`;
  $('#res-filter').value=state.resolution??'';$('#precision-filter').value=state.precision??'';$('#energy-filter').value=state.energy??'';
  $('#apply-filters').onclick=()=>{const input=$('#energy-filter');if(!input.reportValidity())return;state.resolution=Number($('#res-filter').value)||null;state.precision=$('#precision-filter').value||null;state.energy=input.value===''?null:Number(input.value);go(5);};
  $('#question').querySelectorAll('[data-budget]').forEach(b=>b.onclick=()=>{state.budget=b.dataset.budget==='null'?null:Number(b.dataset.budget);go(5);});
  $('#sort').value=state.sort;$('#sort').onchange=e=>{state.sort=e.target.value;layoutTiles('groups',true);};$('#edit').onclick=()=>go(0);
 }
}
function choose(value){if(galleryOpen){closeGallery();layoutTiles('rows');}if(!state.chosenSteps.includes(state.step))state.chosenSteps.push(state.step);const field=['task','platform','budget','memory','angle'][state.step];state[field]=state.step<2?value:value==='null'?null:Number(value);renderQuestion();update();}
function renderSteps(){ $('#steps').innerHTML=titles.map((t,i)=>`<button type="button" class="step ${i===state.step?'current':i<state.step?'done':''}" ${i>state.step?'disabled':''} data-step="${i}" ${i===state.step?'aria-current="step"':''}><span class="num">${i<state.step?'✓':i+1}</span>${t}</button>`).join('');$('#steps').querySelectorAll('button').forEach(b=>b.onclick=()=>go(Number(b.dataset.step)));}
function update(){
 const valid=feasible(),tags=state.step===5?recommendations(valid):new Map();
 currentRows().forEach(x=>{const b=nodes.get(id(x)), name=methods.find(m=>m.id===x.method).name; b.classList.toggle('off',!!rejection(x));b.classList.toggle('selected',galleryOpen&&state.selected===id(x));b.classList.toggle('recommended',tags.has(id(x)));b.setAttribute('aria-pressed',String(galleryOpen&&state.selected===id(x))); b.setAttribute('aria-label',`${name}, ${x.res}px, ${x.precision}, ${rejection(x)||'Eligible'}`);b.title=`${name} · ${x.res} px · ${x.precision.toUpperCase()}\nPose AUC@${state.angle}° ${fmt(x.auc[angleIndex()])}% · ${fmt(x.runtime)} ms${rejection(x)?'\n'+rejection(x):''}`;});
 $('#count').textContent=valid.length;$('#count-label').textContent=state.step<1?'evaluated':'eligible';
 const task=tasks.find(x=>x[0]===state.task),platform=platforms.find(x=>x[0]===state.platform);
 $('#summary').innerHTML=[isChosen(0)?`${task[1]} · ${task[2]}`:null,state.step>=1&&isChosen(1)?platform[1]:null,state.step>=2&&isChosen(2)?(state.budget===null?'No time limit':`≤ ${state.budget} ms`):null,state.step>=3&&isChosen(3)?(state.memory===null?'No memory limit':`≤ ${state.memory} GiB`):null,state.step>=4&&isChosen(4)?`Pose @ ${state.angle}°`:null,state.resolution?`${state.resolution} px`:null,state.precision?state.precision.toUpperCase():null,state.energy!==null?`≤ ${state.energy} J`:null].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
 $('#board-title').textContent=galleryOpen?'Configurations':state.step===5?'Matching configurations':'Configurations';
 $('#evidence').hidden=state.step!==5;$('#announcement').textContent=`${titles[state.step]}, ${valid.length} configurations remaining`;
}
function closeGallery(){caseToken++;galleryOpen=false;state.selected=null;caseContext=null;$('#workspace').classList.remove('inspecting');$('#case-section').hidden=true;$('#all-configs').hidden=true;}
function go(step){if(step>state.step&&!isChosen(state.step))return;closeGallery();state.step=step;document.body.dataset.step=String(step);renderSteps();renderQuestion();layoutTiles(step===5?'groups':'rows',true);update();}
function reset(){closeGallery();state={step:0,task:tasks[0][0],platform:'thor',budget:50,memory:null,energy:null,resolution:null,precision:null,angle:10,sort:'method',selected:null,chosenSteps:[]};go(0);}
function selectConfiguration(key){
 state.selected=key;galleryOpen=true;$('#workspace').classList.add('inspecting');$('#case-section').hidden=false;$('#all-configs').hidden=false;
 layoutTiles('groups');update();renderSelection();loadCases();
}
function renderSelection(){
 const x=currentRows().find(x=>id(x)===state.selected);if(!x)return;
 const m=methods.find(m=>m.id===x.method), ai=angleIndex(),why=rejection(x),tags=recommendations(feasible()).get(id(x));
 $('#inspect').hidden=false;$('#inspect').innerHTML=`<div class="selection-name"><i style="background:${m.color}"></i><h2>${m.name}</h2><span>${x.res} px · ${x.precision.toUpperCase()}</span></div><p class="metric-line"><span><strong>${fmt(x.auc[ai])}%</strong> pose AUC@${state.angle}°</span><span><strong>${fmt(x.runtime)}</strong> ms</span><span><strong>${fmt(x.memory,2)}</strong> GiB</span><span><strong>${fmt(x.energy,2)}</strong> J / pair</span></p><p class="success-summary"><strong>${x.successes[ai]} / ${x.total}</strong> successful pairs · ${fmt(100*x.successes[ai]/x.total)}% at ${state.angle}°${tags?' <span class="best-note">Highest pose AUC</span>':''}</p>${why?`<p class="exclusion-note">${why}</p>`:''}`;
}
async function loadCases(){
 const x=currentRows().find(x=>id(x)===state.selected);if(!x)return;
 const token=++caseToken;caseContext={...x,angle:state.angle};shown={success:12,failure:12};caseResults=[];
 $('#case-grid').replaceChildren();$('#case-status').textContent='Loading image pairs…';
 const key=`${x.task}--${x.method}--${x.res}--${x.precision}`;
 try{
  let data=caseCache.get(key);if(!data){const response=await fetch(`cases/${key}.json`);if(!response.ok)throw Error('Unavailable');data=await response.json();caseCache.set(key,data);}
  if(token!==caseToken||!galleryOpen)return;caseResults=data;$('#case-status').textContent='';renderCases();
 }catch(error){if(token===caseToken&&galleryOpen){$('#case-status').innerHTML='Image pairs could not be loaded. <button class="text-button" id="retry-cases">Retry</button>';$('#retry-cases').onclick=loadCases;}}
}
function renderCases(){
 const x=caseContext;if(!x)return;const passes=r=>r.error!==null&&r.error<=x.angle;
 $('#case-grid').innerHTML=['success','failure'].map(category=>{
  const records=caseResults.filter(r=>passes(r)===(category==='success'));
  return `<section class="case-category" aria-label="${category} examples"><h3>${category==='success'?'Success':'Failure'} <span>${records.length}</span><small>${category==='success'?`≤ ${x.angle}°`:`> ${x.angle}° or not estimated`}</small></h3><div class="image-grid">${records.slice(0,shown[category]).map(r=>`<button class="pair-preview" type="button" data-pair="${r.pair}" aria-label="${category==='success'?'Success':'Failure'}, pose error ${r.error===null?'not estimated':fmt(r.error,2)+' degrees'}, ${r.matches} correspondences"><img src="assets/pairs/${r.pair}.webp" width="400" height="454" loading="lazy" decoding="async" alt="Evaluated input image pair"><span class="pair-overlay"><strong>${r.error===null?'Pose not estimated':fmt(r.error,2)+'° pose error'}</strong><span>${r.matches.toLocaleString()} correspondences</span></span></button>`).join('')||'<p class="empty-category">No pairs</p>'}</div>${shown[category]<records.length?`<button class="more-pairs text-button" data-more="${category}">Show more · ${Math.min(shown[category],records.length)} / ${records.length}</button>`:''}</section>`;
 }).join('');
 $('#case-grid').querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{shown[b.dataset.more]+=12;renderCases();});
 $('#case-grid').querySelectorAll('[data-pair]').forEach(b=>b.onclick=()=>openPair(b.dataset.pair));
}
function openPair(pair){const r=caseResults.find(r=>r.pair===pair);if(!r)return;$('#pair-title').textContent=r.error!==null&&r.error<=caseContext.angle?'Success':'Failure';$('#pair-image').src=`assets/pairs/${r.pair}.webp`;$('#pair-values').textContent=`Pose error: ${r.error===null?'not estimated':fmt(r.error,2)+'°'} · ${r.matches.toLocaleString()} correspondences`;$('#pair-dialog').showModal();}
function openEvidence(type){const task=tasks.find(x=>x[0]===state.task);$('#paper-ref').textContent=type==='figure4'?'FIGURE 4':'TABLE V';$('#paper-title').textContent=type==='figure4'?'Accuracy across resolutions and hardware':'Accuracy and runtime across precisions';$('#paper-image').src=`assets/${type}.png`;$('#paper-context').textContent=type==='figure4'?'Four visual conditions; RUBIK at 256 / 512 px. FP32 / Native.':'RUBIK · 512 px · FP32 / MP / FP16.';$('#paper-dialog').showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('[data-evidence]');if(b)openEvidence(b.dataset.evidence);});
$('#close-dialog').onclick=()=>$('#paper-dialog').close();$('#close-pair').onclick=()=>$('#pair-dialog').close();
[$('#paper-dialog'),$('#pair-dialog')].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();}));
$('#restart').onclick=reset;$('#relax').onclick=()=>go(2);$('#all-configs').onclick=()=>{closeGallery();layoutTiles(state.step===5?'groups':'rows',true);update();};
let resizeFrame,observedBoardWidth=0;new ResizeObserver(()=>{const width=$('#board').clientWidth;if(width===observedBoardWidth)return;observedBoardWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>layoutTiles(galleryOpen||state.step===5?'groups':'rows'));}).observe($('#board'));
window.demoState=()=>({...state,feasible:feasible().length});
reset();
