import {test} from 'node:test';import assert from 'node:assert/strict';
import {DEFAULTS,DEFAULT_MAINTENANCE_MESSAGE,validateSettings,nextTime,makePages,permissionErrors,validLink,resolveCategories} from '../tgcloud/lib/domain.js';
import {buildLayoutRows as buildBackendLayoutRows} from '../tgcloud/lib/layout.js';
import {buildLayoutRows as buildPanelLayoutRows,clampPageIndex} from '../src/lib/layout.js';
test('horários fixos usam UTC−3 e avançam ao próximo dia',()=>{const now=Date.parse('2026-10-13T23:00:00-03:00');assert.equal(new Date(nextTime({enabled:true,mode:'fixed',times:['09:00','20:00']},now)).toISOString(),'2026-10-14T12:00:00.000Z');});
test('intervalo arbitrário de 90 minutos preserva a duração',()=>assert.equal(nextTime({enabled:true,mode:'interval',minutes:90},1000),5401000));
test('validação rejeita configurações inválidas',()=>{assert.throws(()=>validateSettings({...DEFAULTS,columns:8}));assert.throws(()=>validateSettings({...DEFAULTS,schedule:{...DEFAULTS.schedule,times:['25:00']}}));assert.throws(()=>validateSettings({...DEFAULTS,admins:[NaN]}));});
test('IDs principais dos proprietários são preservados',()=>assert.deepEqual(validateSettings({...DEFAULTS,admins:[]}).admins,[7595607953,8474484790]));
test('somente aprovados aparecem e os botões são divididos em páginas',()=>{const items=Array.from({length:85},(_,i)=>({id:i,title:'Canal '+i,url:'https://t.me/test'+i,status:i===0?'pending':'approved',category:0}));const pages=makePages(items,{...DEFAULTS,footerButtons:false});assert.equal(pages.length,3);assert.equal(pages.flatMap(p=>p.reply_markup.inline_keyboard.flat()).length,84);assert.ok(pages.every(p=>p.reply_markup.inline_keyboard.every(r=>r.length<=2)));});
test('permissão para fixar difere entre canal e grupo',()=>{const m={status:'administrator',can_post_messages:true,can_delete_messages:true,can_pin_messages:true};assert.equal(permissionErrors({type:'channel'},m).length,1);assert.equal(permissionErrors({type:'supergroup'},m).length,0);assert.equal(permissionErrors({type:'channel'},{...m,can_edit_messages:true}).length,0);});
test('somente links do Telegram são publicados',()=>{assert.equal(validLink('javascript:alert(1)'),false);assert.equal(validLink('https://t.me/+Abc_123'),true);assert.equal(validLink('https://t.me/testchannel'),true);assert.equal(validLink('https://t.me.evil.test/test'),false);});

test('prévia limita a página atual quando a lista diminui',()=>{
 assert.equal(clampPageIndex(0,0),0);
 assert.equal(clampPageIndex(2,1),0);
 assert.equal(clampPageIndex(1,3),1);
 assert.equal(clampPageIndex(-2,3),0);
 assert.equal(clampPageIndex(9,3),2);
});

