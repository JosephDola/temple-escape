import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const file=`standalone/TempleEscape-v${version}.html`,html=await fs.readFile(file,'utf8');
const resources=html.match(/<script id="temple-assets" type="application\/json">(.*?)<\/script>/s);
assert.ok(resources,'embedded resources');const assets=JSON.parse(resources[1]);assert.equal(Object.keys(assets).length,14);
for(const [name,url]of Object.entries(assets)){
 assert.ok(/^data:(model\/gltf-binary|image\/(jpeg|webp));base64,/.test(url),name);
 const bytes=Buffer.from(url.slice(url.indexOf(',')+1),'base64');assert.ok(bytes.length>1000,name);
 if(name.endsWith('.glb')){assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);const g=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));assert.ok(g.skins?.length>0,`${name} has a skeleton`);assert.ok(g.animations?.length>0,`${name} has animation clips`);
  for(const b of g.buffers||[])assert.ok(!b.uri||b.uri.startsWith('data:'),'no external GLB buffer');for(const i of g.images||[])assert.ok(!i.uri||i.uri.startsWith('data:'),'no external GLB texture');
 }
}
let scripts=0;for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(match[1].includes('application/json'))continue;new vm.Script(match[2]);scripts++;}
assert.equal(scripts,2);assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/http-equiv="refresh"|location\.replace\(|chatgpt\.site|TIME REMAINING|timerText|id="(?:minimap|journalMap|mapToggle|hudMap|touchMap)"|firebaseConfig|firebaseapp\.com|firebase-auth/.test(html));
const sha=createHash('sha256').update(html).digest('hex');assert.ok((await fs.readFile('standalone/SHA256SUMS.txt','utf8')).startsWith(sha));
console.log(`Verified ${file}: 14 embedded resources, skeletons/animations, valid scripts, no redirect/login dependency, no map, no timer, matching SHA-256.`);
