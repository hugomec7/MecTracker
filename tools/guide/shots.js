const { chromium } = require('playwright'); const path=require('path');
module.exports = async function shots(renderDir, outDir, lang){
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:340,height:1400},deviceScaleFactor:3});
 p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.goto('file://'+path.join(renderDir,'index.html'));
 await p.addStyleTag({content:`
  .hl{box-shadow:0 0 0 2px #ff9f0a !important;}
  .mk{position:absolute;width:16px;height:16px;border-radius:8px;background:#ff9f0a;color:#1c1c1e;font:700 10px/16px Inter,Arial;text-align:center;z-index:9}
  .callout{position:absolute;z-index:9;color:#1c1c1e;background:#ff9f0a;font:700 10px Inter,Arial;padding:2px 6px;border-radius:5px}
  .arrow{position:absolute;z-index:9;width:2px;background:#ff9f0a}
  body,#app{overflow:visible!important;height:auto!important} #app{position:relative}`});
 const fake=(n,name)=>({clipName:name||'Video',sequenceName:'Seq',samples:Array.from({length:n},()=>({})),frameTicks:1,startTicks:0,source:'render',complete:true});
 const res={};
 async function state(name,o){
  await p.evaluate(([o,lang])=>{
   const $=id=>document.getElementById(id), T=window.__MT_TEST__;
   document.querySelectorAll('.mk,.callout,.arrow').forEach(e=>e.remove());
   document.querySelectorAll('.hl').forEach(e=>e.classList.remove('hl'));
   if(lang==='pt')$('langPT').click();else $('langEN').click();
   if(o.tab==='help')$('tab-help').click();else $('tab-main').click();
   window.SEL=o.sel;
   const c=$('chip-auto'); if(c.className.includes(' on')!==!!o.auto) c.click();
   T.setTrack(o.track||null); T.setSel(o.sel);
   const s=$('status'); if(o.msg){s.textContent=o.msg; s.className='status ok';}
   (o.hl||[]).forEach(id=>$(id).classList.add('hl'));
   const app=$('app').getBoundingClientRect();
   (o.mk||[]).forEach((id,i)=>{const r=document.querySelector(id).getBoundingClientRect();const m=document.createElement('div');m.className='mk';m.textContent=i+1;m.style.left=(r.left-app.left-7)+'px';m.style.top=(r.top-app.top+r.height/2-8)+'px';$('app').appendChild(m);});
   if(o.callout){const r=$(o.callout[0]).getBoundingClientRect();const a=document.createElement('div');a.className='arrow';a.style.left=(r.right-app.left-50)+'px';a.style.top=(r.bottom-app.top+4)+'px';a.style.height='16px';$('app').appendChild(a);
     const t=document.createElement('div');t.className='callout';t.textContent=o.callout[1];$('app').appendChild(t);t.style.left=(r.right-app.left-50-t.offsetWidth/2)+'px';t.style.top=(r.bottom-app.top+20)+'px';}
  },[o,lang]);
  await p.waitForTimeout(150);
  const h=await p.evaluate(()=>{let m=0;document.querySelectorAll('#app *').forEach(e=>{const r=e.getBoundingClientRect();if(r.height&&getComputedStyle(e).display!=='none'&&e.offsetParent!==null)m=Math.max(m,r.bottom);});return Math.ceil(m)+12;});
  const f=path.join(outDir,lang+'-'+name+'.png'); await p.screenshot({path:f,clip:{x:0,y:0,width:340,height:Math.max(h,o.minH||0)}}); res[name]=f;
 }
 const L=lang==='pt';
 await state('rastreie',{sel:1,auto:false,hl:['btn-main'],callout:['btn-main',L?'Clique aqui':'Click here'],minH:150});
 await state('ajuste',{sel:1,auto:false,track:fake(155),msg:L?'Rastreado com Sucesso!':'Tracked Successfully!',mk:['#seg-action','.checks','.every','#chip-auto']});
 await state('cole',{sel:1,auto:false,track:fake(155),msg:L?'Colado com Sucesso!':'Pasted Successfully!',hl:['btn-main']});
 await state('direto',{sel:1,auto:true,hl:['chip-auto','btn-main']});
 await state('varios',{sel:3,auto:false,track:[fake(60,'A'),fake(60,'B'),fake(60,'C')],msg:L?'3 clipes rastreados. Agora selecione os alvos e clique em Colar.':'3 clips tracked. Now select the targets and click Paste.',hl:['btn-main']});
 await state('ajuda',{tab:'help',sel:1,auto:false});
 await b.close(); return res;
};
