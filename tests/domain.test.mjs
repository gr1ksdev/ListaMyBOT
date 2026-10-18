import {test} from 'node:test';import assert from 'node:assert/strict';
import {DEFAULTS,validateSettings,nextTime,makePages,permissionErrors,validLink} from '../tgcloud/lib/domain.js';
test('horários fixos usam UTC−3 e avançam ao próximo dia',()=>{const now=Date.parse('2026-10-13T23:00:00-03:00');assert.equal(new Date(nextTime({enabled:true,mode:'fixed',times:['09:00','20:00']},now)).toISOString(),'2026-10-14T12:00:00.000Z');});
test('intervalo arbitrário de 90 minutos preserva a duração',()=>assert.equal(nextTime({enabled:true,mode:'interval',minutes:90},1000),5401000));
test('validação rejeita configurações inválidas',()=>{assert.throws(()=>validateSettings({...DEFAULTS,columns:8}));assert.throws(()=>validateSettings({...DEFAULTS,schedule:{...DEFAULTS.schedule,times:['25:00']}}));assert.throws(()=>validateSettings({...DEFAULTS,admins:[NaN]}));});
test('IDs principais dos proprietários são preservados',()=>assert.deepEqual(validateSettings({...DEFAULTS,admins:[]}).admins,[7595607953,8474484790]));
test('somente aprovados aparecem e os botões são divididos em páginas',()=>{const items=Array.from({length:85},(_,i)=>({id:i,title:'Canal '+i,url:'https://t.me/test'+i,status:i===0?'pending':'approved',category:0}));const pages=makePages(items,{...DEFAULTS,footerButtons:false});assert.equal(pages.length,3);assert.equal(pages.flatMap(p=>p.reply_markup.inline_keyboard.flat()).length,84);assert.ok(pages.every(p=>p.reply_markup.inline_keyboard.every(r=>r.length<=2)));});
test('permissão para fixar difere entre canal e grupo',()=>{const m={status:'administrator',can_post_messages:true,can_delete_messages:true,can_pin_messages:true};assert.equal(permissionErrors({type:'channel'},m).length,1);assert.equal(permissionErrors({type:'supergroup'},m).length,0);assert.equal(permissionErrors({type:'channel'},{...m,can_edit_messages:true}).length,0);});
test('somente links do Telegram são publicados',()=>{assert.equal(validLink('javascript:alert(1)'),false);assert.equal(validLink('https://t.me/+Abc_123'),true);assert.equal(validLink('https://t.me/testchannel'),true);assert.equal(validLink('https://t.me.evil.test/test'),false);});

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

test('botões default no fim da lista: Add-me em C/G e Canal Oficial', () => {
 const chats = [{ id: 1, position: 0, title: 'Canal 1', url: 'https://t.me/canal1', status: 'approved', category: 0 }];
 const pages = makePages(chats, DEFAULTS);
 const rows = pages[0].reply_markup.inline_keyboard;
 const footerRow = rows[rows.length - 1];
 assert.equal(footerRow.length, 2);
 assert.equal(footerRow[0].text, 'Add-me em C/G');
 assert.equal(footerRow[0].style, 'primary');
 assert.equal(footerRow[0].url, 'https://t.me/ListaMyBOT?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users');
 assert.equal(footerRow[1].text, 'Canal Oficial');
 assert.equal(footerRow[1].style, 'success');
 assert.equal(footerRow[1].url, 'https://t.me/ChannelLogBM');
});


