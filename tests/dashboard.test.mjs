import {test} from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {readFile} from 'node:fs/promises';import {DEFAULTS,CATEGORIES} from '../tgcloud/lib/domain.js';
const app=await readFile(new URL('../frontend/app.js',import.meta.url),'utf8');const html=await readFile(new URL('../frontend/index.html',import.meta.url),'utf8');
async function mount(options={}){const w=new Window({url:'https://app8272402928.tgcloud.ai',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});w.document.write(html);let data={id:7595607953,settings:structuredClone(DEFAULTS),version:1,chats:[{id:-100123,title:'Canal teste',display:'',url:'https://t.me/canalteste',type:'channel',category:0,status:'pending',position:0}],rounds:[],deliveries:[],categories:CATEGORIES,schedulerHeartbeat:0};const calls=[];const events={};w.confirm=()=>true;if(options.fastTimeout){const timer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>timer(fn,ms===20000?0:ms,...args);}
 w.Telegram={WebApp:{initData:'fixture',colorScheme:'dark',themeParams:{bg_color:'#17212b',text_color:'#eeeeee',button_color:'#5288c1',secondary_bg_color:'#0e1621'},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},onEvent(name,fn){events[name]=fn;},Serverless:{call(name,input,cb){calls.push({name,input});if(name==='dashboard'&&options.stallDashboard)return;queueMicrotask(()=>{if(name==='dashboard')return cb(null,structuredClone(data));if(name==='saveSettings'){data.settings=input.settings;data.version++;return cb(null,{ok:true});}if(name==='moderateChat'){data.chats[0].status=input.status;return cb(null,{ok:true});}return cb(null,{ok:true});});}}}};
 const layout=await readFile(new URL('../tgcloud/lib/layout.js',import.meta.url),'utf8');w.eval(layout.replaceAll('export function','function')+'\n'+app.replace(/^import .*?;\n/,''));await settle();return {w,calls,events,get data(){return data;},q:s=>w.document.querySelector(s),close:()=>w.happyDOM.abort()};}
async function settle(){for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));}
test('início abre no centro e leva diretamente à aprovação',async()=>{const a=await mount();assert.equal(a.q('#heading').textContent,'Início');assert.equal(a.w.document.querySelectorAll('#nav button')[2].dataset.tab,'home');assert.ok(a.q('[data-tab="home"]').classList.contains('active'));a.q('#open-pending').click();assert.equal(a.q('#heading').textContent,'Canais e grupos');assert.ok(a.q('[data-moderate="approved"]'));assert.ok(a.q('#approval-mode'));a.q('[data-moderate="approved"]').click();await settle();assert.equal(a.data.chats[0].status,'approved');assert.equal(a.calls.filter(c=>c.name==='moderateChat').length,1);await a.close();});
test('modo automático é salvo com um toque',async()=>{const a=await mount();a.q('[data-tab="settings"]').click();a.q('[data-approval="automatic"]').click();await settle();assert.equal(a.data.settings.approval,'automatic');assert.ok(a.q('[data-approval="automatic"]').classList.contains('selected'));await a.close();});
test('tema acompanha mudança de cores do Telegram',async()=>{const a=await mount();assert.equal(a.w.document.documentElement.dataset.theme,'dark');assert.equal(a.w.document.documentElement.style.getPropertyValue('--tg-theme-bg-color'),'#17212b');a.w.Telegram.WebApp.colorScheme='light';a.w.Telegram.WebApp.themeParams.bg_color='#ffffff';a.events.themeChanged();assert.equal(a.w.document.documentElement.dataset.theme,'light');assert.equal(a.w.document.documentElement.style.getPropertyValue('--tg-theme-bg-color'),'#ffffff');await a.close();});
test('abas, prévia e salvamento da lista funcionam com SDK',async()=>{const a=await mount();a.q('[data-tab="list"]').click();a.q('#message').value='Olá <script>alert(1)</script>';a.q('#message').dispatchEvent(new a.w.Event('input',{bubbles:true}));assert.equal(a.q('#live-preview').textContent,'');a.q('[data-view="preview"]').click();assert.match(a.q('#live-preview').textContent,/<script>/);assert.equal(a.q('#live-preview script'),null);const form=a.q('#list-form'),button=form.querySelector('button[type="submit"]');form.dispatchEvent(new a.w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));await settle();assert.match(a.data.settings.text,/Olá/);a.q('[data-tab="schedule"]').click();assert.ok(a.q('#send'));assert.ok(a.q('#schedule-form'));a.q('[data-tab="settings"]').click();assert.ok(a.q('#delete'));assert.ok(a.q('#pin'));a.q('#open-admins').click();assert.ok(a.q('#admins'));await a.close();});

