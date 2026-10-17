// Optional real-browser check: NODE_PATH pointing to Playwright installation.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const {DEFAULTS,CATEGORIES}=await import('../tgcloud/lib/domain.js');
 const options={headless:true,args:['--no-sandbox']};
 if(process.env.CHROMIUM_MODULE){const {default:c}=await import(process.env.CHROMIUM_MODULE);options.executablePath=process.env.CHROMIUM_PATH||await c.executablePath();options.args=c.args;}
 const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const name=pathname==='/'?'index.html':pathname.slice(1);const file=path.join(__dirname,'../dist',name);try{res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.woff2')?'font/woff2':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.ttf')?'font/ttf':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(8765,'127.0.0.1',r));server.unref();const browser=await chromium.launch(options);const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 let settings=structuredClone(DEFAULTS),version=1;
 const now=Date.now();settings={...settings,deletePrevious:true,rowPattern:[1,2,1],schedule:{...settings.schedule,enabled:true,nextAt:now+3600000}};
 const sampleNames=['Clube dos Livros','Papo Livre','Cinema em Casa'];
 const chats=Array.from({length:24},(_,i)=>({id:-1000-i,title:sampleNames[i]||'Canal '+(i+1),display:'',url:'https://t.me/exemplo'+i,category:[9,2,7][i%3],status:i<3?'pending':'approved',type:i===1||i>18?'supergroup':'channel',position:i}));
 const fixture={id:7595607953,chats,rounds:[{id:1,created:now-3600000,status:'done'}],deliveries:[],lastDeliverySummary:{total:21,sent:21},categories:CATEGORIES,schedulerHeartbeat:now};
 await page.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:'LOCAL_UI_TEST',colorScheme:'light',onEvent(){},ready(){},expand(){},Serverless:{call(name,input,cb){window.testCall(name,input).then(r=>cb(null,r)).catch(e=>cb({message:e.message}));}}}};`}));
 await page.exposeFunction('testCall',async(name,input)=>{if(name==='dashboard')return {...fixture,settings,version};if(name==='saveSettings'){settings=input.settings;version++;return {ok:true};}throw Error('Unexpected '+name);});

 await page.goto('http://127.0.0.1:8765');await page.locator('#app').waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);
 for(const tab of ['home','chats','settings','list','schedule']){await page.click(`[data-tab="${tab}"]`);await page.screenshot({path:`/tmp/design-${tab}.png`,fullPage:true});}
 await page.click('[data-tab="list"]');await page.click('#add-buttons');await page.screenshot({path:'/tmp/design-picker.png',fullPage:true});await page.click('#close-picker');await page.click('[data-view="preview"]');await page.screenshot({path:'/tmp/design-preview.png',fullPage:true});
 await page.evaluate(()=>{window.Telegram.WebApp.colorScheme='dark';document.documentElement.dataset.theme='dark';});await page.click('[data-tab="settings"]');await page.screenshot({path:'/tmp/design-dark.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();server.close();console.log('Reference review screens rendered.');
})().catch(e=>{console.error(e);process.exit(1)});
