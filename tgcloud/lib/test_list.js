import { validLink } from './domain.js';

const FAKE_URL = 'https://t.me/telegram';
const FIRST_FAKE_CHAT_ID = -900000000001;
const FIRST_FAKE_AD_ID = -800000000001;

function approvedChats(chats) {
 return (chats || []).filter(c => c && c.status === 'approved' && validLink(c.url));
}

function usableAds(ads) {
 return (ads || []).filter(a => a && a.title && validLink(a.url));
}

function layoutStats(settings) {
 const rows = settings?.buttonLayout?.enabled && Array.isArray(settings.buttonLayout.rows)
  ? settings.buttonLayout.rows
  : [];
 let chatCells = 0;
 let adCells = 0;
 for (const row of rows) {
  for (const cell of row || []) {
   if (cell?.kind === 'ad') adCells++;
   else chatCells++;
  }
 }
 return { rows, chatCells, adCells, enabled: settings?.buttonLayout?.enabled === true };
}

function targetCounts(real, settings, stats) {
 const realChannels = real.filter(c => c.type === 'channel').length;
 const realGroups = real.filter(c => c.type !== 'channel').length;
 const simple = settings?.listType === 'simple';
 const fill = settings?.buttonLayout?.fill || 'random';
 let channels = realChannels;
 let groups = realGroups;

 if (stats.enabled) {
  const min = stats.chatCells;
  if (simple) {
   channels = Math.max(channels, min);
   groups = Math.max(groups, min);
  } else if (fill === 'channel') {
   channels = Math.max(channels, min);
  } else if (fill === 'group') {
   groups = Math.max(groups, min);
  } else {
   channels = Math.max(channels, Math.ceil(min / 2));
   groups = Math.max(groups, Math.floor(min / 2));
  }
 } else if (simple) {
  channels = Math.max(channels, 4);
  groups = Math.max(groups, 4);
 } else {
  const total = Math.max(real.length, 6);
  channels = Math.max(channels, Math.ceil(total / 2));
  groups = Math.max(groups, Math.floor(total / 2));
 }

 return { channels, groups };
}

function fakeChat(id, type, number, position) {
 const label = type === 'channel' ? 'Canal' : 'Grupo';
 return {
  id,
  title: `${label} de Teste ${number}`,
  display: '',
  type,
  url: FAKE_URL,
  category: 0,
  status: 'approved',
  position,
  style: ''
 };
}

function fakeAd(id, number) {
 return {
  id,
  title: `Divulgação de Teste ${number}`,
  url: FAKE_URL,
  style: 'primary',
  slot_row: 0,
  slot_col: 0
 };
}

// Test-only data. It never touches the database: real approved chats/ads are
// kept, and deterministic fake entries fill the missing positions so a layout
// can always be tested in Telegram.
export function supplementTestData(chats = [], ads = [], settings = {}) {
 const realChats = approvedChats(chats);
 const stats = layoutStats(settings);
 const targets = targetCounts(realChats, settings, stats);
 const existingIds = new Set(realChats.map(c => Number(c.id)));
 const nextId = () => {
  let id = FIRST_FAKE_CHAT_ID;
  while (existingIds.has(id)) id--;
  existingIds.add(id);
  return id;
 };

 const fakeChats = [];
 let channelNumber = 0;
 let groupNumber = 0;
 let position = 10000;
 const addFake = type => {
  const number = type === 'channel' ? ++channelNumber : ++groupNumber;
  fakeChats.push(fakeChat(nextId(), type, number, position++));
 };

 for (let i = realChats.filter(c => c.type === 'channel').length; i < targets.channels; i++) {
  addFake('channel');
 }
 for (let i = realChats.filter(c => c.type !== 'channel').length; i < targets.groups; i++) {
  addFake('group');
 }

 const realAds = usableAds(ads);
 const fakeAds = [];
 const adIds = new Set(realAds.map(a => Number(a.id)));
 let adNumber = 0;
 const addFakeAd = id => {
  fakeAds.push(fakeAd(id, ++adNumber));
  adIds.add(Number(id));
 };

 for (const row of stats.rows) {
  for (const cell of row || []) {
   if (cell?.kind !== 'ad') continue;
   const id = Number(cell.adId);
   if (Number.isSafeInteger(id) && !adIds.has(id)) addFakeAd(id);
  }
 }
 if (!stats.enabled && settings?.listAdsConfig?.enabled && !realAds.length) {
  addFakeAd(FIRST_FAKE_AD_ID);
 }

 return {
  chats: [...realChats, ...fakeChats],
  ads: [...realAds, ...fakeAds],
  usedFake: fakeChats.length > 0 || fakeAds.length > 0,
  fakeChats: fakeChats.length,
  fakeAds: fakeAds.length
 };
}
