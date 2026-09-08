import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL, PLAYER_HEIGHT, CROUCH_HEIGHT, VENT_HEIGHT, TOTAL, DIRS, makeMaze, seededRandom, findPath, farthestCell, chooseCrystals, horizontalDistance, overlapsBox, lineClear, trapHits, updateStamina, makeVents, navigationPath, bodyBlocked, corridorClear, sightClear, slideBody, updateHunter } from './world.js';
import {createPipeline,createFlashlight,skinCreature} from './presentation.js';
import {createNavigation,advanceHunter} from './hunter.js';
import './style.css';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['menu','settings','pause','endScreen','hud','playBtn','playLabel','loadStatus','reloadBtn','settingsBtn','settingsClose','resumeBtn','quitBtn','retryBtn','endMenuBtn','qualitySelect','shakeToggle','audioToggle','armsToggle','sensitivity','sensitivityValue','brightness','brightnessValue','crystalCount','objectiveText','batteryText','batteryBar','staminaBar','healthText','healthBar','prompt','warning','minimap','platformTag','endTitle','endText','endEyebrow','runStats','toast','pauseHint','pauseSettingsBtn','hudPause','touchJump','touchCollect','touchFlash'].map(id=>[id,$(id)]));
const storage = {get(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,String(value));}catch{}}};
const optionDefaults={renderScale:'100',textureSelect:'auto',shadowSelect:'auto',fov:'76',fogAmount:'100',sharpness:'0.25',volume:'65',skinSelect:'basalt',aaToggle:true,bloomToggle:false,aoToggle:false,grainToggle:false,mapToggle:false,reducedScareToggle:false};
for(const [id,fallback]of Object.entries(optionDefaults)){ui[id]=$(id);const value=storage.get(`temple.${id}`,String(fallback));if(typeof fallback==='boolean')ui[id].checked=value==='true';else ui[id].value=value;}
const options=()=>({aa:ui.aaToggle.checked,bloom:ui.bloomToggle.checked,ao:ui.aoToggle.checked,grain:ui.grainToggle.checked,sharpness:Number(ui.sharpness.value)});
ui.qualitySelect.value=storage.get('temple.quality','auto');
if(!ui.qualitySelect.value)ui.qualitySelect.value='auto';
ui.shakeToggle.checked=storage.get('temple.shake',matchMedia('(prefers-reduced-motion: reduce)').matches?'0':'1')==='1';
ui.audioToggle.checked=storage.get('temple.audio','1')==='1';
ui.armsToggle.checked=storage.get('temple.arms','1')==='1';
ui.sensitivity.value=storage.get('temple.sensitivity','1');
ui.brightness.value=storage.get('temple.brightness','1.1');
ui.sensitivityValue.value=Number(ui.sensitivity.value).toFixed(1);
ui.brightnessValue.value=Number(ui.brightness.value).toFixed(1);
const touchMode=matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch-mode',touchMode);
if(touchMode)ui.platformTag.textContent='DRAG THE RIGHT SIDE TO LOOK';
const PRESETS={legacy:{ratio:1,shadows:false,decor:.18,fog:.044,roofDetail:.4,lights:2},balanced:{ratio:1.25,shadows:true,decor:.3,fog:.042,roofDetail:.7,lights:3},high:{ratio:1.5,shadows:true,decor:.4,fog:.04,roofDetail:1,lights:4},ultra:{ratio:1.75,shadows:true,decor:.55,fog:.038,roofDetail:1,lights:5}};
const qualityKey=()=>ui.qualitySelect.value==='auto'?'legacy':ui.qualitySelect.value;
const textureTier=()=>ui.textureSelect.value!=='auto'?ui.textureSelect.value:['high','ultra'].includes(qualityKey())?'4k':qualityKey()==='balanced'?'2k':'1k';
const H=4;
const keys=new Set(),mini=ui.minimap.getContext('2d');
const materialCache=new Map();
let state='loading',renderer,scene,camera,menuCamera,guardian,guardianMixer,armsMixer,armsRoot,portal,portalLight,clock;
let guardianActions={},guardianActionName='',guardianCell,guardianNext=null,brain={mode:'patrol',target:null,lastSeen:null,memory:0};
let maze,collisionProps=[],crystals=[],trapCells=[],sconces=[],lightPool=[],dust;
let yaw=0,pitch=0,elapsed=0,collected=0,footstepTimer=0,headBob=0,rng=Math.random,seed=0;
let vents=[],lowAreas=[],pipeline=null,flashlight=null,flashGrip=null,guardianModel=null,guardianBones=[],navRoute=[],navGoal=null,navCooldown=0,navStuck=0,guardianCrawl=0;
let noisePulse=0,ambientTimer=12,heartbeat=0,threat=0,scare=null,mapHeld=false,visited=new Set(),frameCounter=0,frameClock=0,framesPerSecond=0,lastFrameTime=0;
let hunterNavigation=createNavigation();
let graphicsUsed='',loadedTier='',ready=false,starting=false,modelAssetsLoaded=false,settingsReturn=null,toastUntil=0,uiTime=0,lightTime=0;
let guardianAwake=false,raf=0,menuTime=0,hitUntil=0;
const player={p:new THREE.Vector3(),v:new THREE.Vector3(),vy:0,ground:true,health:100,stamina:100,battery:100,cool:0,speed:0,exhausted:false,running:false,light:true};
const assets={wall:{},guardianTemplate:null,guardianClips:{},armsTemplate:null,armsClip:null};
const loaders={texture:new THREE.TextureLoader(),gltf:new GLTFLoader()};
const path=(a,b)=>findPath(maze,a,b);
const wpos=(c,y=0)=>new THREE.Vector3((c.c-(maze.length-1)/2)*CELL,y,(c.r-(maze.length-1)/2)*CELL);
const cellAt=p=>maze[Math.max(0,Math.min(maze.length-1,Math.round(p.z/CELL+(maze.length-1)/2)))][Math.max(0,Math.min(maze.length-1,Math.round(p.x/CELL+(maze.length-1)/2)))];
function randomCells(n,ban=[]){const excluded=new Set(ban),cells=maze.flat().filter(c=>!excluded.has(c));for(let i=cells.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}return cells.slice(0,n);}
function sharedMaterial(key,props){if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial(props));return materialCache.get(key);}

