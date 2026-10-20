import { db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { validateSettings, OWNER, OWNERS, isOwner } from '../lib/domain.js';
export default async function(input,ctx){const old=await requireAdmin(ctx);let s;try{s=validateSettings(input.settings,Date.now(),old.settings);}catch(e){throw new EndpointError(e.message);}
 if(!isOwner(old.id)&&JSON.stringify(s.admins)!==JSON.stringify(old.settings.admins))throw new EndpointError('Somente os administradores proprietários podem alterar os IDs.');
 let r;if(!old.version){r=await db.run('INSERT INTO list_settings(id,value,version) VALUES(1,:v,1) ON CONFLICT(id) DO NOTHING',{':v':JSON.stringify(s)});}else{r=await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',{':v':JSON.stringify(s),':version':input.version});}
 if(!r.rowsAffected)throw new EndpointError('As configurações mudaram. Atualize o painel e tente novamente.');return {ok:true};}
