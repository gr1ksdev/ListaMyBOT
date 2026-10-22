import {layoutPattern,buildLayoutRows,defaultLayoutRows} from './layout.js';
export const OWNERS = [7595607953, 8474484790];
export const OWNER = 7595607953;
export function isOwner(id) {
 return OWNERS.includes(Number(id));
}
export const APP_URL = 'https://app8272402928.tgcloud.ai/';
export function escHtml(str) {
 return String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
// Telegram rejects inline keyboard buttons whose text contains a lone surrogate.
// A normal .slice() can cut an emoji in half, so trim without breaking pairs.
export function truncateButtonText(value, max = 60) {
 const text = String(value ?? '').replace(LONE_SURROGATE, '');
 if (text.length <= max) return text;
 let end = max;
 const last = text.charCodeAt(end - 1);
 if (last >= 0xD800 && last <= 0xDBFF) end--;
 return text.slice(0, end);
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
// Categories live in list_settings so the panel can add new niches without a
// schema migration. The integer index stored in list_chats.category is kept
// stable: new categories are appended and existing ones can only be renamed.
export function resolveCategories(settings) {
 const list = Array.isArray(settings?.categories)
  ? settings.categories.map(x => String(x ?? '').trim())
  : [];
 return list.length ? list : [...CATEGORIES];
}
export function normalizeCategories(value) {
 const source = value === undefined || value === null ? CATEGORIES : value;
 if (!Array.isArray(source)) throw Error('Lista de categorias inválida.');
 const clean = [];
 for (const item of source) {
  if (typeof item !== 'string') throw Error('Toda categoria precisa ter um nome.');
  const name = item.trim();
  if (!name) throw Error('Toda categoria precisa ter um nome.');
  if (name.length > 60) throw Error('Cada categoria pode ter no máximo 60 caracteres.');
  clean.push(name);
 }
 if (!clean.length) throw Error('Mantenha ao menos uma categoria cadastrada.');
 if (clean.length > 60) throw Error('Use no máximo 60 categorias.');
 if (new Set(clean).size !== clean.length) throw Error('Não repita o mesmo nome de categoria.');
 return clean;
}
export const BUTTON_LAYOUT_FILLS = ['random', 'group', 'channel'];
export const DEFAULT_BUTTON_LAYOUT = { enabled: true, fill: 'random', rotate: false, rows: defaultLayoutRows() };
export function normalizeButtonLayout(value, options = {}) {
 const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
 if (source.rows !== undefined && !Array.isArray(source.rows)) throw Error('Layout de botões inválido.');
 const sourceRows = Array.isArray(source.rows) && source.rows.length ? source.rows : defaultLayoutRows();
 if (sourceRows.length > 20) throw Error('O layout pode ter no máximo 20 linhas.');
 const rows = [];
 const usedChats = new Set();
 const usedAds = new Set();
 let total = 0;
 for (const rawRow of sourceRows) {
  if (!Array.isArray(rawRow) || !rawRow.length || rawRow.length > 5) {
   throw Error('Cada linha do layout precisa ter de 1 a 5 botões.');
  }
  const row = [];
  for (const rawCell of rawRow) {
   const kind = rawCell?.kind || 'auto';
   const style = ['primary', 'danger', 'success'].includes(rawCell?.style) ? rawCell.style : '';
   const styleFields = style ? { style } : {};
   if (kind === 'chat') {
    if (!Number.isSafeInteger(rawCell.chatId) || rawCell.chatId === 0) throw Error('Canal/grupo fixo inválido no layout.');
    if (usedChats.has(rawCell.chatId)) throw Error('O mesmo canal/grupo não pode ocupar duas posições no layout.');
    usedChats.add(rawCell.chatId);
    row.push({ kind: 'chat', chatId: rawCell.chatId, ...styleFields });
   } else if (kind === 'ad') {
    const adId = Number.isSafeInteger(rawCell.adId) && rawCell.adId > 0 ? rawCell.adId : null;
    const adKey = options.allowAdKey && Number.isSafeInteger(rawCell.adKey) && rawCell.adKey > 0
     ? rawCell.adKey
     : null;
    if (!adId && !adKey) throw Error('Divulgação fixa inválida no layout.');
    const adRef = adId ?? adKey;
    if (usedAds.has(adRef)) throw Error('A mesma divulgação não pode ocupar duas posições no layout.');
    usedAds.add(adRef);
    row.push(adId ? { kind: 'ad', adId, ...styleFields } : { kind: 'ad', adKey, ...styleFields });
   } else if (kind === 'adRandom') {
    row.push({ kind: 'adRandom', ...styleFields });
   } else {
    row.push({ kind: 'auto', ...styleFields });
   }
  }
  total += row.length;
  if (total > 100) throw Error('O layout pode ter no máximo 100 botões.');
  rows.push(row);
 }
 return {
  enabled: true,
  fill: BUTTON_LAYOUT_FILLS.includes(source.fill) ? source.fill : 'random',
  rotate: source.rotate === true,
  rows
 };
}
export const DEFAULT_MAINTENANCE_MESSAGE = '🛠️ <b>Bot em manutenção</b>\n\nEstamos fazendo ajustes e voltamos em breve. Obrigado pela paciência!';
export function normalizeMaintenance(value) {
 const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
 return {
  enabled: source.enabled === true,
  message: typeof source.message === 'string' ? source.message : DEFAULT_MAINTENANCE_MESSAGE
 };
}
export const DEFAULTS = { admins:[...OWNERS], approval:'manual', minMembers:0, text:'📢 Conheça os canais e grupos da nossa comunidade!\n\nToque nos botões abaixo para participar.', columns:2, order:'alphabetical', groupCategories:false, deletePrevious:false, pin:false, bannedUsers:[], buttonColor:'', channelColor:'', groupColor:'', chatColors:{}, maintenance:{ enabled:false, message:DEFAULT_MAINTENANCE_MESSAGE }, schedule:{ enabled:false, mode:'fixed', minutes:60, times:['08:00','20:00'], nextAt:0 }, removalSchedule:{ enabled:false, mode:'fixed', minutes:60, times:['06:00','18:00'], nextAt:0 }, promoLogChat:0, promoLogTopic:0, promoChannel:'', chatsLogTopic:0, supportLogTopic:0, listType:'mixed', footerButtons:true, categories:[...CATEGORIES], buttonLayout:JSON.parse(JSON.stringify(DEFAULT_BUTTON_LAYOUT)) };
function scheduleConfigKey(s) {
 return JSON.stringify({
  enabled: s.enabled,
  mode: s.mode,
  minutes: s.minutes,
  times: [...new Set(s.times || [])].sort()
 });
}
export function validateSettings(input, now=Date.now(), previous=null) {
 const s=JSON.parse(JSON.stringify(input));
 s.minMembers=s.minMembers??0;
 if(!Number.isSafeInteger(s.minMembers)||s.minMembers<0||s.minMembers>100000000)throw Error('Mínimo de membros: informe um inteiro entre 0 e 100.000.000. Use 0 para desativar.');
 if(!['manual','automatic'].includes(s.approval)) throw Error('Escolha o modo de aprovação.');
 if(typeof s.text!=='string'||!s.text.trim()||s.text.length>3500) throw Error('A mensagem precisa ter entre 1 e 3.500 caracteres.');
 if(![1,2,3,4,5].includes(s.columns)||!['alphabetical','manual','rotate'].includes(s.order)) throw Error('Layout inválido.');
 s.order = s.order === 'manual' ? 'manual' : 'alphabetical';
 s.rowPattern=layoutPattern(s);
 if(!Array.isArray(s.admins)||s.admins.length>20||s.admins.some(x=>!Number.isSafeInteger(x)||x<=0)) throw Error('IDs de administradores inválidos.');
 s.admins=[...new Set([...OWNERS,...s.admins])];
 s.bannedUsers = Array.isArray(s.bannedUsers) ? [...new Set(s.bannedUsers.filter(x=>Number.isSafeInteger(x)&&x>0))] : [];
 // Older panel builds do not send these new fields. Preserve what is already
 // stored instead of resetting the categories/layout on an unrelated save.
 s.categories = normalizeCategories(s.categories === undefined ? (previous?.categories ?? CATEGORIES) : s.categories);
 s.buttonLayout = normalizeButtonLayout(s.buttonLayout === undefined ? previous?.buttonLayout : s.buttonLayout);
 s.footerButtons = s.footerButtons !== false;
 const layoutButtons = s.buttonLayout.rows.reduce((n, row) => n + row.length, 0);
 if (layoutButtons + (s.footerButtons ? 1 : 0) > 100) {
  throw Error('O layout pode ter no máximo 100 botões no Telegram' + (s.footerButtons ? ' (incluindo o rodapé)' : '') + '.');
 }
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
 // Older panel builds may not send this new field. Preserve the current mode
 // instead of accidentally turning maintenance off on an unrelated save.
 const rawMaintenance = s.maintenance === undefined ? previous?.maintenance : s.maintenance;
 if(rawMaintenance !== undefined && (rawMaintenance === null || typeof rawMaintenance !== 'object' || Array.isArray(rawMaintenance))) throw Error('Configuração de manutenção inválida.');
 if(rawMaintenance?.enabled !== undefined && typeof rawMaintenance.enabled !== 'boolean') throw Error('Ativação da manutenção inválida.');
 if(rawMaintenance?.message !== undefined && typeof rawMaintenance.message !== 'string') throw Error('Mensagem de manutenção inválida.');
 s.maintenance = normalizeMaintenance(rawMaintenance);
 s.maintenance.message = s.maintenance.message.trim();
 if(s.maintenance.message.length > 3500) throw Error('A mensagem de manutenção pode ter no máximo 3.500 caracteres.');
 for(const k of ['pin','deletePrevious','groupCategories']) if(typeof s[k]!=='boolean') throw Error('Opção inválida.');
 const a=s.schedule;
 if(!a||typeof a.enabled!=='boolean'||!['interval','fixed'].includes(a.mode)) throw Error('Agendamento inválido.');
 if(!Number.isInteger(a.minutes)||a.minutes<1||a.minutes>10080) throw Error('Intervalo: de 1 a 10.080 minutos.');
 if(!Array.isArray(a.times)||!a.times.length||a.times.length>24||a.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw Error('Informe horários válidos, como 09:00.');
 const previousSchedule = previous?.schedule;
 const scheduleUnchanged = previousSchedule && scheduleConfigKey(previousSchedule) === scheduleConfigKey(a);
 const previousScheduleNextAt = previousSchedule?.nextAt;
 a.times=[...new Set(a.times)].sort();
 a.nextAt = scheduleUnchanged && a.enabled &&
  Number.isSafeInteger(previousScheduleNextAt) && previousScheduleNextAt > 0
  ? previousScheduleNextAt
  : nextTime(a,now);
 if(!s.removalSchedule){
  s.removalSchedule={enabled:false,mode:'fixed',minutes:60,times:['06:00','18:00'],nextAt:0};
 }
 const rem=s.removalSchedule;
 if(typeof rem.enabled!=='boolean'||!['interval','fixed'].includes(rem.mode)) throw Error('Agendamento de remoção inválido.');
 if(!Number.isInteger(rem.minutes)||rem.minutes<1||rem.minutes>10080) throw Error('Intervalo de remoção: de 1 a 10.080 minutos.');
 if(!Array.isArray(rem.times)||!rem.times.length||rem.times.length>24||rem.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw Error('Informe horários de remoção válidos, como 06:00.');
 const previousRemoval = previous?.removalSchedule;
 const removalUnchanged = previousRemoval && scheduleConfigKey(previousRemoval) === scheduleConfigKey(rem);
 const previousRemovalNextAt = previousRemoval?.nextAt;
 rem.times=[...new Set(rem.times)].sort();
 rem.nextAt = removalUnchanged && rem.enabled &&
  Number.isSafeInteger(previousRemovalNextAt) && previousRemovalNextAt > 0
  ? previousRemovalNextAt
  : nextTime(rem,now);
 s.promoLogChat = Number.isSafeInteger(s.promoLogChat) ? s.promoLogChat : 0;
 s.promoLogTopic = Number.isSafeInteger(s.promoLogTopic) ? s.promoLogTopic : 0;
 s.chatsLogTopic = Number.isSafeInteger(s.chatsLogTopic) ? s.chatsLogTopic : 0;
 s.promoChannel = typeof s.promoChannel === 'string' ? s.promoChannel : (Number.isSafeInteger(s.promoChannel) ? String(s.promoChannel) : '');
 s.listType = 'mixed';
 // Legacy strategic ad slots are no longer used; drop them on the next save.
 delete s.listAdsConfig;
 return s;
}
export function nextTime(a, now=Date.now()) {
 if(!a.enabled)return 0;
 if(a.mode==='interval')return now+a.minutes*60000;
 const shifted=new Date(now-3*3600000); const day=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())+3*3600000;
 return Math.min(...a.times.map(t=>{const [h,m]=t.split(':').map(Number);const x=day+h*3600000+m*60000;return x>now?x:x+86400000;}));
}
export const AD_STYLES=['primary','danger','success'];
export function resolveButtonStyle(c, s, layoutStyle = '') {
 if (!c) return '';
 const direct = c.style || s?.chatColors?.[c.id] || s?.chatColors?.[String(c.id)];
 if (direct && AD_STYLES.includes(direct)) return direct;
 if (direct === 'none') return '';
 if (AD_STYLES.includes(layoutStyle)) return layoutStyle;
 const isChannel = c.type === 'channel';
 const isGroup = c.type === 'group' || c.type === 'supergroup';
 if (isChannel && s?.channelColor && AD_STYLES.includes(s.channelColor)) return s.channelColor;
 if (isGroup && s?.groupColor && AD_STYLES.includes(s.groupColor)) return s.groupColor;
 if (s?.buttonColor && AD_STYLES.includes(s.buttonColor)) return s.buttonColor;
 return '';
}
export function makePages(chats,s,seed=0,ads=[],botUsername='',targetType='',options={}) {
 let list=chats.filter(c=>c.status==='approved'&&validLink(c.url)).slice();
 if(s.order==='manual')list.sort((a,b)=>a.position-b.position||a.id-b.id);
 else list.sort((a,b)=>(a.display||a.title).localeCompare(b.display||b.title,'pt-BR'));
 if(s.groupCategories)list.sort((a,b)=>a.category-b.category);
 const categories=resolveCategories(s);
 const makeChatButton=(c,layoutStyle='')=>{
  const cat=categories[c.category];
  const prefix=s.groupCategories&&cat?cat.split(' ')[0]+' ':'';
  const style=resolveButtonStyle(c,s,layoutStyle);
  return {
   text:truncateButtonText(prefix+(c.display||c.title),60),
   url:c.url,
   ...(style?{style}:{})
  };
 };
 const makeAdButton=(ad,layoutStyle='')=>{
  const style=AD_STYLES.includes(layoutStyle)?layoutStyle:ad.style;
  return {
   text:truncateButtonText(ad.title,60),
   url:ad.url,
   ...(AD_STYLES.includes(style)?{style}:{})
  };
 };

 // The panel-drawn layout is authoritative. It is resolved once: fixed cells
 // stay, random ads are unique and auto cells are filled up to the drawn count.
 // Extra approved chats never create a second message.
 const layout=normalizeButtonLayout(s.buttonLayout,{allowAdKey:true});
 const layoutRows=buildLayoutRows(list,layout,ads,seed,{
  targetType,
  rotation:layout.rotate===true,
  roundIndex:options.roundIndex||0,
  destinationId:options.destinationId||0
 });
 const rows=layoutRows.map(row=>row.map(cell=>cell.kind==='ad'?makeAdButton(cell.ad,cell.style):makeChatButton(cell.chat,cell.style)));

 if (s.footerButtons !== false) {
  const actualBotUsername = botUsername || s.botUsername || 'ListaMyBOT';
  const botAddUrl = `https://t.me/${actualBotUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users`;
  rows.push([
   { text: 'Adicionar no meu Canal/Grupo', url: botAddUrl, style: 'success' }
  ]);
 }

 if (!rows.length) return [];
 return [{text:s.text,reply_markup:{inline_keyboard:rows}}];
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
