import { db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { validateSettings, OWNER } from '../lib/domain.js';
export default async function(input,ctx){const old=await requireAdmin(ctx);let s;try{s=validateSettings(input.settings);}catch(e){throw new EndpointError(e.message);}
 if(old.id!==OWNER&&JSON.stringify(s.admins)!==JSON.stringify(old.settings.admins))throw new EndpointError('Somente o administrador principal pode alterar os IDs.');
 const a={...s.schedule,nextAt:0},b={...old.settings.schedule,nextAt:0};if(JSON.stringify(a)===JSON.stringify(b))s.schedule.nextAt=old.settings.schedule.nextAt;
 let r;if(!old.version){r=await db.run('INSERT INTO list_settings(id,value,version) VALUES(1,:v,1) ON CONFLICT(id) DO NOTHING',{':v':JSON.stringify(s)});}else{r=await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',{':v':JSON.stringify(s),':version':input.version});}
 if(!r.rowsAffected)throw new EndpointError('As configurações mudaram. Atualize o painel e tente novamente.');return {ok:true};}
