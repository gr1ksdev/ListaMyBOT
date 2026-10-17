import {rm,mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await rm('dist',{recursive:true,force:true});await mkdir('dist');await cp('frontend','dist',{recursive:true});
const layout=await readFile('tgcloud/lib/layout.js','utf8');
const app=await readFile('frontend/app.js','utf8');
const bundle=layout.replaceAll('export function','function')+'\n'+app.replace(/^import .*?;\n/,'');
const fonts=await readFile('frontend/fonts.css','utf8');
const css=fonts+'\n'+(await readFile('frontend/style.css','utf8')).replace("@import url('/fonts.css');",'');
const hash=createHash('sha256').update(bundle).update(css).digest('hex').slice(0,12);
let html=await readFile('frontend/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="/style.css">',`<style>${css}</style>`).replace('<script type="module" src="/app.js"></script>',()=>`<script type="module">${bundle.replace(/<\/script/gi,'<\\/script')}</script>`);
html=html.replace('</head>',`<meta name="interface-version" content="${hash}"></head>`);
await writeFile('dist/index.html',html);
// Keep standalone files useful for debugging; the actual app loads one document.
await writeFile('dist/app.js',bundle);await writeFile('dist/style.css',css);await writeFile('dist/layout.js',layout);
console.log('Interface build: '+hash+' (HTML + CSS + JS bundled)');
