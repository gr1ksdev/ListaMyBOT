import {test,beforeEach} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {DatabaseSync} from 'node:sqlite';
let sql, calls, sent, member, memberCount, countError;
const sdk={db:{async get(q,p={}){return sql.prepare(q).get(p)||null;},async all(q,p={}){return sql.prepare(q).all(p);},async run(q,p={}){const r=sql.prepare(q).run(p);return {rowsAffected:r.changes};}},api:new Proxy({}, {get(_,name){return async p=>{calls.push({name,p});if(name==='getChatMemberCount'){if(countError)throw Error('Telegram unavailable');return memberCount;}if(name==='getMe')return {id:999,username:'ListaMyBOT'};if(name==='getChatMember')return {status:p.user_id===999?'administrator':member,can_delete_messages:true,can_pin_messages:true,can_post_messages:true,can_edit_messages:true};if(name==='getChat')return {id:-100123,type:'channel',title:'Canal teste',username:'canalteste'};if(name==='sendMessage')return {message_id:++sent};return true;};}}),EndpointError:class extends Error{}};
globalThis.__NAV_SDK=sdk;
registerHooks({resolve(specifier,ctx,next){if(specifier==='sdk')return {url:'test:sdk',shortCircuit:true};return next(specifier,ctx);},load(url,ctx,next){if(url==='test:sdk')return {format:'module',source:'export const {db,api,EndpointError}=globalThis.__NAV_SDK;',shortCircuit:true};return next(url,ctx);}});
const {default:message}=await import('../tgcloud/handlers/message.js');const {default:callback}=await import('../tgcloud/handlers/callback_query.js');const {default:moderate}=await import('../tgcloud/endpoints/moderateChat.js');
beforeEach(()=>{sql?.close();sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE list_runtime(id TEXT PRIMARY KEY,value TEXT);CREATE TABLE list_settings(id INTEGER PRIMARY KEY,value TEXT,version INTEGER);CREATE TABLE list_chats(id INTEGER PRIMARY KEY,title TEXT,type TEXT,url TEXT DEFAULT '',category INTEGER DEFAULT -1,status TEXT DEFAULT 'draft',owner INTEGER,updated INTEGER,menu_chat INTEGER,menu_id INTEGER,display TEXT DEFAULT '',position INTEGER DEFAULT 0,last_messages TEXT DEFAULT '[]',error TEXT DEFAULT '');CREATE TABLE list_ads(id INTEGER PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL DEFAULT '',slot_row INTEGER NOT NULL DEFAULT 0,slot_col INTEGER NOT NULL DEFAULT 0,style TEXT NOT NULL DEFAULT '',updated INTEGER NOT NULL);CREATE TABLE list_rounds(id TEXT PRIMARY KEY, created INTEGER, content TEXT, status TEXT);CREATE TABLE list_deliveries(id TEXT PRIMARY KEY, round TEXT, chat INTEGER, status TEXT, page INTEGER, messages TEXT, attempts INTEGER, available INTEGER, error TEXT);`);calls=[];sent=0;member='administrator';memberCount=100;countError=false;});
const {DEFAULTS,CATEGORIES}=await import('../tgcloud/lib/domain.js');const {register,submit,keyboard,menu}=await import('../tgcloud/lib/registration.js');const {default:myChatMember}=await import('../tgcloud/handlers/my_chat_member.js');const {default:updateChat}=await import('../tgcloud/endpoints/updateChat.js');const {default:saveAds}=await import('../tgcloud/endpoints/saveAds.js');const {default:removeNow}=await import('../tgcloud/endpoints/removeNow.js');const {removeLists,processQueue,createRound}=await import('../tgcloud/lib/dispatch.js');const {default:approveUserChats}=await import('../tgcloud/endpoints/approveUserChats.js');const {default:removeChat}=await import('../tgcloud/endpoints/removeChat.js');const {default:banUser}=await import('../tgcloud/endpoints/banUser.js');const {default:saveSettings}=await import('../tgcloud/endpoints/saveSettings.js');
function minimum(n,approval='manual'){sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify({...DEFAULTS,minMembers:n,approval}));}
const pm=text=>({text,chat:{id:42,type:'private'},from:{id:42}});
function seed(){sql.prepare("INSERT INTO list_chats(id,title,type,url,owner,updated) VALUES(-100123,'Canal teste','channel','https://t.me/canalteste',42,1)").run();}
const cb=(data,target=42)=>({id:'callback1',from:{id:42},data,message:{message_id:1,chat:{id:target,type:target>0?'private':'channel'}}});
test('/start responde no fim da conversa e remove o menu anterior',async()=>{await message(pm('/start'));await message(pm('/start'));assert.equal(sent,2);assert.match(calls.find(x=>x.name==='sendMessage').p.text,/Bem-vindo/);assert.ok(calls.some(x=>x.name==='deleteMessage'&&x.p.message_id===1));assert.equal(calls.filter(x=>x.name==='editMessageText').length,0);});
test('novo menu /start, perfil e horários com botões e formatação HTML',async()=>{
 await message(pm('/start'));
 const startMsg=calls.find(x=>x.name==='sendMessage').p;
 assert.match(startMsg.text,/👋 Olá/);
 assert.match(startMsg.text,/Pronto para impulsionar/);
 assert.match(startMsg.text,/Suporte/);
 const startButtons=startMsg.reply_markup.inline_keyboard;
 assert.deepEqual(startButtons.slice(0,3).map(r=>r.map(b=>b.text)),[['👤 Meu Perfil','⏰ Horários'],['Adicionar ao canal/grupo'],['❓ Ajuda','💬 Suporte']]);
 assert.equal(startButtons[1][0].style, 'success');
 assert.match(startButtons[1][0].url, /startgroup=true/);
 assert.match(startButtons[1][0].url, /admin=post_messages/);
 assert.equal(startButtons.flat().some(b => b.text.includes('Pesquisar')), false);

 await callback(cb('nav:profile'));
 const profileMsg=calls.filter(x=>x.name==='editMessageText').at(-1).p;
 assert.match(profileMsg.text,/👤.*Meu Perfil.*Canais.*Grupos/);
 assert.match(profileMsg.text,/Estatísticas da Conta\s+┣ 📢 Canais • 0\s+┗ 💬 Grupos • 0/);
 assert.match(profileMsg.text,/📅 Registro • \d{2}\/\d{2}\/\d{4}/);
 assert.deepEqual(profileMsg.reply_markup.inline_keyboard.map(r=>r.map(b=>b.text)),[['📢 Canais','💬 Grupos'],['🏠 Início']]);

 await callback(cb('nav:schedule'));
 const scheduleMsg=calls.filter(x=>x.name==='editMessageText').at(-1).p;
 assert.match(scheduleMsg.text,/Horários.*todos os dias/);
 assert.match(scheduleMsg.text,/Postagens às.*8:00.*20:00 Hrs/);
 assert.match(scheduleMsg.text,/Remoções às.*6:00.*18:00.*Hrs/);
 assert.deepEqual(scheduleMsg.reply_markup.inline_keyboard.map(r=>r.map(b=>b.text)),[['🏠 Início']]);

 await callback(cb('nav:home'));
 const homeMsg=calls.filter(x=>x.name==='editMessageText').at(-1).p;
 assert.match(homeMsg.text,/👋 Olá/);
});
test('/configurar e /link no privado respondem sem ID',async()=>{await message(pm('/configurar'));await message(pm('/link'));assert.equal(sent,2);assert.match(calls.find(x=>x.name==='sendMessage').p.text,/Minhas Comunidades/);assert.match(calls.filter(x=>x.name==='sendMessage').at(-1).p.text,/Links Oficiais/);});
test('navegação privada usa callbacks e edição',async()=>{await message(pm('/start'));await callback(cb('nav:help'));await callback(cb('nav:home'));assert.equal(sent,1);assert.equal(calls.filter(x=>x.name==='editMessageText').length,2);});
test('categoria, resumo e link ficam na mesma mensagem do canal, apagada após o envio',async()=>{seed();await message({text:'/configurar',chat:{id:-100123,type:'channel',title:'Canal teste'},from:{id:42}});await callback(cb('cat:-100123:3',-100123));await callback(cb('cfg:-100123',-100123));assert.equal(sent,1);assert.equal(calls.filter(x=>x.name==='editMessageText').length,2);await callback(cb('submit:-100123',-100123));assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'pending');assert.equal(calls.filter(x=>x.name==='editMessageText').length,2,'o menu apagado não deve ser editado');assert.equal(calls.filter(x=>x.name==='sendMessage').length,1,'nenhuma mensagem nova no canal');assert.ok(calls.some(x=>x.name==='deleteMessage'&&x.p.chat_id===-100123&&x.p.message_id===1));const row=sql.prepare('SELECT menu_chat,menu_id FROM list_chats').get();assert.equal(row.menu_chat,0);assert.equal(row.menu_id,0);assert.equal(sql.prepare("SELECT value FROM list_runtime WHERE id='config_menu:-100123:-100123'").get()?.value,'null');});

test('cadastro rejeitado no chat mantém a mensagem com verificação',async()=>{minimum(101);seed();sql.exec("UPDATE list_chats SET category=0,status='draft'");await callback(cb('submit:-100123',-100123));assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'rejected');assert.equal(calls.filter(x=>x.name==='deleteMessage').length,0);assert.match(calls.filter(x=>x.name==='editMessageText').at(-1).p.text,/rejeitado/i);});
test('edição do link no privado salva no chat selecionado',async()=>{seed();await message(pm('/start -100123'));await callback(cb('link:-100123'));await message(pm('https://t.me/novolink'));assert.equal(sql.prepare('SELECT url FROM list_chats').get().url,'https://t.me/novolink');assert.equal(sent,1);});
test('usuário sem administração não altera categoria',async()=>{seed();member='member';await callback(cb('cat:-100123:4',-100123));assert.equal(sql.prepare('SELECT category FROM list_chats').get().category,-1);assert.ok(calls.some(x=>x.name==='answerCallbackQuery'&&x.p.show_alert));});
test('aprovação direta exige admin do bot e cadastro pendente',async()=>{seed();sql.exec("UPDATE list_chats SET category=0,status='pending'");await assert.rejects(()=>moderate({id:-100123,status:'approved'},{initData:{user:{id:42}}}));await moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}});assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'approved');await assert.rejects(()=>moderate({id:-100123,status:'rejected'},{initData:{user:{id:7595607953}}}));});
test('rejeição direta não exige consertar um link inválido',async()=>{seed();sql.exec("UPDATE list_chats SET status='pending',url=''");await moderate({id:-100123,status:'rejected'},{initData:{user:{id:7595607953}}});assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'rejected');});
test('aprovar pelo painel recupera cadastro rejeitado com dados válidos',async()=>{seed();sql.exec("UPDATE list_chats SET category=0,status='rejected',error='motivo antigo'");const r=await moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}});assert.equal(r.status,'approved');const c=sql.prepare('SELECT status,error FROM list_chats').get();assert.equal(c.status,'approved');assert.equal(c.error,'');});
test('aprovar pelo painel não contorna banimento do dono',async()=>{minimum(0);seed();sql.exec("UPDATE list_chats SET category=0,status='pending'");sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({...DEFAULTS,bannedUsers:[42]}));await assert.rejects(()=>moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}}),/banido/);assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'pending');});

test('bot adicionado rejeita abaixo do mínimo e não libera categorias',async()=>{minimum(101);await register({id:-100123,title:'Canal teste',type:'channel'},42);const c=sql.prepare('SELECT * FROM list_chats').get();assert.equal(c.status,'rejected');assert.match(c.error,/100.*101/);const screen=calls.find(c=>c.name==='sendMessage').p;assert.ok(screen.reply_markup.inline_keyboard.flat().some(b=>b.callback_data==='recheck:-100123'));assert.equal(screen.reply_markup.inline_keyboard.flat().some(b=>b.callback_data?.startsWith('cat:')),false);});
test('igual ao mínimo libera cadastro; nova checagem pode recuperar rejeitado',async()=>{minimum(100);memberCount=99;await register({id:-100123,title:'Canal teste',type:'supergroup'},42);memberCount=100;await callback(cb('recheck:-100123',-100123));const c=sql.prepare('SELECT * FROM list_chats').get();assert.equal(c.status,'draft');assert.equal(c.error,'');assert.equal(calls.filter(c=>c.name==='getChatMemberCount').length,2);});
test('aprovação manual consulta contagem atual e rejeita se caiu abaixo',async()=>{minimum(100);seed();sql.exec("UPDATE list_chats SET category=0,status='pending'");memberCount=99;const r=await moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}});assert.equal(r.status,'rejected');assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'rejected');assert.equal(calls.filter(c=>c.name==='getChatMemberCount').length,1);});
test('aprovação manual aceita contagem exatamente igual',async()=>{minimum(100);seed();sql.exec("UPDATE list_chats SET category=0,status='pending'");await moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}});assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'approved');});
test('aprovação automática e edição não contornam o mínimo',async()=>{minimum(101,'automatic');seed();sql.exec('UPDATE list_chats SET category=0');const c=sql.prepare('SELECT * FROM list_chats').get();assert.equal(await submit(c,42),'rejected');const r=await updateChat({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}});assert.equal(r.status,'rejected');assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'rejected');});
test('falha de contagem bloqueia aprovação sem rejeição falsa',async()=>{minimum(100);seed();sql.exec("UPDATE list_chats SET category=0,status='pending'");countError=true;await assert.rejects(()=>moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}}),/conferir os membros/);assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'pending');});

test('botão de aprovar no log também respeita o mínimo de membros',async()=>{
 minimum(100);seed();sql.exec("UPDATE list_chats SET category=0,status='pending'");memberCount=99;
 calls=[];
 await callback(cb('chat_adm:approve:-100123',-1001999999));
 const answer=calls.find(c=>c.name==='answerCallbackQuery');
 assert.ok(answer);
 assert.match(answer.p.text,/Mínimo de membros/);
 assert.equal(sql.prepare('SELECT status FROM list_chats').get().status,'rejected');
});

test('divulgações: só o admin salva, upsert mantém id e remoção apaga registro',async()=>{
 await assert.rejects(()=>saveAds({upsert:[]},{initData:{user:{id:42}}}));
 await saveAds({upsert:[{title:'Parceiro',url:'https://t.me/parceirox',style:'success',row:0,col:0}]},{initData:{user:{id:7595607953}}});
 const row=sql.prepare('SELECT * FROM list_ads').get();
 assert.equal(row.title,'Parceiro');assert.equal(row.style,'success');assert.equal(row.slot_row,0);assert.equal(row.slot_col,0);
 await saveAds({upsert:[{id:row.id,title:'Novo nome',url:'https://t.me/parceirox',style:'danger',row:2,col:1}]},{initData:{user:{id:7595607953}}});
 let after=sql.prepare('SELECT * FROM list_ads').get();
 assert.equal(after.id,row.id);assert.equal(after.title,'Novo nome');assert.equal(after.slot_row,2);assert.equal(after.style,'danger');
 await saveAds({remove:[row.id]},{initData:{user:{id:7595607953}}});
 assert.equal(sql.prepare('SELECT count(*) AS n FROM list_ads').get().n,0);
});
test('divulgações: valida link, estilo, posição repetida e nome vazio',async()=>{
 const admin={initData:{user:{id:7595607953}}};
 await assert.rejects(()=>saveAds({upsert:[{title:'X',url:'https://x.test/a',row:0,col:0}]},admin),/Telegram/);
 await assert.rejects(()=>saveAds({upsert:[{title:'X',url:'https://t.me/aaaa',style:'rosa',row:0,col:0}]},admin),/Estilo/);
 await assert.rejects(()=>saveAds({upsert:[{title:'A',url:'https://t.me/aaaa',row:0,col:0},{title:'B',url:'https://t.me/bbbb',row:0,col:0}]},admin),/posição/);
 await assert.rejects(()=>saveAds({upsert:[{title:'',url:'https://t.me/aaaa',row:0,col:0}]},admin),/1 a 60/);
 await assert.rejects(()=>saveAds({upsert:[{title:'X',url:'https://t.me/aaaa',row:1000,col:0}]},admin),/Posição/);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM list_ads').get().n,0);
});

test('divulgações: aceita mais de 20 parcerias sem consumir posições da lista',async()=>{
 const admin={initData:{user:{id:7595607953}}};
 const rows=Array.from({length:21},(_,i)=>({
  title:'Parceiro '+i,
  url:'https://t.me/parceiro'+i,
  row:16+Math.floor(i/5),
  col:i%5
 }));
 await saveAds({upsert:rows},admin);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM list_ads').get().n,21);
 assert.equal(sql.prepare('SELECT slot_row FROM list_ads ORDER BY slot_row DESC, slot_col DESC LIMIT 1').get().slot_row,20);
});

test('horários da aba nav:schedule refletem as configurações da dashboard',async()=>{
 const customSchedule={...DEFAULTS,schedule:{enabled:true,mode:'fixed',times:['10:30','22:30'],minutes:60,nextAt:0},removalSchedule:{enabled:true,mode:'fixed',times:['05:15','17:45'],minutes:60,nextAt:0}};
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(customSchedule));
 await message(pm('/start'));
 await callback(cb('nav:schedule'));
 const scheduleMsg=calls.filter(x=>x.name==='editMessageText').at(-1).p;
 assert.match(scheduleMsg.text,/Postagens às.*10:30.*22:30 Hrs/);
 assert.match(scheduleMsg.text,/Remoções às.*5:15.*17:45.*Hrs/);
});

test('remoção de listas: endpoint removeNow exclui mensagens e limpa last_messages',async()=>{
 seed();
 sql.exec("UPDATE list_chats SET last_messages='[101,102]' WHERE id=-100123");
 await assert.rejects(()=>removeNow({},{initData:{user:{id:42}}}));
 const res=await removeNow({},{initData:{user:{id:7595607953}}});
 assert.equal(res.ok,true);
 assert.equal(res.deletedCount,2);
 assert.equal(res.chatsAffected,1);
 const row=sql.prepare('SELECT last_messages FROM list_chats WHERE id=-100123').get();
 assert.equal(row.last_messages,'[]');
 const deleteCalls=calls.filter(x=>x.name==='deleteMessage'&&x.p.chat_id===-100123);
 assert.equal(deleteCalls.length,2);
 assert.deepEqual(deleteCalls.map(c=>c.p.message_id),[101,102]);
});

test('remoção de listas: agendamento automático executa no horário programado',async()=>{
 seed();
 sql.exec("UPDATE list_chats SET last_messages='[201]' WHERE id=-100123");
 const past=Date.now()-1000;
 const settingsWithRemoval={...DEFAULTS,schedule:{enabled:false,mode:'fixed',times:['08:00'],minutes:60,nextAt:0},removalSchedule:{enabled:true,mode:'fixed',times:['06:00'],minutes:60,nextAt:past}};
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(settingsWithRemoval));
 await processQueue({scheduled:true});
 const row=sql.prepare('SELECT last_messages FROM list_chats WHERE id=-100123').get();
 assert.equal(row.last_messages,'[]');
 assert.ok(calls.some(x=>x.name==='deleteMessage'&&x.p.message_id===201));
 const updatedSettings=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.ok(updatedSettings.removalSchedule.nextAt>Date.now());
});

test('setup inicial de canal/grupo e boas-vindas usam texto designer, blockquote e tglink em palavras fortes',async()=>{
 seed();
 await message(pm('/start'));
 const startMsg=calls.find(x=>x.name==='sendMessage').p;
 assert.match(startMsg.text,/<a href="tg:\/\/user\?id=999">Canais<\/a>/);
 assert.match(startMsg.text,/<a href="tg:\/\/user\?id=999">Grupos<\/a>/);
 assert.match(startMsg.text,/<a href="tg:\/\/user\?id=999">Suporte<\/a>/);
 assert.match(startMsg.text,/<blockquote>/);

 calls=[];
 await message({text:'/configurar',chat:{id:-100123,type:'channel',title:'Canal VIP'},from:{id:42}});
 const catMsg=calls.find(x=>x.name==='sendMessage').p;
 assert.match(catMsg.text,/🏷 <a href="tg:\/\/user\?id=999">Categorias<\/a>/);
 assert.match(catMsg.text,/<blockquote><b>📂 Configuração de Nicho/);
 assert.match(catMsg.text,/┣ 📢 Tipo • <a href="tg:\/\/user\?id=999">Canal<\/a>/);

 await callback(cb('cfg:-100123',-100123));
 const setupMsg=calls.filter(x=>x.name==='editMessageText').at(-1).p;
 assert.match(setupMsg.text,/⚙️ <a href="tg:\/\/user\?id=999">Configuração<\/a>/);
 assert.match(setupMsg.text,/<blockquote><b>📢 Painel do <a href="tg:\/\/user\?id=999">Canal<\/a>/);
 assert.match(setupMsg.text,/┣ 📊 Status • 📝 Cadastro em configuração/);
 assert.match(setupMsg.text,/┗ 🔗 Link •/);
 assert.match(setupMsg.text,/<b><i>✨ Defina a categoria abaixo/);
 const setupButtons=setupMsg.reply_markup.inline_keyboard;
 assert.ok(setupButtons.some(r=>r.some(b=>b.text==='🏷 Escolher categoria')));
 assert.equal(setupButtons.some(r=>r.some(b=>b.text==='🔗 Editar link')), false);
 assert.ok(setupButtons.some(r=>r.some(b=>b.text==='✅ Enviar cadastro' && b.style==='success')));
 assert.ok(setupButtons.some(r=>r.some(b=>b.text==='❌ Cancelar' && b.style==='danger')));
});

test('aprovar e desaprovar: permite alternar situação do canal',async()=>{
 seed();
 sql.exec("UPDATE list_chats SET category=0,status='pending'");
 await moderate({id:-100123,status:'approved'},{initData:{user:{id:7595607953}}});
 assert.equal(sql.prepare('SELECT status FROM list_chats WHERE id=-100123').get().status,'approved');

 await moderate({id:-100123,status:'disapproved'},{initData:{user:{id:7595607953}}});
 assert.equal(sql.prepare('SELECT status FROM list_chats WHERE id=-100123').get().status,'pending');
});

test('aceitar todos do usuário: aprova todos os canais pendentes do mesmo owner',async()=>{
 seed();
 sql.exec("UPDATE list_chats SET category=0,status='pending'");
 sql.exec("INSERT INTO list_chats(id,title,type,url,owner,category,status,updated) VALUES(-100124,'Canal 2','channel','https://t.me/canal2',42,0,'pending',1)");
 sql.exec("INSERT INTO list_chats(id,title,type,url,owner,category,status,updated) VALUES(-100125,'Outro usuário','channel','https://t.me/outro',99,0,'pending',1)");

 const res=await approveUserChats({owner:42},{initData:{user:{id:7595607953}}});
 assert.equal(res.ok,true);
 assert.equal(res.count,2);

 const c1=sql.prepare('SELECT status FROM list_chats WHERE id=-100123').get();
 const c2=sql.prepare('SELECT status FROM list_chats WHERE id=-100124').get();
 const c3=sql.prepare('SELECT status FROM list_chats WHERE id=-100125').get();
 assert.equal(c1.status,'approved');
 assert.equal(c2.status,'approved');
 assert.equal(c3.status,'pending');
});

test('remover canal: exclui o registro permanentemente de list_chats',async()=>{
 seed();
 const res=await removeChat({id:-100123},{initData:{user:{id:7595607953}}});
 assert.equal(res.ok,true);
 const row=sql.prepare('SELECT * FROM list_chats WHERE id=-100123').get();
 assert.equal(row,undefined);
});

test('banir e desbanir usuário: suspende cadastros, bloqueia mensagens e preserva agendamentos',async()=>{
 seed();
 const scheduleNextAt=Date.now()+3600000;
 const removalNextAt=Date.now()+7200000;
 const custom={...DEFAULTS,
  schedule:{...DEFAULTS.schedule,enabled:true,nextAt:scheduleNextAt},
  removalSchedule:{...DEFAULTS.removalSchedule,enabled:true,nextAt:removalNextAt}
 };
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(custom));

 const banRes=await banUser({user:42,ban:true},{initData:{user:{id:7595607953}}});
 assert.equal(banRes.ok,true);
 assert.equal(banRes.banned,true);
 let saved=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.equal(saved.schedule.nextAt,scheduleNextAt);
 assert.equal(saved.removalSchedule.nextAt,removalNextAt);

 const chat=sql.prepare('SELECT status,error FROM list_chats WHERE owner=42').get();
 assert.equal(chat.status,'rejected');
 assert.match(chat.error,/banido/i);

 calls=[];
 await message(pm('/start'));
 const banMsg=calls.find(x=>x.name==='sendMessage').p;
 assert.match(banMsg.text,/Acesso Suspenso/);
 assert.match(banMsg.text,/banido pelo administrador/);

 const unbanRes=await banUser({user:42,ban:false},{initData:{user:{id:7595607953}}});
 assert.equal(unbanRes.ok,true);
 assert.equal(unbanRes.banned,false);
 saved=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.equal(saved.schedule.nextAt,scheduleNextAt);
 assert.equal(saved.removalSchedule.nextAt,removalNextAt);

 calls=[];
 await message(pm('/start'));
 const okMsg=calls.find(x=>x.name==='sendMessage').p;
 assert.match(okMsg.text,/👋 Olá/);
});

test('salvar configurações preserva o próximo envio e a próxima remoção',async()=>{
 const scheduleNextAt=Date.now()+3600000;
 const removalNextAt=Date.now()+7200000;
 const custom={...DEFAULTS,
  schedule:{...DEFAULTS.schedule,enabled:true,nextAt:scheduleNextAt},
  removalSchedule:{...DEFAULTS.removalSchedule,enabled:true,nextAt:removalNextAt}
 };
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(custom));
 await saveSettings({settings:{...custom,buttonColor:'primary'},version:1},{initData:{user:{id:7595607953}}});
 const saved=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.equal(saved.schedule.nextAt,scheduleNextAt);
 assert.equal(saved.removalSchedule.nextAt,removalNextAt);
});

test('comandos /setadmin, /deladmin e /admins gerenciam administradores com sucesso',async()=>{
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(DEFAULTS));

 const ownerMsg = text => ({ text, chat: { id: 7595607953, type: 'private' }, from: { id: 7595607953 } });
 const nonAdminMsg = text => ({ text, chat: { id: 42, type: 'private' }, from: { id: 42 } });

 // Não-admin tenta /setadmin
 calls = [];
 await message(nonAdminMsg('/setadmin 123456789'));
 const denied = calls.find(x => x.name === 'sendMessage').p;
 assert.match(denied.text, /Acesso negado/);

 // Owner executa /setadmin sem ID
 calls = [];
 await message(ownerMsg('/setadmin'));
 const usage = calls.find(x => x.name === 'sendMessage').p;
 assert.match(usage.text, /Uso do comando \/setadmin/);

 // Owner tenta /setadmin com o próprio ID de owner
 calls = [];
 await message(ownerMsg('/setadmin 7595607953'));
 const alreadyOwner = calls.find(x => x.name === 'sendMessage').p;
 assert.match(alreadyOwner.text, /Proprietário \(Owner\) permanente/i);

 // Segundo owner tenta /setadmin com seu ID
 calls = [];
 const owner2Msg = text => ({ text, chat: { id: 8474484790, type: 'private' }, from: { id: 8474484790 } });
 await message(owner2Msg('/setadmin 8474484790'));
 const alreadyOwner2 = calls.find(x => x.name === 'sendMessage').p;
 assert.match(alreadyOwner2.text, /Proprietário \(Owner\) permanente/i);

 // Owner adiciona novo admin 123456789
 calls = [];
 await message(ownerMsg('/setadmin 123456789'));
 const successAdd = calls.find(x => x.name === 'sendMessage').p;
 assert.match(successAdd.text, /Novo administrador configurado com sucesso/);
 assert.match(successAdd.text, /123456789/);

 // Verifica no banco se 123456789 foi adicionado
 const row = sql.prepare('SELECT value FROM list_settings WHERE id=1').get();
 const settings = JSON.parse(row.value);
 assert.ok(settings.admins.includes(123456789));

 // Lista admins com /admins
 calls = [];
 await message(ownerMsg('/admins'));
 const adminsList = calls.find(x => x.name === 'sendMessage').p;
 assert.match(adminsList.text, /7595607953/);
 assert.match(adminsList.text, /8474484790/);
 assert.match(adminsList.text, /123456789/);

 // Tentar remover owner com /deladmin é bloqueado
 calls = [];
 await message(ownerMsg('/deladmin 7595607953'));
 const blockedDel = calls.find(x => x.name === 'sendMessage').p;
 assert.match(blockedDel.text, /proprietários? \(owners?\) permanente/i);

 calls = [];
 await message(owner2Msg('/deladmin 8474484790'));
 const blockedDel2 = calls.find(x => x.name === 'sendMessage').p;
 assert.match(blockedDel2.text, /proprietários? \(owners?\) permanente/i);

 // Remover admin 123456789
 calls = [];
 await message(owner2Msg('/deladmin 123456789'));
 const successDel = calls.find(x => x.name === 'sendMessage').p;
 assert.match(successDel.text, /Administrador removido com sucesso/);

 const rowAfter = sql.prepare('SELECT value FROM list_settings WHERE id=1').get();
 const settingsAfter = JSON.parse(rowAfter.value);
 assert.equal(settingsAfter.admins.includes(123456789), false);
});

test('modo manutenção responde usuários comuns, silencia quando vazio e libera administradores', async () => {
 const active={...DEFAULTS,maintenance:{enabled:true,message:'🛠️ <b>Voltamos já</b>'}};
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(active));

 calls=[];
 await message(pm('/start'));
 let sentCalls=calls.filter(x=>x.name==='sendMessage');
 assert.equal(sentCalls.length,1);
 assert.match(sentCalls[0].p.text,/Voltamos já/);
 assert.doesNotMatch(sentCalls[0].p.text,/Bem-vindo/);

 calls=[];
 await callback(cb('nav:help'));
 const maintenanceAnswer=calls.find(x=>x.name==='answerCallbackQuery');
 assert.ok(maintenanceAnswer);
 assert.match(maintenanceAnswer.p.text,/Voltamos já/);
 assert.equal(calls.filter(x=>x.name==='editMessageText').length,0);

 // Administradores continuam podendo usar o bot durante a manutenção.
 calls=[];
 await message({text:'/start',chat:{id:7595607953,type:'private'},from:{id:7595607953}});
 sentCalls=calls.filter(x=>x.name==='sendMessage');
 assert.equal(sentCalls.length,1);
 assert.match(sentCalls[0].p.text,/👋 Olá/);

 // Mensagem vazia = modo silencioso.
 const silent={...active,maintenance:{enabled:true,message:''}};
 sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify(silent));
 calls=[];
 await message(pm('/start'));
 await callback(cb('nav:help'));
 assert.equal(calls.filter(x=>x.name==='sendMessage').length,0);
 const silentAnswer=calls.find(x=>x.name==='answerCallbackQuery');
 assert.ok(silentAnswer);
 assert.equal(silentAnswer.p.text,undefined);
});

test('somente administradores ativam o modo manutenção', async () => {
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(DEFAULTS));
 const adminMsg=text=>({text,chat:{id:7595607953,type:'private'},from:{id:7595607953}});

 await assert.rejects(
  ()=>saveSettings({settings:{...DEFAULTS,maintenance:{enabled:true,message:'X'}},version:1},{initData:{user:{id:42}}}),
  /administradores/
 );

 calls=[];
 await message(pm('/manutencao on'));
 assert.match(calls.find(x=>x.name==='sendMessage').p.text,/Acesso negado/);
 assert.equal(JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value).maintenance.enabled,false);

 calls=[];
 await message(adminMsg('/manutencao on'));
 assert.match(calls.find(x=>x.name==='sendMessage').p.text,/ativado/i);
 let saved=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.equal(saved.maintenance.enabled,true);

 calls=[];
 await message(adminMsg('/manutencao msg 🛠️ <b>Voltamos já</b>'));
 saved=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.equal(saved.maintenance.message,'🛠️ <b>Voltamos já</b>');

 calls=[];
 await message(adminMsg('/manutencao off'));
 saved=JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
 assert.equal(saved.maintenance.enabled,false);
});

test('modo manutenção pausa envios automáticos e bloqueia novas rodadas', async () => {
 const active={...DEFAULTS,maintenance:{enabled:true,message:'X'},schedule:{...DEFAULTS.schedule,enabled:true,nextAt:Date.now()-1000}};
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(active));
 seed();
 calls=[];
 const result=await processQueue({scheduled:true});
 assert.equal(result.maintenance,true);
 assert.equal(calls.filter(x=>x.name==='sendMessage').length,0);
 await assert.rejects(()=>createRound(),/manutenção/i);
});

test('modo manutenção não registra novos chats de usuários comuns', async () => {
 const active={...DEFAULTS,maintenance:{enabled:true,message:'X'}};
 sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(active));
 calls=[];
 await myChatMember({
  chat:{id:-100123,type:'channel',title:'Canal Teste'},
  from:{id:42},
  new_chat_member:{status:'administrator'}
 });
 assert.equal(sql.prepare('SELECT * FROM list_chats').get(),undefined);
 assert.equal(calls.length,0);

 // Um proprietário pode continuar preparando o chat durante a manutenção.
 await myChatMember({
  chat:{id:-100124,type:'channel',title:'Canal do Owner'},
  from:{id:7595607953},
  new_chat_member:{status:'administrator'}
 });
 assert.ok(sql.prepare('SELECT * FROM list_chats WHERE id=-100124').get());
});

test('novas categorias, layout 2 por linha e botões de cancelar no canal', async () => {
 assert.equal(CATEGORIES.length, 12);
 assert.equal(CATEGORIES[0], '🎮 Jogos');
 assert.equal(CATEGORIES[1], '📚 Estudos');
 assert.equal(CATEGORIES[11], '📰 Notícias');

 const c = { id: -100123, title: 'Meu Canal', type: 'channel', category: 0, status: 'draft', url: 'https://t.me/meucanal' };
 const kb = keyboard(c, -100123).inline_keyboard;
 assert.equal(kb.length, 8);
 for (let i = 0; i < 6; i++) {
  assert.equal(kb[i].length, 2);
 }
 assert.deepEqual(kb[6].map(b => b.text), ['✅ Enviar cadastro']);
 assert.equal(kb[6][0].style, 'success');
 assert.deepEqual(kb[7].map(b => b.text), ['‹ Voltar', '❌ Cancelar']);
 assert.equal(kb[7][0].style, 'primary');
 assert.equal(kb[7][1].style, 'danger');
 // Categoria 0 selecionada fica verde (success) e sem o ícone ✓
 assert.equal(kb[0][0].text, '🎮 Jogos');
 assert.equal(kb[0][0].style, 'success');
 // Categorias não selecionadas ficam azuis (primary)
 assert.equal(kb[0][1].text, '📚 Estudos');
 assert.equal(kb[0][1].style, 'primary');
 // Verifica que em todo o teclado de categorias só há 1 botão cancelar
 assert.equal(kb.flat().filter(b => b.text === '❌ Cancelar').length, 1);

 seed();
 calls = [];
 await menu(c, -100123);
 const sentMsg = calls.find(x => x.name === 'sendMessage').p;
 const menuRows = sentMsg.reply_markup.inline_keyboard;
 assert.equal(menuRows.flat().some(b => b.text?.includes('Continuar no privado')), false);
 assert.equal(menuRows.flat().some(b => b.text?.includes('Editar link')), false);
 assert.equal(menuRows.flat().filter(b => b.text === '❌ Cancelar').length, 1);
 assert.ok(menuRows.flat().some(b => b.text === '❌ Cancelar' && b.style === 'danger'));
});

test('botão cancelar no canal/grupo fecha menu e remove mensagem', async () => {
 seed();
 calls = [];
 await callback(cb('cancel:-100123', -100123));
 assert.ok(calls.some(x => x.name === 'answerCallbackQuery'));
 assert.ok(calls.some(x => x.name === 'deleteMessage' && x.p.chat_id === -100123));
 const exitMsg = calls.find(x => x.name === 'sendMessage' && x.p.chat_id === -100123)?.p;
 assert.match(exitMsg.text, /⚠️ Cadastro cancelado/);
 assert.match(exitMsg.text, /O <b>ListaMyBOT<\/b> está saindo do canal\.\.\./);
 assert.ok(calls.some(x => x.name === 'leaveChat' && x.p.chat_id === -100123));
});

test('bot adicionado como membro (não admin) avisa e sai do canal/grupo', async () => {
 calls = [];
 await myChatMember({
  chat: { id: -100123, type: 'channel', title: 'Canal Teste' },
  from: { id: 42 },
  new_chat_member: { status: 'member' }
 });
 const warnMsg = calls.find(x => x.name === 'sendMessage').p;
 assert.match(warnMsg.text, /⚠️ Este canal precisa que o bot seja administrador/);
 assert.match(warnMsg.text, /O <b>ListaMyBOT<\/b> requer permissões de administrador para operar\. Saindo\.\.\./);
 assert.ok(calls.some(x => x.name === 'leaveChat' && x.p.chat_id === -100123));
});