let audioContext,master,drone;
function audioStart(){
 if(!ui.audioToggle.checked)return;
 try{if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();master=audioContext.createGain();master.gain.value=.16;master.connect(audioContext.destination);drone=audioContext.createOscillator();const gain=audioContext.createGain();gain.gain.value=.038;drone.type='triangle';drone.frequency.value=48;drone.connect(gain).connect(master);drone.start();}if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}
}
function audioState(){if(master)master.gain.setTargetAtTime(ui.audioToggle.checked&&['playing','scare'].includes(state)?Number(ui.volume.value)/100*.25:0,audioContext.currentTime,.15);}
function tone(freq,duration=.16,gain=.08,type='sine',pan=0){if(!ui.audioToggle.checked||!audioContext||audioContext.state!=='running')return;const o=audioContext.createOscillator(),g=audioContext.createGain(),p=audioContext.createStereoPanner();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.001,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(gain,audioContext.currentTime+.015);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);p.pan.value=Math.max(-1,Math.min(1,pan));o.connect(g).connect(p).connect(master);o.start();o.stop(audioContext.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};}
function noise(duration,level,frequency,pan=0){
 if(!ui.audioToggle.checked||!audioContext||audioContext.state!=='running')return;
 const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5);
 const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),panner=audioContext.createStereoPanner();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.65;gain.gain.value=level;panner.pan.value=THREE.MathUtils.clamp(pan,-1,1);source.connect(filter).connect(gain).connect(panner).connect(master);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
}
function sfx(kind,pan=0){
 if(kind==='crystal'){tone(520,.22,.10);setTimeout(()=>tone(780,.45,.07),90);}
 else if(kind==='portal'){tone(130,1,.08,'triangle');tone(390,1.2,.1);}
 else if(kind==='step'){noise(.11,.17,player.running?340:240,pan);tone(72,.07,.025,'triangle');}
 else if(kind==='crawl'||kind==='scrape'){noise(.24,kind==='crawl'?.12:.2,820,pan);tone(145,.12,.025,'triangle',pan);}
 else if(kind==='guardian'){noise(.22,.24,160,pan);tone(48,.22,.06,'triangle',pan);}
 else if(kind==='heartbeat'){tone(48,.16,.06);setTimeout(()=>tone(55,.12,.035),130);}
 else if(kind==='distant'){noise(.9,.15,440,pan);tone(73,.8,.06,'triangle',pan);}
 else if(kind==='threat'){tone(44,.8,.08,'triangle');noise(.8,.08,740);}
 else if(kind==='capture'){noise(.85,ui.reducedScareToggle.checked?.22:.5,1100);tone(61,1.2,.18,'sawtooth');tone(93,.8,.09,'triangle');}
 else if(kind==='switch')noise(.05,.06,1600);
}
function assetUrl(path){return window.__TEMPLE_ASSETS__?.[path]??`${import.meta.env.BASE_URL}${path}`;}
function loadTexture(path,srgb=false){return new Promise(resolve=>loaders.texture.load(assetUrl(path),t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=2;if(srgb)t.colorSpace=THREE.SRGBColorSpace;resolve(t);},undefined,()=>resolve(null)));}
function loadGLB(file){return loaders.gltf.loadAsync(assetUrl(`models/${file}`)).catch(error=>{console.warn('Model unavailable',file,error);return null;});}
async function loadAssets(){
 const tier=textureTier();
 if(loadedTier!==tier){const maps=await Promise.all([loadTexture(`textures/temple_custom/albedo_${tier}.jpg`,true),loadTexture(`textures/temple_custom/normal_${tier}.webp`),loadTexture(`textures/temple_custom/roughness_${tier}.jpg`),loadTexture(`textures/temple_custom/emissive_${tier}.webp`,true)]);Object.values(assets.wall).forEach(t=>t?.dispose());assets.wall={diffuse:maps[0],normal:maps[1],rough:maps[2],emissive:maps[3]};loadedTier=tier;}
 if(!modelAssetsLoaded){ui.loadStatus.textContent='Restoring the creature and equipment…';const [creature,arms]=await Promise.all([loadGLB('maw-gooey.glb'),loadGLB('arms_rig.glb')]);
  if(!creature||!arms)throw new Error('Required character assets could not load');
  assets.guardianTemplate=creature.scene;assets.guardianClips={idle:creature.animations.find(c=>c.name==='IdleFinal'),walk:creature.animations.find(c=>c.name==='Walk'),run:creature.animations.find(c=>c.name==='Walk'),attack:creature.animations.find(c=>c.name==='Attack')};
  assets.armsTemplate=arms.scene;assets.armsClip=arms.animations.find(c=>c.name==='knife_idle');modelAssetsLoaded=true;
 }
}

