import { db } from 'sdk';
import { requireAdmin, state } from '../lib/store.js';
import { CATEGORIES } from '../lib/domain.js';
export default async function(input,ctx){
 const auth=await requireAdmin(ctx);
 const [chats,rounds,deliveries,schedulerHeartbeat,memberRows,adRows,lastRemovalSummary,userNameRows]=await Promise.all([
 db.all('SELECT * FROM list_chats ORDER BY updated DESC'),
 db.all('SELECT id,created,status FROM list_rounds ORDER BY created DESC LIMIT 10'),
 db.all('SELECT * FROM list_deliveries ORDER BY round DESC LIMIT 200'),
 state('schedulerHeartbeat',0),
 db.all("SELECT id,value FROM list_runtime WHERE id LIKE 'members:%'"),
 db.all('SELECT * FROM list_ads ORDER BY slot_row,slot_col,id'),
 state('lastRemovalSummary',null),
 db.all("SELECT id,value FROM list_runtime WHERE id LIKE 'user_name:%'")
 ]);
 const countsById=new Map(memberRows.map(r=>[Number(r.id.slice(8)),JSON.parse(r.value)]));
 const userNames=new Map(userNameRows.map(r=>[Number(r.id.slice(10)),JSON.parse(r.value)]));
 const bannedUsers=Array.isArray(auth.settings?.bannedUsers)?auth.settings.bannedUsers:[];
 for(const c of chats){
  const v=countsById.get(c.id);
  c.members=v?.count??null;
  c.membersCheckedAt=v?.checkedAt??null;
  c.ownerName=userNames.get(c.owner)||null;
  c.isBanned=bannedUsers.includes(c.owner);
  c.style=auth.settings?.chatColors?.[c.id]||'';
 }
 let lastDeliverySummary=null;
 if(rounds.length){
 const id=rounds[0].id;
 const [counts,snapshot]=await Promise.all([
 db.all('SELECT status,count(*) AS n FROM list_deliveries WHERE round=:r GROUP BY status',{':r':id}),
 db.get('SELECT content FROM list_rounds WHERE id=:r',{':r':id})
 ]);
 const total=JSON.parse(snapshot.content).destinations.length;
 lastDeliverySummary={total,sent:0,failed:0,uncertain:0,skipped:0,pending:0,sending:0};
 for(const row of counts)lastDeliverySummary[row.status]=row.n;
 }
 return {...auth,chats,rounds,deliveries,lastDeliverySummary,lastRemovalSummary,categories:CATEGORIES,schedulerHeartbeat,ads:adRows,bannedUsers};
}