test('overview usa dados reais e não indica agendador desconectado como ativo',async()=>{const a=await mount();assert.match(a.q('#content').textContent,/0Ativos/);assert.match(a.q('#content').textContent,/1Pendentes/);assert.match(a.q('#content').textContent,/Nenhum envio ainda/);assert.ok(a.q('#send').disabled);a.data.settings.schedule.enabled=true;a.data.settings.schedule.nextAt=Date.now()+60000;a.q('#refresh').click();await settle();assert.match(a.q('#content').textContent,/Aguardando conexão/);assert.equal(a.q('.pill.online'),null);await a.close();});
test('última rodada usa total agregado e não o limite de detalhes de entregas',async()=>{const a=await mount();a.data.rounds=[{id:'round1',created:Date.now()-3600000,status:'done'}];a.data.lastDeliverySummary={total:350,sent:349,failed:1,uncertain:0};a.q('#refresh').click();await settle();assert.match(a.q('#content').textContent,/349 de 350 entregues/);await a.close();});
test('preferência de fixar salva imediatamente em Ajustes',async()=>{const a=await mount();a.q('[data-tab="settings"]').click();a.q('#pin').checked=true;a.q('#pin').dispatchEvent(new a.w.Event('change',{bubbles:true}));await settle();assert.equal(a.data.settings.pin,true);a.q('[data-tab="list"]').click();assert.equal(a.q('#pin'),null);await a.close();});

test('editor salva padrão 1-2-1 e não persiste nomes fictícios',async()=>{const a=await mount();a.q('[data-tab="list"]').click();a.q('#example-pattern').click();assert.equal(a.w.document.querySelectorAll('.pattern-token').length,4);a.q('[data-view="preview"]').click();assert.deepEqual([...a.w.document.querySelectorAll('#live-preview .tg-row')].map(r=>r.children.length),[1,2,1,1,2,1,1,2,1]);const f=a.q('#list-form');f.dispatchEvent(new a.w.SubmitEvent('submit',{cancelable:true,submitter:a.q('#preview-panel button[type="submit"]')}));await settle();assert.deepEqual([...a.data.settings.rowPattern],[1,2,1]);assert.equal('rows' in a.data.settings,false);assert.equal(a.data.chats.length,1);await a.close();});
test('mover botão por toque altera linhas e permite voltar sem perder rascunho',async()=>{const a=await mount();a.q('[data-tab="list"]').click();a.q('#example-pattern').click();a.q('[data-drop-row="1"][data-token]').click();a.q('[data-add-row="0"]').click();assert.deepEqual([...a.w.document.querySelectorAll('.pattern-slots')].map(r=>r.querySelectorAll('[data-token]').length).filter(Boolean),[2,1,1]);a.q('[data-view="preview"]').click();a.q('#back-organize').click();assert.equal(a.q('.pattern-summary strong').textContent,'2 → 1 → 1');await a.close();});
test('seletor cadastrado e fictício respeita capacidade de 5 por linha',async()=>{const a=await mount();a.q('[data-tab="list"]').click();a.q('#more-column').click();a.q('#more-column').click();a.q('#add-buttons').click();a.q('[data-pick]').click();a.q('#confirm-pick').click();assert.match(a.q('#pattern-grid').textContent,/Canal teste/);a.q('[data-add-row="0"]').click();a.q('[data-source="fake"]').click();a.q('#fake-count').value='3';a.q('#confirm-pick').click();assert.match(a.q('#toast').textContent,/espaço para 2/);a.q('#fake-count').value='2';a.q('#confirm-pick').click();assert.equal(a.w.document.querySelectorAll('[data-token]').length,5);assert.equal(a.q('[data-add-row="0"]'),null);await a.close();});

