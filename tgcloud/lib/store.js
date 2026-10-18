import { db, EndpointError } from 'sdk';
import { DEFAULTS, OWNER } from './domain.js';
export async function config(){const r=await db.get('SELECT value,version FROM list_settings WHERE id=1');return r?{settings:{minMembers:0,bannedUsers:[],promoLogChat:0,promoLogTopic:0,promoChannel:'',removalSchedule:JSON.parse(JSON.stringify(DEFAULTS.removalSchedule)),...JSON.parse(r.value)},version:r.version}:{settings:JSON.parse(JSON.stringify(DEFAULTS)),version:0};}
export async function requireAdmin(ctx){const id=ctx?.initData?.user?.id;const c=await config();if(!id||!c.settings.admins.includes(id))throw new EndpointError('Acesso restrito aos administradores.');return {id,...c};}
export async function isAdmin(id){return id===OWNER||(await config()).settings.admins.includes(id);}
export async function isBanned(userId){if(!userId)return false;const c=await config();return Array.isArray(c.settings.bannedUsers)&&c.settings.bannedUsers.includes(Number(userId));}
export async function getChat(id){if(!Number.isSafeInteger(id)||id===0)return null;return db.get('SELECT * FROM list_chats WHERE id=:id',{':id':id});}
export async function state(key,fallback=null){const r=await db.get('SELECT value FROM list_runtime WHERE id=:id',{':id':key});return r?JSON.parse(r.value):fallback;}
export async function putState(key,value){await db.run('INSERT INTO list_runtime(id,value) VALUES(:id,:v) ON CONFLICT(id) DO UPDATE SET value=excluded.value',{':id':key,':v':JSON.stringify(value)});}
