const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const fmt=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const uid=()=>crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
const defaultData={
  expenses:[],
  cards:[
    {name:'Santander',cutDay:15,payDay:5,balance:0},
    {name:'Nu',cutDay:20,payDay:10,balance:0},
    {name:'Encargos',cutDay:1,payDay:1,balance:0}
  ],
  apiUrl:'',
  countdownUrl:''
};
const normalize=d=>{
  d={...defaultData,...(d||{})};
  d.expenses=d.expenses||[];
  d.cards=(d.cards||defaultData.cards).map(c=>typeof c==='string'?{name:c,cutDay:15,payDay:5,balance:0}:{balance:0,...c});
  d.cards=d.cards.filter(c=>!['bbva','banamex','apple card'].includes(String(c.name).toLowerCase()));
  if(!d.cards.some(c=>String(c.name).toLowerCase()==='santander')) d.cards.unshift({name:'Santander',cutDay:15,payDay:5,balance:0});
  if(!d.cards.some(c=>String(c.name).toLowerCase()==='encargos')) d.cards.push({name:'Encargos',cutDay:1,payDay:1,balance:0});
  return d;
};
const store={get(){try{return normalize(JSON.parse(localStorage.getItem('gastosPro')||'{}'))}catch{return normalize(defaultData)}},set(d){localStorage.setItem('gastosPro',JSON.stringify(normalize(d)));render();}};
let calDate=new Date(); let deferredPrompt=null; let calc='0';
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=()=>deferredPrompt?.prompt();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
function init(){ $('#todayLabel').textContent=new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}); bind(); render(); updateRestPreview(); }
function bind(){
 $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.view).classList.add('active');});
 ['amount','paid','extraPaid'].forEach(id=>$('#'+id)?.addEventListener('input',updateRestPreview));
 $('#cardName').addEventListener('change',()=>{suggestDates();toggleMode();});
 $('#purchaseDate').addEventListener('change',suggestDates);
 $('#expenseForm').onsubmit=e=>{e.preventDefault();const d=store.get();const cardName=$('#cardName').value;const isEnc=isEncargo(cardName);const amount=+$('#amount').value||0, paid=isEnc?(+$('#paid').value||0):0, extraPaid=isEnc?(+$('#extraPaid').value||0):0; const card=d.cards.find(c=>c.name===cardName); if(card&&!isEnc) card.balance=amount; const pagos=[]; if(isEnc&&paid>0)pagos.push({fecha:$('#purchaseDate').value||new Date().toISOString().slice(0,10),monto:paid,nota:'Primer a cuenta'}); if(isEnc&&extraPaid>0)pagos.push({fecha:$('#extraPaidDate').value||new Date().toISOString().slice(0,10),monto:extraPaid,nota:'Abono posterior'}); const totalPaid=paid+extraPaid; d.expenses.push({id:uid(),concept:isEnc?$('#concept').value:`Pago ${cardName}`,amount,paid:totalPaid,payments:pagos,remaining:Math.max(0,amount-totalPaid),card:cardName,purchaseDate:$('#purchaseDate').value||new Date().toISOString().slice(0,10),dueDate:$('#dueDate').value,category:isEnc?$('#category').value:'Tarjeta crédito',notes:isEnc?$('#notes').value:`Corte día ${card?.cutDay||'-'} · buenas compras desde día ${buyFromDay(card||{})} · límite día ${card?.payDay||'-'}`,createdAt:new Date().toISOString(),status:(totalPaid>=amount?'paid':'pending')});store.set(d);e.target.reset();$('#paid').value=0;$('#extraPaid').value='';updateRestPreview();suggestDates();toggleMode();};
 $('#cardForm').onsubmit=e=>{e.preventDefault();const v=$('#newCard').value.trim();if(!v)return;const d=store.get();const existing=d.cards.find(c=>c.name.toLowerCase()===v.toLowerCase());const data={name:v,balance:+$('#cardBalance').value||0,cutDay:clampDay($('#cutDay').value||15),payDay:clampDay($('#payDay').value||5)}; if(existing) Object.assign(existing,data); else d.cards.push(data);store.set(d);e.target.reset();};
 $('#clearBtn').onclick=()=>confirm('¿Borrar todos los gastos?')&&(store.set({...store.get(),expenses:[]}));
 $('#demoBtn').onclick=()=>{const d=store.get();d.expenses.push({id:uid(),concept:'Cancún',amount:7400,paid:2000,remaining:5400,card:'Santander',purchaseDate:new Date().toISOString().slice(0,10),dueDate:nextPayDate(d.cards.find(c=>c.name==='Santander'),new Date()).toISOString().slice(0,10),category:'Viaje',notes:'Total 7400 · A cuenta 2000 · Restan 5400',createdAt:new Date().toISOString(),status:'pending'});store.set(d)};
 $('#exportBtn').onclick=()=>downloadJSON(); $('#importInput').onchange=importJSON; $('#saveCountdownUrl').onclick=()=>{const d=store.get();d.countdownUrl=$('#countdownUrl').value.trim();store.set(d);alert('Liga de CuentaAtrás guardada')};
 $('#prevMonth').onclick=()=>{calDate.setMonth(calDate.getMonth()-1);renderCalendar(store.get())}; $('#nextMonth').onclick=()=>{calDate.setMonth(calDate.getMonth()+1);renderCalendar(store.get())};
 ['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','=','+','C'].forEach(k=>{const b=document.createElement('button');b.textContent=k;b.onclick=()=>calcKey(k);$('#calcKeys').appendChild(b)});
}
function render(){const d=store.get(), now=new Date(); $('#monthName').textContent=now.toLocaleDateString('es-MX',{month:'long'}); fillCards(d); renderTotals(d); renderLists(d); renderCalendar(d); $('#jsonPreview').value=JSON.stringify(d,null,2); $('#countdownUrl').value=d.countdownUrl||''; suggestDates();toggleMode();}
function fillCards(d){$('#cardName').innerHTML=d.cards.map(c=>`<option>${esc(c.name)}</option>`).join('');$('#cardsList').innerHTML=d.cards.map((c,i)=>cardHTML(c,i)).join('');}
function cardHTML(c,i){const buy=buyFromDay(c); const isEnc=isEncargo(c.name);return `<article class="card-chip"><strong>• ${esc(c.name)}</strong>${isEnc?`<span>• Apartado para trabajos, material o encargos con abonos.</span><small>• Puedes editar y agregar más pagos después.</small>`:`<span>• Saldo: ${fmt(c.balance||0)}</span><span>• Fecha de corte: día ${c.cutDay||'-'} · fecha límite de pago: día ${c.payDay||'-'}</span><small>• Fechas buenas para comprar: desde el día ${buy} después del corte.</small>`}</article>`;}
function renderTotals(d){const month=new Date().getMonth(), year=new Date().getFullYear();const m=d.expenses.filter(x=>{const dt=new Date(x.dueDate+'T00:00');return dt.getMonth()==month&&dt.getFullYear()==year});const total=m.reduce((s,x)=>s+x.amount,0), paid=m.reduce((s,x)=>s+(x.status==='paid'?x.amount:x.paid),0), pending=Math.max(0,total-paid);$('#balanceAmount').textContent=fmt(total);$('#paidAmount').textContent=fmt(paid);$('#pendingAmount').textContent=fmt(pending);$('#cardsCount').textContent=d.cards.length;}
function renderLists(d){const sorted=[...d.expenses].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));const upcoming=sorted.filter(x=>x.status!=='paid').slice(0,6);$('#upcomingList').innerHTML=upcoming.map(itemHTML).join('')||'<p class="muted">Sin pagos pendientes.</p>';$('#expenseList').innerHTML=sorted.map(itemHTML).join('')||'<p class="muted">Aún no hay movimientos.</p>';$('#nextPaymentCard').innerHTML=upcoming[0]?`<h3>Siguiente pago</h3><p>${esc(upcoming[0].concept)} vence el ${dateMx(upcoming[0].dueDate)}</p><h2>${fmt(upcoming[0].amount-upcoming[0].paid)}</h2>`:'<h3>Todo limpio ✨</h3><p>No tienes pagos próximos registrados.</p>';$$('.amount-box button[data-id]').forEach(b=>b.onclick=()=>markPaid(b.dataset.id));$$('.editBtn').forEach(b=>b.onclick=()=>editExpense(b.dataset.edit));$$('.alertBtn').forEach(b=>b.onclick=()=>sendToCuentaAtras(b.dataset.alert));}
function itemHTML(x){const rest=Math.max(0,x.amount-x.paid);const pagos=(x.payments||[]).map(p=>`${dateMx(p.fecha)} ${fmt(p.monto)}`).join(' · ');return `<article class="expense-item"><div><h4>${esc(x.concept)}</h4><p>${esc(x.card)} · ${esc(x.category)}</p><small>Inicio/a cuenta: ${dateMx(x.purchaseDate||x.createdAt?.slice(0,10)||x.dueDate)} · Entrega/pago: ${dateMx(x.dueDate)} ${pagos?'· Abonos: '+esc(pagos):''} ${x.notes?'· '+esc(x.notes):''}</small></div><div class="amount-box"><strong>${fmt(x.amount)}</strong><span>${x.status==='paid'?'Pagado':'A cuenta '+fmt(x.paid)+' · Restan '+fmt(rest)}</span><button data-id="${x.id}">✓</button><button class="editBtn" data-edit="${x.id}">Editar</button><button class="alertBtn" data-alert="${x.id}">Aviso</button></div></article>`;}
function markPaid(id){const d=store.get();const x=d.expenses.find(e=>e.id===id); if(x){x.paid=x.amount;x.remaining=0;x.status='paid';x.payments=x.payments||[];x.payments.push({fecha:new Date().toISOString().slice(0,10),monto:Math.max(0,x.amount-(x.paid||0)),nota:'Marcado pagado'});store.set(d)}}
function editExpense(id){const d=store.get();const x=d.expenses.find(e=>e.id===id); if(!x)return; const abono=parseFloat(prompt('¿Cuánto quieres agregar a cuenta?', '0')||'0'); if(!abono||abono<0)return; const fecha=prompt('Fecha del nuevo abono (AAAA-MM-DD)', new Date().toISOString().slice(0,10))||new Date().toISOString().slice(0,10); x.paid=(+x.paid||0)+abono; x.remaining=Math.max(0,x.amount-x.paid); x.status=x.remaining<=0?'paid':'pending'; x.payments=x.payments||[]; x.payments.push({fecha,monto:abono,nota:'Abono editado'}); const nota=prompt('Nota opcional: material, trabajo o detalle', '')||''; if(nota) x.notes=(x.notes?x.notes+' | ':'')+nota; store.set(d);}

