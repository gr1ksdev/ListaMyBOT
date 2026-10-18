import { api, db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { makePages } from '../lib/domain.js';
export default async function(input,ctx){
 const a=await requireAdmin(ctx);
 const [list,ads]=await Promise.all([
  db.all("SELECT * FROM list_chats WHERE status='approved'"),
  db.all('SELECT * FROM list_ads ORDER BY slot_row,slot_col,id')
 ]);
 if(a.settings.listType==='simple'){
  const channelList=list.filter(c=>c.type==='channel');
  const groupList=list.filter(c=>c.type!=='channel');
  const channelPages=makePages(channelList,a.settings,0,ads);
  const groupPages=makePages(groupList,a.settings,0,ads);
  if(!channelPages.length&&!groupPages.length)throw new EndpointError('Aprove ao menos um canal ou grupo para testar a lista.');
  if(channelPages.length){
   await api.sendMessage({chat_id:a.id,text:'📢 <b>[Lista Simples — Canais]</b>\nEsta é a lista entregue apenas nos canais:',parse_mode:'HTML'});
   for(const page of channelPages)await api.sendMessage({chat_id:a.id,...page});
  }
  if(groupPages.length){
   await api.sendMessage({chat_id:a.id,text:'💬 <b>[Lista Simples — Grupos]</b>\nEsta é a lista entregue apenas nos grupos:',parse_mode:'HTML'});
   for(const page of groupPages)await api.sendMessage({chat_id:a.id,...page});
  }
  return {ok:true};
 }
 const pages=makePages(list,a.settings,0,ads);
 if(!pages.length)throw new EndpointError('Aprove um participante para testar a lista.');
 for(const page of pages)await api.sendMessage({chat_id:a.id,...page});
 return {ok:true};
}