test('padrão 1-2-1 repete em toda a lista e preserva último bloco parcial',()=>{
 const chats=Array.from({length:11},(_,i)=>({id:i,position:i,title:'Canal '+i,url:'https://t.me/canal'+i,status:'approved',category:0}));
 const rows=makePages(chats,{...DEFAULTS,order:'manual',rowPattern:[1,2,1],footerButtons:false})[0].reply_markup.inline_keyboard;
 assert.deepEqual(rows.map(r=>r.length),[1,2,1,1,2,1,1,2]);assert.deepEqual(rows.flat().map(b=>b.text),chats.map(c=>c.title));
});
test('divulgação ocupa o slot desenhado em cada repetição sem alterar o fluxo',()=>{
 const chats=Array.from({length:11},(_,i)=>({id:i,position:i,title:'Canal '+i,url:'https://t.me/canal'+i,status:'approved',category:0}));
 const ad={title:'Patrocinador',url:'https://t.me/patrocssinador',style:'primary',slot_row:1,slot_col:1};
 const rows=makePages(chats,{...DEFAULTS,order:'manual',rowPattern:[1,2,1],footerButtons:false},0,[ad])[0].reply_markup.inline_keyboard;
 assert.deepEqual(rows.map(r=>r.length),[1,2,1,1,2,1,1,2,1,1,2]);
 assert.deepEqual(rows.flat().map(b=>b.text),['Canal 0','Canal 1','Patrocinador','Canal 2','Canal 3','Canal 4','Patrocinador','Canal 5','Canal 6','Canal 7','Patrocinador','Canal 8','Canal 9','Canal 10','Patrocinador']);
 assert.deepEqual(rows.flat().find(b=>b.text==='Patrocinador'),{text:'Patrocinador',url:'https://t.me/patrocssinador',style:'primary'});
});
test('estilo inválido sai sem style e slot fora da largura é ignorado',()=>{
 const chats=[{id:1,position:0,title:'Canal A',url:'https://t.me/canala',status:'approved',category:0}];
 const s={...DEFAULTS,order:'manual',rowPattern:[1],footerButtons:false};
 assert.deepEqual(makePages(chats,s,0,[{title:'Ad',url:'https://t.me/aaaa',slot_row:0,slot_col:0,style:'rosa'}])[0].reply_markup.inline_keyboard,[[{text:'Ad',url:'https://t.me/aaaa'}]]);
 assert.deepEqual(makePages(chats,s,0,[{title:'Ad',url:'https://t.me/aaaa',slot_row:0,slot_col:1}])[0].reply_markup.inline_keyboard,[[{text:'Canal A',url:'https://t.me/canala'}]]);
});
test('paginação não interrompe uma linha nem reinicia o padrão',()=>{
 const chats=Array.from({length:103},(_,i)=>({id:i,position:i,title:'Canal '+i,url:'https://t.me/canal'+i,status:'approved',category:0}));
 const pages=makePages(chats,{...DEFAULTS,order:'manual',rowPattern:[5,2,4],footerButtons:false});const rows=pages.flatMap(p=>p.reply_markup.inline_keyboard);
 assert.ok(pages.every(p=>p.reply_markup.inline_keyboard.length<=20&&p.reply_markup.inline_keyboard.flat().length<=40));
 assert.deepEqual(rows.flat().map(b=>b.text),chats.map(c=>c.title));assert.ok(rows.slice(0,-1).every((r,i)=>r.length===[5,2,4][i%3]));
});
test('limites do padrão e migração das colunas anteriores',()=>{
 assert.deepEqual(validateSettings({...DEFAULTS,columns:2}).rowPattern,[2]);
 assert.deepEqual(validateSettings({...DEFAULTS,rowPattern:Array(20).fill(5)}).rowPattern,Array(20).fill(5));
 for(const rowPattern of [[],[0],[6],[1.5],Array(21).fill(1),'1,2,1',null])assert.throws(()=>validateSettings({...DEFAULTS,rowPattern}));
});

test('mínimo de membros aceita zero e inteiros e mantém compatibilidade',()=>{assert.equal(validateSettings({...DEFAULTS,minMembers:undefined}).minMembers,0);assert.equal(validateSettings({...DEFAULTS,minMembers:100}).minMembers,100);for(const minMembers of [-1,1.1,'100',100000001])assert.throws(()=>validateSettings({...DEFAULTS,minMembers}));});

