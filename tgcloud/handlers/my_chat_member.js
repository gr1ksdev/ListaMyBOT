import { db } from 'sdk';
import { register } from '../lib/registration.js';
export default async function(u){
 if(!['group','supergroup','channel'].includes(u.chat?.type))return;
 if(u.new_chat_member.status==='administrator')await register(u.chat,u.from?.id||0);
 else await db.run("UPDATE list_chats SET status='paused',error='Bot removido ou sem administração',updated=:n WHERE id=:id",{':n':Date.now(),':id':u.chat.id});
}
