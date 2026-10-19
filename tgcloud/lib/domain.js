import {layoutPattern,repeatRows,paginateRows} from './layout.js';
export const OWNERS = [7595607953, 8474484790];
export const OWNER = 7595607953;
export function isOwner(id) {
 return OWNERS.includes(Number(id));
}
export const APP_URL = 'https://app8718726006.tgcloud.ai/';
export function escHtml(str) {
 return String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}
export const CATEGORIES = [
 '🎮 Jogos',
 '📚 Estudos',
 '🎵 Música',
 '💻 Tecnologia',
 '🎬 Entretenimento',
 '⚽ Esportes',
 '🎉 Amizades',
 '🎨 Arte & Criatividade',
 '🏥 Saúde & Bem-estar',
 '🙏 Religião',
 '🍥 Anime',
 '📰 Notícias'
];
export const DEFAULT_LIST_ADS = {
 enabled: false,
 mode: 'fixed',
 sameAdAcrossSlots: true,
 slots: {
  start: { enabled: false, adId: null },
  middle: { enabled: false, adId: null },
  end: { enabled: false, adId: null }
 },
 randomPool: [],
 fixedAdId: null
};
export const DEFAULTS = { admins:[...OWNERS], approval:'manual', minMembers:0, text:'📢 Conheça os canais e grupos da nossa comunidade!\n\nToque nos botões abaixo para participar.', columns:2, order:'alphabetical', groupCategories:false, deletePrevious:false, pin:false, bannedUsers:[], buttonColor:'', channelColor:'', groupColor:'', chatColors:{}, schedule:{ enabled:false, mode:'fixed', minutes:60, times:['08:00','20:00'], nextAt:0 }, removalSchedule:{ enabled:false, mode:'fixed', minutes:60, times:['06:00','18:00'], nextAt:0 }, promoLogChat:0, promoLogTopic:0, promoChannel:'', chatsLogTopic:0, supportLogTopic:0, listType:'mixed', listAdsConfig:JSON.parse(JSON.stringify(DEFAULT_LIST_ADS)), footerButtons:true };
export function validateSettings(input, now=Date.now()) {
 const s=JSON.parse(JSON.stringify(input));
 s.minMembers=s.minMembers??0;
 if(!Number.isSafeInteger(s.minMembers)||s.minMembers<0||s.minMembers>100000000)throw Error('Mínimo de membros: informe um inteiro entre 0 e 100.000.000. Use 0 para desativar.');
 if(!['manual','automatic'].includes(s.approval)) throw Error('Escolha o modo de aprovação.');
 if(typeof s.text!=='string'||!s.text.trim()||s.text.length>3500) throw Error('A mensagem precisa ter entre 1 e 3.500 caracteres.');
 if(![1,2,3,4,5].includes(s.columns)||!['alphabetical','manual','rotate'].includes(s.order)) throw Error('Layout inválido.');
 s.rowPattern=layoutPattern(s);
 if(!Array.isArray(s.admins)||s.admins.length>20||s.admins.some(x=>!Number.isSafeInteger(x)||x<=0)) throw Error('IDs de administradores inválidos.');
 s.admins=[...new Set([...OWNERS,...s.admins])];
 s.bannedUsers = Array.isArray(s.bannedUsers) ? [...new Set(s.bannedUsers.filter(x=>Number.isSafeInteger(x)&&x>0))] : [];
 s.buttonColor = typeof s.buttonColor === 'string' && AD_STYLES.includes(s.buttonColor) ? s.buttonColor : '';
 s.channelColor = typeof s.channelColor === 'string' && AD_STYLES.includes(s.channelColor) ? s.channelColor : '';
 s.groupColor = typeof s.groupColor === 'string' && AD_STYLES.includes(s.groupColor) ? s.groupColor : '';
 if (s.chatColors && typeof s.chatColors === 'object' && !Array.isArray(s.chatColors)) {
  const clean = {};
  for (const [k, v] of Object.entries(s.chatColors)) {
   if (typeof v === 'string' && (AD_STYLES.includes(v) || v === 'none')) {
    clean[k] = v;
   }
  }
  s.chatColors = clean;
 } else {
  s.chatColors = {};
 }
 for(const k of ['pin','deletePrevious','groupCategories']) if(typeof s[k]!=='boolean') throw Error('Opção inválida.');
 const a=s.schedule;
 if(!a||typeof a.enabled!=='boolean'||!['interval','fixed'].includes(a.mode)) throw Error('Agendamento inválido.');
 if(!Number.isInteger(a.minutes)||a.minutes<1||a.minutes>10080) throw Error('Intervalo: de 1 a 10.080 minutos.');
 if(!Array.isArray(a.times)||!a.times.length||a.times.length>24||a.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw Error('Informe horários válidos, como 09:00.');
 a.times=[...new Set(a.times)].sort(); a.nextAt=nextTime(a,now);
 if(!s.removalSchedule){
  s.removalSchedule={enabled:false,mode:'fixed',minutes:60,times:['06:00','18:00'],nextAt:0};
 }
 const rem=s.removalSchedule;
 if(typeof rem.enabled!=='boolean'||!['interval','fixed'].includes(rem.mode)) throw Error('Agendamento de remoção inválido.');
 if(!Number.isInteger(rem.minutes)||rem.minutes<1||rem.minutes>10080) throw Error('Intervalo de remoção: de 1 a 10.080 minutos.');
 if(!Array.isArray(rem.times)||!rem.times.length||rem.times.length>24||rem.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw Error('Informe horários de remoção válidos, como 06:00.');
 rem.times=[...new Set(rem.times)].sort(); rem.nextAt=nextTime(rem,now);
 s.promoLogChat = Number.isSafeInteger(s.promoLogChat) ? s.promoLogChat : 0;
 s.promoLogTopic = Number.isSafeInteger(s.promoLogTopic) ? s.promoLogTopic : 0;
 s.chatsLogTopic = Number.isSafeInteger(s.chatsLogTopic) ? s.chatsLogTopic : 0;
 s.promoChannel = typeof s.promoChannel === 'string' ? s.promoChannel : (Number.isSafeInteger(s.promoChannel) ? String(s.promoChannel) : '');
 s.listType = ['mixed', 'simple'].includes(s.listType) ? s.listType : 'mixed';
 if (s.listAdsConfig && typeof s.listAdsConfig === 'object') {
  const lac = s.listAdsConfig;
  s.listAdsConfig = {
   enabled: Boolean(lac.enabled),
   mode: ['fixed', 'random'].includes(lac.mode) ? lac.mode : 'fixed',
   sameAdAcrossSlots: Boolean(lac.sameAdAcrossSlots),
   slots: {
    start: {
     enabled: Boolean(lac.slots?.start?.enabled),
     adId: Number.isSafeInteger(lac.slots?.start?.adId) ? lac.slots.start.adId : null
    },
    middle: {
     enabled: Boolean(lac.slots?.middle?.enabled),
     adId: Number.isSafeInteger(lac.slots?.middle?.adId) ? lac.slots.middle.adId : null
    },
    end: {
     enabled: Boolean(lac.slots?.end?.enabled),
     adId: Number.isSafeInteger(lac.slots?.end?.adId) ? lac.slots.end.adId : null
    }
   },
   randomPool: Array.isArray(lac.randomPool) ? lac.randomPool.filter(x => Number.isSafeInteger(x) && x > 0) : [],
   fixedAdId: Number.isSafeInteger(lac.fixedAdId) ? lac.fixedAdId : null
  };
 } else {
  s.listAdsConfig = JSON.parse(JSON.stringify(DEFAULT_LIST_ADS));
 }
 s.footerButtons = s.footerButtons !== false;
 return s;
}
export function nextTime(a, now=Date.now()) {
 if(!a.enabled)return 0;
 if(a.mode==='interval')return now+a.minutes*60000;
 const shifted=new Date(now-3*3600000); const day=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())+3*3600000;
 return Math.min(...a.times.map(t=>{const [h,m]=t.split(':').map(Number);const x=day+h*3600000+m*60000;return x>now?x:x+86400000;}));
}
export const AD_STYLES=['primary','danger','success'];
export function resolveButtonStyle(c, s) {
 if (!c) return '';
 const direct = c.style || s?.chatColors?.[c.id] || s?.chatColors?.[String(c.id)];
 if (direct && AD_STYLES.includes(direct)) return direct;
 if (direct === 'none') return '';
 const isChannel = c.type === 'channel';
 const isGroup = c.type === 'group' || c.type === 'supergroup';
 if (isChannel && s?.channelColor && AD_STYLES.includes(s.channelColor)) return s.channelColor;
 if (isGroup && s?.groupColor && AD_STYLES.includes(s.groupColor)) return s.groupColor;
 if (s?.buttonColor && AD_STYLES.includes(s.buttonColor)) return s.buttonColor;
 return '';
}
export function resolveListAds(s, ads = [], seed = 0) {
 if (!s?.listAdsConfig?.enabled || !Array.isArray(ads) || !ads.length) {
  return { start: null, middle: null, end: null };
 }
 const cfg = s.listAdsConfig;
 const validAds = ads.filter(a => a && a.title && a.url);
 if (!validAds.length) return { start: null, middle: null, end: null };
 const getAdKey = a => (a.id != null ? a.id : a.key);
 const adsById = new Map(validAds.map(a => [getAdKey(a), a]));

 const activeSlots = [];
 if (cfg.slots?.start?.enabled) activeSlots.push('start');
 if (cfg.slots?.middle?.enabled) activeSlots.push('middle');
 if (cfg.slots?.end?.enabled) activeSlots.push('end');
 if (!activeSlots.length) return { start: null, middle: null, end: null };

 const result = { start: null, middle: null, end: null };

 if (cfg.mode === 'fixed') {
  if (cfg.sameAdAcrossSlots) {
   const targetId = cfg.fixedAdId || cfg.slots?.start?.adId || cfg.slots?.middle?.adId || cfg.slots?.end?.adId;
   const targetAd = (targetId && adsById.get(targetId)) || validAds[0];
   for (const slot of activeSlots) result[slot] = targetAd;
  } else {
   const usedIds = new Set();
   for (const slot of activeSlots) {
    const explicitId = cfg.slots?.[slot]?.adId;
    if (explicitId && adsById.has(explicitId)) {
     result[slot] = adsById.get(explicitId);
     usedIds.add(explicitId);
    }
   }
   let fallbackIdx = 0;
   for (const slot of activeSlots) {
    if (!result[slot]) {
     let candidate = validAds.find(a => !usedIds.has(getAdKey(a)));
     if (candidate) {
      result[slot] = candidate;
      usedIds.add(getAdKey(candidate));
     } else {
      result[slot] = validAds[fallbackIdx % validAds.length];
      fallbackIdx++;
     }
    }
   }
  }
 } else if (cfg.mode === 'random') {
  let pool = (cfg.randomPool || []).map(id => adsById.get(id)).filter(Boolean);
  if (!pool.length) pool = validAds.slice();

  if (cfg.sameAdAcrossSlots) {
   const pickIndex = Math.abs(seed) % pool.length;
   const picked = pool[pickIndex];
   for (const slot of activeSlots) result[slot] = picked;
  } else {
   const shuffled = [...pool].sort((a, b) => {
    const hashA = (a.id * 31 + seed) % 1000;
    const hashB = (b.id * 31 + seed) % 1000;
    return hashA - hashB;
   });
   let i = 0;
   for (const slot of activeSlots) {
    result[slot] = shuffled[i % shuffled.length];
    i++;
   }
  }
 }

 return result;
}
export function makePages(chats,s,seed=0,ads=[]) {
 let list=chats.filter(c=>c.status==='approved'&&validLink(c.url)).slice();
 if(s.order==='manual')list.sort((a,b)=>a.position-b.position||a.id-b.id);
 else list.sort((a,b)=>(a.display||a.title).localeCompare(b.display||b.title,'pt-BR'));
 if(s.order==='rotate'&&list.length){const n=Math.abs(seed)%list.length;list=[...list.slice(n),...list.slice(0,n)];}
 if(s.groupCategories)list.sort((a,b)=>a.category-b.category);
 const buttons=list.map(c=>{
  const style=resolveButtonStyle(c,s);
  return {
   text:((s.groupCategories?CATEGORIES[c.category].split(' ')[0]+' ':'')+(c.display||c.title)).slice(0,60),
   url:c.url,
   ...(style?{style}:{})
  };
 });

 const promoSlots = resolveListAds(s, ads, seed);
 const hasNewAds = Boolean(promoSlots.start || promoSlots.middle || promoSlots.end);

 let rows;
 if (hasNewAds) {
  rows = repeatRows(buttons, layoutPattern(s), []);
  const makeButton = (ad) => ({
   text: String(ad.title).slice(0, 60),
   url: ad.url,
   ...(AD_STYLES.includes(ad.style) ? { style: ad.style } : {})
  });
  if (promoSlots.end) {
   rows.push([makeButton(promoSlots.end)]);
  }
  if (promoSlots.middle) {
   if (rows.length === 0) {
    rows.push([makeButton(promoSlots.middle)]);
   } else {
    const midIdx = Math.max(1, Math.floor(rows.length / 2));
    rows.splice(midIdx, 0, [makeButton(promoSlots.middle)]);
   }
  }
  if (promoSlots.start) {
   rows.unshift([makeButton(promoSlots.start)]);
  }
 } else {
  const slots=(ads||[]).filter(a=>a.title&&a.url).map(a=>({row:a.slot_row,col:a.slot_col,button:{text:String(a.title).slice(0,60),url:a.url,...(AD_STYLES.includes(a.style)?{style:a.style}:{})}}));
  rows = repeatRows(buttons, layoutPattern(s), slots);
 }

 if (s.footerButtons !== false) {
  const botUsername = s.botUsername || 'ListaMyBOT';
  const botAddUrl = `https://t.me/${botUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users`;
  rows.push([
   { text: 'Add-me em C/G', url: botAddUrl, style: 'primary' },
   { text: 'Canal Oficial', url: 'https://t.me/ChannelLogBM', style: 'success' }
  ]);
 }

 const groups=paginateRows(rows);
 const pages=groups.map((pageRows,i)=>({text:s.text+(groups.length>1?`\n\nParte ${i+1}/${groups.length}`:''),reply_markup:{inline_keyboard:pageRows}}));
 return pages;
}
export function validLink(s){return typeof s==='string'&&/^https:\/\/t\.me\/(?:[A-Za-z][A-Za-z0-9_]{3,}|\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)\/?$/.test(s);}
export function permissionErrors(chat,m){
 const out=[]; if(!['administrator','creator'].includes(m.status))return ['tornar o bot administrador'];
 if(m.status==='creator')return out;
 if(chat.type==='channel'&&!m.can_post_messages)out.push('enviar mensagens');
 if(!m.can_delete_messages)out.push('apagar mensagens');
 if(chat.type==='channel'?!m.can_edit_messages:!m.can_pin_messages)out.push('fixar mensagens'+(chat.type==='channel'?' (editar mensagens no canal)':''));
 return out;
}