test('grade preserva botões ao reduzir colunas e mantém limite de cinco',async()=>{const a=await mount();a.q('[data-tab="list"]').click();a.q('#less-column').click();a.q('#less-column').click();assert.match(a.q('#toast').textContent,/Mova ou remova/);assert.equal(a.w.document.querySelectorAll('[data-token]').length,2);for(let i=0;i<5;i++)a.q('#more-column').click();assert.equal(a.q('#more-column').disabled,true);assert.equal(a.w.document.querySelectorAll('.grid-column-labels span').length,6);await a.close();});

test('divulgações: token no padrão, chip fora do padrão e envio das definições',async()=>{
 const a=await mount();
 a.data.ads=[{id:1,title:'Parceiro',url:'https://t.me/parceiro',style:'primary',slot_row:0,slot_col:0},{id:2,title:'Solto',url:'https://t.me/solto',style:'',slot_row:9,slot_col:9}];
 a.q('#refresh').click();await settle();
 a.q('[data-tab="list"]').click();
 const adTokens=a.w.document.querySelectorAll('.pattern-token.ad-token');
 assert.equal(adTokens.length,1);assert.match(adTokens[0].textContent,/Parceiro/);
 assert.ok(a.q('.ad-chip'));a.q('.ad-chip').click();
 assert.ok(a.q('#remove-ad'));a.q('[data-add-row="1"]').click();
 assert.equal(a.w.document.querySelectorAll('.pattern-token.ad-token').length,2);
 a.q('#ads-editor').click();assert.ok(a.q('[data-ad-title="2"]'));
 a.q('#close-ads').click();
 const before=a.calls.length;
 const form=a.q('#list-form');
 form.dispatchEvent(new a.w.SubmitEvent('submit',{cancelable:true,submitter:a.q('#list-form button[type="submit"]')}));
 await settle();
 const save=a.calls.slice(before).find(c=>c.name==='saveAds');
 assert.ok(save);
 assert.deepEqual(JSON.parse(JSON.stringify(save.input.upsert)),[{id:1,title:'Parceiro',url:'https://t.me/parceiro',style:'primary',row:0,col:0},{id:2,title:'Solto',url:'https://t.me/solto',style:'',row:1,col:0}]);
 assert.deepEqual(JSON.parse(JSON.stringify(save.input.remove)),[]);
 await a.close();
});

test('divulgação com link fora do Telegram bloqueia o salvamento com aviso',async()=>{
 const a=await mount();
 a.data.ads=[{id:1,title:'Ruim',url:'https://x.test/a',style:'',slot_row:0,slot_col:0}];
 a.q('#refresh').click();await settle();
 a.q('[data-tab="list"]').click();
 const before=a.calls.length;
 const form=a.q('#list-form');
 form.dispatchEvent(new a.w.SubmitEvent('submit',{cancelable:true,submitter:a.q('#list-form button[type="submit"]')}));
 await settle();
 assert.match(a.q('#toast').textContent,/Telegram/);
 assert.equal(a.calls.slice(before).some(c=>c.name==='saveAds'||c.name==='saveSettings'),false);
 await a.close();
});

test('canal compactado abre card ao clicar no nome e edição permanece acessível',async()=>{const a=await mount();a.q('[data-tab="chats"]').click();assert.equal(a.w.document.querySelectorAll('.participant-actions button').length,2);assert.equal(a.q('.participant-name strong').textContent,'Canal teste');assert.equal(a.q('.participant').classList.contains('expanded'),false);a.q('.participant-name').click();assert.equal(a.q('.participant').classList.contains('expanded'),true);assert.match(a.q('.participant-info-box').textContent,/-100123/);a.q('.participant-name').click();assert.equal(a.q('.participant').classList.contains('expanded'),false);a.q('.participant-name').click();assert.equal(a.q('.participant').classList.contains('expanded'),true);a.q('[data-edit]').click();assert.ok(a.q('#chat-form'));await a.close();});

