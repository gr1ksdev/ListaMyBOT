import { api, db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { DEFAULTS, makePages } from '../lib/domain.js';
import { supplementTestData } from '../lib/test_list.js';
export default async function(input,ctx){
 const a=await requireAdmin(ctx);
 const [chatRows,adRows,me]=await Promise.all([
  db.all("SELECT * FROM list_chats WHERE status='approved'"),
  db.all('SELECT * FROM list_ads ORDER BY slot_row,slot_col,id'),
  api.getMe().catch(()=>null)
 ]);
 const settings={...a.settings,text:a.settings.text||DEFAULTS.text};
 const testData=supplementTestData(chatRows,adRows,settings);
 const botUsername=me?.username||settings.botUsername||'ListaMyBOT';
 if(testData.usedFake){
  await api.sendMessage({
   chat_id:a.id,
   text:'🧪 <b>Modo de teste</b>\nA lista abaixo usa dados fictícios para completar as posições sem canais/grupos cadastrados suficientes. Nada disso é enviado para os participantes reais.',
   parse_mode:'HTML'
  });
 }
 if(settings.listType==='simple'){
  const channelList=testData.chats.filter(c=>c.type==='channel');
  const groupList=testData.chats.filter(c=>c.type!=='channel');
  const channelPages=makePages(channelList,settings,0,testData.ads,botUsername,'channel');
  const groupPages=makePages(groupList,settings,0,testData.ads,botUsername,'group');
  if(!channelPages.length&&!groupPages.length)throw new EndpointError('Não foi possível montar a lista de teste.');
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
 const pages=makePages(testData.chats,settings,0,testData.ads,botUsername);
 if(!pages.length)throw new EndpointError('Não foi possível montar a lista de teste.');
 for(const page of pages)await api.sendMessage({chat_id:a.id,...page});
 return {ok:true};
}
