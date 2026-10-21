import {checkMembers} from '../lib/membership.js';
import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { resolveCategories, validLink, AD_STYLES } from '../lib/domain.js';
import { rights } from '../lib/registration.js';
export default async function(input,ctx){const auth=await requireAdmin(ctx);const {settings}=auth;const c=await getChat(input.id);if(!c)throw new EndpointError('Participante não encontrado.');
 const status=input.status??c.status, category=input.category??c.category, url=input.url??c.url, display=input.display??c.display,position=input.position??c.position;
 if(!['draft','pending','approved','rejected','paused'].includes(status)||!Number.isInteger(category)||!resolveCategories(settings)[category])throw new EndpointError('Categoria ou situação inválida.');
 if(!validLink(url)||typeof display!=='string'||display.length>60||!Number.isInteger(position)||position<0)throw new EndpointError('Verifique link, nome (até 60 caracteres) e posição.');
 if(status==='approved'){
  if(Array.isArray(settings.bannedUsers)&&settings.bannedUsers.map(Number).includes(Number(c.owner)))throw new EndpointError('O dono deste cadastro está banido. Desbane o usuário antes de aprovar.');
  let members;try{members=await checkMembers(c,settings);}catch(e){throw new EndpointError(e.message);}if(!members.ok)return {ok:true,status:'rejected',reason:members.reason};const missing=await rights(c);if(missing.length)throw new EndpointError('Faltam permissões: '+missing.join(', '));
 }
 if(input.style!==undefined){
  const cleanStyle=typeof input.style==='string'&&(AD_STYLES.includes(input.style)||input.style==='none')?input.style:'';
  settings.chatColors=settings.chatColors||{};
  if(cleanStyle){settings.chatColors[c.id]=cleanStyle;}else{delete settings.chatColors[c.id];}
  const expected=Number.isSafeInteger(input.version)?input.version:auth.version;
  const styleResult=await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',{':v':JSON.stringify(settings),':version':expected});
  if(!styleResult.rowsAffected)throw new EndpointError('As configurações mudaram. Atualize o painel e tente novamente.');
 }
 await db.run('UPDATE list_chats SET status=:s,category=:c,url=:u,display=:d,position=:p,updated=:n,error=\'\' WHERE id=:id',{':s':status,':c':category,':u':url,':d':display,':p':position,':n':Date.now(),':id':c.id});return {ok:true};}