function sendToCuentaAtras(id){
 const d=store.get(); const x=d.expenses.find(e=>e.id===id); if(!x)return;
 let base=(d.countdownUrl||'').trim();
 if(!base){base=prompt('Pega la liga de tu app CuentaAtrás en GitHub Pages. Ejemplo: https://TU-USUARIO.github.io/cuentaAtras/','')||''; if(!base)return; d.countdownUrl=base; store.set(d);}
 const dueDate=x.dueDate||new Date().toISOString().slice(0,10);
 const qs=new URLSearchParams({
   quick:'1',
   title:`Pagar ${x.card==='Encargos'?x.concept:x.card}`,
   due:`${dueDate}T09:00`,
   category:x.card==='Encargos'?'Encargos':'Tarjetas',
   notes:`${x.concept} · saldo ${fmt(Math.max(0,(+x.amount||0)-(+x.paid||0)))} · desde Mis Gastos`
 });
 const sep=base.includes('?')?'&':'?';
 window.open(base+sep+qs.toString(),'_blank');
}

function renderCalendar(d){const y=calDate.getFullYear(),m=calDate.getMonth();$('#calendarTitle').textContent=calDate.toLocaleDateString('es-MX',{month:'long',year:'numeric'});const first=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate();let html='';for(let i=0;i<first;i++)html+='<div></div>';for(let day=1;day<=days;day++){const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const due=d.expenses.some(x=>x.dueDate===iso);const buy=d.expenses.some(x=>x.purchaseDate===iso);const today=iso===new Date().toISOString().slice(0,10);html+=`<div class="day ${due?'has':''} ${buy?'buy':''} ${today?'today':''}">${day}${due?'<div class="dot"></div>':''}${buy?'<div class="buydot"></div>':''}</div>`}$('#calendarGrid').innerHTML=html;}