test('modo manutenção valida estado e permite mensagem vazia para silêncio',()=>{
 const saved=validateSettings({...DEFAULTS,maintenance:{enabled:true,message:'  <b>Voltamos já</b>  '}});
 assert.equal(saved.maintenance.enabled,true);
 assert.equal(saved.maintenance.message,'<b>Voltamos já</b>');
 assert.equal(validateSettings({...DEFAULTS,maintenance:{enabled:false,message:''}}).maintenance.message,'');
 assert.equal(validateSettings({...DEFAULTS}).maintenance.message,DEFAULT_MAINTENANCE_MESSAGE);
 assert.throws(()=>validateSettings({...DEFAULTS,maintenance:{enabled:'yes'}}),/manutenção/i);
 assert.throws(()=>validateSettings({...DEFAULTS,maintenance:{enabled:true,message:123}}),/manutenção/i);
 assert.throws(()=>validateSettings({...DEFAULTS,maintenance:{enabled:true,message:'x'.repeat(3501)}}),/3.500/);

 // Um painel antigo que não envia o campo não desativa a manutenção sem querer.
 const previous=validateSettings({...DEFAULTS,maintenance:{enabled:true,message:'X'}});
 const {maintenance,...withoutMaintenance}=previous;
 const savedWithout=validateSettings({...withoutMaintenance,buttonColor:'primary'},Date.now(),previous);
 assert.deepEqual(savedWithout.maintenance,previous.maintenance);
});

test('salvar configurações não adia o próximo envio nem a próxima remoção',()=>{
 const now=Date.parse('2026-10-13T12:00:00-03:00');
 const scheduleNextAt=now+3600000;
 const removalNextAt=now+7200000;
 const previous={...DEFAULTS,
  schedule:{...DEFAULTS.schedule,enabled:true,nextAt:scheduleNextAt},
  removalSchedule:{...DEFAULTS.removalSchedule,enabled:true,nextAt:removalNextAt}
 };
 const input={...previous,buttonColor:'primary'};
 const saved=validateSettings(input,now,previous);
 assert.equal(saved.schedule.nextAt,scheduleNextAt);
 assert.equal(saved.removalSchedule.nextAt,removalNextAt);

 const changedSchedule=validateSettings({...input,schedule:{...input.schedule,times:['10:00']}},now,previous);
 assert.equal(changedSchedule.schedule.nextAt,nextTime({...input.schedule,times:['10:00']},now));
 assert.equal(changedSchedule.removalSchedule.nextAt,removalNextAt);

 const disabledRemoval=validateSettings({...input,removalSchedule:{...input.removalSchedule,enabled:false}},now,previous);
 assert.equal(disabledRemoval.removalSchedule.nextAt,0);
});

test('rodapé usa o username real do bot quando informado',()=>{
 const chats=[{id:1,position:0,title:'Canal A',url:'https://t.me/canala',status:'approved',category:0}];
 const pages=makePages(chats,{...DEFAULTS,footerButtons:true},0,[],'OutroBot');
 const footer=pages[0].reply_markup.inline_keyboard.at(-1)[0];
 assert.equal(footer.text,'Adicionar no meu Canal/Grupo');
 assert.match(footer.url,/^https:\/\/t\.me\/OutroBot\?startgroup=true/);
});

test('cores dos botões: global, tipo canal/grupo e individual com precedência correta',()=>{
 const chats=[
  {id:1,position:0,title:'Canal 1',type:'channel',url:'https://t.me/canal1',status:'approved',category:0},
  {id:2,position:1,title:'Grupo 1',type:'group',url:'https://t.me/grupo1',status:'approved',category:0},
  {id:3,position:2,title:'Canal 2 VIP',type:'channel',url:'https://t.me/canal2',status:'approved',category:0,style:'danger'},
  {id:4,position:3,title:'Grupo 2 Especial',type:'supergroup',url:'https://t.me/grupo2',status:'approved',category:0}
 ];
 const s={
  ...DEFAULTS,
  order:'manual',
  rowPattern:[4],
  buttonColor:'primary',
  channelColor:'success',
  groupColor:'',
  chatColors:{'4':'danger'}
 };
 const rows=makePages(chats,s)[0].reply_markup.inline_keyboard[0];
 assert.equal(rows[0].style,'success');
 assert.equal(rows[1].style,'primary');
 assert.equal(rows[2].style,'danger');
 assert.equal(rows[3].style,'danger');
});

