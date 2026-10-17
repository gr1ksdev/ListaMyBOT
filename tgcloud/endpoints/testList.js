import { api, db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { makePages } from '../lib/domain.js';
export default async function(input,ctx){const a=await requireAdmin(ctx);const [list,ads]=await Promise.all([db.all("SELECT * FROM list_chats WHERE status='approved'"),db.all('SELECT * FROM list_ads ORDER BY slot_row,slot_col,id')]);const pages=makePages(list,a.settings,0,ads);if(!pages.length)throw new EndpointError('Aprove um participante para testar a lista.');for(const page of pages)await api.sendMessage({chat_id:a.id,...page});return {ok:true};}