function isEncargo(name){return String(name||'').toLowerCase()==='encargos';}
function toggleMode(){const name=$('#cardName')?.value||''; const enc=isEncargo(name); ['paidGroup','extraPaidGroup','extraDateGroup'].forEach(id=>$('#'+id)?.classList.toggle('hidden',!enc)); $$('.encargoOnly').forEach(el=>el.classList.toggle('hidden',!enc)); $('#conceptLabel').textContent=enc?'Concepto / encargo':'Tarjeta de crédito'; $('#concept').required=enc; $('#concept').placeholder=enc?'Ej. Cancel, material, trabajo de casa...':'Se guardará como pago de '+name; $('#amountLabel').textContent=enc?'Monto total':'Saldo de tarjeta'; $('#amount').placeholder=enc?'Costo completo':'Saldo actual a pagar'; $('#purchaseLabel').textContent=enc?'Inicio de pago / fecha a cuenta':'Fecha de corte'; $('#dueLabel').textContent=enc?'Fecha de entrega / límite de pago':'Fecha límite de pago'; $('#restLabel').textContent=enc?'Saldo pendiente automático':'Saldo registrado'; updateRestPreview();}
function suggestDates(){const d=store.get();const card=d.cards.find(c=>c.name===$('#cardName').value); if(!card)return; const now=new Date(); if(!isEncargo(card.name)){const cut=safeDate(now.getFullYear(),now.getMonth(),card.cutDay||15); const due=nextPayDate(card,cut); if(!$('#purchaseDate').value) $('#purchaseDate').value=cut.toISOString().slice(0,10); if(!$('#dueDate').value) $('#dueDate').value=due.toISOString().slice(0,10); return;} const p=$('#purchaseDate').value?new Date($('#purchaseDate').value+'T00:00'):now; const due=nextPayDate(card,p); if(!$('#dueDate').value) $('#dueDate').value=due.toISOString().slice(0,10);}
function nextPayDate(card,date){const y=date.getFullYear(),m=date.getMonth(),day=date.getDate(),cut=clampDay(card?.cutDay||15),pay=clampDay(card?.payDay||5);let payMonth=m+(day>cut?2:1); if(pay>cut) payMonth=m+(day>cut?1:0); return safeDate(y,payMonth,pay);}
function safeDate(y,m,d){return new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()));}
function buyFromDay(c){return clampDay((c.cutDay||15)+1>31?1:(c.cutDay||15)+1)}
function clampDay(v){return Math.max(1,Math.min(31,parseInt(v)||1));}
function updateRestPreview(){const enc=isEncargo($('#cardName')?.value);const rest=enc?Math.max(0,(+$('#amount').value||0)-(+$('#paid').value||0)-(+($('#extraPaid')?.value||0))):(+$('#amount').value||0);$('#restPreview').textContent=fmt(rest);}
function dateMx(v){if(!v)return 'sin fecha';return new Date(v+'T00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});} 
function downloadJSON(){const blob=new Blob([JSON.stringify(store.get(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='respaldo-mis-gastos.json';a.click();}
function importJSON(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=normalize(JSON.parse(r.result));if(!data.expenses||!data.cards)throw Error();store.set(data)}catch{alert('JSON no válido')}};r.readAsText(f);}
function calcKey(k){if(k==='C')calc='0';else if(k==='='){try{calc=String(Function('return '+calc.replaceAll('×','*').replaceAll('÷','/'))())}catch{calc='Error'}}else calc=calc==='0'?k:calc+k;$('#calcDisplay').value=calc;}
function esc(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
init();