test('listType validação e valor padrão',()=>{
 assert.equal(validateSettings({...DEFAULTS,listType:'simple'}).listType,'simple');
 assert.equal(validateSettings({...DEFAULTS,listType:'mixed'}).listType,'mixed');
 assert.equal(validateSettings({...DEFAULTS,listType:'invalid'}).listType,'mixed');
});

test('resolveListAds e makePages com posições início, meio e fim',()=>{
 const chats = Array.from({length: 6}, (_, i) => ({
  id: i + 1, position: i, title: 'Chat ' + (i + 1), url: 'https://t.me/chat' + (i + 1), status: 'approved', category: 0
 }));
 const ads = [
  { id: 101, title: 'Patrocinador Topo', url: 'https://t.me/topo', style: 'primary' },
  { id: 102, title: 'Patrocinador Centro', url: 'https://t.me/centro', style: 'success' },
  { id: 103, title: 'Patrocinador Rodapé', url: 'https://t.me/rodape', style: 'danger' }
 ];

 const s = {
  ...DEFAULTS,
  order: 'manual',
  rowPattern: [2, 2],
  footerButtons: false,
  listAdsConfig: {
   enabled: true,
   mode: 'fixed',
   sameAdAcrossSlots: false,
   slots: {
    start: { enabled: true, adId: 101 },
    middle: { enabled: true, adId: 102 },
    end: { enabled: true, adId: 103 }
   }
  }
 };

 const pages = makePages(chats, s, 0, ads);
 const rows = pages[0].reply_markup.inline_keyboard;
 // Top slot (início)
 assert.equal(rows[0][0].text, 'Patrocinador Topo');
 assert.equal(rows[0][0].style, 'primary');
 // End slot (fim)
 assert.equal(rows[rows.length - 1][0].text, 'Patrocinador Rodapé');
 assert.equal(rows[rows.length - 1][0].style, 'danger');
 // Middle slot exists
 const mid = rows.find(r => r.length === 1 && r[0].text === 'Patrocinador Centro');
 assert.ok(mid);
 assert.equal(mid[0].style, 'success');

 // Test sameAdAcrossSlots
 const sSame = {
  ...s,
  listAdsConfig: {
   ...s.listAdsConfig,
   sameAdAcrossSlots: true,
   fixedAdId: 102
  }
 };
 const pagesSame = makePages(chats, sSame, 0, ads);
 const rowsSame = pagesSame[0].reply_markup.inline_keyboard;
 assert.equal(rowsSame[0][0].text, 'Patrocinador Centro');
 assert.equal(rowsSame[rowsSame.length - 1][0].text, 'Patrocinador Centro');
});

test('duas divulgações com início e fim ativos distribui a 1ª no início e a 2ª no fim', () => {
 const chats = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1, position: i, title: 'Canal ' + (i + 1), url: 'https://t.me/c' + (i + 1), status: 'approved', category: 0
 }));
 const twoAds = [
  { id: 1, title: 'Parceria Alfa', url: 'https://t.me/alfa', style: 'primary' },
  { id: 2, title: 'Parceria Beta', url: 'https://t.me/beta', style: 'success' }
 ];
 const s = {
  ...DEFAULTS,
  order: 'manual',
  rowPattern: [2, 2],
  footerButtons: false,
  listAdsConfig: {
   enabled: true,
   mode: 'fixed',
   sameAdAcrossSlots: false,
   slots: {
    start: { enabled: true, adId: null },
    middle: { enabled: false, adId: null },
    end: { enabled: true, adId: null }
   }
  }
 };
 const pages = makePages(chats, s, 0, twoAds);
 const rows = pages[0].reply_markup.inline_keyboard;
 assert.equal(rows[0][0].text, 'Parceria Alfa');
 assert.equal(rows[rows.length - 1][0].text, 'Parceria Beta');
});

test('botão default no fim da lista: Adicionar no meu Canal/Grupo', () => {
 const chats = [{ id: 1, position: 0, title: 'Canal 1', url: 'https://t.me/canal1', status: 'approved', category: 0 }];
 const pages = makePages(chats, DEFAULTS);
 const rows = pages[0].reply_markup.inline_keyboard;
 const footerRow = rows[rows.length - 1];
 assert.equal(footerRow.length, 1);
 assert.equal(footerRow[0].text, 'Adicionar no meu Canal/Grupo');
 assert.equal(footerRow[0].style, 'success');
 assert.equal(footerRow[0].url, 'https://t.me/ListaMyBOT?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users');
});

