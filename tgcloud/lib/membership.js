import { api, db } from 'sdk';
import { putState } from './store.js';
export const membershipBlocked=c=>c.status==='rejected'&&String(c.error||'').startsWith('Mínimo de membros:');
export async function checkMembers(c,settings){
 const minimum=settings.minMembers??0;
 if(minimum===0)return {ok:true,count:null,minimum};
 let count;
 try{count=await api.getChatMemberCount({chat_id:c.id});if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid count');}
 catch{throw Error('Não foi possível conferir os membros no Telegram. Tente novamente; o cadastro não foi aprovado.');}
 await putState(`members:${c.id}`,{count,checkedAt:Date.now()});
 if(count>=minimum)return {ok:true,count,minimum};
 const reason=`Mínimo de membros: este chat tem ${count}; são necessários ${minimum}. Aumente o número de membros e toque em Verificar novamente.`;
 const result=await db.run("UPDATE list_chats SET status='rejected',error=:e,updated=:n WHERE id=:id AND status=:status",{':e':reason,':n':Date.now(),':id':c.id,':status':c.status});
 if(!result.rowsAffected)throw Error('O cadastro mudou durante a verificação. Atualize e tente novamente.');
 c.status='rejected';c.error=reason;
 return {ok:false,count,minimum,reason};
}
