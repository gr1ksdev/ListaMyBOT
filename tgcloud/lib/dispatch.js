import { db, api, EndpointError } from 'sdk';
import { config, getChat, state, putState } from './store.js';
import { makePages, nextTime } from './domain.js';
import { rights } from './registration.js';
export async function lock(){
 await db.run("INSERT INTO list_runtime(id,value) VALUES('dispatch_lock','0') ON CONFLICT(id) DO NOTHING");
 const now=Date.now();const r=await db.run("UPDATE list_runtime SET value=:until WHERE id='dispatch_lock' AND CAST(value AS INTEGER)<:now",{':until':String(now+120000),':now':now});return r.rowsAffected>0;
}
export async function unlock(){await putState('dispatch_lock',0);}
export async function createRound(){
 if(await db.get("SELECT id FROM list_rounds WHERE status='active' LIMIT 1"))throw new EndpointError('Já existe um envio em andamento.');
 const {settings}=await config();const [list,ads]=await Promise.all([db.all("SELECT * FROM list_chats WHERE status='approved'"),db.all('SELECT * FROM list_ads ORDER BY slot_row,slot_col,id')]);
 const pages=makePages(list,settings,Math.floor(Date.now()/60000),ads);if(!pages.length)throw new EndpointError('Nenhum participante aprovado com link válido.');
 const id=String(Date.now());await db.run('INSERT INTO list_rounds(id,created,content,status) VALUES(:id,:n,:c,\'active\')',{':id':id,':n':Date.now(),':c':JSON.stringify({pages,settings,destinations:list.map(c=>c.id)})});return id;
}
export async function removeLists() {
 const chats = await db.all("SELECT id, last_messages FROM list_chats WHERE last_messages != '[]' AND last_messages != ''");
 let deletedCount = 0;
 let chatsAffected = 0;
 for (const c of chats) {
  let msgs = [];
  try { msgs = JSON.parse(c.last_messages || '[]'); } catch {}
  if (!msgs.length) continue;
  let deletedAny = false;
  for (const msgId of msgs) {
   try {
    await api.deleteMessage({ chat_id: c.id, message_id: msgId });
    deletedCount++;
    deletedAny = true;
   } catch {
    // Already deleted or gone
   }
  }
  if (deletedAny || msgs.length) {
   await db.run("UPDATE list_chats SET last_messages='[]' WHERE id=:id", { ':id': c.id });
   chatsAffected++;
  }
 }
 await putState('lastRemovalSummary', { timestamp: Date.now(), deletedCount, chatsAffected });
 return { ok: true, deletedCount, chatsAffected };
}
export async function processQueue({scheduled=false}={}){
 if(!await lock())return {busy:true};
 try{
 const now=Date.now();if(scheduled)await putState('schedulerHeartbeat',now);
 let active=await db.get("SELECT * FROM list_rounds WHERE status='active' ORDER BY created LIMIT 1");
 const c=await config();
 const rem=c.settings.removalSchedule;
 if(scheduled&&rem?.enabled&&rem.nextAt<=now){
  await removeLists();
  rem.nextAt=nextTime(rem,now);
  await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',{':v':JSON.stringify(c.settings),':version':c.version});
 }
 if(!active&&scheduled&&c.settings.schedule.enabled&&c.settings.schedule.nextAt<=now){
 const n=await db.get("SELECT count(*) AS n FROM list_chats WHERE status='approved'");
 if(n.n)await createRound();
 c.settings.schedule.nextAt=nextTime(c.settings.schedule,now);
 await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',{':v':JSON.stringify(c.settings),':version':c.version});
 active=await db.get("SELECT * FROM list_rounds WHERE status='active' ORDER BY created LIMIT 1");
 }
 if(!active)return {idle:true};
 const content=JSON.parse(active.content);
 for(const chat of content.destinations)await db.run("INSERT INTO list_deliveries(id,round,chat,status) VALUES(:id,:round,:chat,'pending') ON CONFLICT(id) DO NOTHING",{':id':`${active.id}:${chat}`,':round':active.id,':chat':chat});
 // A crashed send may have reached Telegram. Do not silently retry it.
 await db.run("UPDATE list_deliveries SET status='uncertain',error='Envio interrompido; confira o chat antes de reenviar.' WHERE status='sending' AND available<:n",{':n':now});
 const jobs=await db.all("SELECT * FROM list_deliveries WHERE round=:r AND status='pending' AND available<=:n ORDER BY id LIMIT 4",{':r':active.id,':n':now});
 for(const job of jobs){
 const chat=await getChat(job.chat);
 if(!chat||chat.status!=='approved'){await finish(job,'skipped','Participação inativa');continue;}
 const claim=await db.run("UPDATE list_deliveries SET status='sending',available=:n,attempts=attempts+1 WHERE id=:id AND status='pending'",{':n':now+120000,':id':job.id});if(!claim.rowsAffected)continue;
 let sent;
 try{
 const missing=await rights(chat);if(missing.length){await db.run("UPDATE list_chats SET status='paused',error=:e WHERE id=:id",{':e':missing.join(', '),':id':chat.id});await finish(job,'failed','Faltam permissões: '+missing.join(', '));continue;}
 sent=await api.sendMessage({chat_id:chat.id,...content.pages[job.page],link_preview_options:{is_disabled:true}});
 }catch(e){
 const message=String(e.description||e.message||'Falha de comunicação').slice(0,300);
 if(e.code===429){await db.run("UPDATE list_deliveries SET status='pending',available=:n,error=:e WHERE id=:id",{':n':Date.now()+Math.max(1,e.parameters?.retry_after||60)*1000,':e':message,':id':job.id});break;}
 if(e.code===403){await db.run("UPDATE list_chats SET status='paused',error=:e WHERE id=:id",{':e':message,':id':chat.id});}
 await finish(job,e.code&&e.code<500?'failed':'uncertain',message);continue;
 }
 const ids=[...JSON.parse(job.messages),sent.message_id];const page=job.page+1;
 // Persist the message ID before optional pin/delete operations.
 await db.run('UPDATE list_deliveries SET messages=:m,page=:p,status=:s,available=:n,error=\'\' WHERE id=:id',{':m':JSON.stringify(ids),':p':page,':s':page===content.pages.length?'sent':'pending',':n':Date.now()+1500,':id':job.id});
 if(page===content.pages.length){
 const warnings=[];
 if(content.settings.pin)try{await api.pinChatMessage({chat_id:chat.id,message_id:ids[0],disable_notification:true});}catch{warnings.push('Lista enviada, mas não foi possível fixar.');}
 if(content.settings.deletePrevious)for(const old of JSON.parse(chat.last_messages))try{await api.deleteMessage({chat_id:chat.id,message_id:old});}catch{warnings.push('Uma mensagem anterior não pôde ser apagada.');}
 await db.run('UPDATE list_chats SET last_messages=:m,error=:e WHERE id=:id',{':m':JSON.stringify(ids),':e':[...new Set(warnings)].join(' '),':id':chat.id});
 }
 }
 const remaining=await db.get("SELECT count(*) AS n FROM list_deliveries WHERE round=:r AND status IN ('pending','sending')",{':r':active.id});
 if(!remaining.n)await db.run("UPDATE list_rounds SET status='done' WHERE id=:id",{':id':active.id});
 return {round:active.id,remaining:remaining.n,processed:jobs.length};
 }finally{await unlock();}
}
async function finish(job,status,error){await db.run('UPDATE list_deliveries SET status=:s,error=:e WHERE id=:id',{':s':status,':e':error,':id':job.id});}
