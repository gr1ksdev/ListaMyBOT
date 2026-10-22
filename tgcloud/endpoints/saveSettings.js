import { db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { validateSettings, OWNER, OWNERS, isOwner } from '../lib/domain.js';
export default async function(input,ctx){const old=await requireAdmin(ctx);let s;try{s=validateSettings(input.settings,Date.now(),old.settings);}catch(e){throw new EndpointError(e.message);}
 if(!isOwner(old.id)&&JSON.stringify(s.admins)!==JSON.stringify(old.settings.admins))throw new EndpointError('Somente os administradores proprietários podem alterar os IDs.');
 const cells=s.buttonLayout.rows.flat();
 const fixedAds=[...new Set(cells.filter(c=>c.kind==='ad').map(c=>c.adId))];
 const randomAds=cells.filter(c=>c.kind==='adRandom').length;
 const adRows=await db.all('SELECT id FROM list_ads');
 const adIds=new Set(adRows.map(r=>Number(r.id)));
 const missing=fixedAds.filter(id=>!adIds.has(id));
 if(missing.length)throw new EndpointError('Uma divulgação fixada no layout não existe mais. Atualize o layout e salve novamente.');
 if(fixedAds.length+randomAds>adIds.size)throw new EndpointError(`Você tem ${adIds.size} divulgação(ões) cadastrada(s), mas o layout usa ${fixedAds.length+randomAds} posição(ões) de divulgação. Remova posições ou cadastre mais divulgações.`);
 let r;if(!old.version){r=await db.run('INSERT INTO list_settings(id,value,version) VALUES(1,:v,1) ON CONFLICT(id) DO NOTHING',{':v':JSON.stringify(s)});}else{r=await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',{':v':JSON.stringify(s),':version':input.version});}
 if(!r.rowsAffected)throw new EndpointError('As configurações mudaram. Atualize o painel e tente novamente.');return {ok:true};}
