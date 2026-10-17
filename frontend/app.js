import {layoutPattern,repeatRows,paginateRows} from './layout.js';
const tg=window.Telegram?.WebApp;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,tab='home',polling=false,dirty=false,chatFilter=null,previewColorMode='telegram';
const expandedChats=new Set();
function resolveStyle(c,s=data?.settings){
 if(!c)return '';
 const direct=c.style||s?.chatColors?.[c.id]||s?.chatColors?.[String(c.id)];
 if(direct&&['primary','danger','success'].includes(direct))return direct;
 if(direct==='none')return '';
 const isChannel=c.type==='channel';
 const isGroup=c.type==='group'||c.type==='supergroup';
 if(isChannel&&s?.channelColor&&['primary','danger','success'].includes(s.channelColor))return s.channelColor;
 if(isGroup&&s?.groupColor&&['primary','danger','success'].includes(s.groupColor))return s.groupColor;
 if(s?.buttonColor&&['primary','danger','success'].includes(s.buttonColor))return s.buttonColor;
 return '';
}
const tabs=[['chats','channels','Canais','Canais e grupos'],['list','list','Lista','Organizar lista'],['home','home','Início','Início'],['schedule','send','Envios','Envios'],['settings','settings','Ajustes','Ajustes']];
const paths={search:'M21 21l-5-5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z',refresh:'M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 14-1l1 6M4 12l1 6a8 8 0 0 0 14-1',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z',info:'M12 11v6M12 7h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z',channels:'M3 11v2l14 5V6L3 11Zm0 0H1m5 3 2 6h3l-2-5M20 8l2-2m-2 10 2 2m-2-6h3',list:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',home:'m3 10 9-7 9 7v11h-7v-7h-4v7H3V10Z',send:'m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13',settings:'m9 3 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2V9L3 7l2-3L7 4l2-1ZM15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',clock:'M12 8v5l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z',calendar:'M3 5h18v16H3V5ZM7 2v6M17 2v6M3 11h18',chevron:'m9 5 7 7-7 7',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',pin:'m9 3 6 0-1 7 4 4H6l4-4-1-7Zm3 11v8',moon:'M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13Z'};
function icon(name){
 const filled={users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM1 20v-2c0-3 3-5 8-5s8 2 8 5v2H1Zm16-9a4 4 0 0 0 0-8h-1a6 6 0 0 1 0 8Zm3 9v-2c0-2-1-4-3-5 4 0 6 2 6 5v2h-3Z',home:'m2 11 10-9 10 9h-3v11h-5v-7h-4v7H5V11H2Z',channels:'M3 9h4l12-6v18L7 15H3a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Zm3 7 3 1 2 6H7l-1-7Z'};
 if(filled[name])return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${filled[name]}"/></svg>`;
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.list}"/></svg>`;}
const renderIcon=icon;
function navigate(to){if(to===tab)return;if(dirty&&!confirm('Sair sem salvar as alterações?'))return;dirty=false;tab=to;render();window.scrollTo?.(0,0);}
const labels={draft:'Em configuração',pending:'Pendente',approved:'Aprovado',rejected:'Rejeitado',paused:'Pausado',sent:'Enviado',failed:'Falhou',uncertain:'Conferir envio',skipped:'Ignorado',sending:'Enviando',active:'Em andamento',done:'Concluído'};
let toastTimer;function toast(t){clearTimeout(toastTimer);$('#toast').textContent=t;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function call(name,input={}){if(demoData)return Promise.resolve().then(()=>demoCall(name,input));return new Promise((resolve,reject)=>{
 let settled=false;const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(result);};
 const timer=setTimeout(()=>finish(new Error(name==='dashboard'?'O servidor demorou para responder. Tente novamente.':'Não foi possível confirmar a operação. Atualize o painel antes de tentar novamente.')),20000);
 try{tg.Serverless.call(name,input,(err,result)=>finish(err?new Error(err.message||'Não foi possível concluir.'):null,result));}catch(e){finish(e);}
});}
function date(n){return n?new Date(n).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
function displayDate(n){if(!n)return '—';const opts={timeZone:'America/Fortaleza'};return new Date(n).toLocaleDateString('pt-BR',opts)===new Date().toLocaleDateString('pt-BR',opts)?'Hoje, às '+new Date(n).toLocaleTimeString('pt-BR',{...opts,hour:'2-digit',minute:'2-digit'}):date(n);}
const pill=s=>`<span class="pill ${esc(s)}">${labels[s]||esc(s)}</span>`;
const active=()=>data.chats.filter(c=>c.status==='approved');
const schedulerOk=()=>data.schedulerHeartbeat&&Date.now()-data.schedulerHeartbeat<180000;
async function load(){data=await call('dashboard');dirty=false;render();resume();}
let cancelActiveDrag=null;
function render(){
 cancelActiveDrag?.();
 document.body.dataset.page=tab;
 $('#subtitle').textContent=tab==='home'?'Resumo da sua rede':tab==='settings'?'Configure sua comunidade':'';
 $('#heading').textContent=tabs.find(t=>t[0]===tab)[3];$('#nav').innerHTML=tabs.map(([id,icon,label])=>`<button data-tab="${id}" aria-current="${tab===id?'page':'false'}" class="${tab===id?'active':''} ${id==='home'?'nav-home':''}"><span class="nav-icon">${renderIcon(icon)}</span>${label}</button>`).join('');
 $('#banner').innerHTML=tab==='schedule'&&data.settings.schedule.enabled&&!schedulerOk()?'<div class="notice">O agendamento está salvo, mas o serviço automático ainda não está conectado. Os horários só serão executados após ativar o agendador.</div>':'';
 ({home:home,chats:chats,list:list,schedule:schedule,settings:settings})[tab]();
 $('#refresh').innerHTML=icon(tab==='chats'?'search':'refresh');$('#refresh').hidden=tab!=='chats';
 if(demoData){$('#banner').innerHTML='<div class="demo-banner"><span><strong>Modo de teste · 20 mocks</strong><small>Alterações locais. Nenhum envio real.</small></span><button id="leave-demo" type="button">Sair</button></div>'+$('#banner').innerHTML;$('#leave-demo').onclick=()=>action($('#leave-demo'),exitDemo);}
 $('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(b.dataset.tab));
 $('#content').querySelectorAll('input,textarea,select').forEach(e=>e.addEventListener('input',()=>{if(tab==='list'||tab==='schedule')dirty=true;}));
}
function card(title,sub,body){return `<section class="card"><div class="card-head"><div><h2>${title}</h2><p>${sub}</p></div></div>${body}</section>`;}
function approvalButtons(){return `<div class="segmented" aria-label="Modo de aprovação"><button data-approval="manual" class="${data.settings.approval==='manual'?'selected':''}">Manual</button><button data-approval="automatic" class="${data.settings.approval==='automatic'?'selected':''}">Automática</button></div><p class="help">${data.settings.approval==='manual'?'Você revisa antes de publicar.':'Novos cadastros válidos entram direto. Pendências anteriores precisam ser revisadas.'}</p>`;}
async function setApproval(button,mode){await action(button,async()=>{if(mode===data.settings.approval)return;document.querySelectorAll('[data-approval],#approval-mode').forEach(x=>x.disabled=true);try{await call('saveSettings',{settings:{...data.settings,approval:mode},version:data.version});await load();toast('Modo de aprovação salvo.');}catch(e){if($('#approval-mode'))$('#approval-mode').value=data.settings.approval;throw e;}finally{document.querySelectorAll('[data-approval],#approval-mode').forEach(x=>x.disabled=false);}});}
function bindApproval(){document.querySelectorAll('[data-approval]').forEach(b=>b.onclick=()=>setApproval(b,b.dataset.approval));if($('#approval-mode'))$('#approval-mode').onchange=e=>setApproval(e.target,e.target.value);}
function bindSend(){const b=$('#send');if(b)b.onclick=()=>action(b,async()=>{if(!confirm(`Enviar a lista para ${active().length} participantes aprovados?`))return;await call('sendNow');toast('Envio iniciado.');await load();});}
function home(){
 const pending=data.chats.filter(c=>c.status==='pending').length,latest=data.rounds[0],summary=data.lastDeliverySummary;
 const sch=data.settings.schedule,connected=schedulerOk();
 const stats=[['Ativos',active().length,'users','green'],['Pendentes',pending,'clock','orange'],['Canais',data.chats.filter(c=>c.type==='channel').length,'channels','blue'],['Grupos',data.chats.filter(c=>c.type==='group'||c.type==='supergroup').length,'users','purple']];
 const nextTitle=!sch.enabled?'Envios pausados':!connected?'Aguardando conexão':displayDate(sch.nextAt);
 const nextDescription=!sch.enabled?'Defina quando sua lista será publicada.':!connected?'Conecte o agendador para executar os horários salvos.':sch.mode==='interval'?`A cada ${sch.minutes} minutos`:`Todos os dias · ${sch.times.join(' · ')}`;
 $('#content').innerHTML=`<div class="overview-stats">${stats.map(([label,n,i,color])=>`<div class="overview-stat"><span class="stat-icon ${color}">${icon(i)}</span><div><strong>${n}</strong><span>${label}</span></div></div>`).join('')}</div><button id="open-pending" class="pending-shortcut">${icon('clock')}<span>${pending?`${pending} cadastro${pending===1?'':'s'} aguardando aprovação`:'Nenhum cadastro aguardando aprovação'}</span>${icon('chevron')}</button><section class="card overview-card schedule-shortcut" id="open-schedule" role="button" tabindex="0" aria-label="Configurar envios"><div class="overview-icon">${icon('calendar')}</div><div class="overview-body"><div class="overview-title"><h2>Próximo envio</h2><span class="pill ${sch.enabled&&connected?'online':''}">${!sch.enabled?'Pausado':connected?'Ativo':'Não conectado'}</span></div><strong class="overview-value">${nextTitle}</strong><p class="sub">${nextDescription}</p></div></section><section class="card overview-card"><div class="overview-icon">${icon('send')}</div><div class="overview-body"><h2>Último envio</h2><strong class="overview-value">${latest?displayDate(latest.created):'Nenhum envio ainda'}</strong><p class="sub">${latest&&summary?`${summary.sent} de ${summary.total} entregues${latest.status==='active'?' · Em andamento':''}`:'Suas publicações aparecerão aqui.'}</p>${summary&&(summary.failed||summary.uncertain)?`<p class="help">${summary.failed} falha(s) · ${summary.uncertain} para conferir</p>`:''}</div></section><button id="send" class="home-send" ${!active().length||data.rounds.some(r=>r.status==='active')?'disabled':''}>${icon('send')} ${data.rounds.some(r=>r.status==='active')?'Envio em andamento':'Enviar lista agora'}</button>`;
 $('#open-pending').onclick=()=>{chatFilter='pending';navigate('chats');};$('#open-schedule').onclick=()=>navigate('schedule');$('#open-schedule').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate('schedule');}};bindSend();
}
function initials(title){return String(title||'Canal').trim().split(/\s+/).filter(w=>!['de','da','do','das','dos'].includes(w.toLowerCase())).slice(0,2).map(w=>Array.from(w)[0]).join('').toUpperCase();}
function categoryText(c){return (data.categories[c.category]||'Sem categoria').replace(/^\S+\s/,'');}
function participant(c){
 const name=c.display||c.title,type=c.type==='channel'?'canal':'grupo';
 const isBanned=Array.isArray(data.settings?.bannedUsers)&&data.settings.bannedUsers.includes(c.owner);
 const userPendingCount=data.chats.filter(x=>x.owner===c.owner&&x.status==='pending').length;
 const isApproved=c.status==='approved';
 const isExpanded=expandedChats.has(c.id);
 return `<article class="participant ${isExpanded?'expanded':''} ${isBanned?'participant-banned':''}" data-chat="${c.id}">
  <div class="participant-compact" data-toggle="${c.id}">
   <button type="button" class="avatar avatar-${Math.abs(c.id)%4}" data-edit="${c.id}" aria-label="Editar ${esc(name)}">${esc(initials(name))}</button>
   <button type="button" class="participant-name">
    <strong>${esc(name)}</strong>
    <small>${esc(categoryText(c))} · ${c.type==='channel'?'Canal':'Grupo'}</small>
   </button>
   <div class="participant-status-wrap">
    ${pill(c.status)}
    <span class="chevron-icon" aria-hidden="true">${icon('chevron')}</span>
   </div>
  </div>
  <div class="participant-card">
   <div class="participant-info-box">
    <div class="participant-info-header">Info#</div>
    <div class="participant-info-line">
     <span>👤 <strong>Usuário:</strong></span>
     ${c.ownerName?`<span>${esc(c.ownerName)}</span> · `:''}
     <code>ID ${c.owner||'—'}</code>
     ${c.owner?`<a class="text-link" href="tg://user?id=${c.owner}" target="_blank" rel="noopener noreferrer">Ver perfil ↗</a>`:''}
     ${isBanned?'<span class="pill danger">Banido</span>':''}
    </div>
    <div class="participant-info-line">
     <span>🆔 <strong>ID ${c.type==='channel'?'Canal':'Grupo'}:</strong></span>
     <code>${c.id}</code>
    </div>
    <div class="participant-info-line">
     <span>🔗 <strong>Link ${c.type==='channel'?'Canal':'Grupo'}:</strong></span>
     ${c.url?`<a class="text-link" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.url)} ↗</a>`:'<span class="help">Sem link cadastrado</span>'}
    </div>
    <div class="participant-info-line">
     <span>🎨 <strong>Cor do botão:</strong></span>
     <div class="mini-segmented" data-chat-style-select="${c.id}">
      <button type="button" data-style="" class="${!c.style?'selected':''}">Herda</button>
      <button type="button" data-style="none" class="${c.style==='none'?'selected':''}">Padrão</button>
      <button type="button" data-style="primary" class="${c.style==='primary'?'selected':''}">Azul</button>
      <button type="button" data-style="success" class="${c.style==='success'?'selected':''}">Verde</button>
      <button type="button" data-style="danger" class="${c.style==='danger'?'selected':''}">Vermelho</button>
     </div>
    </div>
   </div>
   ${c.error?`<p class="participant-error">${esc(c.error)}</p>`:''}
   ${c.members!==null&&c.members!==undefined?`<p class="participant-members">${c.members.toLocaleString('pt-BR')} membros${demoData?' · fictício':''}</p>`:''}
   <div class="participant-actions-section">
    <div class="participant-actions">
     ${c.status==='pending'
       ? `<button class="ghost" data-moderate="rejected" data-id="${c.id}">Rejeitar</button><button data-moderate="approved" data-id="${c.id}">Aprovar</button>`
       : isApproved
       ? `<button class="ghost" data-moderate="disapproved" data-id="${c.id}">Desaprovar</button><button class="text-button" data-edit="${c.id}">Editar cadastro ${icon('chevron')}</button>`
       : `<button data-moderate="approved" data-id="${c.id}">Aprovar</button><button class="text-button" data-edit="${c.id}">Editar cadastro ${icon('chevron')}</button>`
     }
    </div>
    <div class="participant-subactions">
     <button class="tool-btn" data-approve-user="${c.owner||0}" data-id="${c.id}">✓ Aceitar todos do usuário${userPendingCount>1?` (${userPendingCount})`:''}</button>
     ${isBanned
       ? `<button class="tool-btn" data-unban="${c.owner}">Desbanir</button>`
       : `<button class="tool-btn tool-btn-danger" data-ban="${c.owner}">Banir</button>`
     }
     <button class="tool-btn tool-btn-danger" data-remove="${c.id}" data-name="${esc(name)}">Remover</button>
    </div>
   </div>
  </div>
 </article>`;
}
function bindEdit(){
 document.querySelectorAll('[data-chat-style-select] button').forEach(b=>b.onclick=(e)=>{
  e.stopPropagation();
  const parent=b.closest('[data-chat-style-select]');
  const id=Number(parent.dataset.chatStyleSelect);
  const style=b.dataset.style;
  action(b,async()=>{
   await call('setChatColor',{id,style});
   if(!data.settings.chatColors)data.settings.chatColors={};
   if(style)data.settings.chatColors[id]=style;
   else delete data.settings.chatColors[id];
   const c=data.chats.find(x=>x.id===id);
   if(c)c.style=style;
   parent.querySelectorAll('button').forEach(btn=>btn.classList.toggle('selected',btn.dataset.style===style));
   tg?.HapticFeedback?.selectionChanged?.();
   toast('Cor do botão atualizada.');
  });
 });
 document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=(e)=>{
  if(e.target.closest('button[data-edit], button[data-moderate], button[data-approve-user], button[data-ban], button[data-unban], button[data-remove], [data-chat-style-select], a'))return;
  const id=Number(el.dataset.toggle);
  if(!id)return;
  const article=el.closest('.participant');
  if(!article)return;
  if(expandedChats.has(id)){
   expandedChats.delete(id);
   article.classList.remove('expanded');
  }else{
   expandedChats.add(id);
   article.classList.add('expanded');
  }
 });
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();editChat(Number(b.dataset.edit));});
 document.querySelectorAll('[data-moderate]').forEach(b=>b.onclick=()=>action(b,async()=>{
  const result=await call('moderateChat',{id:Number(b.dataset.id),status:b.dataset.moderate});
  tg?.HapticFeedback?.notificationOccurred('success');
  await load();
  toast(result.reason||(b.dataset.moderate==='approved'?'Canal/grupo aprovado.':b.dataset.moderate==='disapproved'?'Canal/grupo desaprovado.':'Cadastro rejeitado.'));
 }));
 document.querySelectorAll('[data-approve-user]').forEach(b=>b.onclick=()=>action(b,async()=>{
  const owner=Number(b.dataset.approveUser);
  if(!owner){toast('Usuário não identificado.');return;}
  if(!confirm('Deseja aprovar todos os canais e grupos pendentes deste usuário?'))return;
  const res=await call('approveUserChats',{owner});
  tg?.HapticFeedback?.notificationOccurred('success');
  await load();
  toast(res.count?`${res.count} cadastro(s) aprovado(s)!`:(res.message||'Nenhum cadastro pendente aprovado.'));
 }));
 document.querySelectorAll('[data-ban]').forEach(b=>b.onclick=()=>action(b,async()=>{
  const user=Number(b.dataset.ban);
  if(!user){toast('Usuário não identificado.');return;}
  if(!confirm(`Deseja banir o usuário ${user}? Seus canais e grupos serão suspensos.`))return;
  await call('banUser',{user,ban:true});
  tg?.HapticFeedback?.notificationOccurred('warning');
  await load();
  toast(`Usuário ${user} banido.`);
 }));
 document.querySelectorAll('[data-unban]').forEach(b=>b.onclick=()=>action(b,async()=>{
  const user=Number(b.dataset.unban);
  if(!user)return;
  await call('banUser',{user,ban:false});
  tg?.HapticFeedback?.notificationOccurred('success');
  await load();
  toast(`Usuário ${user} desbanido.`);
 }));
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>action(b,async()=>{
  const id=Number(b.dataset.remove);
  const name=b.dataset.name||'este canal/grupo';
  if(!confirm(`Tem certeza que deseja remover "${name}" da lista?`))return;
  await call('removeChat',{id});
  tg?.HapticFeedback?.notificationOccurred('warning');
  await load();
  toast('Canal/grupo removido.');
 }));
}
function deliveryResults(){return data.deliveries.filter(d=>['failed','uncertain'].includes(d.status)).slice(0,5).map(d=>`<p class="result">${pill(d.status)} ${esc(data.chats.find(c=>c.id===d.chat)?.title||d.chat)}: ${esc(d.error)}</p>`).join('');}
function chats(){
 const pending=data.chats.filter(c=>c.status==='pending').length;
 if(chatFilter===null)chatFilter=pending?'pending':'all';
 $('#content').innerHTML=`<div class="filter-tabs">${[['all','Todos',data.chats.length],['pending','Pendentes',pending],['approved','Ativos',active().length]].map(([v,l,n])=>`<button data-filter="${v}" class="${chatFilter===v?'selected':''}">${l} <span>${n}</span></button>`).join('')}</div><div class="approval-row"><strong>Aprovação</strong><select id="approval-mode" aria-label="Modo de aprovação"><option value="manual" ${data.settings.approval==='manual'?'selected':''}>Manual</option><option value="automatic" ${data.settings.approval==='automatic'?'selected':''}>Automática</option></select></div><div class="toolbar">${icon('search')}<input id="search" placeholder="Buscar canal ou grupo" aria-label="Buscar canal ou grupo"></div><div id="participants"></div>`;
 const update=()=>{const items=data.chats.filter(c=>(c.title+' '+c.display).toLowerCase().includes($('#search').value.toLowerCase())&&(chatFilter==='all'||c.status===chatFilter));$('#participants').innerHTML=items.map(participant).join('')||`<div class="empty"><b>${chatFilter==='pending'?'Tudo em dia ✓':'Nenhum cadastro encontrado'}</b>${chatFilter==='pending'?'Nenhum canal ou grupo aguardando aprovação.':'Adicione o bot como administrador para cadastrar um canal ou grupo.'}</div>`;bindEdit();};
 $('#search').oninput=update;document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{chatFilter=b.dataset.filter;chats();});
 bindApproval();update();
}
function editChat(id){const c=data.chats.find(c=>c.id===id);const d=$('#editor');d.innerHTML=`<h2>${esc(c.title)}</h2><p class="help">${c.type==='channel'?'Canal':'Grupo'} · ID ${c.id}</p><form id="chat-form"><label>Nome no botão</label><input name="display" maxlength="60" value="${esc(c.display)}" placeholder="${esc(c.title)}"><label>Link do próprio canal ou grupo</label><input name="url" ${demoData?'':'required'} value="${esc(c.url)}" placeholder="https://t.me/…"><div class="field-row"><div><label>Categoria</label><select name="category">${data.categories.map((x,i)=>`<option value="${i}" ${i===c.category?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Posição na ordem manual</label><input name="position" type="number" min="0" value="${c.position}"></div></div><div class="field-row"><div><label>Situação</label><select name="status">${['pending','approved','rejected','paused','draft'].map(s=>`<option value="${s}" ${s===c.status?'selected':''}>${labels[s]}</option>`).join('')}</select></div><div><label>Cor do botão</label><select name="style"><option value="" ${!c.style?'selected':''}>Herdar (tipo/global)</option><option value="none" ${c.style==='none'?'selected':''}>Padrão neutro</option><option value="primary" ${c.style==='primary'?'selected':''}>Azul (primary)</option><option value="success" ${c.style==='success'?'selected':''}>Verde (success)</option><option value="danger" ${c.style==='danger'?'selected':''}>Vermelho (danger)</option></select></div></div>${c.error?`<p class="notice">${esc(c.error)}</p>`:''}<div class="spacer"></div><div class="actions"><button type="submit">Salvar participante</button><button type="button" class="ghost" id="close">Cancelar</button></div></form>`;d.showModal();$('#close').onclick=()=>d.close();$('#chat-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);action(e.submitter,async()=>{const result=await call('updateChat',{id,display:f.get('display'),url:f.get('url').trim(),category:Number(f.get('category')),position:Number(f.get('position')),status:f.get('status'),style:f.get('style')});d.close();await load();toast(result.reason||'Participante atualizado.');});};}
function schedule(){const s=data.settings.schedule;const rem=data.settings.removalSchedule||{enabled:false,mode:'fixed',minutes:60,times:['06:00','18:00'],nextAt:0};$('#content').innerHTML=`${card('Publicar ou remover agora','Envie ou exclua a lista salva nos participantes aprovados.',`<div class="actions"><button id="send">Enviar agora</button><button id="remove-now" class="ghost">Excluir listas agora</button><button id="test" class="ghost">Testar no privado</button></div>${deliveryResults()}`)}<div class="grid"><div>${card('Quando publicar','Horários de Brasília (UTC−3).',`<form id="schedule-form"><div class="schedule-mode"><label><input type="radio" name="mode" value="interval" ${s.mode==='interval'?'checked':''}> A cada X minutos<small>Repete a publicação em um intervalo.</small></label><label><input type="radio" name="mode" value="fixed" ${s.mode==='fixed'?'checked':''}> Horários fixos<small>Publica nos horários definidos do dia.</small></label></div><div id="interval-fields"><label>Intervalo em minutos</label><input id="minutes" type="number" min="1" max="10080" value="${s.minutes}"></div><div id="fixed-fields"><label>Horários diários de envio</label><input id="times" value="${s.times.join(', ')}" placeholder="08:00, 20:00"><p class="help">Separe os horários por vírgulas.</p></div><label class="check"><input id="enabled" type="checkbox" ${s.enabled?'checked':''}> Ativar envios automáticos</label><div class="spacer"></div><button type="submit">Salvar agendamento de envios</button></form>`)}<div style="margin-top:14px">${card('Quando remover','Exclui a lista dos canais e grupos nos horários definidos.',`<form id="removal-form"><div class="schedule-mode"><label><input type="radio" name="rem_mode" value="interval" ${rem.mode==='interval'?'checked':''}> A cada X minutos<small>Repete a remoção em um intervalo.</small></label><label><input type="radio" name="rem_mode" value="fixed" ${rem.mode==='fixed'?'checked':''}> Horários fixos<small>Remove nos horários definidos do dia.</small></label></div><div id="rem-interval-fields"><label>Intervalo em minutos</label><input id="rem-minutes" type="number" min="1" max="10080" value="${rem.minutes||60}"></div><div id="rem-fixed-fields"><label>Horários diários de remoção</label><input id="rem-times" value="${(rem.times||['06:00','18:00']).join(', ')}" placeholder="06:00, 18:00"><p class="help">Separe os horários por vírgulas.</p></div><label class="check"><input id="rem-enabled" type="checkbox" ${rem.enabled?'checked':''}> Ativar remoções automáticas</label><div class="spacer"></div><button type="submit">Salvar agendamento de remoções</button></form>`)}</div></div><div>${card('Status das automações',schedulerOk()?'Agendador conectado':'Agendador ainda não conectado',`<div class="notice ${schedulerOk()?'info':''}">${schedulerOk()?'O serviço automático está ativo e verifica os horários a cada minuto.':'O bot e o painel funcionam. Para executar horários com o painel fechado, é necessário ativar o Worker de agendamento na Cloudflare.'}</div><div class="row"><div class="row-main"><small>Próximo envio salvo</small><strong>${date(s.nextAt)}</strong></div></div><div class="row"><div class="row-main"><small>Próxima remoção salva</small><strong>${date(rem.nextAt)}</strong></div></div><div class="row"><div class="row-main"><small>Última verificação automática</small><strong>${date(data.schedulerHeartbeat)}</strong></div></div><p class="help">As rodadas em andamento são concluídas antes de iniciar a próxima. As publicações e remoções agendadas são executadas automaticamente nos horários programados.</p>`)}</div></div>`;
 $('#send').onclick=()=>action($('#send'),async()=>{if(!confirm(`Enviar a lista para ${active().length} participantes aprovados?`))return;await call('sendNow');toast('Envio iniciado.');await load();});
 $('#remove-now').onclick=()=>action($('#remove-now'),async()=>{if(!confirm('Excluir as mensagens da lista de todos os canais e grupos agora?'))return;const res=await call('removeNow');toast(`Listas removidas: ${res?.deletedCount||0} mensagem(ns) apagada(s).`);await load();});
 $('#test').onclick=()=>action($('#test'),async()=>{await call('testList');toast('Teste enviado ao seu privado.');});
 const update=()=>{const mode=$('input[name="mode"]:checked').value;$('#interval-fields').hidden=mode!=='interval';$('#fixed-fields').hidden=mode!=='fixed';};$('#schedule-form').onchange=update;update();$('#schedule-form').onsubmit=e=>{e.preventDefault();save(e.submitter,{...data.settings,schedule:{...s,enabled:$('#enabled').checked,mode:$('input[name="mode"]:checked').value,minutes:Number($('#minutes').value),times:$('#times').value.split(',').map(x=>x.trim()).filter(Boolean)}});};
 const updateRem=()=>{const mode=$('input[name="rem_mode"]:checked').value;$('#rem-interval-fields').hidden=mode!=='interval';$('#rem-fixed-fields').hidden=mode!=='fixed';};$('#removal-form').onchange=updateRem;updateRem();$('#removal-form').onsubmit=e=>{e.preventDefault();save(e.submitter,{...data.settings,removalSchedule:{...rem,enabled:$('#rem-enabled').checked,mode:$('input[name="rem_mode"]:checked').value,minutes:Number($('#rem-minutes').value),times:$('#rem-times').value.split(',').map(x=>x.trim()).filter(Boolean)}});};}
function settings(){const s=data.settings;
 const colorButtons=(target,cur,inheritLabel='Padrão')=>`<div class="segmented" data-color-target="${target}">${[['',inheritLabel],['primary','Azul'],['success','Verde'],['danger','Vermelho']].map(([v,l])=>`<button type="button" data-val="${v}" class="${(cur||'')===v?'selected':''}">${l}</button>`).join('')}</div>`;
 $('#content').innerHTML=card('Aprovação dos cadastros','',approvalButtons())+card('Cores dos botões no Telegram','Personalize as cores dos botões na lista enviada aos canais e grupos.',`<div class="color-field"><label>Cor global (todos os botões)</label>${colorButtons('buttonColor',s.buttonColor)}<small>Aplicada a todos os botões sem cor específica.</small></div><div class="color-field" style="margin-top:14px"><label>Cor para Canais</label>${colorButtons('channelColor',s.channelColor,'Herda global')}<small>Substitui a cor global apenas nos botões de canais.</small></div><div class="color-field" style="margin-top:14px"><label>Cor para Grupos</label>${colorButtons('groupColor',s.groupColor,'Herda global')}<small>Substitui a cor global apenas nos botões de grupos.</small></div>`)+card('Publicação','',`<label class="setting-switch">${icon('trash')}<span>Apagar lista anterior</span><input id="delete" type="checkbox" role="switch" ${s.deletePrevious?'checked':''}></label><label class="setting-switch">${icon('pin')}<span>Fixar nova lista</span><input id="pin" type="checkbox" role="switch" ${s.pin?'checked':''}></label>`)+card('Acesso','',`<button id="open-admins" class="settings-link">${icon('users')}<span>Administradores</span><small>${s.admins.length}</small>${icon('chevron')}</button>`)+card('Aparência','',`<div class="settings-link">${icon('moon')}<span>Tema do Telegram</span>${icon('chevron')}</div>`);
 $('#content').innerHTML+=card('Mínimo de membros','Verificado ao cadastrar e novamente ao aprovar.',`<form id="minimum-form"><label for="minimum-members">Quantidade mínima</label><input id="minimum-members" type="number" min="0" max="100000000" step="1" value="${s.minMembers??0}" required inputmode="numeric"><p class="help">0 desativa a exigência. A regra vale para canais e grupos. Cadastros já aprovados não são removidos automaticamente.</p><div class="spacer"></div><button type="submit">Salvar mínimo</button></form>`)+card('Testes','20 canais e grupos fictícios em diferentes categorias.',`<button id="start-demo" class="outline">${demoData?'Reiniciar dados de teste':'Abrir modo de teste'}</button><p class="help">Teste a aprovação e a organização sem enviar mensagens.</p>`);
 $('#minimum-form').onsubmit=e=>{e.preventDefault();save(e.submitter,{...data.settings,minMembers:Number($('#minimum-members').value)});};$('#start-demo').onclick=()=>{if(dirty&&!confirm('Descartar alterações e abrir os dados de teste?'))return;startDemo();};
 bindApproval();
 document.querySelectorAll('[data-color-target] button').forEach(b=>b.onclick=()=>action(b,async()=>{
  const target=b.closest('[data-color-target]').dataset.colorTarget;
  const val=b.dataset.val;
  await call('saveSettings',{settings:{...data.settings,[target]:val},version:data.version});
  await load();
  toast('Cores salvas.');
 }));
 for(const [id,key] of [['delete','deletePrevious'],['pin','pin']])$('#'+id).onchange=async e=>{const control=e.target;$('#delete').disabled=$('#pin').disabled=true;try{await call('saveSettings',{settings:{...data.settings,[key]:control.checked},version:data.version});await load();toast('Preferência salva.');}catch(err){control.checked=data.settings[key];toast(err.message);}finally{if($('#delete'))$('#delete').disabled=false;if($('#pin'))$('#pin').disabled=false;}};
 $('#open-admins').onclick=()=>{const d=$('#editor');d.innerHTML=`<h2>Administradores</h2><form id="admins-form"><label for="admins">IDs autorizados</label><textarea id="admins" ${data.id!==7595607953?'disabled':''}>${s.admins.join('\n')}</textarea><p class="help">Um ID por linha. O administrador principal permanece autorizado.</p><div class="actions"><button type="submit" ${data.id!==7595607953?'disabled':''}>Salvar</button><button id="close-admins" type="button" class="ghost">Fechar</button></div></form>`;d.showModal();$('#close-admins').onclick=()=>d.close();$('#admins-form').onsubmit=e=>{e.preventDefault();action(e.submitter,async()=>{await call('saveSettings',{settings:{...data.settings,admins:$('#admins').value.split(/[\s,]+/).filter(Boolean).map(Number)},version:data.version});d.close();await load();toast('Administradores salvos.');});};};
}
async function action(button,fn){button.disabled=true;button.setAttribute('aria-busy','true');try{await fn();}catch(e){toast(e.message);}finally{button.disabled=false;button.removeAttribute('aria-busy');}}
async function save(button,settings){await action(button,async()=>{await call('saveSettings',{settings,version:data.version});dirty=false;await load();toast('Alterações salvas.');});}
async function saveList(button){
 await action(button,async()=>{
  const payload=adPayload();if(payload===false)return;
  if(payload)await call('saveAds',payload);
  await call('saveSettings',{settings:listSettings(),version:data.version});
  dirty=false;adRemove.clear();selectedAd=null;await load();toast('Alterações salvas.');
 });
}
async function resume(){if(polling||!data.rounds.some(r=>r.status==='active'))return;polling=true;try{for(let i=0;i<60;i++){const r=await call('processQueue');if(r.idle||r.remaining===0)break;await new Promise(r=>setTimeout(r,2000));}const refreshed=await call('dashboard');if(!dirty){data=refreshed;render();}}catch(e){toast('Envio interrompido no painel: '+e.message);}finally{polling=false;}}
$('#refresh').onclick=()=>{if(tab==='chats'){$('#search').focus();return;}if(dirty&&!confirm('Atualizar e descartar alterações não salvas?'))return;action($('#refresh'),load);};
let appliedTheme='';
function applyTheme(){const signature=JSON.stringify([tg?.colorScheme,tg?.themeParams]);if(signature===appliedTheme)return;appliedTheme=signature;document.documentElement.dataset.theme=tg?.colorScheme||'light';const colors=tg?.themeParams||{};for(const [key,value] of Object.entries(colors)){if(/^#[a-fA-F0-9]{6}$/.test(value))document.documentElement.style.setProperty('--tg-theme-'+key.replaceAll('_','-'),value);}if(tab==='settings'&&data&&!$('#editor').open)settings();}
async function retryLoad(){const retry=$('#retry-load');retry.hidden=true;$('#gate-text').textContent='Carregando seu painel…';try{await load();$('#gate').hidden=true;$('#app').hidden=false;}catch(e){$('#gate-text').textContent=e.message;retry.hidden=false;}}
async function boot(){applyTheme();tg?.onEvent('themeChanged',applyTheme);tg?.ready();tg?.expand();try{tg?.setHeaderColor('bg_color');tg?.setBackgroundColor('secondary_bg_color');}catch{}$('#retry-load').onclick=retryLoad;if(!tg?.initData||!tg?.Serverless?.call){$('#gate-text').textContent='Abra o bot no Telegram e envie /admin para acessar o painel.';return;}await retryLoad();}


let listDraft,listView='organize',selectedToken=null,selectedRow=null,tokenSerial=0,editorColumns=3,previewPage=0,selectedAd=null;
const adRemove=new Set();
const AD_COLORS=[['','Padrão'],['primary','Azul'],['success','Verde'],['danger','Vermelho']];
function sampleToken(name){return {key:++tokenSerial,name:name||`Exemplo ${tokenSerial}`,fake:!name};}
function adDef(token){return listDraft&&listDraft.ads?listDraft.ads.find(d=>d.key===token.ad):null;}
function adTokenOf(def){for(let r=0;r<listDraft.rows.length;r++){const i=listDraft.rows[r].findIndex(t=>t&&t.ad===def.key);if(i>=0)return [r,i];}return null;}
function list(){
 const s=data.settings;tokenSerial=0;listDraft={...s,ads:(data.ads||[]).map(a=>({id:a.id,title:a.title,url:a.url,style:a.style,slot_row:a.slot_row,slot_col:a.slot_col,key:++tokenSerial})),rows:layoutPattern(s).map(n=>Array.from({length:n},()=>sampleToken()))};
 for(const def of listDraft.ads){const row=listDraft.rows[def.slot_row];if(row&&def.slot_col>=0&&def.slot_col<row.length)listDraft.rows[def.slot_row][def.slot_col]={key:++tokenSerial,name:def.title,ad:def.key};}
 adRemove.clear();selectedAd=null;editorColumns=Math.max(3,...layoutPattern(s));while(listDraft.rows.length<6)listDraft.rows.push([]);listView='organize';selectedToken=null;selectedRow=null;drawList();
}
function patternValue(){return listDraft.rows.filter(r=>r.length).map(r=>r.length);}
function listSettings(){return {...data.settings,text:listDraft.text,order:listDraft.order,groupCategories:listDraft.groupCategories,rowPattern:patternValue(),columns:Math.max(1,...patternValue())};}
function changePattern(){dirty=true;drawList();}
function drawList(){
 cancelActiveDrag?.();previewPage=0;
 $('#heading').textContent=listView==='preview'?'Prévia no Telegram':'Organizar lista';
 const pattern=patternValue(),defFor=t=>t&&listDraft.ads?listDraft.ads.find(d=>d.key===t.ad):null,missing=(listDraft.ads||[]).filter(d=>!adTokenOf(d));
 $('#content').innerHTML=`<div class="list-workspace"><div class="segmented editor-tabs"><button type="button" data-view="organize" class="${listView==='organize'?'selected':''}">Organizar</button><button type="button" data-view="preview" class="${listView==='preview'?'selected':''}">Prévia</button></div><form id="list-form"><div id="organize-panel" ${listView==='preview'?'hidden':''}>
 <div class="pattern-top"><div><span class="field-caption">Linhas (X)</span><div class="stepper"><button type="button" id="less-row" aria-label="Remover última linha" ${listDraft.rows.length<=1?'disabled':''}>−</button><output>${listDraft.rows.length}</output><button type="button" id="more-row" aria-label="Adicionar linha" ${listDraft.rows.length>=20?'disabled':''}>+</button></div></div><div><span class="field-caption">Colunas (Y)</span><div class="stepper"><button type="button" id="less-column" aria-label="Diminuir colunas" ${editorColumns===1?'disabled':''}>−</button><output>${editorColumns}</output><button type="button" id="more-column" aria-label="Aumentar colunas" ${editorColumns===5?'disabled':''}>+</button></div></div></div>
 <p class="editor-hint">Até 20 linhas e 5 colunas</p>
 <div id="pattern-grid" class="pattern-grid"><div class="grid-column-labels" style="--slots:${editorColumns}"><span></span>${Array.from({length:editorColumns},(_,i)=>`<span>Y${i+1}</span>`).join('')}</div>${listDraft.rows.map((row,r)=>`<div class="pattern-line" data-row="${r}"><button type="button" class="row-label ${selectedRow===r?'selected':''}" data-select-row="${r}" aria-label="Opções da linha ${r+1}">X${r+1}</button><div class="pattern-slots" style="--slots:${editorColumns}">${Array.from({length:editorColumns},(_,i)=>{const token=row[i],ad=defFor(token);return token?`<button type="button" class="pattern-token ${ad?`ad-token style-${ad.style||'none'}${selectedAd===ad.key?' chosen':''}`:selectedToken===token.key?'chosen':''}" data-token="${token.key}" data-drop-row="${r}" data-drop-index="${i}" aria-label="${ad?'Divulgação ':''}${esc(ad?ad.title:token.name)}, linha ${r+1}, posição ${i+1}. Toque para selecionar ou arraste pelo ícone."><span class="drag-grip" aria-hidden="true"><svg viewBox="0 0 12 20" fill="currentColor"><circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/><circle cx="3" cy="16" r="1.5"/><circle cx="9" cy="16" r="1.5"/></svg></span><span class="token-name">${ad?'🔆 ':''}${esc(ad?ad.title:token.name)}${ad?' 💠':''}</span></button>`:`<button type="button" class="empty-slot" data-add-row="${r}" data-drop-row="${r}" data-drop-index="${i}" aria-label="Adicionar ou mover botão para linha ${r+1}, coluna ${i+1}">+</button>`;}).join('')}</div></div>`).join('')}</div>${missing.length?`<div class="ad-chips"><span>Fora do padrão — toque para inserir:</span>${missing.map(d=>`<button type="button" class="outline ad-chip ${selectedAd===d.key?'selected':''}" data-ad-chip="${d.key}" aria-label="Inserir divulgação ${esc(d.title||'sem nome')}">🔆 ${esc(d.title||'Sem nome')}</button>`).join('')}</div>`:''}
 <div class="move-help">${selectedAd?'<span>Divulgação selecionada — toque em uma posição para inserir.</span><button type="button" id="remove-ad">Remover divulgação</button><button type="button" id="cancel-ad">Cancelar</button>':selectedToken?'<span>Toque em uma posição para mover.</span><button type="button" id="remove-token">Remover botão</button><button type="button" id="cancel-selection">Cancelar</button>':selectedRow!==null?`<span>Linha ${selectedRow+1}</span><button type="button" data-row-up="${selectedRow}" ${selectedRow===0?'disabled':''}>Subir</button><button type="button" data-remove-row="${selectedRow}" ${listDraft.rows.length===1?'disabled':''}>Excluir linha</button><button type="button" id="close-row">Fechar</button>`:'<span>Segure e arraste para mover.</span>'}</div>
 <div class="pattern-summary"><span>Padrão</span><strong>${pattern.join(' → ')||'Adicione botões'}</strong><span>↻ Repetir</span><button class="text-button" type="button" id="example-pattern">1 → 2 → 1</button></div>
 <details class="list-content-options"><summary>Mensagem e ordem dos canais <span>⌄</span></summary><label for="message">Mensagem da publicação</label><textarea id="message" maxlength="3500">${esc(listDraft.text)}</textarea><label for="order">Ordem dos participantes</label><select id="order">${[['alphabetical','Alfabética'],['manual','Posição manual'],['rotate','Alternar a cada rodada']].map(([v,l])=>`<option value="${v}" ${listDraft.order===v?'selected':''}>${l}</option>`).join('')}</select><label class="check"><input id="group" type="checkbox" ${listDraft.groupCategories?'checked':''}> Agrupar por categoria</label><p class="help">O padrão define o tamanho das linhas. Os nomes usados no editor são exemplos; a ordem real vem desta opção.</p></details>
 <div class="editor-actions"><button type="button" class="outline" id="add-buttons">+ Adicionar botões</button><button type="button" class="outline" id="ads-editor">🔆 Divulgações</button><button type="submit">Salvar organização</button></div></div>
 <div id="preview-panel" ${listView!=='preview'?'hidden':''}><div id="live-preview"></div><div class="preview-note">${icon('info')}<span>Fictícios aparecem apenas na prévia.</span></div><div class="preview-summary"><span>${icon('list')}</span><div><strong>${pattern.join(' → ')||'Sem padrão'} · repetir</strong><small>${active().length} participantes aprovados</small></div></div><div class="editor-actions"><button type="button" class="outline" id="back-organize">← Voltar ao editor</button><button type="submit">Salvar organização</button></div></div></form></div>`;
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{listView=b.dataset.view;selectedToken=null;drawList();});
 $('#more-column').onclick=()=>{if(editorColumns<5){editorColumns++;drawList();}};$('#less-column').onclick=()=>{if(editorColumns<=1)return;if(listDraft.rows.some(r=>r.length>=editorColumns)){toast('Mova ou remova botões antes de reduzir as colunas.');return;}editorColumns--;drawList();};
 document.querySelectorAll('[data-select-row]').forEach(b=>b.onclick=()=>{selectedRow=selectedRow===+b.dataset.selectRow?null:+b.dataset.selectRow;selectedToken=null;drawList();});if($('#close-row'))$('#close-row').onclick=()=>{selectedRow=null;drawList();};
 $('#back-organize').onclick=()=>{listView='organize';drawList();};
 $('#more-row').onclick=()=>{if(listDraft.rows.length<20){listDraft.rows.push([]);changePattern();}};
 $('#less-row').onclick=()=>removePatternRow(listDraft.rows.length-1);
 document.querySelectorAll('[data-remove-row]').forEach(b=>b.onclick=()=>removePatternRow(+b.dataset.removeRow));
 document.querySelectorAll('[data-row-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.rowUp;if(i){[listDraft.rows[i-1],listDraft.rows[i]]=[listDraft.rows[i],listDraft.rows[i-1]];changePattern();}});
 $('#example-pattern').onclick=()=>{const placedAds=(listDraft.ads||[]).some(d=>adTokenOf(d));if(dirty&&!confirm(placedAds?'Substituir o desenho atual pelo padrão 1 → 2 → 1? As divulgações ficarão fora do padrão até você recolocá-las.':'Substituir o desenho atual pelo padrão 1 → 2 → 1?'))return;tokenSerial=0;listDraft.rows=[1,2,1].map(n=>Array.from({length:n},()=>sampleToken()));while(listDraft.rows.length<6)listDraft.rows.push([]);editorColumns=Math.max(2,editorColumns);selectedRow=null;changePattern();};
 document.querySelectorAll('[data-add-row]').forEach(b=>b.onclick=()=>{const r=+b.dataset.addRow;if(selectedAd)placeAd(selectedAd,r,+b.dataset.dropIndex);else if(selectedToken)moveToken(selectedToken,r,listDraft.rows[r].length);else buttonPicker(r);});
 document.querySelectorAll('[data-ad-chip]').forEach(b=>b.onclick=()=>{selectedAd=selectedAd===+b.dataset.adChip?null:+b.dataset.adChip;selectedToken=null;drawList();});
 document.querySelectorAll('[data-token]').forEach(b=>{b.onclick=()=>{if(b.dataset.dragged){delete b.dataset.dragged;return;}if(selectedAd){placeAd(selectedAd,+b.dataset.dropRow,+b.dataset.dropIndex);return;}const key=+b.dataset.token;if(selectedToken&&selectedToken!==key)moveToken(selectedToken,+b.dataset.dropRow,+b.dataset.dropIndex);else{selectedToken=selectedToken===key?null:key;drawList();}};bindTokenDrag(b);});
 if($('#remove-token'))$('#remove-token').onclick=()=>{for(const row of listDraft.rows){const i=row.findIndex(t=>t.key===selectedToken);if(i>=0)row.splice(i,1);}selectedToken=null;changePattern();};
 if($('#cancel-ad'))$('#cancel-ad').onclick=()=>{selectedAd=null;drawList();};
 if($('#remove-ad'))$('#remove-ad').onclick=()=>removeAd(selectedAd);
 if($('#cancel-selection'))$('#cancel-selection').onclick=()=>{selectedToken=null;drawList();};
 $('#message').oninput=e=>{listDraft.text=e.target.value;dirty=true;updatePatternPreview();};$('#order').onchange=e=>{listDraft.order=e.target.value;dirty=true;updatePatternPreview();};$('#group').onchange=e=>{listDraft.groupCategories=e.target.checked;dirty=true;updatePatternPreview();};
 $('#add-buttons').onclick=()=>buttonPicker();$('#ads-editor').onclick=()=>adsSheet();
 $('#list-form').onsubmit=e=>{e.preventDefault();if(!patternValue().length){toast('Adicione pelo menos um botão ao padrão.');return;}saveList(e.submitter);};
 updatePatternPreview();
}
function removePatternRow(r){if(listDraft.rows.length<=1)return;if(listDraft.rows[r].length&&!confirm('Remover esta linha do padrão?'))return;listDraft.rows.splice(r,1);selectedToken=null;selectedRow=null;changePattern();}
function placeAd(key,r,index){
 const def=listDraft.ads.find(d=>d.key===key),row=listDraft.rows[r];if(!def||!row)return;
 listDraft.rows[r].splice(Math.min(Math.max(0,index),row.length),0,{key:++tokenSerial,name:def.title,ad:def.key});
 selectedAd=null;selectedToken=null;changePattern();tg?.HapticFeedback?.impactOccurred('light');
}
function removeAd(key){
 const i=listDraft.ads.findIndex(d=>d.key===key);if(i<0)return;
 const def=listDraft.ads[i];
 for(const row of listDraft.rows){const t=row.findIndex(x=>x&&x.ad===key);if(t>=0)row.splice(t,1);}
 listDraft.ads.splice(i,1);if(def.id>0)adRemove.add(def.id);
 selectedAd=null;selectedToken=null;changePattern();
}
function adsSheet(){
 const d=$('#editor');d.classList.add('button-sheet');
 const refresh=()=>{$('#ads-list').innerHTML=listDraft.ads.map(def=>{const place=adTokenOf(def);
  return `<div class="ad-row"><div class="ad-fields"><label>Nome do botão<input data-ad-title="${def.key}" value="${esc(def.title)}" maxlength="60" placeholder="Ex.: Canal parceiro"></label><label>Link do Telegram<input data-ad-url="${def.key}" value="${esc(def.url)}" placeholder="https://t.me/…" inputmode="url"></label><span class="field-caption">Cor no Telegram</span><div class="segmented ad-colors">${AD_COLORS.map(([v,label])=>`<button type="button" data-ad-style="${def.key}|${v}" class="${(def.style||'')===v?'selected':''}">${label}</button>`).join('')}</div></div><div class="ad-row-foot"><span>${place?`Fixado: linha ${place[0]+1}, posição ${place[1]+1}`:'Fora do padrão — feche e toque no chip abaixo da grade'}</span><button type="button" class="ghost" data-ad-remove="${def.key}">Remover</button></div></div>`;}).join('')||'<p class="empty">Nenhuma divulgação ainda. Toque em adicionar.</p>';
  document.querySelectorAll('[data-ad-title]').forEach(i=>i.oninput=()=>{const def=listDraft.ads.find(x=>x.key===+i.dataset.adTitle);if(def){def.title=i.value;dirty=true;}});
  document.querySelectorAll('[data-ad-url]').forEach(i=>i.oninput=()=>{const def=listDraft.ads.find(x=>x.key===+i.dataset.adUrl);if(def){def.url=i.value;dirty=true;}});
  document.querySelectorAll('[data-ad-style]').forEach(b=>b.onclick=()=>{const [k,v]=b.dataset.adStyle.split('|');const def=listDraft.ads.find(x=>x.key===+k);if(def){def.style=v;dirty=true;tg?.HapticFeedback?.selectionChanged?.();}refresh();});
  document.querySelectorAll('[data-ad-remove]').forEach(b=>b.onclick=()=>{removeAd(+b.dataset.adRemove);refresh();});
 };
 d.innerHTML=`<div class="sheet-handle"></div><div class="sheet-heading"><h2>Divulgações</h2><button type="button" id="close-ads" aria-label="Fechar">×</button></div><p class="help">Botões fixos na posição desenhada: a repetição da lista nunca os move. Cada divulgação reaparece no mesmo ponto de cada repetição do padrão.</p><div id="ads-list"></div><button id="add-ad" type="button" class="outline">+ Adicionar divulgação</button><button id="confirm-ads" class="sheet-confirm" type="button">Pronto</button>`;
 refresh();
 $('#close-ads').onclick=$('#confirm-ads').onclick=()=>d.close();
 $('#add-ad').onclick=()=>{
  const free=listDraft.rows.find(r=>r.length<editorColumns);
  if(!free&&listDraft.rows.length>=20){toast('O padrão está cheio. Aumente as linhas ou colunas.');return;}
  const def={key:++tokenSerial,title:'',url:'',style:''};listDraft.ads.push(def);
  const token={key:++tokenSerial,name:def.title,ad:def.key};
  if(free)free.push(token);else listDraft.rows.push([token]);
  dirty=true;refresh();
 };
 d.onclose=()=>{d.classList.remove('button-sheet');d.onclose=null;selectedAd=null;selectedToken=null;drawList();};
 d.showModal();
}
function adPayload(){
 const upsert=[],remove=[...adRemove];
 for(let r=0;r<listDraft.rows.length;r++)for(let i=0;i<listDraft.rows[r].length;i++){
  const t=listDraft.rows[r][i];if(!t||!t.ad)continue;const def=adDef(t);if(!def)continue;
  const title=(def.title||'').trim();
  if(!title){toast('Dê um nome a todos os botões de divulgação.');return false;}
  if(!/^https:\/\/t\.me\//.test(def.url||'')){toast(`Informe um link do Telegram (https://t.me/…) para “${title}”.`);return false;}
  upsert.push({id:def.id,title,url:def.url.trim(),style:def.style||'',row:r,col:i});
 }
 for(const def of listDraft.ads){if(def.id>0&&!adTokenOf(def))remove.push(def.id);}
 return upsert.length||remove.length?{upsert,remove:[...new Set(remove)]}:null;
}
function moveToken(key,r,index){
 const from=listDraft.rows.findIndex(row=>row.some(t=>t.key===key));if(from<0)return;
 const pos=listDraft.rows[from].findIndex(t=>t.key===key);
 if(from!==r&&listDraft.rows[r].length>=editorColumns){toast('A linha está cheia. Aumente as colunas para adicionar outra posição.');return;}
 const [token]=listDraft.rows[from].splice(pos,1);if(from===r&&pos<index)index--;listDraft.rows[r].splice(index,0,token);selectedToken=null;changePattern();tg?.HapticFeedback?.impactOccurred('light');
}
function bindTokenDrag(button){
 button.querySelector('.drag-grip').onpointerdown=e=>{
 if(e.button!==0)return;e.preventDefault();cancelActiveDrag?.();const grip=e.currentTarget;grip.setPointerCapture?.(e.pointerId);
 let ghost=null,target=null,moved=false,frame=0,x=e.clientX,y=e.clientY;const startX=x,startY=y;
 const paint=()=>{frame=0;if(!ghost){ghost=button.cloneNode(true);ghost.classList.add('drag-ghost');ghost.style.width=button.offsetWidth+'px';ghost.style.left='0';ghost.style.top='0';document.body.append(ghost);}
 ghost.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(4deg)`;
 const next=document.elementFromPoint(x,y)?.closest('[data-drop-row]');if(target!==next){target?.classList.remove('drop-target');target=next;target?.classList.add('drop-target');}
 if(y<100)window.scrollBy(0,-12);else if(y>window.innerHeight-135)window.scrollBy(0,12);
 };
 const cleanup=()=>{cancelAnimationFrame(frame);ghost?.remove();target?.classList.remove('drop-target');grip.onpointermove=grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=null;if(grip.hasPointerCapture?.(e.pointerId))grip.releasePointerCapture(e.pointerId);if(cancelActiveDrag===cleanup)cancelActiveDrag=null;};cancelActiveDrag=cleanup;
 grip.onpointermove=ev=>{x=ev.clientX;y=ev.clientY;if(!moved&&Math.hypot(x-startX,y-startY)<6)return;moved=true;if(!frame)frame=requestAnimationFrame(paint);};
 grip.onpointerup=ev=>{x=ev.clientX;y=ev.clientY;if(moved){cancelAnimationFrame(frame);paint();}button.dataset.dragged='true';const dest=target;cleanup();if(moved&&dest)moveToken(+button.dataset.token,+dest.dataset.dropRow,+dest.dataset.dropIndex);else if(!moved){selectedToken=+button.dataset.token;drawList();}};
 grip.onpointercancel=grip.onlostpointercapture=cleanup;
 };
}
function buttonPicker(targetRow){
 const d=$('#editor');d.classList.add('button-sheet');let mode='registered';const chosen=new Set();
 d.innerHTML=`<div class="sheet-handle"></div><div class="sheet-heading"><h2>Adicionar botões</h2><button type="button" id="close-picker" aria-label="Fechar">×</button></div><div class="segmented"><button type="button" data-source="registered" class="selected">Cadastrados</button><button type="button" data-source="fake">Fictícios</button></div><div class="picker-search-wrap">${icon('search')}<input id="picker-search" class="picker-search" placeholder="Buscar canal ou grupo" aria-label="Buscar canal ou grupo"></div><div id="picker-items"></div><div id="fake-controls" hidden><p class="help">Use exemplos para desenhar o padrão. Eles não entram nos envios.</p><label for="fake-count">Quantos botões?</label><input id="fake-count" type="number" min="1" max="100" value="4"></div><div class="fake-card"><span class="fake-icon">${icon('star')}</span><div><strong>Botões fictícios</strong><p>Teste posições com nomes de exemplo.</p></div><button type="button" class="outline" id="create-fake">Criar fictício</button></div><button id="confirm-pick" class="sheet-confirm">Adicionar botões</button>`;
 const update=()=>{const search=$('#picker-search').value.toLowerCase();$('#picker-items').innerHTML=data.chats.filter(c=>(c.title+' '+c.display).toLowerCase().includes(search)).map(c=>`<label class="picker-item"><span class="avatar picker-avatar">${icon(c.type==='channel'?'channels':'users')}</span><span class="picker-name"><strong>${esc(c.display||c.title)}</strong><small>${esc(categoryText(c))}</small></span><input type="checkbox" data-pick="${c.id}" ${chosen.has(c.id)?'checked':''}></label>`).join('')||'<p class="empty">Nenhum cadastro encontrado. Use a aba Fictícios.</p>';document.querySelectorAll('[data-pick]').forEach(c=>c.onchange=()=>{if(c.checked)chosen.add(+c.dataset.pick);else chosen.delete(+c.dataset.pick);$('#confirm-pick').textContent=`Adicionar ${chosen.size} botões`;});};
 document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{mode=b.dataset.source;document.querySelectorAll('[data-source]').forEach(x=>x.classList.toggle('selected',x===b));$('#picker-items').hidden=$('.picker-search-wrap').hidden=$('.fake-card').hidden=mode==='fake';$('#fake-controls').hidden=mode!=='fake';$('#confirm-pick').textContent='Adicionar botões';});
 $('#create-fake').onclick=()=>document.querySelector('[data-source="fake"]').click();$('#picker-search').oninput=update;$('#close-picker').onclick=()=>d.close();d.onclose=()=>{d.classList.remove('button-sheet');d.onclose=null;};
 $('#confirm-pick').onclick=()=>{
 let tokens;if(mode==='fake'){const count=Number($('#fake-count').value);if(!Number.isInteger(count)||count<1||count>100){toast('Escolha de 1 a 100 botões.');return;}tokens=Array.from({length:count},()=>sampleToken());}else tokens=data.chats.filter(c=>chosen.has(c.id)).map(c=>sampleToken(c.display||c.title));
 if(!tokens.length){toast('Selecione pelo menos um botão.');return;}
 const capacity=targetRow===undefined?20*editorColumns-listDraft.rows.reduce((n,r)=>n+r.length,0):editorColumns-listDraft.rows[targetRow].length;
 if(tokens.length>capacity){toast(`Há espaço para ${capacity} botões${targetRow===undefined?' no padrão':' nesta linha'}.`);return;}
 for(const token of tokens){let row=targetRow===undefined?listDraft.rows.find(r=>r.length<editorColumns):listDraft.rows[targetRow];if(!row){row=[];listDraft.rows.push(row);}row.push(token);}
 d.close();changePattern();
 };update();d.showModal();
}
function updatePatternPreview(){
 if(listView!=='preview')return;
 const s=listSettings(),pattern=s.rowPattern.length?s.rowPattern:[1];let items=active().filter(c=>demoData||/^https:\/\/t\.me\//.test(c.url||'')).slice();
 if(s.order==='manual')items.sort((a,b)=>a.position-b.position||a.id-b.id);else items.sort((a,b)=>(a.display||a.title).localeCompare(b.display||b.title,'pt-BR'));
 if(s.groupCategories)items.sort((a,b)=>a.category-b.category);
 const sample=!items.length;if(sample)items=Array.from({length:12},(_,i)=>({id:i+1,title:`Exemplo ${i+1}`,category:0,type:i%2===0?'channel':'group'}));
 const slots=[];
 listDraft.rows.forEach((row,r)=>row.forEach((t,i)=>{if(t&&t.ad){const def=adDef(t);if(def&&def.title&&/^https:\/\/t\.me\//.test(def.url||''))slots.push({row:r,col:i,button:{text:def.title,url:def.url,style:def.style||'',preview:true}});}}));
 const pages=paginateRows(repeatRows(items,pattern,slots));
 previewPage=Math.min(previewPage,Math.max(0,pages.length-1));
 const previewModeBar=`<div class="preview-mode-bar"><span>Visualização das cores:</span><div class="mini-segmented" id="preview-color-toggle"><button type="button" data-mode="telegram" class="${previewColorMode==='telegram'?'selected':''}">🎨 Cores do Telegram</button><button type="button" data-mode="plain" class="${previewColorMode==='plain'?'selected':''}">⚪ Visual padrão</button></div></div>`;
 const colorLegend=`<div class="color-legend"><span><span class="legend-dot tg-primary"></span>Azul</span><span><span class="legend-dot tg-success"></span>Verde</span><span><span class="legend-dot tg-danger"></span>Vermelho</span><span><span class="legend-dot tg-default"></span>Padrão</span></div>`;
 $('#live-preview').innerHTML=previewModeBar+pages.slice(previewPage,previewPage+1).map((rows)=>{const index=previewPage;return`<div class="telegram pattern-preview"><div class="bubble">${esc(s.text)}${pages.length>1?`\n\nParte ${index+1}/${pages.length}`:''}<div class="bubble-time">09:41 ✓✓</div></div><div class="tg-buttons">${rows.map(row=>`<div class="tg-row">${row.map(c=>{
  const ad=c&&c.preview;
  const rawStyle=ad?c.style:(previewColorMode==='plain'?'':resolveStyle(c,s));
  const styleClass=rawStyle?' tg-'+rawStyle:'';
  return `<div class="tg-button${styleClass}"><span>${esc(ad?c.text:(s.groupCategories?(data.categories[c.category]||'').split(' ')[0]+' ':'')+(c.display||c.title))}</span><span class="external-arrow">↗</span></div>`;
 }).join('')}</div>`).join('')}</div></div>`;}).join('')+colorLegend+`<p class="preview-label">${sample?'Exemplo com 12 botões · nenhum participante aprovado':`${items.length} participantes · ${pages.length} mensagem(ns)`}${s.order==='rotate'?' · a ordem alterna a cada rodada':''}</p>${pages.length>1?`<div class="preview-pagination"><button type="button" id="preview-prev" ${previewPage===0?'disabled':''}>← Anterior</button><span>${previewPage+1} / ${pages.length}</span><button type="button" id="preview-next" ${previewPage===pages.length-1?'disabled':''}>Próxima →</button></div>`:''}`;
 if($('#preview-prev'))$('#preview-prev').onclick=()=>{previewPage--;updatePatternPreview();};if($('#preview-next'))$('#preview-next').onclick=()=>{previewPage++;updatePatternPreview();};
 document.querySelectorAll('#preview-color-toggle button').forEach(b=>b.onclick=()=>{previewColorMode=b.dataset.mode;updatePatternPreview();});
}
const cloneData=value=>JSON.parse(JSON.stringify(value));
let demoData=null;
function startDemo(){
 const names=['Clube dos Livros','Papo Livre','Cinema em Casa','Música Todo Dia','Notícias Agora','Curso de Inglês','Humor BR','Investidores Iniciantes','Eventos da Cidade','Receitas e Amigos','Biblioteca Digital','Séries em Debate','Rock e Companhia','Estudos para Concursos','Amizades Brasil','Resumo das Notícias','Comunidade Geral','Apostas em Debate','Comunidade +18','Filmes de Domingo'];
 const categories=[9,2,7,10,11,5,4,8,6,2,9,7,10,5,2,11,0,3,1,7];
 const members=[25,50,99,100,101,150,200,250,300,400,500,600,750,900,1000,1500,2000,3000,5000,10000];
 demoData={...cloneData(data),demo:true,settings:cloneData(data.settings),version:1,rounds:[],deliveries:[],lastDeliverySummary:null,schedulerHeartbeat:0,ads:[{id:1,title:'📣 Comunidade parceira',url:'https://t.me/canalteste',style:'primary',slot_row:0,slot_col:0}],chats:names.map((title,i)=>({id:-9000000-i,title,display:'',type:i%2?'supergroup':'channel',category:categories[i],members:members[i],membersCheckedAt:Date.now(),status:i<8?'pending':i<18?'approved':'rejected',url:'',owner:data.id,position:i,error:i>=18?'Exemplo de cadastro rejeitado.':'',updated:Date.now()}))};
 dirty=false;chatFilter='all';tab='chats';load();
}
async function exitDemo(){demoData=null;dirty=false;chatFilter=null;await load();toast('Dados reais restaurados.');}
function demoCall(name,input){
 if(name==='dashboard')return cloneData(demoData);
 if(name==='removeNow')return {ok:true,deletedCount:0,chatsAffected:0};
 if(name==='setChatColor'){
  const c=demoData.chats.find(c=>c.id===input.id);if(!c)throw Error('Mock não encontrado.');
  c.style=input.style||'';
  demoData.settings.chatColors=demoData.settings.chatColors||{};
  if(input.style)demoData.settings.chatColors[input.id]=input.style;
  else delete demoData.settings.chatColors[input.id];
  return {ok:true,style:input.style};
 }
 if(name==='approveUserChats'){
  const pending=demoData.chats.filter(c=>c.owner===input.owner&&c.status==='pending');
  for(const c of pending){c.status='approved';c.error='';}
  return {ok:true,count:pending.length};
 }
 if(name==='removeChat'){
  demoData.chats=demoData.chats.filter(c=>c.id!==input.id);
  return {ok:true,id:input.id};
 }
 if(name==='banUser'){
  demoData.settings.bannedUsers=demoData.settings.bannedUsers||[];
  const user=Number(input.user||input.id);
  if(input.ban!==false){
   if(!demoData.settings.bannedUsers.includes(user))demoData.settings.bannedUsers.push(user);
   demoData.chats.filter(c=>c.owner===user).forEach(c=>{c.status='rejected';c.error='Usuário banido';});
  }else{
   demoData.settings.bannedUsers=demoData.settings.bannedUsers.filter(u=>u!==user);
  }
  return {ok:true,banned:input.ban!==false};
 }
 if(name==='saveSettings'){if(!Number.isSafeInteger(input.settings.minMembers??0)||(input.settings.minMembers??0)<0)throw Error('Informe um mínimo válido.');demoData.settings=cloneData(input.settings);demoData.version++;return {ok:true};}
 if(name==='saveAds'){demoData.ads=demoData.ads||[];const kept=demoData.ads.filter(a=>!(input.remove||[]).includes(a.id));for(const u of input.upsert||[]){const copy=cloneData(u);const at=copy.id>=1?kept.findIndex(x=>x.id===copy.id):-1;if(at>=0)kept[at]=copy;else{copy.id=-(1+Math.max(0,...demoData.ads.map(a=>Math.abs(a.id||0))));kept.push(copy);}}demoData.ads=kept;return {ok:true};}
 if(['moderateChat','updateChat'].includes(name)){
  const c=demoData.chats.find(c=>c.id===input.id);if(!c)throw Error('Mock não encontrado.');
  if(input.status==='disapproved'){c.status='pending';c.error='';return {ok:true,status:'pending'};}
  if(input.status==='approved'&&c.members<(demoData.settings.minMembers??0)){c.status='rejected';c.error=`Mínimo de membros: este exemplo tem ${c.members}; são necessários ${demoData.settings.minMembers}.`;return {ok:true,status:'rejected',reason:c.error};}
  for(const k of ['status','category','url','display','position','style'])if(input[k]!==undefined)c[k]=input[k];c.error='';return {ok:true};
 }
 throw Error('Modo de teste: esta ação não envia mensagens nem executa o agendador.');
}

boot();