function copyTexture(tex, rx = 1, ry = 1) {
  if (!tex) return null;
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
function makeWallMaterial(rx = 1, ry = 1) {
  const key = `wall:${rx}:${ry}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8d897b,
    map: copyTexture(assets.wall.diffuse, rx, ry),
    normalMap: copyTexture(assets.wall.normal, rx, ry),
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughnessMap: copyTexture(assets.wall.rough, rx, ry),
    emissiveMap: copyTexture(assets.wall.emissive, rx, ry),
    emissive: new THREE.Color(0x28d9d0),
    emissiveIntensity: 0.065,
    roughness: 0.92,
    metalness: 0.025,
  });
  materialCache.set(key, material);
  return material;
}
function makeFloorMaterial(rx = 12, ry = 12) {
  return new THREE.MeshStandardMaterial({
    color: 0x5d655c,
    map: copyTexture(assets.wall.diffuse, rx, ry),
    normalMap: copyTexture(assets.wall.normal, rx, ry),
    normalScale: new THREE.Vector2(.32,.32),
    roughness: 0.89,
    metalness: 0.015,
    roughnessMap: copyTexture(assets.wall.rough, rx, ry),
  });
}
function makeRoofMaterial(rx = 2, ry = 2) {
  const mat = makeWallMaterial(rx, ry).clone();
  mat.color = new THREE.Color(0x48524f);
  mat.normalScale.set(0.48, 0.48);
  mat.emissiveIntensity = 0.025;
  mat.roughness = 0.97;
  return mat;
}

function addCollisionBox(x, z, w, d, y1=0, y2=H) {
  collisionProps.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2, y1, y2 });
}
function box(x, y, z, w, h, d, material, collide = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  if (collide) addCollisionBox(x, z, w, d, y-h/2, y+h/2);
  return mesh;
}
function addSconce(pos, rot = 0) {
  const base = new THREE.Group();
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.12), sharedMaterial('bracket', { color: 0x665642, metalness: 0.45, roughness: 0.6 }));
  bracket.position.z = 0.05;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.42, 6), sharedMaterial('lamp', { color: 0xf0cda2, emissive: 0xe4a267, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.6 }));
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(0, 0.05, 0.16);
  base.add(bracket, lamp);
  base.position.copy(pos);
  base.rotation.y = rot;
  scene.add(base);
  sconces.push(pos.clone());
}
function addPillar(x, z) {
  const mat = makeWallMaterial(1, 2);
  box(x, 1.4, z, 0.7, 2.8, 0.7, mat, true);
  box(x, 3.0, z, 0.9, 0.18, 0.9, mat, true);
}
function buildWallKit() {
  const wallMatLong = makeWallMaterial(2, 1);
  const wallMatTall = makeWallMaterial(1, 2);
  maze.flat().forEach((c) => {
    const p = wpos(c);
    if (c.n && !c.vents?.n) {
      box(p.x, H / 2, p.z - CELL / 2, CELL + 0.3, H, 0.3, wallMatLong);
      if (rng() > 0.55) addSconce(new THREE.Vector3(p.x + (rng() - 0.5) * 1.6, 2, p.z - CELL / 2 + 0.16), 0);
    }
    if (c.w && !c.vents?.w) {
      box(p.x - CELL / 2, H / 2, p.z, 0.3, H, CELL + 0.3, wallMatTall);
      if (rng() > 0.55) addSconce(new THREE.Vector3(p.x - CELL / 2 + 0.16, 2, p.z + (rng() - 0.5) * 1.6), Math.PI / 2);
    }
    if (c.r === maze.length - 1 && c.s) box(p.x, H / 2, p.z + CELL / 2, CELL + 0.3, H, 0.3, wallMatLong);
    if (c.c === maze.length - 1 && c.e) box(p.x + CELL / 2, H / 2, p.z, 0.3, H, CELL + 0.3, wallMatTall);

    if (c.n && c.w && (c.r + c.c) % 3 === 0) addPillar(p.x - 1.5, p.z - 1.5);
  });
}


function buildVents(){
 const metal=sharedMaterial('duct-metal',{color:0x555c53,metalness:.64,roughness:.62}),seam=sharedMaterial('duct-seam',{color:0x917c59,metalness:.64,roughness:.48});
 for(const vent of vents){const pa=wpos(vent.a),pb=wpos(vent.b),mid=pa.clone().add(pb).multiplyScalar(.5),alongX=vent.dir==='e',width=1.28,length=2.2;
  const part=(u,y,v,w,h,d,mat,collide=true)=>alongX?box(mid.x+v,y,mid.z+u,d,h,w,mat,collide):box(mid.x+u,y,mid.z+v,w,h,d,mat,collide);
  const jamb=(CELL+.3-width)/2;part(-(width+jamb)/2,H/2,0,jamb,H,.3,makeWallMaterial());part((width+jamb)/2,H/2,0,jamb,H,.3,makeWallMaterial());
  part(0,(H+VENT_HEIGHT)/2,0,width,H-VENT_HEIGHT,.3,makeWallMaterial());
  part(0,VENT_HEIGHT+.06,0,width+.2,.12,length,metal);part(0,.02,0,width,.035,length,metal,false);
  part(-width/2-.04,VENT_HEIGHT/2,0,.08,VENT_HEIGHT,length,metal);part(width/2+.04,VENT_HEIGHT/2,0,.08,VENT_HEIGHT,length,metal);
  for(let j=-1;j<=1;j++){const depth=j*.95;part(0,VENT_HEIGHT-.03,depth,width,.04,.045,seam,false);part(-width/2+.018,VENT_HEIGHT/2,depth,.03,VENT_HEIGHT,.045,seam,false);part(width/2-.018,VENT_HEIGHT/2,depth,.03,VENT_HEIGHT,.045,seam,false);}
  // Warm markers make the low opening findable in flashlight darkness.
  const marker=sharedMaterial('vent-marker',{color:0xbca77b,emissive:0xa4793d,emissiveIntensity:.38,roughness:.8});
  part(0,1.38,alongX?-.18:-.18,.4,.095,.025,marker,false);part(0,1.38,.18,.4,.095,.025,marker,false);
  lowAreas.push({x1:mid.x-(alongX?length:width)/2,x2:mid.x+(alongX?length:width)/2,z1:mid.z-(alongX?width:length)/2,z2:mid.z+(alongX?width:length)/2,vent,center:mid});
 }
}
function ventAt(pos,margin=0){return lowAreas.find(b=>overlapsBox(b,pos.x,pos.z,margin));}
function buildAtmosphere(q){
 const pipeMat=sharedMaterial('pipe',{color:0x625940,metalness:.7,roughness:.6});
 const damp=sharedMaterial('damp',{color:0x192526,roughness:.28,metalness:.28,transparent:true,opacity:.68});
 for(const c of maze.flat()){
  const p=wpos(c);
  if(c.room||rng()<q.decor){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,3.65,8),pipeMat);pipe.rotation.z=Math.PI/2;pipe.position.set(p.x,3.36,p.z+1.38);scene.add(pipe);
   const stain=new THREE.Mesh(new THREE.CircleGeometry(.7+rng()*.5,11),damp);stain.rotation.x=-Math.PI/2;stain.scale.y=.42;stain.position.set(p.x+.75,.012,p.z-.8);scene.add(stain);
  }
  if(c.room){for(let i=0;i<3;i++){const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.11+rng()*.07,0),makeRoofMaterial());stone.position.set(p.x+1.25+rng()*.25,.07,p.z-.75+rng()*.4);stone.scale.y=.5;scene.add(stone);}}
 }
}
function applyGraphics(){
 if(!renderer||!camera)return;const q=PRESETS[qualityKey()];
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio)*Number(ui.renderScale.value)/100);renderer.setSize(innerWidth,innerHeight);
 renderer.toneMappingExposure=Number(ui.brightness.value);camera.fov=Number(ui.fov.value);camera.updateProjectionMatrix();
 const shadowChoice=ui.shadowSelect.value;const shadows=shadowChoice==='auto'?q.shadows:shadowChoice!=='off';const size=shadowChoice==='auto'?(qualityKey()==='ultra'?2048:1024):Number(shadowChoice)||512;
 renderer.shadowMap.enabled=shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;const flash=camera.userData.flash;flash.castShadow=shadows;
 if(flash.shadow.mapSize.x!==size){flash.shadow.map?.dispose();flash.shadow.map=null;flash.shadow.mapSize.set(size,size);}flash.shadow.needsUpdate=true;
 scene.fog.density=q.fog*Number(ui.fogAmount.value)/100;
 pipeline?.dispose();pipeline=createPipeline(renderer,scene,camera,options());
 document.body.classList.toggle('show-map',ui.mapToggle.checked||mapHeld);
 skinCreature(guardianModel,ui.skinSelect.value);
}

function buildTempleRoof(q) {
  const roofMat = makeRoofMaterial(2, 2);
  const beamMat = makeRoofMaterial(1, 1);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x202a29,
    roughness: 0.83,
    metalness: 0.08,
    emissive: 0x0a5f5b,
    emissiveIntensity: 0.12,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x75fff4,
    emissive: 0x25ded5,
    emissiveIntensity: qualityKey() === 'legacy' ? 0.8 : 1.45,
    roughness: 0.32,
    metalness: 0.18,
  });

  // Dark backing above the coffers so there are never visible gaps.
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(maze.length * CELL + 4, maze.length * CELL + 4),
    new THREE.MeshStandardMaterial({ color: 0x050b0c, roughness: 1, side: THREE.DoubleSide })
  );
  backing.position.y = H + 0.48;
  backing.rotation.x = Math.PI / 2;
  scene.add(backing);

  maze.flat().forEach((c, index) => {
    const p = wpos(c);

    // Recessed stone ceiling panel per temple cell.
    const panel = new THREE.Mesh(new THREE.BoxGeometry(CELL - 0.42, 0.14, CELL - 0.42), roofMat);
    panel.position.set(p.x, H + 0.34, p.z);
    panel.receiveShadow = true;
    scene.add(panel);

    if (rng() < q.roofDetail) {
      // Cross ribs form a heavy carved temple ceiling.
      const ribX = new THREE.Mesh(new THREE.BoxGeometry(CELL - 0.24, 0.24, 0.22), beamMat);
      ribX.position.set(p.x, H + 0.06, p.z);
      ribX.castShadow = ribX.receiveShadow = true;
      scene.add(ribX);

      const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, CELL - 0.24), beamMat);
      ribZ.position.set(p.x, H + 0.06, p.z);
      ribZ.castShadow = ribZ.receiveShadow = true;
      scene.add(ribZ);
    }

    if (qualityKey() !== 'legacy' && index % 3 === 0) {
      // Raised stepped medallion makes the roof read as a designed temple, not a flat maze lid.
      const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.86, 0.18, 8), trimMat);
      medallion.position.set(p.x, H - 0.03, p.z);
      medallion.rotation.x = Math.PI;
      medallion.castShadow = medallion.receiveShadow = true;
      scene.add(medallion);

      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), runeMat);
      rune.scale.set(1.15, 0.28, 1.15);
      rune.position.set(p.x, H - 0.16, p.z);
      scene.add(rune);
    }
  });

  // Continuous structural beams break up long sightlines and create a monumental roof grid.
  const span = maze.length * CELL + 0.3;
  for (let i = 0; i <= maze.length; i += qualityKey() === 'legacy' ? 2 : 1) {
    const offset = (i - maze.length / 2) * CELL;
    const beamA = new THREE.Mesh(new THREE.BoxGeometry(span, 0.34, 0.34), beamMat);
    beamA.position.set(0, H + 0.12, offset);
    beamA.castShadow = beamA.receiveShadow = true;
    scene.add(beamA);

    const beamB = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, span), beamMat);
    beamB.position.set(offset, H + 0.12, 0);
    beamB.castShadow = beamB.receiveShadow = true;
    scene.add(beamB);
  }

  // Sparse teal ceiling channels tie the roof into the crystal/rune language.
  const stripeCount = qualityKey() === 'legacy' ? 4 : (qualityKey() === 'balanced' ? 8 : 12);
  const stripeCells = randomCells(stripeCount);
  stripeCells.forEach((c, i) => {
    const p = wpos(c);
    const horizontal = i % 2 === 0;
    const channel = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 1.5 : 0.055, 0.035, horizontal ? 0.055 : 1.5),
      runeMat
    );
    channel.position.set(p.x, H - 0.19, p.z);
    scene.add(channel);
  });

  // Half-round carved stone arches at selected open passages.
  // These visually carry the roof weight and make corridors feel like a real temple.
  const archTarget = qualityKey() === 'legacy' ? 5 : (qualityKey() === 'balanced' ? 9 : 14);
  let archCount = 0;
  const archCandidates = randomCells(maze.length * maze.length);
  for (const c of archCandidates) {
    if (archCount >= archTarget) break;
    const p = wpos(c);
    let arch = null;

    if (!c.e && c.c < maze.length - 1 && rng() > 0.45) {
      arch = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.14, 6, 18, Math.PI), trimMat);
      arch.position.set(p.x + CELL / 2, 2.72, p.z);
      arch.rotation.y = Math.PI / 2;
    } else if (!c.s && c.r < maze.length - 1) {
      arch = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.14, 6, 18, Math.PI), trimMat);
      arch.position.set(p.x, 2.72, p.z + CELL / 2);
    }

    if (arch) {
      arch.castShadow = arch.receiveShadow = true;
      scene.add(arch);
      archCount += 1;
    }
  }
}


function disposeScene(){
 if(!scene)return;
 pipeline?.dispose();pipeline=null;
 const keepGeometries=new Set(),keepMaterials=new Set(),keepTextures=new Set(Object.values(assets.wall).filter(Boolean));
 for(const template of [assets.guardianTemplate,assets.armsTemplate])template?.traverse(o=>{if(o.geometry)keepGeometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){keepMaterials.add(m);for(const value of Object.values(m))if(value?.isTexture)keepTextures.add(value);}});
 const geometries=new Set(),materials=new Set(),textures=new Set();
 scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose();if(o.geometry&&!keepGeometries.has(o.geometry))geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!keepMaterials.has(m)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture&&!keepTextures.has(value))textures.add(value);}});
 geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());
 guardianMixer?.stopAllAction();armsMixer?.stopAllAction();materialCache.clear();scene.clear();
}
function buildGuardian(){
 guardian=new THREE.Group();guardian.userData.dynamic=true;guardianActions={};guardianActionName='';guardianMixer=null;
 const model=SkeletonUtils.clone(assets.guardianTemplate);guardianModel=model;
 model.rotation.y=-Math.PI/2;model.scale.set(.39,.67,.43);model.position.y=.28;skinCreature(model,ui.skinSelect.value);guardian.add(model);
 guardianMixer=new THREE.AnimationMixer(model);
 for(const [name,original]of Object.entries(assets.guardianClips)){if(!original)continue;const clip=original.clone();clip.name=name;guardianActions[name]=guardianMixer.clipAction(clip);if(name==='run')guardianActions[name].timeScale=1.55;}
 guardianBones=[];model.traverse(o=>{if(o.isBone&&/Center|Tentacle/.test(o.name))guardianBones.push({bone:o,base:o.quaternion.clone()});});
 setGuardianAction('idle');guardianMixer.update(.01);guardian.visible=false;scene.add(guardian);
}
function setGuardianAction(name){if(name===guardianActionName||!guardianActions[name])return;const next=guardianActions[name];next.reset().play();guardianActions[guardianActionName]?.fadeOut(.18);next.fadeIn(.18);guardianActionName=name;}
function attachArms(){
 armsRoot=new THREE.Group();armsRoot.userData.dynamic=true;armsRoot.position.set(0,-1.44,-.22);armsRoot.rotation.y=Math.PI;camera.add(armsRoot);armsMixer=null;
 const model=SkeletonUtils.clone(assets.armsTemplate);model.scale.setScalar(.86);
 model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=false;o.renderOrder=3;}});armsRoot.add(model);
 if(assets.armsClip){armsMixer=new THREE.AnimationMixer(model);const action=armsMixer.clipAction(assets.armsClip);action.play();armsMixer.update(.2);action.paused=true;}
 flashGrip=model.getObjectByName('handR')||model.getObjectByName('hand.R');
 flashlight=createFlashlight();flashlight.userData.dynamic=true;camera.add(flashlight);armsRoot.visible=ui.armsToggle.checked;
 camera.updateMatrixWorld(true);updateHeldFlashlight(0);
}
function updateHeldFlashlight(dt){
 armsRoot.visible=ui.armsToggle.checked;armsRoot.position.y=-1.44+(ui.shakeToggle.checked?Math.sin(headBob)*.012*Math.min(player.speed/6,1):0);armsRoot.position.z=-.22-(player.running?.035:0);
 armsMixer?.update(dt);camera.updateMatrixWorld(true);
 if(flashGrip){const grip=camera.worldToLocal(flashGrip.getWorldPosition(new THREE.Vector3()));flashlight.position.copy(grip).add(new THREE.Vector3(0,-.025,-.028));}else flashlight.position.set(.25,-.26,-.43);
 flashlight.rotation.set(-.08,player.running?.13:.015,ui.shakeToggle.checked?Math.sin(headBob)*.014:0);flashlight.visible=true;flashlight.userData.lens.material.emissiveIntensity=player.light?2.2:.03;
 camera.userData.flash.position.copy(flashlight.position).add(new THREE.Vector3(0,0,-.22));
}
function makePortal(exit){
 portal=new THREE.Group();portal.userData.dynamic=true;portal.userData.exit=exit;portal.position.copy(wpos(exit,1.6));portal.position.x+=2;portal.position.z+=1.4;
 const frame=new THREE.Mesh(new THREE.TorusGeometry(1.45,.16,8,64),new THREE.MeshStandardMaterial({color:0x8e7955,emissive:0x125b51,emissiveIntensity:.45,metalness:.6,roughness:.5}));portal.add(frame);
 const outer=new THREE.Mesh(new THREE.TorusGeometry(1.67,.065,6,64),new THREE.MeshStandardMaterial({color:0xb5a478,metalness:.68,roughness:.58}));portal.add(outer);
 const disc=new THREE.Mesh(new THREE.CircleGeometry(1.31,48),new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{uTime:{value:0},uActive:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float uTime;uniform float uActive;void main(){vec2 p=vUv*2.0-1.0;float r=length(p);float a=atan(p.y,p.x);float spiral=.5+.5*sin(a*4.0-r*15.0+uTime*.9);float rings=.5+.5*sin(r*24.0-uTime*1.6);float edge=pow(r,3.0);vec3 col=mix(vec3(.015,.10,.12),vec3(.23,.83,.71),spiral*.4+edge*.55);float alpha=(.15+edge*.6+rings*.09)*uActive;gl_FragColor=vec4(col,alpha*(1.0-smoothstep(.94,1.0,r)));}'}));portal.add(disc);portal.userData.disc=disc;
 const runes=[];for(let i=0;i<TOTAL;i++){const a=i/TOTAL*Math.PI*2+Math.PI/2;const rune=new THREE.Mesh(new THREE.OctahedronGeometry(.12),new THREE.MeshStandardMaterial({color:0x476a62,emissive:0x82f5d3,emissiveIntensity:.12,metalness:.25,roughness:.5}));rune.position.set(Math.cos(a)*1.66,Math.sin(a)*1.66,0);portal.add(rune);runes.push(rune);}portal.userData.runes=runes;
 scene.add(portal);portalLight=new THREE.PointLight(0x61d9bf,5,7,1.8);portalLight.position.copy(portal.position);portalLight.position.z+=.65;scene.add(portalLight);
 const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2,.15,12),sharedMaterial('plinth',{color:0x303c36,roughness:.9,metalness:.08}));plinth.position.copy(portal.position);plinth.position.y=.075;scene.add(plinth);
}
function bakeStaticMeshes(){
 scene.updateMatrixWorld(true);const groups=new Map(),oldGeometries=new Set();
 scene.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||Array.isArray(o.material))return;for(let p=o;p;p=p.parent)if(p.userData.dynamic)return;const pos=o.getWorldPosition(new THREE.Vector3());const key=`${o.material.uuid}:${Math.floor(pos.x/12)}:${Math.floor(pos.z/12)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});
 for(const list of groups.values()){if(list.length<2)continue;const geometries=list.map(o=>o.geometry.clone().applyMatrix4(o.matrixWorld));const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)continue;const mesh=new THREE.Mesh(merged,list[0].material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);list.forEach(o=>{oldGeometries.add(o.geometry);o.removeFromParent();});}
 // Some single meshes can still reference a shared geometry.
 const live=new Set();scene.traverse(o=>{if(o.geometry)live.add(o.geometry);});oldGeometries.forEach(g=>{if(!live.has(g))g.dispose();});
}
function build(){
 disposeScene();seed=crypto.getRandomValues(new Uint32Array(1))[0];rng=seededRandom(seed);const q=PRESETS[qualityKey()];graphicsUsed=qualityKey();maze=makeMaze(9,rng);collisionProps=[];crystals=[];trapCells=[];sconces=[];lightPool=[];guardianNext=null;lowAreas=[];vents=makeVents(maze,rng);navRoute=[];navGoal=null;navCooldown=0;navStuck=0;guardianCrawl=0;hunterNavigation=createNavigation();visited=new Set();scare=null;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x080d0f);scene.fog=new THREE.FogExp2(0x0a1112,q.fog);
 if(!renderer){renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;$('game').replaceChildren(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause('The graphics context was interrupted. Reload the page to continue.');});setupLook();}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=q.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMappingExposure=Number(ui.brightness.value);
 camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.06,75);camera.rotation.order='YXZ';camera.userData.dynamic=true;scene.add(camera);
 menuCamera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.08,65);
 scene.add(new THREE.HemisphereLight(0x9ab0bd,0x39342a,.55));const moon=new THREE.DirectionalLight(0xa6b8c3,.22);moon.position.set(9,15,-6);scene.add(moon);
 const flash=new THREE.SpotLight(0xffedcd,24,23,Math.PI/7,.72,1);flash.castShadow=q.shadows;flash.shadow.mapSize.set(512,512);flash.shadow.bias=-.001;const target=new THREE.Object3D();target.position.set(0,-.12,-7);flash.position.set(.1,-.18,-.1);camera.add(flash,target);flash.target=target;camera.userData.flash=flash;attachArms();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(maze.length*CELL+4,maze.length*CELL+4),makeFloorMaterial());floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 buildTempleRoof(q);buildWallKit();buildVents();buildAtmosphere(q);
 const spawn=maze[0][0];const rooms=[maze[2][4],maze[5][1],maze[7][7]];rooms.sort((a,b)=>path(spawn,b).length-path(spawn,a).length);const exit=rooms[0];
 const picks=chooseCrystals(maze,spawn,exit,TOTAL,rng);
 for(let i=0;i<picks.length;i++){
  const c=picks[i];const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.37),new THREE.MeshStandardMaterial({color:0xb0f3dd,emissive:0x48cdb1,emissiveIntensity:1.8,metalness:.28,roughness:.15}));crystal.scale.y=1.45;crystal.position.copy(wpos(c,1.12));crystal.userData={dynamic:true,cell:c,active:true,phase:i};scene.add(crystal);crystals.push(crystal);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.56,.7,.22,8),sharedMaterial('pedestal',{color:0x606556,roughness:.82,metalness:.1}));pedestal.position.copy(wpos(c,.11));scene.add(pedestal);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.62,.025,4,24),sharedMaterial('pedestalTrim',{color:0xd7bd83,emissive:0x93734b,emissiveIntensity:.55,metalness:.6,roughness:.5}));rim.rotation.x=Math.PI/2;rim.position.copy(wpos(c,.23));scene.add(rim);
 }
 // Visible spike rows occupy only their actual footprint and can be jumped.
 trapCells=randomCells(6,[...maze.flat().filter(c=>c.room),...picks,spawn,exit]);
 for(const c of trapCells){const p=wpos(c);const mat=sharedMaterial('trap',{color:0x8b927e,roughness:.75,metalness:.45});for(let i=-1;i<=1;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.12,.42,5),mat);spike.position.set(p.x+i*.45,.21,p.z);scene.add(spike);}const base=new THREE.Mesh(new THREE.BoxGeometry(1.6,.035,.48),sharedMaterial('trapBase',{color:0x8d623f,emissive:0x7a2e17,emissiveIntensity:.45,roughness:.9}));base.position.copy(wpos(c,.02));scene.add(base);}
 makePortal(exit);buildGuardian();guardianCell=farthestCell(maze,spawn);guardian.position.copy(wpos(guardianCell));brain={mode:'patrol',target:null,lastSeen:null,memory:0};guardianAwake=false;
 for(let i=0;i<q.lights;i++){const light=new THREE.PointLight(0xffbf78,4.2,7,1.7);scene.add(light);lightPool.push(light);}
 // A small particle field gives the chambers depth without a postprocessing pass.
 const positions=new Float32Array(120*3);for(let i=0;i<120;i++){positions[i*3]=(rng()-.5)*36;positions[i*3+1]=rng()*3.8;positions[i*3+2]=(rng()-.5)*36;}
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(positions,3));dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xc9e1c9,size:.028,transparent:true,opacity:.42,depthWrite:false}));scene.add(dust);
 player.p.copy(wpos(spawn,PLAYER_HEIGHT));player.v.set(0,0,0);Object.assign(player,{vy:0,ground:true,health:100,stamina:100,battery:100,cool:0,speed:0,exhausted:false,running:false,light:true,crouched:false,crouchRequested:false,inVent:false});
 elapsed=0;collected=0;noisePulse=0;ambientTimer=10;heartbeat=0;threat=0;mapHeld=false;yaw=-Math.PI/2;pitch=0;headBob=0;footstepTimer=0;guardianFootstep=0;uiTime=0;lightTime=0;toastUntil=0;hitUntil=0;
 camera.position.copy(player.p);camera.rotation.set(pitch,yaw,0,'YXZ');
 const pp=wpos(exit);menuCamera.position.set(pp.x+.1,2.05,pp.z+5.55);menuCamera.lookAt(pp.x+.1,1.75,pp.z+1.3);menuCamera.userData.base=menuCamera.position.clone();
 bakeStaticMeshes();applyGraphics();updateLights(menuCamera);updateHud();drawMap();ui.objectiveText.textContent='Recover the gate crystals';ui.warning.classList.add('hidden');ui.toast.classList.add('hidden');document.body.classList.remove('hit-flash');clock=new THREE.Clock();
}
function updateLights(view){
 const points=sconces.map(p=>({p,d:horizontalDistance(view.position,p)}));for(const c of crystals)if(c.userData.active)points.push({p:c.position,d:horizontalDistance(view.position,c.position)-1});points.sort((a,b)=>a.d-b.d);
 lightPool.forEach((light,i)=>{const point=points[i];light.visible=!!point;if(point){light.position.copy(point.p);light.intensity=3.8*(.92+.08*Math.sin(elapsed*1.7+i*6));}});
}
function move(dt){
 const inputForward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),inputSide=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const hasInput=!!(inputForward||inputSide);
 player.inVent=!!ventAt(player.p,.25);
 const cannotStand=bodyBlocked(collisionProps,player.p.x,player.p.z,.3,PLAYER_HEIGHT);
 player.crouched=player.crouchRequested||keys.has('ControlLeft')||keys.has('ControlRight')||cannotStand;
 const baseHeight=player.crouched?CROUCH_HEIGHT:PLAYER_HEIGHT;
 const stamina=updateStamina(player.stamina,player.exhausted,!player.crouched&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),hasInput,dt);player.stamina=stamina.value;player.exhausted=stamina.exhausted;player.running=stamina.running;
 const maxSpeed=player.crouched?1.65:player.running?5.8:3.45;
 if(keys.has('ArrowLeft'))yaw+=dt*1.7;if(keys.has('ArrowRight'))yaw-=dt*1.7;
 let dx=-Math.sin(yaw)*inputForward+Math.cos(yaw)*inputSide,dz=-Math.cos(yaw)*inputForward-Math.sin(yaw)*inputSide;const length=Math.hypot(dx,dz);if(length){dx=dx/length*maxSpeed;dz=dz/length*maxSpeed;}
 const smoothing=1-Math.exp(-(hasInput?22:27)*dt);player.v.x=THREE.MathUtils.lerp(player.v.x,dx,smoothing);player.v.z=THREE.MathUtils.lerp(player.v.z,dz,smoothing);
 const distance=slideBody(player.p,player.v.x*dt,player.v.z*dt,collisionProps,.3,baseHeight);player.speed=distance/dt;
 if(player.ground){player.p.y=THREE.MathUtils.lerp(player.p.y,baseHeight,1-Math.exp(-dt*16));player.vy=0;}else{player.vy-=16*dt;player.p.y+=player.vy*dt;if(player.p.y<=baseHeight){player.p.y=baseHeight;player.vy=0;player.ground=true;}}
 headBob+=player.speed*dt*2.3;camera.position.copy(player.p);if(ui.shakeToggle.checked&&player.ground)camera.position.y+=Math.sin(headBob*2)*Math.min(player.speed/6,1)*.021;camera.rotation.set(pitch,yaw,0,'YXZ');updateHeldFlashlight(dt);
 visited.add(cellAt(player.p));document.body.classList.toggle('crawling',player.crouched);
 if(player.speed>.15&&player.ground){footstepTimer-=dt;if(footstepTimer<=0){footstepTimer=player.crouched?.65:player.running?.27:.44;noisePulse=.12;sfx(player.inVent?'crawl':'step');}}else footstepTimer=0;
}
function nearestCrystal(radius=2.1){return crystals.filter(c=>c.userData.active&&horizontalDistance(player.p,c.position)<radius&&sightClear(player.p,c.position,collisionProps)).sort((a,b)=>horizontalDistance(player.p,a.position)-horizontalDistance(player.p,b.position))[0];}
function notifyPlayer(message,seconds=4){ui.toast.textContent=message;ui.toast.classList.remove('hidden');toastUntil=elapsed+seconds;}
function take(crystal){
 if(!crystal?.userData.active)return;crystal.userData.active=false;crystal.visible=false;collected++;sfx('crystal');player.battery=Math.min(100,player.battery+25);portal.userData.runes[collected-1].material.emissiveIntensity=2.5;
 if(collected===TOTAL){ui.objectiveText.textContent='Return to the awakened gate';notifyPlayer('The gate is open. Hold M to find your way back.',6);sfx('portal');}else{notifyPlayer(`Crystal ${collected} of ${TOTAL} recovered · flashlight restored`,3);ui.objectiveText.textContent=`Find ${TOTAL-collected} remaining crystal${TOTAL-collected===1?'':'s'}`;}updateHud();
}
function damage(amount,message){if(player.cool>0||state!=='playing')return;player.health=Math.max(0,player.health-amount);player.cool=1.6;hitUntil=elapsed+.22;document.body.classList.add('hit-flash');sfx('threat');if(player.health<=0)finish(false,message);}
let guardianFootstep=0;
function guardianTick(dt){
 if(elapsed<10)return;
 if(!guardianAwake){guardianAwake=true;guardian.visible=true;sfx('distant');}
 const pc=cellAt(player.p),gc=cellAt(guardian.position),d=horizontalDistance(guardian.position,player.p),crawlingHere=!!ventAt(guardian.position,.43);
 const eyes={x:guardian.position.x,y:crawlingHere?.65:1.65,z:guardian.position.z};
 const facing=((player.p.x-guardian.position.x)*Math.sin(guardian.rotation.y)+(player.p.z-guardian.position.z)*Math.cos(guardian.rotation.y))/Math.max(.1,d);
 const visible=d<(player.light?15:player.crouched?5.5:8.5)&&(facing>-.25||d<2.2)&&sightClear(eyes,player.p,collisionProps);
 const soundRange=player.running?5:player.inVent?3:player.crouched?1:2;
 const heard=noisePulse>0&&player.speed>.2&&navigationPath(maze,gc,pc).length<=soundRange;
 const before=brain.mode,reached=brain.target===gc&&horizontalDistance(guardian.position,wpos(gc))<.45;
 updateHunter(brain,{visible,heard,playerCell:pc,playerPosition:player.p,reached,dt});
 if(before!=='chase'&&brain.mode==='chase')sfx('threat');
 if(!brain.target||(brain.mode==='patrol'&&reached)){
  const pool=brain.mode==='search'?maze.flat().filter(c=>c!==gc&&findPath(maze,gc,c).length<=3):maze.flat().filter(c=>c!==gc);
  brain.target=pool[Math.floor(rng()*pool.length)]||gc;
 }
 const nav=advanceHunter(hunterNavigation,guardian.position,brain.target,maze,collisionProps,lowAreas,dt,{visible,playerPosition:player.p,lastPosition:brain.lastPosition,mode:brain.mode,aggression:collected});
 const moving=nav.moving,nextCrawl=nav.crawl;guardianCrawl=THREE.MathUtils.lerp(guardianCrawl,nextCrawl?1:0,1-Math.exp(-dt*12));
 if(nav.heading!==null)guardian.rotation.y+=Math.atan2(Math.sin(nav.heading-guardian.rotation.y),Math.cos(nav.heading-guardian.rotation.y))*Math.min(1,dt*10);
 if(nav.stuck&&(brain.mode==='patrol'||brain.mode==='search'))brain.target=null;
 guardianCell=nav.cell;setGuardianAction(moving?(brain.mode==='chase'?'run':'walk'):'idle');guardianMixer?.update(dt);
 guardian.scale.set(1-guardianCrawl*.43,1-guardianCrawl*.65,1-guardianCrawl*.43);
 for(let i=0;i<guardianBones.length;i++){const {bone}=guardianBones[i];if(guardianCrawl>.01)bone.rotateX(Math.sin(elapsed*7+i*.85)*.13*guardianCrawl);}
 if(moving&&d<13){guardianFootstep-=dt;if(guardianFootstep<=0){guardianFootstep=nextCrawl?.34:brain.mode==='chase'?.38:.7;const pan=((guardian.position.x-player.p.x)*Math.cos(yaw)-(guardian.position.z-player.p.z)*Math.sin(yaw))/Math.max(d,1);sfx(nextCrawl?'scrape':'guardian',pan);}}
 threat=THREE.MathUtils.lerp(threat,visible?Math.max(.2,1-d/16):Math.max(0,1-d/7)*.4,dt*3);
 heartbeat-=dt;if(threat>.25&&heartbeat<=0){heartbeat=1.1-threat*.5;sfx('heartbeat');}
 ui.warning.classList.add('hidden');document.body.style.setProperty('--threat',String(threat*.52));
 if(d<.95&&sightClear(eyes,player.p,collisionProps))beginScare();
}
function updateHud(){ui.crystalCount.textContent=`${collected} / ${TOTAL}`;ui.healthText.textContent=Math.ceil(player.health);ui.healthBar.style.width=`${player.health}%`;ui.staminaBar.style.width=`${player.stamina}%`;ui.batteryText.textContent=player.light?`${Math.ceil(player.battery)}%`:`OFF · ${Math.ceil(player.battery)}%`;ui.batteryBar.style.width=`${player.battery}%`;$('posture').textContent=player.crouched?'CROUCHING':'STANDING';$('fpsText').textContent=`${framesPerSecond} FPS`;}
function drawMap(){
 mini.clearRect(0,0,220,220);mini.fillStyle='#081719e8';mini.fillRect(0,0,220,220);const scale=21,origin=15.5,toMap=p=>({x:origin+(p.x/CELL+(maze.length-1)/2+.5)*scale,y:origin+(p.z/CELL+(maze.length-1)/2+.5)*scale});
 mini.strokeStyle='#7ca89a72';mini.lineWidth=1.1;
 for(const c of maze.flat()){if(!visited.has(c)&&collected<TOTAL)continue;const x=origin+c.c*scale,y=origin+c.r*scale;if(c.room){mini.fillStyle='#99c1a80b';mini.fillRect(x,y,scale,scale);}mini.beginPath();if(c.n){mini.moveTo(x,y);mini.lineTo(x+scale,y);}if(c.w){mini.moveTo(x,y);mini.lineTo(x,y+scale);}if(c.r===maze.length-1&&c.s){mini.moveTo(x,y+scale);mini.lineTo(x+scale,y+scale);}if(c.c===maze.length-1&&c.e){mini.moveTo(x+scale,y);mini.lineTo(x+scale,y+scale);}mini.stroke();}
 if(collected===TOTAL){const route=path(cellAt(player.p),cellAt(portal.position));mini.strokeStyle='#d7bd8390';mini.lineWidth=2;mini.beginPath();let p=toMap(player.p);mini.moveTo(p.x,p.y);for(const c of route){p=toMap(wpos(c));mini.lineTo(p.x,p.y);}p=toMap(portal.position);mini.lineTo(p.x,p.y);mini.stroke();}
 for(const crystal of crystals){if(!crystal.userData.active||(!visited.has(crystal.userData.cell)&&collected<TOTAL))continue;const p=toMap(crystal.position);mini.save();mini.translate(p.x,p.y);mini.rotate(Math.PI/4);mini.fillStyle='#88ecd0';mini.fillRect(-2.6,-2.6,5.2,5.2);mini.restore();}
 for(const b of lowAreas){if(!visited.has(b.vent.a)&&!visited.has(b.vent.b))continue;const p=toMap(b.center);mini.fillStyle='#b69268';mini.fillRect(p.x-2,p.y-2,4,4);}
 const gate=toMap(portal.position);mini.strokeStyle=collected===TOTAL?'#f1d39a':'#a49165';mini.lineWidth=2;mini.strokeRect(gate.x-4,gate.y-4,8,8);
 const p=toMap(player.p);mini.save();mini.translate(p.x,p.y);mini.rotate(-yaw);mini.fillStyle='#fff2ce';mini.beginPath();mini.moveTo(0,-6);mini.lineTo(4.5,5);mini.lineTo(0,2);mini.lineTo(-4.5,5);mini.closePath();mini.fill();mini.restore();
}
function updateWorld(dt){
 elapsed+=dt;noisePulse=Math.max(0,noisePulse-dt);player.cool=Math.max(0,player.cool-dt);move(dt);
 if(player.light)player.battery=Math.max(0,player.battery-dt*.54);else player.battery=Math.min(100,player.battery+dt*4);
 if(player.light&&player.battery===0){player.light=false;notifyPlayer('Flashlight empty. Let it recharge, then press F.',4);}
 camera.userData.flash.intensity=player.light?24*(player.battery<12?.88+.12*Math.sin(elapsed*17):1):0;
 guardianTick(dt);if(state!=='playing')return;
 const near=nearestCrystal();if(near&&horizontalDistance(player.p,near.position)<.8)take(near);
 const prompt=nearestCrystal(),nearVent=lowAreas.find(b=>horizontalDistance(b.center,player.p)<2.5);
 ui.prompt.classList.toggle('hidden',!prompt&&!nearVent);ui.prompt.innerHTML=prompt?'<kbd>E</kbd> Recover crystal':player.crouched?'Move quietly through the duct':'<kbd>C</kbd> Crouch to enter the vent';
 for(const c of trapCells)if(trapHits(player.p,wpos(c))){damage(14,'Watch for the old spike rows. There is room to walk around.');break;}
 if(state!=='playing')return;
 if(collected===TOTAL&&horizontalDistance(player.p,portal.position)<1.05){finish(true);return;}
 ambientTimer-=dt;if(ambientTimer<=0){ambientTimer=18+rng()*23;sfx('distant',rng()*2-1);}
 if(toastUntil&&elapsed>toastUntil)ui.toast.classList.add('hidden');if(elapsed>hitUntil)document.body.classList.remove('hit-flash');
 uiTime-=dt;if(uiTime<=0){uiTime=.1;updateHud();if(ui.mapToggle.checked||mapHeld)drawMap();}lightTime-=dt;if(lightTime<=0){lightTime=.23;updateLights(camera);}
}
function beginScare(){
 if(state!=='playing')return;state='scare';keys.clear();ui.hud.classList.add('hidden');document.exitPointerLock?.();
 const set=new THREE.Scene();set.background=new THREE.Color(0x020304);const model=SkeletonUtils.clone(guardianModel);model.position.set(0,.28,0);set.add(model);
 const view=new THREE.PerspectiveCamera(49,innerWidth/innerHeight,.035,20);view.position.set(0,1.5,3);view.lookAt(0,1.4,0);
 set.add(new THREE.HemisphereLight(0xbccac9,0x111518,1.4));const key=new THREE.PointLight(0xffce91,24,9);key.position.set(-.6,2,2);set.add(key);const rim=new THREE.PointLight(0x518c99,9,6);rim.position.set(1,1.7,-1);set.add(rim);
 const mixer=new THREE.AnimationMixer(model),clip=assets.guardianClips.attack;if(clip){const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}
 scare={scene:set,camera:view,model,mixer,time:0};document.body.classList.add('captured');audioState();sfx('capture');
}
function tickScare(dt){
 if(!scare)return;scare.time+=dt;scare.mixer.update(dt);const t=scare.time,reduced=ui.reducedScareToggle.checked;
 const surge=THREE.MathUtils.smoothstep(t,0,reduced?.6:.22);scare.camera.position.z=3-surge*(reduced?1.0:1.8);
 scare.camera.position.x=!reduced&&ui.shakeToggle.checked?Math.sin(t*34)*.018:0;scare.camera.lookAt(0,1.36,0);renderer.render(scare.scene,scare.camera);
 if(t>1.65){scare.mixer.stopAllAction();scare.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose();});scare=null;document.body.classList.remove('captured');finish(false,'The Hollow found you. Break its sight, keep quiet, and remember: it can enter the vents.');}
}
function animate(now){
 raf=requestAnimationFrame(animate);if(!scene||!renderer)return;
 const realDt=lastFrameTime?Math.min(.25,(now-lastFrameTime)/1000):.016;lastFrameTime=now;frameCounter++;frameClock+=realDt;if(frameClock>=1){framesPerSecond=Math.round(frameCounter/frameClock);frameCounter=0;frameClock=0;}
 const dt=Math.min(.08,clock?.getDelta()||.016);
 if(state==='scare'){tickScare(dt);return;}
 if(state==='playing'){let remaining=dt;while(remaining>0&&state==='playing'){const step=Math.min(remaining,1/60);updateWorld(step);remaining-=step;}}
 if(['paused','ended','scare'].includes(state))return;
 const menuView=state!=='playing';menuTime+=dt;const t=menuView?menuTime:elapsed;
 for(const c of crystals){if(!c.userData.active)continue;c.rotation.y=t*.8+c.userData.phase;c.position.y=1.1+Math.sin(t*2+c.userData.phase)*.1;}
 portal.userData.disc.material.uniforms.uTime.value=t;portal.userData.disc.material.uniforms.uActive.value=menuView||collected===TOTAL?1:.13;
 portalLight.intensity=menuView||collected===TOTAL?5:.3;for(let i=0;i<TOTAL;i++)portal.userData.runes[i].material.emissiveIntensity=menuView||i<collected?1.5:.12;
 if(menuView){camera.userData.flash.intensity=0;armsRoot.visible=false;flashlight.visible=false;if(ui.shakeToggle.checked)menuCamera.position.x=menuCamera.userData.base.x+Math.sin(t*.13)*.12;}
 pipeline.render(menuView?menuCamera:camera,t);
}