test('categorias personalizadas são validadas e preservadas em painéis antigos', () => {
 const saved = validateSettings({ ...DEFAULTS, categories: [...DEFAULTS.categories, '🐶 Pets'] });
 assert.equal(saved.categories.at(-1), '🐶 Pets');
 assert.equal(resolveCategories(saved).length, DEFAULTS.categories.length + 1);

 const { categories, ...withoutCategories } = saved;
 const kept = validateSettings({ ...withoutCategories, buttonColor: 'primary' }, Date.now(), saved);
 assert.deepEqual(kept.categories, saved.categories);

 assert.throws(() => validateSettings({ ...DEFAULTS, categories: [] }), /categoria/i);
 assert.throws(() => validateSettings({ ...DEFAULTS, categories: ['A', ''] }), /nome/i);
 assert.throws(() => validateSettings({ ...DEFAULTS, categories: ['A', 2] }), /nome/i);
 assert.throws(() => validateSettings({ ...DEFAULTS, categories: ['A', 'A'] }), /repita/i);
 assert.throws(() => validateSettings({ ...DEFAULTS, categories: ['x'.repeat(61)] }), /60/);
});

test('layout personalizado fixa C/G e divulgação e preenche os demais botões', () => {
 const chats = [
  { id: 1, title: 'Canal A', type: 'channel', url: 'https://t.me/canala', status: 'approved', category: 0 },
  { id: 2, title: 'Grupo B', type: 'group', url: 'https://t.me/grupob', status: 'approved', category: 0 },
  { id: 3, title: 'Canal C', type: 'channel', url: 'https://t.me/canalc', status: 'approved', category: 0 },
  { id: 4, title: 'Grupo D', type: 'group', url: 'https://t.me/grupod', status: 'approved', category: 0 }
 ];
 const ad = { id: 10, title: 'Patrocinador', url: 'https://t.me/patrocinador', style: 'primary' };
 const settings = {
  ...DEFAULTS,
  order: 'alphabetical',
  footerButtons: false,
  buttonLayout: {
   enabled: true,
   fill: 'random',
   rows: [
    [{ kind: 'chat', chatId: 2 }, { kind: 'ad', adId: 10 }],
    [{ kind: 'auto' }, { kind: 'chat', chatId: 1 }, { kind: 'auto' }]
   ]
  }
 };
 const rows = makePages(chats, settings, 0, [ad])[0].reply_markup.inline_keyboard;
 assert.deepEqual(rows[0].map((b) => b.text), ['Grupo B', 'Patrocinador']);
 assert.equal(rows[1][1].text, 'Canal A');
 assert.equal(rows[1][1].url, 'https://t.me/canala');
 const allTexts = rows.flat().map((b) => b.text).sort();
 assert.deepEqual(allTexts, ['Canal A', 'Canal C', 'Grupo B', 'Grupo D', 'Patrocinador']);
 assert.equal(new Set(allTexts).size, allTexts.length);
});

test('layout preenche apenas canais, apenas grupos ou respeita a lista simples', () => {
 const chats = [
  { id: 1, title: 'Canal A', type: 'channel', url: 'https://t.me/canala', status: 'approved', category: 0 },
  { id: 2, title: 'Canal B', type: 'channel', url: 'https://t.me/canalb', status: 'approved', category: 0 },
  { id: 3, title: 'Grupo C', type: 'group', url: 'https://t.me/grupoc', status: 'approved', category: 0 },
  { id: 4, title: 'Grupo D', type: 'group', url: 'https://t.me/grupod', status: 'approved', category: 0 }
 ];
 const rowsFor = (fill, targetType = '') => {
  const settings = {
   ...DEFAULTS,
   footerButtons: false,
   buttonLayout: {
    enabled: true,
    fill,
    rows: [[{ kind: 'auto' }, { kind: 'auto' }], [{ kind: 'auto' }, { kind: 'auto' }]]
   }
  };
  return makePages(chats, settings, 0, [], '', targetType)[0].reply_markup.inline_keyboard.flat().map((b) => b.text);
 };

 assert.deepEqual(rowsFor('channel').sort(), ['Canal A', 'Canal B']);
 assert.deepEqual(rowsFor('group').sort(), ['Grupo C', 'Grupo D']);
 assert.deepEqual(rowsFor('random', 'channel').sort(), ['Canal A', 'Canal B']);
 assert.deepEqual(rowsFor('random', 'group').sort(), ['Grupo C', 'Grupo D']);
});