test('servidor sem resposta libera tentativa e painel carrega ao reconectar',async()=>{const options={stallDashboard:true,fastTimeout:true};const a=await mount(options);await new Promise(r=>setTimeout(r,10));assert.match(a.q('#gate-text').textContent,/demorou/);assert.equal(a.q('#retry-load').hidden,false);options.stallDashboard=false;a.q('#retry-load').click();await settle();assert.equal(a.q('#app').hidden,false);await a.close();});
test('editor não monta prévia oculta e limita DOM a uma mensagem por vez',async()=>{const a=await mount();a.data.chats=Array.from({length:1000},(_,i)=>({id:-1000-i,title:'Canal '+String(i).padStart(4,'0'),url:'https://t.me/canal'+i,category:0,status:'approved',position:i}));a.q('#refresh').click();await settle();a.q('[data-tab="list"]').click();assert.equal(a.q('#live-preview').children.length,0);a.q('#more-row').click();assert.equal(a.q('#live-preview').children.length,0);a.q('[data-view="preview"]').click();assert.equal(a.w.document.querySelectorAll('.tg-button').length,40);const first=a.q('.tg-button').textContent;a.q('#preview-next').click();assert.equal(a.w.document.querySelectorAll('.tg-button').length,40);assert.notEqual(a.q('.tg-button').textContent,first);await a.close();});
test('eventos de tema não geram chamadas recursivas para o Telegram',async()=>{const a=await mount();let nativeCalls=0;a.w.Telegram.WebApp.setHeaderColor=()=>{nativeCalls++;a.events.themeChanged();};a.w.Telegram.WebApp.setBackgroundColor=()=>{nativeCalls++;a.events.themeChanged();};a.w.Telegram.WebApp.themeParams.bg_color='#123456';for(let i=0;i<20;i++)a.events.themeChanged();assert.equal(nativeCalls,0);assert.equal(a.w.document.documentElement.style.getPropertyValue('--tg-theme-bg-color'),'#123456');await a.close();});

test('configura mínimo e mocks são isolados dos dados e operações reais',async()=>{const a=await mount();a.q('[data-tab="settings"]').click();a.q('#minimum-members').value='100';let f=a.q('#minimum-form');f.dispatchEvent(new a.w.SubmitEvent('submit',{cancelable:true,submitter:f.querySelector('button')}));await settle();assert.equal(a.data.settings.minMembers,100);const savedCalls=a.calls.length;a.q('#start-demo').click();await settle();assert.equal(a.w.document.querySelectorAll('.participant').length,20);assert.equal(a.data.chats.length,1);a.q('[data-id="-9000000"][data-moderate="approved"]').click();await settle();assert.match(a.q('#toast').textContent,/25.*100/);assert.equal(a.calls.length,savedCalls);a.q('[data-tab="schedule"]').click();a.q('#send').click();await settle();assert.match(a.q('#toast').textContent,/Modo de teste/);assert.equal(a.calls.length,savedCalls);a.q('#leave-demo').click();await settle();a.q('[data-tab="chats"]').click();assert.equal(a.w.document.querySelectorAll('.participant').length,1);await a.close();});

test('troca de cores em ajustes e preview com cores do telegram e padrão',async()=>{
 const a=await mount();
 a.q('[data-tab="settings"]').click();
 const btnBlue=a.w.document.querySelector('[data-color-target="buttonColor"] [data-val="primary"]');
 assert.ok(btnBlue);
 btnBlue.click();
 await settle();
 assert.equal(a.data.settings.buttonColor,'primary');
 a.q('[data-tab="list"]').click();
 a.q('[data-view="preview"]').click();
 assert.ok(a.w.document.querySelector('.tg-button.tg-primary'));
 const btnPlain=a.w.document.querySelector('#preview-color-toggle [data-mode="plain"]');
 assert.ok(btnPlain);
 btnPlain.click();
 assert.equal(a.w.document.querySelector('.tg-button.tg-primary'),null);
 a.w.document.querySelector('#preview-color-toggle [data-mode="telegram"]').click();
 assert.ok(a.w.document.querySelector('.tg-button.tg-primary'));
 await a.close();
});

test('troca de cor individual no card do participante chama setChatColor',async()=>{
 const a=await mount();
 a.q('[data-tab="chats"]').click();
 const selector=a.w.document.querySelector('[data-chat-style-select="-100123"] [data-style="danger"]');
 assert.ok(selector);
 selector.click();
 await settle();
 assert.ok(a.calls.some(c=>c.name==='setChatColor'&&c.input.id===-100123&&c.input.style==='danger'));
 await a.close();
});
