import { api, db } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { DEFAULTS } from '../lib/domain.js';
export default async function(input,ctx){await requireAdmin(ctx);await db.run('INSERT INTO list_settings(id,value,version) VALUES(1,:v,1) ON CONFLICT(id) DO NOTHING',{':v':JSON.stringify(DEFAULTS)});
 const me=await api.getMe();
 await api.setMyCommands({commands:[{command:'start',description:'Como participar da lista'},{command:'configurar',description:'Configurar este canal ou grupo'},{command:'link',description:'Definir o link do próprio chat'},{command:'admin',description:'Painel dos administradores do bot'}]});
 await api.setMyDescription({description:'Uma rede de canais e grupos organizada por categorias. Adicione o bot como administrador e configure a participação no próprio chat.'});
 return {id:me.id,username:me.username,name:me.first_name};}