test('layout repete apenas os espaços automáticos e ignora C/G removido', () => {
 const chats = [
  { id: 1, title: 'Canal A', type: 'channel', url: 'https://t.me/canala', status: 'approved', category: 0 },
  { id: 2, title: 'Grupo B', type: 'group', url: 'https://t.me/grupob', status: 'approved', category: 0 },
  { id: 3, title: 'Canal C', type: 'channel', url: 'https://t.me/canalc', status: 'approved', category: 0 }
 ];
 const settings = {
  ...DEFAULTS,
  footerButtons: false,
  buttonLayout: {
   enabled: true,
   fill: 'random',
   rows: [[{ kind: 'chat', chatId: 999 }, { kind: 'auto' }], [{ kind: 'auto' }]]
  }
 };
 const rows = makePages(chats, settings, 0)[0].reply_markup.inline_keyboard;
 const texts = rows.flat().map((b) => b.text);
 assert.deepEqual(texts.sort(), ['Canal A', 'Canal C', 'Grupo B']);
 assert.ok(rows.every((row) => row.length <= 2));
});

test('layout do painel espelha exatamente o motor usado no envio', () => {
 const chats = [
  { id: 1, title: 'Canal A', type: 'channel', url: 'https://t.me/canala', status: 'approved', category: 0 },
  { id: 2, title: 'Grupo B', type: 'group', url: 'https://t.me/grupob', status: 'approved', category: 0 },
  { id: 3, title: 'Canal C', type: 'channel', url: 'https://t.me/canalc', status: 'approved', category: 0 },
  { id: 4, title: 'Grupo D', type: 'group', url: 'https://t.me/grupod', status: 'approved', category: 0 }
 ];
 const ads = [
  { id: 7, title: 'Patrocinador', url: 'https://t.me/patrocinador', style: 'primary' },
  { id: 8, title: 'Sem link', url: '' }
 ];
 const layout = {
  enabled: true,
  fill: 'random',
  rows: [
   [{ kind: 'chat', chatId: 2, style: 'success' }, { kind: 'ad', adId: 7, style: 'danger' }, { kind: 'auto', style: 'primary' }],
   [{ kind: 'auto' }, { kind: 'auto' }]
  ]
 };

 for (const options of [{}, { targetType: 'channel' }, { targetType: 'group' }]) {
  assert.deepEqual(
   buildPanelLayoutRows(chats, layout, ads, 42, options),
   buildBackendLayoutRows(chats, layout, ads, 42, options)
  );
 }
});

test('validação do layout rejeita posições e divulgações repetidas', () => {
 const base = { ...DEFAULTS, buttonLayout: { enabled: true, fill: 'random', rows: [[{ kind: 'auto' }]] } };
 assert.equal(validateSettings(base).buttonLayout.fill, 'random');
 assert.equal(
  validateSettings({ ...base, buttonLayout: { enabled: true, fill: 'invalido', rows: [[{ kind: 'auto' }]] } }).buttonLayout.fill,
  'random'
 );
 assert.throws(() => validateSettings({ ...base, buttonLayout: { enabled: true, fill: 'random', rows: [] } }), /layout/i);
 assert.throws(
  () => validateSettings({ ...base, buttonLayout: { enabled: true, fill: 'random', rows: [[{ kind: 'chat', chatId: 1 }, { kind: 'chat', chatId: 1 }]] } }),
  /mesmo canal/i
 );
 assert.throws(
  () => validateSettings({ ...base, buttonLayout: { enabled: true, fill: 'random', rows: [[{ kind: 'ad', adId: 2 }, { kind: 'ad', adId: 2 }]] } }),
  /mesma divulgação/i
 );

 const saved = validateSettings({ ...base, buttonLayout: { enabled: true, fill: 'group', rows: [[{ kind: 'chat', chatId: 1 }]] } });
 const { buttonLayout, ...withoutLayout } = saved;
 const kept = validateSettings({ ...withoutLayout, buttonColor: 'primary' }, Date.now(), saved);
 assert.deepEqual(kept.buttonLayout, saved.buttonLayout);
});

