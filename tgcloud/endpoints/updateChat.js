import {checkMembers} from '../lib/membership.js';
import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { CATEGORIES, validLink, AD_STYLES } from '../lib/domain.js';
import { rights } from '../lib/registration.js';
export default async function(input,ctx){const {settings}=await requireAdmin(ctx);const c=await getChat(input.id);if(!c)throw new EndpointError('Participante não encontrado.');
 const status=input.status??c.status, category=input.category??c.category, url=input.url??c.url, display=input.display??c.display,position=input.position??c.position;
 if(!['draft','pending','approved','rejected','paused'].includes(status)||!Number.isInteger(category)||!CATEGORIES[category])throw new EndpointError('Categoria ou situação inválida.');
 if(!validLink(url)||typeof display!=='string'||display.length>60||!Number.isInteger(position)||position<0)throw new EndpointError('Verifique link, nome (até 60 caracteres) e posição.');
 if(status==='approved'){let members;try{members=await checkMembers(c,settings);}catch(e){throw new EndpointError(e.message);}if(!members.ok)return {ok:true,status:'rejected',reason:members.reason};const missing=await rights(c);if(missing.length)throw new EndpointError('Faltam permissões: '+missing.join(', '));}
 if(input.style!==undefined){
  const cleanStyle=typeof input.style==='string'&&(AD_STYLES.includes(input.style)||input.style==='none')?input.style:'';
  settings.chatColors=settings.chatColors||{};
  if(cleanStyle){settings.chatColors[c.id]=cleanStyle;}else{delete settings.chatColors[c.id];}
  await db.run('UPDATE list_settings SET value=:v WHERE id=1',{':v':JSON.stringify(settings)});
 }
 await db.run('UPDATE list_chats SET status=:s,category=:c,url=:u,display=:d,position=:p,updated=:n,error=\'\' WHERE id=:id',{':s':status,':c':category,':u':url,':d':display,':p':position,':n':Date.now(),':id':c.id});return {ok:true};}
