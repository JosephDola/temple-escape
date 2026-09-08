import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const directory=`.release/v${version}`,manifest=JSON.parse(await fs.readFile(`${directory}/manifest.json`,'utf8'));
if(manifest.version!==version)throw new Error('Release version does not match package.json');
const parts=[];for(let i=0;i<manifest.parts;i++)parts.push(await fs.readFile(`${directory}/part-${String(i).padStart(3,'0')}.b64`,'utf8'));
const html=gunzipSync(Buffer.from(parts.join(''),'base64'));
if(html.length!==manifest.bytes||createHash('sha256').update(html).digest('hex')!==manifest.sha256)throw new Error('Release data failed its checksum');
await fs.mkdir('standalone',{recursive:true});await fs.writeFile(`standalone/TempleEscape-v${version}.html`,html);
console.log(`Restored TempleEscape-v${version}.html (${html.length} bytes).`);