test('cor do botão do layout não sobrepõe a cor individual do C/G', () => {
 const chats = [
  { id: 1, title: 'Canal individual', type: 'channel', url: 'https://t.me/canalindividual', status: 'approved', category: 0, style: 'success' },
  { id: 2, title: 'Canal layout', type: 'channel', url: 'https://t.me/canallayout', status: 'approved', category: 0 },
  { id: 3, title: 'Grupo individual', type: 'group', url: 'https://t.me/grupoindividual', status: 'approved', category: 0 },
  { id: 4, title: 'Canal auto', type: 'channel', url: 'https://t.me/canalauto', status: 'approved', category: 0 }
 ];
 const settings = {
  ...DEFAULTS,
  footerButtons: false,
  channelColor: 'primary',
  groupColor: 'primary',
  buttonColor: 'primary',
  chatColors: { 3: 'success' },
  buttonLayout: {
   enabled: true,
   fill: 'random',
   rows: [
    [
     { kind: 'chat', chatId: 1, style: 'danger' },
     { kind: 'chat', chatId: 2, style: 'danger' },
     { kind: 'chat', chatId: 3, style: 'danger' }
    ],
    [{ kind: 'auto', style: 'danger' }]
   ]
  }
 };
 const rows = makePages(chats, settings, 0)[0].reply_markup.inline_keyboard;
 assert.equal(rows[0][0].style, 'success'); // cor individual do Chat vence
 assert.equal(rows[0][1].style, 'danger'); // cor do layout vence a cor global de canal
 assert.equal(rows[0][2].style, 'success'); // chatColors vence
 assert.equal(rows[1][0].style, 'danger'); // automático usa a cor da célula
});

test('motor de layout aceita divulgação nova por adKey antes do salvamento', () => {
 const chats = [
  { id: 1, title: 'Canal A', type: 'channel', url: 'https://t.me/canala', status: 'approved', category: 0 },
  { id: 2, title: 'Canal B', type: 'channel', url: 'https://t.me/canalb', status: 'approved', category: 0 }
 ];
 const newAd = {
  key: 501,
  title: 'Novo Parceiro',
  url: 'https://t.me/novoparceiro',
  style: 'success'
 };
 const settings = {
  ...DEFAULTS,
  footerButtons: false,
  buttonLayout: {
   enabled: true,
   fill: 'random',
   rows: [
    [{ kind: 'ad', adKey: 501, style: 'danger' }, { kind: 'auto' }]
   ]
  }
 };
 const rows = makePages(chats, settings, 0, [newAd])[0].reply_markup.inline_keyboard;
 assert.equal(rows[0][0].text, 'Novo Parceiro');
 assert.equal(rows[0][0].style, 'danger');
});

test('validação preserva a cor da célula do layout e ignora valor inválido', () => {
 const saved = validateSettings({
  ...DEFAULTS,
  buttonLayout: {
   enabled: true,
   fill: 'random',
   rows: [
    [
     { kind: 'auto', style: 'danger' },
     { kind: 'chat', chatId: 1, style: 'invalido' }
    ]
   ]
  }
 });
 assert.equal(saved.buttonLayout.rows[0][0].style, 'danger');
 assert.equal('style' in saved.buttonLayout.rows[0][1], false);
});

