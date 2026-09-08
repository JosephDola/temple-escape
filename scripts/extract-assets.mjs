import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const html=await fs.readFile(path.join(root,'standalone',`TempleEscape-v${version}.html`),'utf8');
const match=html.match(/<script id="temple-assets" type="application\/json">(.*?)<\/script>/s);
if(!match)throw new Error('Embedded asset collection was not found');
const assets=JSON.parse(match[1]);let count=0;
for(const [file,url] of Object.entries(assets)){
 if(!/^(models|textures)\/[\w./-]+$/.test(file)||file.split('/').includes('..'))throw new Error(`Invalid asset path: ${file}`);
 const target=path.join(root,'public',file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(url.slice(url.indexOf(',')+1),'base64'));count++;
}console.log(`Restored ${count} game resources from the standalone HTML.`);
