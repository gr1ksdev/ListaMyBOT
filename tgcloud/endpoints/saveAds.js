import { db, EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { validLink, AD_STYLES } from '../lib/domain.js';
// Full replace of the promotion buttons drawn in the panel organizer.
// upsert: [{id?,title,url,style,row,col}] — defs still drawn in the grid.
// remove: [id] — defs the admin deleted in the sheet. Defs without a token in
// the drawn pattern are also dropped by the panel (they would not be sent).
export default async function(input,ctx){
 await requireAdmin(ctx);
 const rows=Array.isArray(input.upsert)?input.upsert:[],remove=(Array.isArray(input.remove)?input.remove:[]).filter(x=>Number.isSafeInteger(x)&&x>0);
 if(rows.length>100||remove.length>100)throw new EndpointError('Muitas divulgações em uma única alteração.');
 const seen=new Set();
 for(const a of rows){
 if(!a||typeof a!=='object')throw new EndpointError('Divulgação inválida.');
 const title=String(a.title??'').trim();
 if(!title||title.length>60)throw new EndpointError('Nome do botão de divulgação: use de 1 a 60 caracteres.');
 if(!validLink(a.url))throw new EndpointError(`Informe um link do Telegram (https://t.me/…) para “${title.slice(0,30)}”.`);
 if(a.style&&!AD_STYLES.includes(a.style))throw new EndpointError(`Estilo de cor inválido para “${title.slice(0,30)}”.`);
 if(!Number.isSafeInteger(a.row)||a.row<0||a.row>19||!Number.isSafeInteger(a.col)||a.col<0||a.col>4)throw new EndpointError(`Posição inválida para “${title.slice(0,30)}”.`);
 const key=a.row+'_'+a.col;if(seen.has(key))throw new EndpointError('Não repita a mesma posição em duas divulgações.');seen.add(key);
 }
 const now=Date.now();
 for(const a of rows){
 const title=String(a.title).trim(),params={':t':title,':u':a.url,':r':a.row,':c':a.col,':s':a.style||'',':n':now};
 if(Number.isSafeInteger(a.id)&&a.id>0){
 const r=await db.run('UPDATE list_ads SET title=:t,url=:u,slot_row=:r,slot_col=:c,style=:s,updated=:n WHERE id=:id',{...params,':id':a.id});
 if(!r.rowsAffected)await db.run('INSERT INTO list_ads(id,title,url,slot_row,slot_col,style,updated) VALUES(:id,:t,:u,:r,:c,:s,:n)',{...params,':id':a.id});
 }else await db.run('INSERT INTO list_ads(title,url,slot_row,slot_col,style,updated) VALUES(:t,:u,:r,:c,:s,:n)',params);
 }
 for(const id of remove)await db.run('DELETE FROM list_ads WHERE id=:id',{':id':id});
 return {ok:true,ads:await db.all('SELECT * FROM list_ads ORDER BY slot_row,slot_col,id')};
}
