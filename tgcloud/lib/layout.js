// Shared by Telegram dispatch and browser preview. Values describe row widths,
// never participant IDs: the template repeats over the complete ordered list.
export function layoutPattern(settings){
 const p=settings.rowPattern;
 if(p===undefined)return [settings.columns||2];
 if(!Array.isArray(p)||p.length<1||p.length>20||p.some(n=>!Number.isInteger(n)||n<1||n>5))throw Error('Use de 1 a 20 linhas, com 1 a 5 botões em cada linha.');
 return p;
}
// Promotion slots: [{row,col,button}] reserve their drawn cell in every repeat
// of the pattern; participants flow around them and never shift.
export function repeatRows(items,pattern,slots=[]){
 const defs=(slots||[]).filter(s=>Number.isInteger(s.row)&&Number.isInteger(s.col)&&s.row>=0&&s.row<pattern.length&&s.col>=0&&s.col<pattern[s.row]).map(s=>({...s,placed:false}));
 const rows=[];let index=0;
 if(!defs.length){let row=0;while(index<items.length){const count=pattern[row++%pattern.length];rows.push(items.slice(index,index+count));index+=count;}return rows;}
 while(index<items.length){
  const before=index;
  for(let r=0;r<pattern.length;r++){
  if(r===0)for(const d of defs)d.placed=false; // re-arm slots every repeat
  const cells=[],inRow=defs.filter(s=>s.row===r).sort((a,b)=>a.col-b.col);
  for(let i=0;i<pattern[r];i++){
  const slot=inRow.find(s=>s.col===i&&!s.placed);
  if(slot){slot.placed=true;cells.push(slot.button);}
  else if(index<items.length){cells.push(items[index++]);}
  }
  if(cells.length)rows.push(cells);
  }
  if(index===before)break; // pattern fully occupied by slots; nothing can flow
 }
 return rows;
}
export function paginateRows(rows,maxButtons=40,maxRows=20){
 const pages=[];let page=[],count=0;
 for(const row of rows){if(page.length&&(count+row.length>maxButtons||page.length===maxRows)){pages.push(page);page=[];count=0;}page.push(row);count+=row.length;}
 if(page.length)pages.push(page);return pages;
}
function seededScore(value,seed){
 let x=(Number(value)|0)^(Number(seed)|0);
 x=Math.imul(x^(x>>>16),0x45d9f3b);
 x=Math.imul(x^(x>>>16),0x45d9f3b);
 x^=x>>>16;
 return x>>>0;
}
// Panel-drawn layout. Every cell is either a pinned chat, a pinned promotion
// button or an auto slot. Pinned items appear once (first pass); auto slots are
// refilled on further passes so the whole approved list still fits. Pinned
// items that are no longer approved fall back to an auto participant, keeping
// the drawn row width intact.
export function buildLayoutRows(chats,layout,ads=[],seed=0,options={}){
 if(!layout||layout.enabled!==true||!Array.isArray(layout.rows)||!layout.rows.length)return [];
 const targetType=options.targetType||'';
 const fill=targetType||layout.fill||'random';
 const matchesType=c=>!targetType||(targetType==='channel'?c.type==='channel':c.type!=='channel');
 const validChats=(chats||[]).filter(c=>c&&c.id!=null&&matchesType(c));
 const chatById=new Map(validChats.map(c=>[Number(c.id),c]));
 const validAds=(ads||[]).filter(a=>a&&a.title&&a.url);
 const adsById=new Map(validAds.map(a=>[Number(a.id??a.key),a]));
 const fixedChats=new Set(),fixedAds=new Set();
 for(const row of layout.rows)for(const cell of row||[]){
  if(cell?.kind==='chat'&&Number.isSafeInteger(cell.chatId))fixedChats.add(cell.chatId);
  if(cell?.kind==='ad'&&Number.isSafeInteger(cell.adId))fixedAds.add(cell.adId);
 }
 let pool=validChats.filter(c=>!fixedChats.has(Number(c.id)));
 if(fill==='channel')pool=pool.filter(c=>c.type==='channel');
 else if(fill==='group')pool=pool.filter(c=>c.type!=='channel');
 if(fill==='random')pool=[...pool].sort((a,b)=>seededScore(a.id,seed)-seededScore(b.id,seed)||Number(a.id)-Number(b.id));
 const placedChats=new Set(),placedAds=new Set();
 let poolIndex=0;
 const nextAuto=()=>{
  while(poolIndex<pool.length){
   const chat=pool[poolIndex++];
   if(!placedChats.has(Number(chat.id))){placedChats.add(Number(chat.id));return chat;}
  }
  return null;
 };
 const rows=[];
 for(let pass=0;pass<1000;pass++){
  const first=pass===0;
  const before=poolIndex;
  let autoCount=0;
  for(const rawRow of layout.rows){
   const cells=[];
   for(const rawCell of rawRow||[]){
    const kind=rawCell?.kind||'auto';
    if(kind==='chat'){
     if(first){
      const chat=chatById.get(Number(rawCell.chatId));
      if(chat&&!placedChats.has(Number(chat.id))){
       placedChats.add(Number(chat.id));
       cells.push({kind:'chat',chat});
       continue;
      }
     }
     if(first){
      const auto=nextAuto();
      if(auto){cells.push({kind:'chat',chat:auto});autoCount++;}
     }
     continue;
    }
    if(kind==='ad'){
     if(first){
      const ad=adsById.get(Number(rawCell.adId));
      if(ad&&!placedAds.has(Number(ad.id??ad.key))){
       placedAds.add(Number(ad.id??ad.key));
       cells.push({kind:'ad',ad});
       continue;
      }
     }
     if(first){
      const auto=nextAuto();
      if(auto){cells.push({kind:'chat',chat:auto});autoCount++;}
     }
     continue;
    }
    const auto=nextAuto();
    if(auto){cells.push({kind:'chat',chat:auto});autoCount++;}
   }
   if(cells.length)rows.push(cells);
  }
  if(first){
   const hasAutoCells=layout.rows.some(row=>(row||[]).some(cell=>!cell||cell.kind==='auto'||(cell.kind!=='chat'&&cell.kind!=='ad')));
   if(!hasAutoCells)break;
  }else if(autoCount===0||poolIndex===before)break;
  if(poolIndex>=pool.length)break;
 }
 return rows;
}
