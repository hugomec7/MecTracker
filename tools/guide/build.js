const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const shots=require('./shots.js');
const [renderDir,outDir]=process.argv.slice(2);
const logo='file://'+path.join(renderDir,'logo.png');
const T={
pt:{file:'MecTracker-Guide_pt-br.pdf',title:'Guia de Uso',lead:'Transforme o tracking de máscara nativo do Premiere em keyframes de Transform, em poucos cliques. Para o Premiere Pro 2026.',
inst:'1. Instalar',win:'<li>Extraia o arquivo baixado.</li><li>Dê dois cliques em <code>Install-Windows.bat</code> e aceite o pedido de administrador.</li><li>Reinicie o Premiere Pro.</li>',
mac:'<li>Extraia o arquivo baixado.</li><li>Abra o Terminal, digite <code>bash</code> e arraste o <code>Install-Mac.command</code> para a janela; aperte Enter.</li><li>Reinicie o Premiere Pro.</li>',
box:'Para abrir o plugin: <b>Janela &gt; Plug-ins UXP &gt; Mec Tracker</b> (Window &gt; UXP Plugins). Instalação manual (Windows): copie a pasta <code>com.mectracker.v2</code> para <code>C:\\Program Files\\Common Files\\Adobe\\UXP\\Plugins\\External\\</code>.',
how:'2. Como usar',
s1t:'Prepare a máscara',s1:'No clipe que tem o objeto, crie uma máscara (retângulo, caneta ou Object Mask) e use o rastreio do próprio Premiere (<i>Track selected mask forward</i>) até o fim do clipe. A máscara pode ficar dentro do Opacity ou em <i>Unassigned Masks</i>.',
s2t:'Rastreie',s2:'Selecione o clipe na timeline e aperte <b>Rastrear</b> (caixa laranja). Espere a barra de progresso terminar. O botão <b>Colar</b> só aparece depois do rastreio: o botão azul é sempre o próximo passo.',
s3t:'Escolha o alvo',s3:'Selecione o texto, imagem ou gráfico que deve seguir o objeto (pode ser mais de um). Coloque a agulha da timeline no quadro em que ele já está bem posicionado.',
s4t:'Ajuste',s4:'<p><span class="m">1</span><b>Seguir</b>: o alvo acompanha o objeto. <b>Estabilizar</b>: o alvo faz o contrário, para deixar o objeto parado.</p><p><span class="m">2</span>Marque o que quer copiar: <b>Posição</b>, <b>Rotação</b> e/ou <b>Escala</b>.</p><p><span class="m">3</span><b>Um Keyframe a Cada</b>: escolha com − e +. 1 é o mais fiel; números maiores deixam o movimento mais suave, com menos keyframes.</p><p><span class="m">4</span><b>Colar Direto no Clipe de Cima</b>: veja as seções 3 e 4.</p>',
s5t:'Cole',s5:'Aperte <b>Colar</b> (caixa laranja), que agora é o botão azul. O Mec Tracker cria o efeito <b>Transform</b> (Uniform Scale ligado, Shutter Angle 360) com os keyframes sozinho. Em clipes de gráfico, ele fica logo acima do componente Text. Dá para selecionar vários alvos e colar em todos de uma vez. Para rastrear outro clipe, use o botão cinza <b>Rastrear</b>, em cima.',
d:'3. Colar Direto no Clipe de Cima',dt:'<p>Marque <b>Colar Direto no Clipe de Cima</b> e o botão vira <b>Rastrear e Colar</b>. Com um clique, o Mec Tracker rastreia o clipe com a máscara e já cola os keyframes no clipe da trilha mais próxima acima dele (por exemplo, o texto em cima do vídeo), usando as opções que você escolheu.</p><p>Se houver vários clipes acima nesse trecho, cola em todos. Se não houver nada acima, ele avisa e guarda o rastreio: desmarque a caixa e o botão <b>Colar</b> aparece para você colar manualmente. A posição do alvo é ancorada na agulha (quando ela está dentro do clipe rastreado) ou no início do clipe.</p>',
v:'4. Vários clipes de uma vez',vt:'<p>Selecione na timeline vários clipes com máscara. O que acontece depende da caixa <b>Colar Direto no Clipe de Cima</b>:</p><p><span class="m">A</span><b>Desligada</b>: <b>Rastrear</b> rastreia todos, um por vez, e guarda os rastreios. Depois selecione os alvos e aperte <b>Colar</b>. Cada alvo recebe o rastreio do clipe com que ele mais coincide no tempo; um alvo que não coincide com nenhum é pulado.</p><p><span class="m">B</span><b>Ligada</b>: <b>Rastrear e Colar</b> rastreia cada clipe e cola no clipe da trilha logo acima dele.</p><p>Os botões mostram quantos clipes estão selecionados (por exemplo, <b>Rastrear 3 Clipes</b> ou <b>Colar em 3 Clipes</b>), para você confirmar antes de clicar.</p><p>A barra mostra em qual clipe ele está, e o <b>Cancelar</b> para tudo (o que já foi feito fica).</p>',
vl:'<li>Com a caixa ligada, pode selecionar os textos/Nests junto: eles são tratados como alvo, não como clipe a rastrear.</li><li>Clipe sem máscara ou sem nada em cima é pulado; o Registro mostra o motivo.</li><li>Um texto que passa por cima de um corte vai só para o clipe que ele cobre mais.</li><li>No <b>Rastrear e Colar</b>, cada clipe usa o seu primeiro quadro como referência. No <b>Colar</b>, vale a agulha quando ela está dentro do trecho; se não, o início do trecho em comum.</li>',
h:'5. A aba Ajuda',ht:'Os mesmos passos rápidos estão dentro do plugin, na aba <b>Ajuda</b>. Ela também tem o <b>Registro</b>: se algo der errado, abra o Registro, clique em <b>Copiar</b> e envie para o criador.',
t:'6. Dicas e problemas',tl:'<li>Depois de rastrear, a faixa verde em cima dos botões mostra o rastreio copiado; <b>Descartar</b> apaga ele.</li><li><b>Ocultar opções</b> recolhe Posição, Rotação, Escala e o intervalo e deixa só um resumo; <b>Mostrar opções</b> abre de novo.</li><li>Se a máscara estiver em <i>Unassigned Masks</i>, salve o projeto (Ctrl+S) antes de rastrear. O plugin lê a máscara do arquivo do projeto.</li><li>O idioma, as opções, o intervalo e o Colar Direto ficam salvos para a próxima vez que abrir o Premiere.</li><li>Clipes com velocidade alterada (diferente de 100%) ainda não são suportados como alvo.</li><li>Com vários clipes, o Ctrl+Z desfaz um clipe por vez.</li><li>Clique em qualquer mensagem do painel para copiar o texto.</li>',
by:'Criado por Hugo Mec · Twitter @hugoeditor_'},
en:{file:'MecTracker-Guide_en-us.pdf',title:'User Guide',lead:"Turn Premiere's native mask tracking into Transform keyframes, in a few clicks. For Premiere Pro 2026.",
inst:'1. Install',win:'<li>Unzip the download.</li><li>Double-click <code>Install-Windows.bat</code> and accept the administrator prompt.</li><li>Restart Premiere Pro.</li>',
mac:'<li>Unzip the download.</li><li>Open Terminal, type <code>bash</code> and drag <code>Install-Mac.command</code> into the window, then press Enter.</li><li>Restart Premiere Pro.</li>',
box:'Open the plugin in Premiere: <b>Window &gt; UXP Plugins &gt; Mec Tracker</b>. Manual install (Windows): copy the folder <code>com.mectracker.v2</code> to <code>C:\\Program Files\\Common Files\\Adobe\\UXP\\Plugins\\External\\</code>.',
how:'2. How to use',
s1t:'Prepare the mask',s1:"On the clip that has the object, create a mask (rectangle, pen or Object Mask) and use Premiere's own tracking (<i>Track selected mask forward</i>) until the end of the clip. The mask can stay inside Opacity or in <i>Unassigned Masks</i>.",
s2t:'Track',s2:'Select the clip on the timeline and press <b>Track</b> (orange box). Wait for the progress bar to finish. The <b>Paste</b> button only shows up after tracking: the blue button is always the next step.',
s3t:'Pick the target',s3:'Select the text, image or graphic that should follow the object (it can be more than one). Park the timeline playhead on the frame where it is already placed correctly.',
s4t:'Adjust',s4:'<p><span class="m">1</span><b>Follow</b>: the target follows the object. <b>Stabilize</b>: the target does the opposite, to hold the object still.</p><p><span class="m">2</span>Tick what to copy: <b>Position</b>, <b>Rotation</b> and/or <b>Scale</b>.</p><p><span class="m">3</span><b>One Keyframe Every</b>: use − and +. 1 is the most accurate; higher numbers give smoother motion with fewer keyframes.</p><p><span class="m">4</span><b>Paste Straight to Clip Above</b>: see sections 3 and 4.</p>',
s5t:'Paste',s5:'Press <b>Paste</b> (orange box), which is now the blue button. Mec Tracker creates the <b>Transform</b> effect (Uniform Scale on, Shutter Angle 360) with the keyframes for you. On graphics clips it is placed right above the Text component. You can select several targets and paste on all of them at once. To track another clip, use the grey <b>Track</b> button on top.',
d:'3. Paste Straight to Clip Above',dt:'<p>Tick <b>Paste Straight to Clip Above</b> and the button becomes <b>Track &amp; Paste</b>. With one click, Mec Tracker tracks the masked clip and immediately pastes the keyframes onto the clip on the nearest track above it (for example, the text over the video), using the options you chose.</p><p>If there are several clips above at that time, it pastes on all of them. If there is nothing above, it tells you and keeps the track: untick the box and the <b>Paste</b> button shows up so you can paste manually. Where the target ends up is anchored to the playhead (when it is inside the tracked clip) or to the start of the clip.</p>',
v:'4. Several clips at once',vt:'<p>Select several masked clips on the timeline. What happens depends on the <b>Paste Straight to Clip Above</b> box:</p><p><span class="m">A</span><b>Off</b>: <b>Track</b> tracks all of them, one at a time, and keeps the tracks. Then select the targets and press <b>Paste</b>. Each target gets the track of the clip it overlaps most in time; a target that overlaps none is skipped.</p><p><span class="m">B</span><b>On</b>: <b>Track &amp; Paste</b> tracks each clip and pastes onto the clip on the track right above it.</p><p>The buttons show how many clips are selected (for example, <b>Track 3 Clips</b> or <b>Paste to 3 Clips</b>), so you can confirm before clicking.</p><p>The bar shows which clip it is on, and <b>Cancel</b> stops everything (what was already done stays).</p>',
vl:'<li>With the box on, you can select the texts/Nests too: they are used as targets, not tracked.</li><li>A clip with no mask or nothing above it is skipped; the Log says why.</li><li>A text that crosses a cut goes only to the clip it covers the most.</li><li>In <b>Track &amp; Paste</b>, each clip uses its first frame as the reference. In <b>Paste</b>, the playhead counts when it is inside the shared stretch; otherwise, the start of that stretch.</li>',
h:'5. The Help tab',ht:'The same quick steps are inside the plugin, in the <b>Help</b> tab. It also has the <b>Log</b>: if something goes wrong, open the Log, click <b>Copy</b> and send it to the creator.',
t:'6. Tips and troubleshooting',tl:'<li>After tracking, the green strip above the buttons shows the copied track; <b>Discard</b> clears it.</li><li><b>Hide options</b> folds Position, Rotation, Scale and the interval, leaving just a summary; <b>Show options</b> opens them again.</li><li>If the mask is in <i>Unassigned Masks</i>, save the project (Ctrl+S) before tracking. The plugin reads the mask from the project file.</li><li>The language, options, interval and Paste Straight are remembered the next time you open Premiere.</li><li>Clips with changed speed (not 100%) are not supported as a target yet.</li><li>With several clips, Ctrl+Z undoes one clip at a time.</li><li>Click any message in the panel to copy its text.</li>',
by:'Created by Hugo Mec · Twitter @hugoeditor_'}};
const css=`@page{size:A4;margin:0} *{box-sizing:border-box} body{margin:0;font-family:Inter,Arial;color:#1d1d1f;font-size:9.6pt;line-height:1.5}
.page{width:210mm;height:297mm;padding:16mm 15mm;page-break-after:always;overflow:hidden;position:relative}
.logo{height:22px} h1{font-size:25pt;margin:6px 0 4px;font-weight:700;letter-spacing:-.3px} .lead{color:#6e6e73;font-size:11pt;margin:0 0 18px}
h2{font-size:15pt;margin:20px 0 8px;font-weight:600} h3{font-size:10.5pt;margin:0 0 4px} p{margin:0 0 7px}
.cols{display:flex;gap:26px} .cols>div{flex:1} ul{margin:4px 0 0;padding-left:16px} li{margin-bottom:4px}
code{font-family:"DejaVu Sans Mono",monospace;font-size:8.4pt;background:#f2f2f4;padding:1px 4px;border-radius:4px}
.box{background:#f2f2f4;border-radius:10px;padding:12px 16px;margin:16px 0 4px}
.box code{background:none;padding:0}
.step{display:flex;gap:18px;margin:12px 0 18px;align-items:flex-start} .step .txt{flex:1}
.n{display:inline-block;width:17px;height:17px;border-radius:9px;background:#0a84ff;color:#fff;font-size:8.5pt;font-weight:700;text-align:center;line-height:17px;margin-right:8px}
.m{display:inline-block;width:14px;height:14px;border-radius:7px;background:#ff9f0a;color:#1c1c1e;font-size:7.5pt;font-weight:700;text-align:center;line-height:14px;margin-right:5px;vertical-align:1px}
.shot{width:62mm;flex:none;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.shot.big{width:66mm} .foot{color:#6e6e73;font-size:8.5pt;margin-top:16px}`;
(async()=>{
 for(const lang of ['pt','en']){
  const S=await shots(renderDir,outDir,lang), t=T[lang], im=k=>`<img class="shot" src="file://${S[k]}">`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="page"><img class="logo" src="${logo}"><h1>${t.title}</h1><p class="lead">${t.lead}</p>
<h2>${t.inst}</h2><div class="cols"><div><h3>Windows</h3><ul>${t.win}</ul></div><div><h3>Mac</h3><ul>${t.mac}</ul></div></div>
<div class="box">${t.box}</div>
<h2>${t.how}</h2>
<div class="step"><div class="txt"><h3><span class="n">1</span>${t.s1t}</h3><p>${t.s1}</p></div></div>
<div class="step"><div class="txt"><h3><span class="n">2</span>${t.s2t}</h3><p>${t.s2}</p></div>${im('rastreie')}</div>
<div class="step"><div class="txt"><h3><span class="n">3</span>${t.s3t}</h3><p>${t.s3}</p></div></div></div>
<div class="page">
<div class="step"><div class="txt"><h3><span class="n">4</span>${t.s4t}</h3>${t.s4}</div>${im('ajuste')}</div>
<div class="step"><div class="txt"><h3><span class="n">5</span>${t.s5t}</h3><p>${t.s5}</p></div>${im('cole')}</div>
<div class="step"><div class="txt"><h2 style="margin-top:0">${t.d}</h2>${t.dt}</div>${im('direto')}</div></div>
<div class="page">
<div class="step"><div class="txt"><h2 style="margin-top:0">${t.v}</h2>${t.vt}<ul>${t.vl}</ul></div>${im('varios')}</div>
</div>
<div class="page"><div class="step"><div class="txt"><h2 style="margin-top:0">${t.h}</h2><p>${t.ht}</p><h2>${t.t}</h2><ul>${t.tl}</ul><p class="foot">${t.by}</p></div>${im('ajuda')}</div></div>
</body></html>`;
  const hf=path.join(outDir,lang+'.html'); fs.writeFileSync(hf,html);
  const b=await chromium.launch(), p=await b.newPage(); await p.goto('file://'+hf); await p.waitForTimeout(300);
  await p.pdf({path:path.join(outDir,t.file),format:'A4',printBackground:true,preferCSSPageSize:true}); await b.close();
  console.log('ok',t.file);
 }
})();
