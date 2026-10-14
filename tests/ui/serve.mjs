// Isolated presentation review only. Never imports or connects to a real backend.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stub = `
import React from 'react';
export const useRouter=()=>({push:p=>window.__qa.navigation.push(p),refresh:()=>{}});
export const useSearchParams=()=>new URLSearchParams(location.search);
export const usePathname=()=>new URLSearchParams(location.search).get('screen')==='team'?'/settings/team':location.pathname==='/settings'||new URLSearchParams(location.search).get('screen')==='settings'?'/settings':'/';
export default function Element({children,priority,fill,prefetch,replace,scroll,...props}){return React.createElement(props.src?'img':'a',props,children)}
async function reply(name,input) {
 window.__qa.calls.push({name,input});
 const safeCalls=window.__qa.calls.map(c=>({...c,input:Object.fromEntries(Object.entries(c.input||{}).map(([k,v])=>[k,/password/i.test(k)?'[test value redacted]':v]))}));
 const output=document.getElementById('qa-events');if(output)output.textContent=JSON.stringify(safeCalls,null,2);
 if(window.__qa.mode==='slow') await new Promise(r=>setTimeout(r,1200));
 if(window.__qa.mode==='error') return {success:false,error:'Unable to save. Please try again.'};
 if(window.__qa.mode==='field') return {success:false,error:'Check your details.',fieldErrors:{name:'Enter a business name',email:'Check your email'}};
 if(name==='signup') return {success:true,emailConfirmationRequired:true};
 if(name==='createBusiness') return {success:true,data:{id:'org-new',slug:input.slug,planName:'Standard'}};
 if(name==='confirm') return {success:true,data:{redirectTo:'/?screen=verify&email=confirmed%40example.test'}};
 return {success:true};
}
export const loginAction=p=>reply('login',p);
export const signupAction=p=>reply('signup',p);
export const forgotPasswordAction=p=>reply('forgot',p);
export const resetPasswordAction=p=>reply('reset',p);
export const confirmOtpAction=p=>reply('confirm',p);
export const logoutAction=p=>reply('logout',p);
export const createBusinessAction=p=>reply('createBusiness',p);
export const updateBusinessConfigurationAction=p=>reply('business',p);
export const updateBranchConfigurationAction=p=>reply('branch',p);
`;
const bundled = await build({
 entryPoints:[path.join(root,'tests/ui/review-fixture.tsx')], bundle:true, write:false, format:'esm', jsx:'automatic',
 plugins:[{name:'isolated-backend',setup(b){
  b.onResolve({filter:/^(next\/(navigation|link|image))$/},args=>({path:args.path,namespace:'qa'}));
  b.onResolve({filter:/lib\/actions\/(auth|organization)$/},args=>({path:args.path,namespace:'qa'}));
  b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'js',resolveDir:root}));
 }}],
});
const processed = await postcss([tailwind({base:root})]).process(await readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
const media = process.env.STACK37_REVIEW_FONT_DIR || path.join(root,'.next/dev/static/media');
const fonts = await readdir(media);
const sans = fonts.find(f=>f.startsWith('caa3a2')&&f.endsWith('.woff2'));
const mono = fonts.find(f=>f.startsWith('797e43')&&f.endsWith('.woff2'));
const css = processed.css + `@font-face{font-family:Geist;src:url('/font-sans.woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('/font-mono.woff2');font-weight:100 900}:root{--font-geist-sans:Geist;--font-geist-mono:'Geist Mono'}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TASK-STAB-004 · Local UI review</title><link rel="stylesheet" href="/ui.css"></head><body><div id="root"></div><script type="module" src="/ui.js"></script></body></html>`;
const port = Number(process.env.STACK37_REVIEW_PORT || 3002);
createServer(async(req,res)=>{
 try {
  const pathname = new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/email/confirmation'||pathname==='/email/recovery'){
   const kind=pathname.split('/').pop();
   const email=(await readFile(path.join(root,'docs/email-templates',kind+'.html'),'utf8')).replaceAll('{{LOGO_URL}}','/stack37-logo.webp').replaceAll('{{ACTION_URL}}','/?screen=confirm&type=signup&token_hash=local-preview-only');
   res.setHeader('Content-Type','text/html');res.end(email)
  }
  else if(pathname==='/ui.js'){res.setHeader('Content-Type','text/javascript');res.end(bundled.outputFiles[0].text)}
  else if(pathname==='/ui.css'){res.setHeader('Content-Type','text/css');res.end(css)}
  else if(pathname==='/stack37-logo.webp'){res.setHeader('Content-Type','image/webp');res.end(await readFile(path.join(root,'public/stack37-logo.webp')))}
  else if(pathname==='/font-sans.woff2'||pathname==='/font-mono.woff2'){res.setHeader('Content-Type','font/woff2');res.end(await readFile(path.join(media,pathname.includes('sans')?sans:mono)))}
  else{res.setHeader('Content-Type','text/html');res.end(html)}
 }catch{res.statusCode=500;res.end('Review asset unavailable')}
}).listen(port,'127.0.0.1',()=>console.log(`Isolated UI review: http://127.0.0.1:${port} · no live backend`));
