import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const filename=`TempleEscape-v${version}.html`;
let html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
const scriptRef=html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const cssRef=html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if(!scriptRef||!cssRef)throw new Error('Expected one bundled script and stylesheet');
const js=await fs.readFile(path.join(root,'dist',scriptRef[1]),'utf8');
new vm.Script(js,{filename:'temple-escape-bundle.js'});
const css=await fs.readFile(path.join(root,'dist',cssRef[1]),'utf8');
const assets={};
const files=['models/arms_rig.glb','models/maw-gooey.glb'];
for(const tier of ['1k','2k','4k'])for(const [kind,ext] of [['albedo','jpg'],['normal','webp'],['roughness','jpg'],['emissive','webp']])files.push(`textures/temple_custom/${kind}_${tier}.${ext}`);
const mime={'.glb':'model/gltf-binary','.jpg':'image/jpeg','.webp':'image/webp'};
for(const file of files){const data=await fs.readFile(path.join(root,'public',file));assets[file]=`data:${mime[path.extname(file)]};base64,${data.toString('base64')}`;}
const notices=await fs.readFile(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8');
const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
html=html.replace(scriptRef[0],'').replace(cssRef[0],()=>`<style>${css}</style>`);
html=html.replace('</body>',()=>`<script id="temple-assets" type="application/json">${JSON.stringify(assets)}</script>
<script id="temple-notices" type="application/json">${escapeScript(JSON.stringify(notices))}</script>
<script>window.__TEMPLE_ASSETS__=JSON.parse(document.getElementById('temple-assets').textContent);</script>
<script>${escapeScript(js)}</script></body>`);
if(/<script[^>]+src=|<link[^>]+href="(?!data:)/.test(html))throw new Error('Standalone file retains an external script or stylesheet');
const out=path.join(root,'standalone');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,filename),html);
const digest=createHash('sha256').update(html).digest('hex');await fs.writeFile(path.join(out,'SHA256SUMS.txt'),`${digest}  ${filename}\n`);
console.log(`${filename}: ${(Buffer.byteLength(html)/1048576).toFixed(2)} MiB; ${files.length} embedded assets; SHA256 ${digest}`);
