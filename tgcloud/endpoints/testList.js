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
 const pages=makePages(testData.chats,settings,0,testData.ads,botUsername,'',{
  roundIndex:0,
  destinationId:a.id
 });
 if(!pages.length)throw new EndpointError('Não foi possível montar a lista de teste.');
 const page=pages[0];
 const notice=testData.usedFake
  ? '🧪 <b>Modo de teste</b>\nA lista abaixo usa dados fictícios para completar as posições sem canais/grupos cadastrados suficientes. Nada disso é enviado para os participantes reais.\n\n'
  : '';
 await api.sendMessage({
  chat_id:a.id,
  text:notice+page.text,
  reply_markup:page.reply_markup,
  link_preview_options:{is_disabled:true}
 });
 return {ok:true};
}