function showOnly(panel){for(const node of [ui.menu,ui.pause,ui.endScreen,ui.hud])node.classList.toggle('hidden',node!==panel);}
async function prepare(){
 if(starting)return;starting=true;ready=false;state='loading';showOnly(ui.menu);ui.playBtn.disabled=true;ui.playLabel.textContent='Opening the temple…';ui.loadStatus.textContent='Restoring the stone halls…';ui.reloadBtn.classList.add('hidden');audioState();
 try{await loadAssets();build();renderer.compile(scene,menuCamera);state='menu';ready=true;ui.playBtn.disabled=false;ui.playLabel.textContent='Enter the temple';ui.loadStatus.textContent=touchMode?'Use the arrows to move. Drag the right side to look.':'Your descent awaits.';if(!assets.wall.diffuse)ui.loadStatus.textContent='Some textures did not load. You can still play.';}catch(error){console.error(error);state='error';ui.playLabel.textContent='Unable to open';ui.loadStatus.textContent='The temple could not load. Check that your browser supports WebGL 2, then try again.';ui.reloadBtn.classList.remove('hidden');}finally{starting=false;}
}
let hadLock=false,lookPointer=null,lookX=0,lookY=0;
function requestLook(){
 if(touchMode)return;
 try{const result=renderer.domElement.requestPointerLock?.();result?.catch(()=>{notifyPlayer('Drag to look, or use the arrow keys to turn.',5);});if(!renderer.domElement.requestPointerLock)notifyPlayer('Drag to look, or use the arrow keys to turn.',5);}catch{notifyPlayer('Drag to look, or use the arrow keys to turn.',5);}
}
function enter(){if(!ready||starting)return;keys.clear();state='playing';showOnly(ui.hud);audioStart();audioState();clock.getDelta();requestLook();notifyPlayer('Recover five crystals. C crouches. F toggles your light. Hold M for your map.',7);updateLights(camera);}
function pause(hint='Your descent will wait.'){
 if(state!=='playing')return;state='paused';keys.clear();mapHeld=false;document.body.classList.toggle('show-map',ui.mapToggle.checked);lookPointer=null;ui.pauseHint.textContent=hint;ui.pause.classList.remove('hidden');audioState();if(document.pointerLockElement)document.exitPointerLock?.();ui.resumeBtn.focus();
}
function resume(){if(state!=='paused')return;keys.clear();state='playing';ui.pause.classList.add('hidden');clock.getDelta();audioStart();audioState();requestLook();}
function menu(){keys.clear();state='menu';if(document.pointerLockElement)document.exitPointerLock?.();showOnly(ui.menu);audioState();prepare();}
function finish(win,msg){if(!['playing','scare'].includes(state))return;state='ended';ready=false;keys.clear();document.exitPointerLock?.();showOnly(ui.endScreen);ui.endEyebrow.textContent=win?'THE GATE AWAKENS':'ANOTHER DESCENT AWAITS';ui.endTitle.textContent=win?'Escaped.':'Lost in the temple.';ui.endText.textContent=msg||(win?'You recovered the light and found your way home.':'You did not reach the gate.');const seconds=Math.floor(elapsed);ui.runStats.replaceChildren();const count=document.createElement('span'),time=document.createElement('span');count.textContent=`${collected} / ${TOTAL} crystals`;time.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} elapsed`;ui.runStats.append(count,time);sfx(win?'portal':'threat');setTimeout(audioState,1200);ui.retryBtn.focus();}
function openSettings(){settingsReturn=state;ui.settings.classList.remove('hidden');ui.settingsClose.focus();}
function closeSettings(){
 ui.settings.classList.add('hidden');for(const [id,fallback]of Object.entries(optionDefaults))storage.set(`temple.${id}`,typeof fallback==='boolean'?ui[id].checked:ui[id].value);
 for(const id of ['quality','sensitivity','brightness'])storage.set(`temple.${id}`,ui[id==='quality'?'qualitySelect':id].value);
 for(const id of ['shake','audio','arms'])storage.set(`temple.${id}`,ui[`${id}Toggle`].checked?'1':'0');
 audioState();applyGraphics();
 if(settingsReturn==='menu'&&(graphicsUsed!==qualityKey()||loadedTier!==textureTier()))prepare();
 (settingsReturn==='paused'?ui.pauseSettingsBtn:ui.settingsBtn).focus();
}
function jump(){if(state==='playing'&&player.ground&&!player.crouched){player.vy=5.8;player.ground=false;}}
function toggleLight(){if(state!=='playing')return;if(!player.light&&player.battery<5){notifyPlayer('Let the flashlight recharge to 5% first.',2);return;}player.light=!player.light;sfx('switch');updateHud();}
function look(dx,dy){const s=Number(ui.sensitivity.value);yaw-=dx*.0022*s;pitch=THREE.MathUtils.clamp(pitch-dy*.0020*s,-1.3,1.3);}
function setupLook(){
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{if(state!=='playing'||document.pointerLockElement===canvas||(touchMode&&e.clientX<innerWidth*.4))return;lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(state!=='playing'||e.pointerId!==lookPointer||document.pointerLockElement===canvas)return;look(e.clientX-lookX,e.clientY-lookY);lookX=e.clientX;lookY=e.clientY;});
 const end=e=>{if(e.pointerId===lookPointer)lookPointer=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
}
ui.playBtn.onclick=enter;ui.resumeBtn.onclick=resume;ui.quitBtn.onclick=menu;ui.endMenuBtn.onclick=menu;ui.retryBtn.onclick=()=>{ui.retryBtn.disabled=true;prepare().finally(()=>{ui.retryBtn.disabled=false;});};ui.reloadBtn.onclick=()=>prepare();ui.settingsBtn.onclick=openSettings;ui.pauseSettingsBtn.onclick=openSettings;ui.settingsClose.onclick=closeSettings;ui.hudPause.onclick=()=>pause();ui.touchJump.onclick=jump;ui.touchCollect.onclick=()=>{if(state==='playing')take(nearestCrystal());};ui.touchFlash.onclick=toggleLight;
for(const id of ['sensitivity','brightness'])ui[id].addEventListener('input',()=>{ui[`${id}Value`].value=Number(ui[id].value).toFixed(1);if(id==='brightness'&&renderer)renderer.toneMappingExposure=Number(ui.brightness.value);});
ui.audioToggle.addEventListener('change',()=>{if(ui.audioToggle.checked)audioStart();audioState();});
for(const button of document.querySelectorAll('[data-key]')){const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='playing')return;keys.add(key);button.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));}
addEventListener('keydown',e=>{
 if(!ui.settings.classList.contains('hidden')){if(e.code==='Escape'){e.preventDefault();closeSettings();return;}if(e.code==='Tab'){const focusable=[...ui.settings.querySelectorAll('button,input,select')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(state!=='playing')return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyF','Escape','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyC','KeyM'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyC')player.crouchRequested=!player.crouchRequested;if(e.code==='KeyM'){mapHeld=true;document.body.classList.add('show-map');drawMap();}if(e.code==='Space')jump();if(e.code==='KeyE')take(nearestCrystal());if(e.code==='KeyF')toggleLight();if(e.code==='Escape')pause();
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyM'){mapHeld=false;document.body.classList.toggle('show-map',ui.mapToggle.checked);}});addEventListener('mousemove',e=>{if(state==='playing'&&document.pointerLockElement===renderer?.domElement)look(e.movementX,e.movementY);});
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===renderer?.domElement;if(hadLock&&!locked&&state==='playing')pause();hadLock=locked;});
document.addEventListener('pointerlockerror',()=>{if(state==='playing')notifyPlayer('Drag to look, or use the arrow keys to turn.',5);});
addEventListener('blur',()=>{keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pause();}});
addEventListener('resize',()=>{if(!renderer||!camera)return;for(const view of [camera,menuCamera]){view.aspect=innerWidth/innerHeight;view.updateProjectionMatrix();}renderer.setSize(innerWidth,innerHeight);pipeline?.resize();if(scare){scare.camera.aspect=innerWidth/innerHeight;scare.camera.updateProjectionMatrix();}if(state==='paused'||state==='ended')pipeline?.render(camera,elapsed);});
$('touchCrouch').onclick=()=>{if(state==='playing')player.crouchRequested=!player.crouchRequested;};
$('touchMap').onclick=()=>{if(state==='playing'){mapHeld=!mapHeld;document.body.classList.toggle('show-map',ui.mapToggle.checked||mapHeld);drawMap();}};
for(const id of ['renderScale','fov','fogAmount','sharpness','volume'])ui[id].addEventListener('input',()=>{const output=$(`${id}Value`);if(output)output.value=ui[id].value+(id==='renderScale'||id==='fogAmount'||id==='volume'?'%':id==='fov'?'°':'');if(id==='volume')audioState();});
ui.qualitySelect.addEventListener('change',()=>{const high=['high','ultra'].includes(qualityKey());ui.bloomToggle.checked=high;ui.aoToggle.checked=qualityKey()==='ultra';ui.shadowSelect.value='auto';ui.textureSelect.value='auto';});
// Asset loading happens before the Play gesture, so mouse capture stays reliable.
prepare();requestAnimationFrame(animate);
