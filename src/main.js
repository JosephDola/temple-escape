import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CELL,PLAYER_HEIGHT,CROUCH_HEIGHT,VENT_HEIGHT,seededRandom,findPath,horizontalDistance,overlapsBox,updateStamina,navigationPath,bodyBlocked,sightClear,slideBody,updateHunter} from './world.js';
import {makeEscapeLevel,newProgress,currentTask,completedTasks,TASKS,taskStatus,completeTask,syncDoors,roomAt,makeCheckpoint,readCheckpoint,wallPlan,groundHeight,cellHeight,levelPosition} from './campaign.js';
import {buildEscapeProps,buildCrawlways} from './escape-props.js';
import {createPipeline,createFlashlight,skinCreature} from './presentation.js';
import {createNavigation,advanceHunter} from './hunter.js';
import {createCreatureRig} from './creature-rig.js';
import {createVentMemory,observeVentUse,pickHuntTarget} from './hunt-director.js';
import {acousticPosition} from './acoustics.js';
import {advanceDoor} from './doors.js';
import './style.css';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['menu','settings','pause','endScreen','hud','playBtn','playLabel','loadStatus','reloadBtn','settingsBtn','settingsClose','resumeBtn','quitBtn','retryBtn','endMenuBtn','qualitySelect','shakeToggle','audioToggle','armsToggle','sensitivity','sensitivityValue','brightness','brightnessValue','objectiveText','batteryText','batteryBar','staminaBar','healthText','healthBar','prompt','warning','platformTag','endTitle','endText','endEyebrow','runStats','toast','pauseHint','pauseSettingsBtn','hudPause','touchJump','touchCollect','touchFlash'].map(id=>[id,$(id)]));
const storage = {get(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,String(value));return true;}catch{return false;}}};
const optionDefaults={renderScale:'100',textureSelect:'auto',shadowSelect:'auto',fov:'76',fogAmount:'100',sharpness:'0.25',volume:'65',skinSelect:'basalt',aaToggle:true,bloomToggle:false,aoToggle:false,grainToggle:false,reducedScareToggle:false};
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

const SAVE_KEY='temple.checkpoint.last-descent';
let decoyMeshes=[];
let level,progress=newProgress(),props,interacting=null,interactionTime=0,interactionNoise=0,noiseEvent=null,puzzleOpen=false,keypadValue='',journalReturn=null,awakenAt=18,lastRoom='',hasStarted=false;
for(const id of ['continueBtn','endContinueBtn','taskCount','taskTitle','locationName','journal','journalClose','journalTasks','journalNotes','keypad','keypadClose','keypadDisplay','keypadHint','keypadSubmit','keypadClear','interactionBar','interactionFill','inventoryText','hudJournal','touchJournal','touchDecoy'])ui[id]=$(id);
const keys=new Set();
const materialCache=new Map();
let state='loading',renderer,scene,camera,menuCamera,guardian,guardianMixer,armsMixer,armsRoot,portal,portalLight,clock;
let guardianActions={},guardianActionName='',guardianCell,guardianNext=null,brain={mode:'patrol',target:null,lastSeen:null,memory:0};
let maze,collisionProps=[],sconces=[],lightPool=[],dust;
let yaw=0,pitch=0,elapsed=0,footstepTimer=0,headBob=0,rng=Math.random,seed=0;
let vents=[],lowAreas=[],pipeline=null,flashlight=null,flashGrip=null,guardianModel=null,guardianBones=[],navRoute=[],navGoal=null,navCooldown=0,navStuck=0,guardianCrawl=0;
let noisePulse=0,ambientTimer=12,heartbeat=0,threat=0,scare=null,visited=new Set(),frameCounter=0,frameClock=0,framesPerSecond=0,lastFrameTime=0;
let hunterNavigation=createNavigation(),creatureRig=null,ventMemory=createVentMemory(),alertUntil=0,chaseTail=0,breathTimer=0,senseClock=0,lastHeard={player:false,event:null};
let graphicsUsed='',loadedTier='',ready=false,starting=false,modelAssetsLoaded=false,settingsReturn=null,toastUntil=0,uiTime=0,lightTime=0;
let guardianAwake=false,raf=0,menuTime=0,hitUntil=0;
const player={p:new THREE.Vector3(),v:new THREE.Vector3(),vy:0,ground:true,health:100,stamina:100,battery:100,cool:0,speed:0,exhausted:false,running:false,light:true};
const assets={wall:{},guardianTemplate:null,guardianClips:{},armsTemplate:null,armsClip:null};
const loaders={texture:new THREE.TextureLoader(),gltf:new GLTFLoader()};
const path=(a,b)=>findPath(maze,a,b);
const floorAt=(x,z)=>groundHeight(level,x,z);
const wpos=(c,y=0)=>new THREE.Vector3((c.c-(maze.length-1)/2)*CELL,(c.floor||0)+y,(c.r-(maze.length-1)/2)*CELL);
const cellAt=p=>maze[Math.max(0,Math.min(maze.length-1,Math.round(p.z/CELL+(maze.length-1)/2)))][Math.max(0,Math.min(maze.length-1,Math.round(p.x/CELL+(maze.length-1)/2)))];
function randomCells(n,ban=[]){const excluded=new Set(ban),cells=maze.flat().filter(c=>c.active&&!c.duct&&!excluded.has(c));for(let i=cells.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}return cells.slice(0,n);}
function sharedMaterial(key,props){if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial(props));return materialCache.get(key);}

let audioContext,master,drone,droneGain;
function audioStart(){
 if(!ui.audioToggle.checked)return;
 try{if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();master=audioContext.createGain();master.gain.value=.16;master.connect(audioContext.destination);drone=audioContext.createOscillator();const gain=droneGain=audioContext.createGain();gain.gain.value=.018;drone.type='triangle';drone.frequency.value=48;drone.connect(gain).connect(master);drone.start();}if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}
}
function audioState(){if(master)master.gain.setTargetAtTime(ui.audioToggle.checked&&['playing','scare'].includes(state)?Number(ui.volume.value)/100*.25:0,audioContext.currentTime,.15);}
function tone(freq,duration=.16,gain=.08,type='sine',pan=0){if(!ui.audioToggle.checked||!audioContext||audioContext.state!=='running')return;const o=audioContext.createOscillator(),g=audioContext.createGain(),p=audioContext.createStereoPanner();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.001,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(gain,audioContext.currentTime+.015);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);p.pan.value=Math.max(-1,Math.min(1,pan));o.connect(g).connect(p).connect(master);o.start();o.stop(audioContext.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};}
function noise(duration,level,frequency,pan=0){
 if(!ui.audioToggle.checked||!audioContext||audioContext.state!=='running')return;
 const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5);
 const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),panner=audioContext.createStereoPanner();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.65;gain.gain.value=level;panner.pan.value=THREE.MathUtils.clamp(pan,-1,1);source.connect(filter).connect(gain).connect(panner).connect(master);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
}
function sfx(kind,pan=0){
 if(kind==='complete'){tone(520,.22,.10);setTimeout(()=>tone(780,.45,.07),90);}
 else if(kind==='portal'){tone(130,1,.08,'triangle');tone(390,1.2,.1);}
 else if(kind==='step'){noise(.11,.17,player.running?340:240,pan);tone(72,.07,.025,'triangle');}
 else if(kind==='water-step'){noise(.28,.13,1800,pan);noise(.12,.1,450,pan);}
 else if(kind==='metal-step'){noise(.12,.1,1250,pan);tone(195,.2,.02,'triangle',pan);}
 else if(kind==='crawl'||kind==='scrape'){noise(.24,kind==='crawl'?.12:.2,820,pan);tone(145,.12,.025,'triangle',pan);}
 else if(kind==='guardian'){noise(.22,.24,160,pan);tone(48,.22,.06,'triangle',pan);}
 else if(kind==='heartbeat'){tone(48,.16,.06);setTimeout(()=>tone(55,.12,.035),130);}
 else if(kind==='distant'){noise(.9,.15,440,pan);tone(73,.8,.06,'triangle',pan);}
 else if(kind==='threat'){tone(44,.8,.08,'triangle');noise(.8,.08,740);}
 else if(kind==='capture'){noise(.85,ui.reducedScareToggle.checked?.22:.5,1100);tone(61,1.2,.18,'sawtooth');tone(93,.8,.09,'triangle');}
 else if(kind==='switch')noise(.05,.06,1600);
}
function spatialSfx(kind,source,range=28){
 const a=acousticPosition(player.p,source,yaw,collisionProps,range);if(a.gain<.006)return;
 if(kind==='breath'){noise(.8,.2*a.gain,280*a.muffle,a.pan);tone(49,.6,.045*a.gain,'triangle',a.pan);}
 else if(kind==='clang'){noise(.18,.25*a.gain,1800*a.muffle,a.pan);tone(270,.7,.06*a.gain,'triangle',a.pan);tone(407,.55,.027*a.gain,'sine',a.pan);}
 else if(kind==='scrape'){noise(.33,.25*a.gain,850*a.muffle,a.pan);tone(145,.2,.03*a.gain,'triangle',a.pan);}
 else if(kind==='growl'){noise(.9,.31*a.gain,160*a.muffle,a.pan);tone(43,.7,.1*a.gain,'sawtooth',a.pan);}
 else if(kind==='drip'){tone(800,.14,.035*a.gain,'sine',a.pan);noise(.13,.09*a.gain,2300*a.muffle,a.pan);}
 else {noise(.25,.35*a.gain,180*a.muffle,a.pan);tone(52,.22,.075*a.gain,'triangle',a.pan);}
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
function box(x, y, z, w, h, d, material, collide = true, absolute = false) {
  if(!absolute)y+=floorAt(x,z);
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
 for(const wall of wallPlan(maze,H)){
  box(wall.x,wall.y,wall.z,wall.w,wall.h,wall.d,makeWallMaterial(wall.w>.3?2:1,wall.w>.3?1:2),true,true);
  if(rng()>.58&&!wall.cell.duct){const inward={n:[0,.18,0],w:[.18,0,Math.PI/2],s:[0,-.18,Math.PI],e:[-.18,0,-Math.PI/2]}[wall.dir];addSconce(new THREE.Vector3(wall.x+inward[0],floorAt(wall.x,wall.z)+2.1,wall.z+inward[1]),inward[2]);}
 }
}

function buildVents(){buildCrawlways({scene,vents,box,sharedMaterial,wpos,makeWallMaterial,lowAreas});}
function ventAt(pos,margin=0){return lowAreas.find(b=>overlapsBox(b,pos.x,pos.z,margin));}
function buildAtmosphere(q){
 const pipeMat=sharedMaterial('pipe',{color:0x625940,metalness:.7,roughness:.6});
 const rubbleMat=makeRoofMaterial();
 const damp=sharedMaterial('damp',{color:0x192526,roughness:.28,metalness:.28,transparent:true,opacity:.68});
 for(const c of maze.flat().filter(c=>c.active&&!c.duct)){
  const p=wpos(c);
  if(c.surface==='metal'&&rng()<.5||rng()<q.decor*.12){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,3.65,8),pipeMat);pipe.rotation.z=Math.PI/2;pipe.position.set(p.x,p.y+3.36,p.z+1.38);scene.add(pipe);
   const stain=new THREE.Mesh(new THREE.CircleGeometry(.7+rng()*.5,11),damp);stain.rotation.x=-Math.PI/2;stain.scale.y=.42;stain.position.set(p.x+.75,p.y+.012,p.z-.8);scene.add(stain);
  }
  if(c.room&&rng()<q.decor*.3){for(let i=0;i<2;i++){const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.11+rng()*.07,0),rubbleMat);stone.position.set(p.x+1.25+rng()*.25,p.y+.07,p.z-.75+rng()*.4);stone.scale.y=.5;scene.add(stone);}}
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
 
 skinCreature(guardianModel,ui.skinSelect.value);
}

function buildTempleRoof(q) {
 const floorMat=makeFloorMaterial(1,1),roofMat=makeRoofMaterial(1,1),beamMat=makeWallMaterial(1,1);roofMat.side=THREE.DoubleSide;
 for(const cell of maze.flat().filter(c=>c.active)){
  const p=wpos(cell),geometry=new THREE.PlaneGeometry(CELL+.025,CELL+.025);geometry.rotateX(-Math.PI/2);const vertices=geometry.attributes.position;
  for(let i=0;i<vertices.count;i++){const x=vertices.getX(i)+p.x,z=vertices.getZ(i)+p.z;vertices.setXYZ(i,x,cellHeight(cell,x,z),z);}geometry.computeVertexNormals();
  const floor=new THREE.Mesh(geometry,floorMat);floor.receiveShadow=true;scene.add(floor);
  const ceiling=geometry.clone(),verts=ceiling.attributes.position;for(let i=0;i<verts.count;i++)verts.setY(i,verts.getY(i)+H);ceiling.computeVertexNormals();const roof=new THREE.Mesh(ceiling,roofMat);roof.receiveShadow=true;scene.add(roof);
  if(!cell.duct&&rng()<q.roofDetail*.6){box(p.x,H-.02,p.z,CELL,.16,.16,beamMat,false);box(p.x,H-.02,p.z,.16,.16,CELL,beamMat,false);}
  if(cell.ramp&&cell.ramp.y0!==cell.ramp.y1){for(let i=0;i<5;i++){const offset=-CELL/2+(i+.5)*CELL/5,alongX=cell.ramp.axis==='x';box(p.x+(alongX?offset:0),.012,p.z+(alongX?0:offset),alongX?.07:3.5,.025,alongX?3.5:.07,beamMat,false);}}
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
 creatureRig=createCreatureRig(model);skinCreature(model,ui.skinSelect.value);
 setGuardianAction('idle');guardianMixer.update(.01);creatureRig.apply(0);guardian.visible=false;scene.add(guardian);
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
 portal=new THREE.Group();portal.userData.dynamic=true;portal.position.copy(wpos(exit));scene.add(portal);
 const frame=sharedMaterial('exit-frame',{color:0x73776c,metalness:.55,roughness:.7});
 for(const x of [-1.28,1.28]){const post=new THREE.Mesh(new THREE.BoxGeometry(.23,3.1,.38),frame);post.position.set(x,1.55,.6);portal.add(post);}
 const header=new THREE.Mesh(new THREE.BoxGeometry(2.78,.3,.38),frame);header.position.set(0,3.1,.6);portal.add(header);
 const panel=new THREE.Group();portal.add(panel);portal.userData.panel=panel;
 for(let i=0;i<12;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(2.3,.22,.12),frame);slat.position.set(0,.15+i*.235,.6);panel.add(slat);}
 for(let i=0;i<6;i++){const step=new THREE.Mesh(new THREE.BoxGeometry(2.25,.15*(i+1),.35),frame);step.position.set(0,.075*(i+1),.95+i*.33);portal.add(step);}
 const daylight=new THREE.Mesh(new THREE.PlaneGeometry(2.3,2.8),new THREE.MeshBasicMaterial({color:0xd9e5d4,side:THREE.DoubleSide}));daylight.position.set(0,1.55,2.1);portal.add(daylight);
 portalLight=new THREE.PointLight(0xe3dcc0,0,8,1.6);portalLight.position.copy(portal.position).add(new THREE.Vector3(0,2,.2));scene.add(portalLight);
}
function bakeStaticMeshes(){
 scene.updateMatrixWorld(true);const groups=new Map(),oldGeometries=new Set();
 scene.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||Array.isArray(o.material))return;for(let p=o;p;p=p.parent)if(p.userData.dynamic)return;const pos=o.getWorldPosition(new THREE.Vector3());const key=`${o.material.uuid}:${Math.floor(pos.x/12)}:${Math.floor(pos.z/12)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});
 for(const list of groups.values()){if(list.length<2)continue;const geometries=list.map(o=>o.geometry.clone().applyMatrix4(o.matrixWorld));const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)continue;const mesh=new THREE.Mesh(merged,list[0].material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);list.forEach(o=>{oldGeometries.add(o.geometry);o.removeFromParent();});}
 // Some single meshes can still reference a shared geometry.
 const live=new Set();scene.traverse(o=>{if(o.geometry)live.add(o.geometry);});oldGeometries.forEach(g=>{if(!live.has(g))g.dispose();});
}
function build(save=null){
 disposeScene();seed=save?.seed??crypto.getRandomValues(new Uint32Array(1))[0];rng=seededRandom(seed);level=makeEscapeLevel(seed);progress=save?.progress??newProgress();const q=PRESETS[qualityKey()];graphicsUsed=qualityKey();maze=level.maze;collisionProps=[];sconces=[];lightPool=[];guardianNext=null;lowAreas=[];vents=level.vents;guardianCrawl=0;hunterNavigation=createNavigation();ventMemory=createVentMemory();alertUntil=0;chaseTail=0;breathTimer=0;senseClock=0;lastHeard={player:false,event:null};visited=new Set((save?.visited||[]).map(([r,c])=>maze[r][c]));scare=null;interacting=null;interactionTime=0;noiseEvent=null;puzzleOpen=false;lastRoom='';hasStarted=false;decoyMeshes=[];
 $('keypad').classList.add('hidden');$('journal').classList.add('hidden');document.body.classList.remove('hidden-in-locker','captured');
 scene=new THREE.Scene();scene.background=new THREE.Color(0x080d0f);scene.fog=new THREE.FogExp2(0x0a1112,q.fog);
 if(!renderer){renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;$('game').replaceChildren(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause('The graphics context was interrupted. Reload the page to continue.');});setupLook();}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,q.ratio));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=q.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMappingExposure=Number(ui.brightness.value);
 camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.06,75);camera.rotation.order='YXZ';camera.userData.dynamic=true;scene.add(camera);
 menuCamera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.08,65);
 scene.add(new THREE.HemisphereLight(0x9ab0bd,0x39342a,.55));const moon=new THREE.DirectionalLight(0xa6b8c3,.22);moon.position.set(9,15,-6);scene.add(moon);
 const flash=new THREE.SpotLight(0xffedcd,24,23,Math.PI/7,.72,1);flash.castShadow=q.shadows;flash.shadow.mapSize.set(512,512);flash.shadow.bias=-.001;const target=new THREE.Object3D();target.position.set(0,-.12,-7);flash.position.set(.1,-.18,-.1);camera.add(flash,target);flash.target=target;camera.userData.flash=flash;const spill=new THREE.PointLight(0xb5bcc0,.15,2.7,2);camera.add(spill);camera.userData.spill=spill;attachArms();
 buildTempleRoof(q);buildWallKit();buildVents();buildAtmosphere(q);
 const spawn=level.spawn,exit=level.exit;
 props=buildEscapeProps({scene,level,box,sharedMaterial,wpos,lowAreas});
 collisionProps.push(...props.doors.map(d=>d.collider),...props.lockers.map(e=>e.collider));
 syncProgress(true);
 makePortal(exit);buildGuardian();guardianCell=level.hunterSpawn;guardian.position.copy(wpos(guardianCell));brain={mode:'patrol',target:null,lastSeen:null,memory:0};guardianAwake=false;
 for(let i=0;i<q.lights;i++){const light=new THREE.PointLight(0xffbf78,4.2,7,1.7);scene.add(light);lightPool.push(light);}
 // A small particle field gives the chambers depth without a postprocessing pass.
 const positions=new Float32Array(120*3);for(let i=0;i<120;i++){positions[i*3]=(rng()-.5)*16;positions[i*3+1]=rng()*3.2;positions[i*3+2]=(rng()-.5)*16;}
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(positions,3));dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xc9e1c9,size:.028,transparent:true,opacity:.42,depthWrite:false}));scene.add(dust);
 player.p.copy(wpos(spawn,PLAYER_HEIGHT));player.v.set(0,0,0);Object.assign(player,{vy:0,ground:true,health:100,stamina:100,battery:100,cool:0,speed:0,exhausted:false,running:false,light:true,crouched:false,crouchRequested:false,inVent:false,hidden:false,locker:null,hidingSeen:false});
 elapsed=save?.elapsed??0;awakenAt=elapsed+18;noisePulse=0;ambientTimer=10;heartbeat=0;threat=0;yaw=-Math.PI/2;pitch=0;headBob=0;footstepTimer=0;guardianFootstep=0;uiTime=0;lightTime=0;toastUntil=0;hitUntil=0;
 camera.position.copy(player.p);camera.rotation.set(pitch,yaw,0,'YXZ');
 const pp=wpos(exit);menuCamera.position.set(pp.x-2.8,2.05,pp.z-5.55);menuCamera.lookAt(pp.x,1.65,pp.z+.8);menuCamera.userData.base=menuCamera.position.clone();
 bakeStaticMeshes();applyGraphics();updateLights(menuCamera);updateHud();ui.warning.classList.add('hidden');ui.toast.classList.add('hidden');document.body.classList.remove('hit-flash');clock=new THREE.Clock();
}
function updateLights(view){
 const points=sconces.map(p=>({p,d:horizontalDistance(view.position,p)}));points.sort((a,b)=>a.d-b.d);
 lightPool.forEach((light,i)=>{const point=points[i];light.visible=!!point;if(point){light.position.copy(point.p);light.intensity=(progress.power?4.8:2.5)*(.95+.05*Math.sin(elapsed*1.7+i*6));}});
}
function move(dt){
 if(player.hidden||puzzleOpen){player.v.set(0,0,0);player.speed=0;player.running=false;camera.position.copy(player.p);camera.rotation.set(pitch,yaw,0,'YXZ');updateHeldFlashlight(dt);return;}
 const inputForward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),inputSide=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const hasInput=!!(inputForward||inputSide);
 player.inVent=!!ventAt(player.p,.25);
 const cannotStand=bodyBlocked(collisionProps,player.p.x,player.p.z,.3,PLAYER_HEIGHT,floorAt(player.p.x,player.p.z));
 player.crouched=player.crouchRequested||keys.has('ControlLeft')||keys.has('ControlRight')||cannotStand;
 const eyeHeight=player.crouched?CROUCH_HEIGHT:PLAYER_HEIGHT;
 const wet=cellAt(player.p).surface==='water'&&!progress.drained;player.wet=wet;
 const stamina=updateStamina(player.stamina,player.exhausted,!player.crouched&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),hasInput,dt);player.stamina=stamina.value;player.exhausted=stamina.exhausted;player.running=stamina.running;
 const maxSpeed=(player.crouched?1.65:player.running?5.8:3.45)*(wet?.72:1);
 if(keys.has('ArrowLeft'))yaw+=dt*1.7;if(keys.has('ArrowRight'))yaw-=dt*1.7;
 let dx=-Math.sin(yaw)*inputForward+Math.cos(yaw)*inputSide,dz=-Math.cos(yaw)*inputForward-Math.sin(yaw)*inputSide;const length=Math.hypot(dx,dz);if(length){dx=dx/length*maxSpeed;dz=dz/length*maxSpeed;}
 const smoothing=1-Math.exp(-(hasInput?22:27)*dt);player.v.x=THREE.MathUtils.lerp(player.v.x,dx,smoothing);player.v.z=THREE.MathUtils.lerp(player.v.z,dz,smoothing);
 const distance=slideBody(player.p,player.v.x*dt,player.v.z*dt,collisionProps,.3,eyeHeight,floorAt);const baseHeight=floorAt(player.p.x,player.p.z)+eyeHeight;player.speed=distance/dt;
 if(player.ground){player.p.y=THREE.MathUtils.lerp(player.p.y,baseHeight,1-Math.exp(-dt*16));player.vy=0;}else{player.vy-=16*dt;player.p.y+=player.vy*dt;if(player.p.y<=baseHeight){player.p.y=baseHeight;player.vy=0;player.ground=true;}}
 headBob+=player.speed*dt*2.3;camera.position.copy(player.p);if(ui.shakeToggle.checked&&player.ground)camera.position.y+=Math.sin(headBob*2)*Math.min(player.speed/6,1)*.021;camera.rotation.set(pitch,yaw,0,'YXZ');updateHeldFlashlight(dt);
 visited.add(cellAt(player.p));document.body.classList.toggle('crawling',player.crouched);
 if(player.speed>.15&&player.ground){footstepTimer-=dt;if(footstepTimer<=0){footstepTimer=player.crouched?.65:player.running?.27:.44;noisePulse=.12;sfx(player.inVent?'crawl':wet?'water-step':cellAt(player.p).surface==='metal'?'metal-step':'step');}}else footstepTimer=0;
}
function notifyPlayer(message,seconds=4){ui.toast.textContent=message;ui.toast.classList.remove('hidden');toastUntil=elapsed+seconds;}
function syncProgress(initial=false){
 for(const d of props?.doors||[]){d.targetOpening=progress[d.gate.flag]&&!d.manualClosed?3.3:0;if(initial)d.opening=d.targetOpening;d.root.position.y=d.baseY+d.opening;d.collider.disabled=d.opening>2.05;d.gate.a[d.gate.dir]=d.gate.b[d.gate.back]=!d.collider.disabled;}
 for(const e of props?.entities||[]){const task=TASKS.find(t=>t.id===e.id);e.root.visible=!(task&&['fuse','key','artifact'].includes(e.id)&&progress[task.flag])&&!progress.pickups.includes(e.id);if(e.id==='key'&&!progress.drained)e.root.visible=false;}
 if(props){props.water.visible=!progress.drained;props.flood.visible=!progress.drained;for(const cage of props.cages)cage.visible=!(progress.sealA&&progress.sealB);for(const e of props.entities)if(e.lever)e.lever.rotation.x=progress[e.id]?-.9:0;for(const led of props.indicators){led.material.color.set(progress.power?0xabc399:0xcf9876);led.material.emissive.set(progress.power?0x8da96a:0xcf7653);}}
 hunterNavigation=createNavigation();
}
function checkpoint(message=false){const success=storage.set(SAVE_KEY,JSON.stringify(makeCheckpoint(level,progress,elapsed,visited)));updateContinue();if(message)notifyPlayer(success?'Progress saved. Continue will return you to the arrival hall.':'Your browser could not save progress on this device.',5);return success;}
function updateContinue(){const saved=readCheckpoint(storage.get(SAVE_KEY,'null'));ui.continueBtn.classList.toggle('hidden',!saved);ui.endContinueBtn.classList.toggle('hidden',!saved);}
function nearestEntity(){
 if(player.hidden||puzzleOpen)return null;
 const lookDir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 return props.entities.filter(e=>{
  if(!e.root.visible||progress.pickups.includes(e.id))return false;
  const task=TASKS.find(t=>t.id===e.id);if(task&&progress[task.flag])return false;
  const vector=e.point.clone().sub(player.p),distance=vector.length();
  return distance<2.5&&vector.normalize().dot(lookDir)>.38&&sightClear(player.p,e.point,collisionProps);
 }).sort((a,b)=>horizontalDistance(player.p,a.point)-horizontalDistance(player.p,b.point))[0]||null;
}
function emitNoise(p,range=8){noiseEvent={p:{x:p.x,y:p.y,z:p.z},range,until:elapsed+1.6};}
function taskComplete(id,code){
 const result=completeTask(progress,id,{code,expectedCode:level.code});if(!result.changed){notifyPlayer(result.reason,4);return false;}
 syncProgress();sfx('complete');
 if(id==='exit'){storage.set(SAVE_KEY,'null');finish(true);return true;}
 const messages={fuse:'Replacement fuse packed. Find the generator.',generator:'Power restored. The drainage controls are live.',valve:'Water drained. Look for the brass key in the basin.',key:'Archive key packed. The eastern door can now be unlocked.',archiveGate:'Archive unlocked. Find the operator’s log.',log:`Surface code: ${level.code}. Saved in your journal.`,sealA:'Burial seal released. The stonework shifted in the sanctuary.',sealB:'Lower seal released. Something moved above you.',artifact:'Artifact recovered. Return to Seal Control to release the surface lock.',keypad:'Surface lock released. Go through the workshop to the Escape Wing.'};
 notifyPlayer(messages[id]||'Task completed.',6);if(['generator','valve','sealA','sealB','artifact','keypad'].includes(id)){emitNoise(player.p,14);sfx('distant');}
 checkpoint();updateHud();return true;
}
function interact(){
 if(state!=='playing'||puzzleOpen)return;if(player.hidden){leaveLocker();return;}
 const e=nearestEntity();if(!e)return;
 if(e.kind==='locker'){player.hidingSeen=brain.mode==='chase'&&sightClear({x:guardian.position.x,y:guardian.position.y+1.6,z:guardian.position.z},player.p,collisionProps);player.hidden=true;player.locker=e;player.lightBeforeHide=player.light;player.light=false;player.p.copy(e.hide);player.v.set(0,0,0);yaw=Math.PI;pitch=0;document.body.classList.add('hidden-in-locker');notifyPlayer(player.hidingSeen?'It saw you enter. Find another escape route.':'Stay still and listen. Press E to leave.',4);return;}
 if(e.kind==='battery'||e.kind==='medical'){
  if(e.kind==='battery'&&player.battery>=99||e.kind==='medical'&&player.health>=100){notifyPlayer(e.kind==='battery'?'Battery already full. Leave this for later.':'Health already full.',2);return;}
  if(e.kind==='battery')player.battery=Math.min(100,player.battery+65);else player.health=Math.min(100,player.health+45);
  progress.pickups.push(e.id);e.root.visible=false;sfx('complete');notifyPlayer(e.kind==='battery'?'Battery replaced.':'First-aid kit used.',3);return;
 }
 if(e.kind==='door'&&!progress[e.door.gate.flag]){notifyPlayer(e.door.gate.id==='archiveGate'?'Unlock the archive with its brass key first.':'The surface lock is still engaged.',3);return;}
 if(e.kind==='task'){const status=taskStatus(progress,e.id);if(!status.allowed){notifyPlayer(status.reason,4);return;}}
 if(e.id==='keypad'){openKeypad();return;}
 if(e.duration){interacting=e;interactionTime=0;interactionNoise=0;return;}
 taskComplete(e.id);
}
function leaveLocker(){if(!player.hidden)return;player.p.copy(player.locker.leave);player.hidden=false;player.light=player.lightBeforeHide;player.hidingSeen=false;player.locker=null;document.body.classList.remove('hidden-in-locker');notifyPlayer('Keep moving quietly.',2);}
function tossDecoy(){
 if(state!=='playing'||player.hidden||puzzleOpen)return;if(progress.decoys<=0){notifyPlayer('No distraction stones left.',2);return;}
 const p={x:player.p.x,y:.35,z:player.p.z};slideBody(p,-Math.sin(yaw)*4.8,-Math.cos(yaw)*4.8,collisionProps,.08,.3,floorAt);progress.decoys--;const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(.065,0),sharedMaterial('decoy-stone',{color:0x9b947e,roughness:.85}));stone.userData.dynamic=true;stone.position.copy(player.p).add(new THREE.Vector3(0,-.23,0));scene.add(stone);decoyMeshes.push({mesh:stone,start:stone.position.clone(),end:new THREE.Vector3(p.x,floorAt(p.x,p.z)+.07,p.z),age:0,landed:false});sfx('switch');notifyPlayer('Stone thrown. Move away from the sound.',3);updateHud();
}
function tickInteractions(dt){
 const e=nearestEntity(),nearVent=lowAreas.find(b=>horizontalDistance(b.center,player.p)<2.7);
 if(interacting){if(!keys.has('KeyE')||e!==interacting||player.speed>.25){interacting=null;interactionTime=0;}else{
  interactionTime+=dt;interactionNoise-=dt;if(interactionNoise<=0&&interacting.kind!=='checkpoint'){interactionNoise=.5;emitNoise(player.p,8);sfx('scrape');}
  if(interacting.wheel)interacting.wheel.rotation.z-=dt*2;if(interacting.lever)interacting.lever.rotation.x=-.9*Math.min(1,interactionTime/interacting.duration);
  if(interactionTime>=interacting.duration){const complete=interacting;interacting=null;interactionTime=0;if(complete.kind==='checkpoint'){player.health=100;player.battery=100;checkpoint(true);sfx('complete');}else if(complete.kind==='door'){complete.door.manualClosed=!complete.door.manualClosed;complete.door.targetOpening=complete.door.manualClosed?0:3.3;emitNoise(player.p,6);spatialSfx('clang',complete.point,24);}else taskComplete(complete.id);}
 }}
 ui.interactionBar.classList.toggle('hidden',!interacting);ui.interactionFill.style.width=interacting?`${Math.min(100,interactionTime/interacting.duration*100)}%`:'0%';
 if(e?.kind==='door')e.label=progress[e.door.gate.flag]?(e.door.manualClosed?'Open door slowly':'Close door behind you'):'Door locked';
 const prompt=player.hidden?'E · Leave locker':puzzleOpen?'':e?`${e.duration?'Hold E':'E'} · ${e.label}`:nearVent?player.crouched?'Crawl quietly · The creature can follow':'C · Crouch to enter vent':'';
 ui.prompt.textContent=prompt;ui.prompt.classList.toggle('hidden',!prompt);
}
function cycleFocus(e,panel){if(e.code!=='Tab')return false;const nodes=[...panel.querySelectorAll('button,input,select')].filter(n=>!n.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return true;}
function openJournal(){
 if(!['playing','paused'].includes(state)||puzzleOpen)return;journalReturn=state;state='journal';keys.clear();interacting=null;document.exitPointerLock?.();ui.journal.classList.remove('hidden');audioState();
 ui.journalTasks.replaceChildren();for(const task of TASKS){const li=document.createElement('li');li.className=progress[task.flag]?'complete':task===currentTask(progress)?'active':'';const name=document.createElement('strong'),hint=document.createElement('span');name.textContent=`${progress[task.flag]?'✓':String(TASKS.indexOf(task)+1).padStart(2,'0')}  ${task.title}`;hint.textContent=task.hint;li.append(name,hint);ui.journalTasks.append(li);}
 ui.journalNotes.textContent=progress.codeKnown?`Operator’s log: “Release the burial and lower seals, then take the artifact from the sanctuary. The surface access code is ${level.code}.”`:'Arrival note: The main stairwell is sealed. Follow LOWER TEMPLE signs down, then MAINTENANCE. A spare fuse is in the workshop east of the generator. Bring power online, drain the flooded chamber, and search its basin for the archive key.';
ui.journalClose.focus();
}
function closeJournal(){if(state!=='journal')return;ui.journal.classList.add('hidden');state=journalReturn||'playing';clock.getDelta();audioState();if(state==='playing')requestLook();}
function openKeypad(){puzzleOpen=true;keypadValue='';keys.clear();interacting=null;player.v.set(0,0,0);document.exitPointerLock?.();ui.keypad.classList.remove('hidden');ui.keypadHint.textContent=`Operator’s code: ${level.code}. The creature can still move.`;updateKeypad();ui.keypadClose.focus();}
function closeKeypad(relock=true){puzzleOpen=false;ui.keypad.classList.add('hidden');keys.clear();if(relock&&state==='playing')requestLook();}
function updateKeypad(){ui.keypadDisplay.textContent=keypadValue.padEnd(3,'_');}
function keypadDigit(d){if(puzzleOpen&&keypadValue.length<3){keypadValue+=d;updateKeypad();sfx('switch');}}
function submitKeypad(){if(!puzzleOpen)return;if(keypadValue===level.code){taskComplete('keypad',keypadValue);closeKeypad();}else{keypadValue='';updateKeypad();ui.keypadHint.textContent='Code rejected. Read the operator’s code in J · Journal.';emitNoise(player.p,8);sfx('threat');}}
function damage(amount,message){if(player.cool>0||state!=='playing')return;player.health=Math.max(0,player.health-amount);player.cool=1.6;hitUntil=elapsed+.22;document.body.classList.add('hit-flash');sfx('threat');if(player.health<=0)finish(false,message);}
function tickDoors(dt){
 for(const d of props.doors){const result=advanceDoor(d,dt,player.p,guardianAwake?guardian.position:null,progress[d.gate.flag]);if(result.forced)spatialSfx('clang',d.root.position,30);if(result.changed)hunterNavigation=createNavigation();}
}
let guardianFootstep=0;
function guardianTick(dt){
 if(elapsed<awakenAt)return;
 if(!guardianAwake){guardianAwake=true;guardian.visible=true;spatialSfx('growl',guardian.position,55);}
 const pc=cellAt(player.p),gc=cellAt(guardian.position),d=horizontalDistance(guardian.position,player.p),crawlingHere=!!ventAt(guardian.position,.43);
 const eyes={x:guardian.position.x,y:guardian.position.y+(crawlingHere?.65:1.65),z:guardian.position.z};
 const facing=((player.p.x-guardian.position.x)*Math.sin(guardian.rotation.y)+(player.p.z-guardian.position.z)*Math.cos(guardian.rotation.y))/Math.max(.1,d);
 const beamFacing=((-Math.sin(yaw))*(guardian.position.x-player.p.x)+(-Math.cos(yaw))*(guardian.position.z-player.p.z))/Math.max(.1,d);
 const inBeam=player.light&&beamFacing>.82;
 const visible=!player.hidden&&d<(inBeam?20:player.light?12:player.crouched?4.8:7.5)&&(facing>-.2||d<2.2)&&sightClear(eyes,player.p,collisionProps);
 senseClock-=dt;
 if(senseClock<=0){senseClock=.12;const soundRange=player.running?7:player.wet?5:player.inVent?4:player.crouched?1:3;
  const soundPath=noisePulse>0&&player.speed>.2&&d<soundRange*CELL?navigationPath(maze,gc,pc):[];
  const heardPlayer=noisePulse>0&&player.speed>.2&&(gc===pc||soundPath.length>0&&soundPath.length<=soundRange);
  const eventCell=noiseEvent&&elapsed<noiseEvent.until?cellAt(noiseEvent.p):null,eventPath=eventCell?navigationPath(maze,gc,eventCell):[];
  const heardEvent=eventCell&&(gc===eventCell||eventPath.length>0&&eventPath.length<=noiseEvent.range);
  lastHeard={player:heardPlayer,event:heardEvent?eventCell:null};
 }
 const before=brain.mode,reached=brain.target===gc&&horizontalDistance(guardian.position,wpos(gc))<.45;
 updateHunter(brain,{visible,heard:lastHeard.player||!!lastHeard.event,playerCell:visible||lastHeard.player?pc:lastHeard.event,playerPosition:player.p,reached,dt});
 if(visible){if(chaseTail<=0){alertUntil=elapsed+.58;spatialSfx('growl',eyes,35);sfx('threat');}chaseTail=2.4;}else chaseTail=Math.max(0,chaseTail-dt);
 observeVentUse(ventMemory,level.ventRoutes,{visible,cell:pc,inVent:player.inVent,time:elapsed});
 let intercept=false;const prediction=ventMemory.prediction;
 if(!visible&&prediction&&elapsed<prediction.until&&gc!==prediction.exit){const alternative=navigationPath(maze,gc,prediction.exit,{allowVents:false});if(alternative.length&&alternative.length<18){brain.target=prediction.exit;intercept=true;}}
 if(!brain.target||(brain.mode==='patrol'&&reached))brain.target=pickHuntTarget(level,gc,brain,rng);
 const nav=advanceHunter(hunterNavigation,guardian.position,brain.target,maze,collisionProps,lowAreas,dt,{visible,playerPosition:player.p,lastPosition:brain.lastPosition,mode:chaseTail>0?'chase':brain.mode,aggression:completedTasks(progress)*.5,floorAt,speedScale:elapsed<alertUntil?.12:1,allowVents:!intercept});
 const moving=nav.moving,nextCrawl=nav.crawl;guardianCrawl=THREE.MathUtils.lerp(guardianCrawl,nextCrawl?1:0,1-Math.exp(-dt*12));
 if(nav.heading!==null)guardian.rotation.y+=Math.atan2(Math.sin(nav.heading-guardian.rotation.y),Math.cos(nav.heading-guardian.rotation.y))*Math.min(1,dt*10);
 if(nav.stuck&&(brain.mode==='patrol'||brain.mode==='search'))brain.target=null;
 guardianCell=nav.cell;setGuardianAction(elapsed<alertUntil?'attack':moving?(chaseTail>0?'run':'walk'):'idle');
 creatureRig.restore();guardianMixer?.update(dt);
 const desiredLook=visible?Math.atan2(player.p.x-guardian.position.x,player.p.z-guardian.position.z)-guardian.rotation.y:Math.sin(elapsed*1.3)*.7;
 creatureRig.apply(elapsed,{crawl:guardianCrawl,moving,chase:chaseTail>0,look:Math.atan2(Math.sin(desiredLook),Math.cos(desiredLook)),illuminated:inBeam&&visible});
 guardian.scale.set(1-guardianCrawl*.43,1-guardianCrawl*.65,1-guardianCrawl*.43);
 if(moving&&d<24){guardianFootstep-=dt;if(guardianFootstep<=0){guardianFootstep=nextCrawl?.36:chaseTail>0?.36:.75;spatialSfx(nextCrawl?'scrape':'guardian',eyes,26);}}
 breathTimer-=dt;if(d<18&&breathTimer<=0){breathTimer=chaseTail>0?1.5:3.5;spatialSfx('breath',eyes,18);}
 const pressure=chaseTail>0?Math.max(.2,1-d/25):visible?Math.max(.2,1-d/20):0;
 threat=THREE.MathUtils.lerp(threat,pressure,Math.min(1,dt*3));heartbeat-=dt;if(threat>.25&&heartbeat<=0){heartbeat=1.1-threat*.5;sfx('heartbeat');}
 ui.warning.classList.add('hidden');document.body.style.setProperty('--threat',String(threat*.52));
 if(!player.hidden&&d<.95&&sightClear(eyes,player.p,collisionProps)||player.hidden&&player.hidingSeen&&horizontalDistance(guardian.position,player.locker.leave)<1.4)beginScare();
}
function updateHud(){
 const task=currentTask(progress),room=roomAt(level,player.p);ui.taskCount.textContent=`${completedTasks(progress)} / ${TASKS.length}`;ui.taskTitle.textContent=task.title;ui.objectiveText.textContent=task.hint;ui.locationName.textContent=room?.name.toUpperCase()||'SERVICE PASSAGE';
 ui.healthText.textContent=Math.ceil(player.health);ui.healthBar.style.width=`${player.health}%`;ui.staminaBar.style.width=`${player.stamina}%`;ui.batteryText.textContent=player.light?`${Math.ceil(player.battery)}%`:`OFF · ${Math.ceil(player.battery)}%`;ui.batteryBar.style.width=`${player.battery}%`;$('posture').textContent=player.hidden?'HIDDEN':player.crouched?'CROUCHING':'STANDING';$('fpsText').textContent=`${framesPerSecond} FPS`;
 ui.inventoryText.textContent=[progress.fuseFound&&!progress.power?'FUSE':null,progress.keyFound?'ARCHIVE KEY':null,progress.codeKnown?`CODE ${level.code}`:null,`${progress.decoys} STONES · Q`].filter(Boolean).join('  /  ');
}
function updateWorld(dt){
 elapsed+=dt;for(const d of decoyMeshes){d.age+=dt;const t=Math.min(1,d.age/.45);d.mesh.position.lerpVectors(d.start,d.end,t);d.mesh.position.y+=Math.sin(t*Math.PI)*.4;if(t===1&&!d.landed){d.landed=true;emitNoise(d.end,10);spatialSfx('clang',d.end,26);}}decoyMeshes=decoyMeshes.filter(d=>{if(d.age<20)return true;d.mesh.removeFromParent();d.mesh.geometry.dispose();return false;});noisePulse=Math.max(0,noisePulse-dt);tickDoors(dt);player.cool=Math.max(0,player.cool-dt);move(dt);
 if(player.light)player.battery=Math.max(0,player.battery-dt*.54);else player.battery=Math.min(100,player.battery+dt*4);
 if(player.light&&player.battery===0){player.light=false;notifyPlayer('Flashlight empty. Let it recharge, then press F.',4);}
 const flash=camera.userData.flash;flash.intensity=player.light?24*(player.battery<12?.72+.28*Math.sin(elapsed*17)*Math.sin(elapsed*7):1):0;
 flash.angle=THREE.MathUtils.lerp(flash.angle,player.inVent?.26:Math.PI/7,Math.min(1,dt*8));flash.penumbra=player.inVent?.45:.72;camera.userData.spill.intensity=player.light?.17:.025;
 const targetFov=Number(ui.fov.value)+(ui.shakeToggle.checked?threat*4:0);if(Math.abs(camera.fov-targetFov)>.02){camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,dt*4);camera.updateProjectionMatrix();}
 dust.position.set(player.p.x,floorAt(player.p.x,player.p.z),player.p.z);dust.material.opacity=player.light?.28:.045;
 if(droneGain)droneGain.gain.setTargetAtTime(threat>.1?.025+threat*.025:Math.sin(elapsed*.028)>.4?.016:.001,audioContext.currentTime,.6);
 guardianTick(dt);if(state!=='playing')return;
 tickInteractions(dt);if(state!=='playing')return;
 for(const vent of props.steam){const active=progress.power&&(elapsed+vent.phase)%7<2.5;vent.mesh.visible=active;vent.mesh.scale.setScalar(.9+.15*Math.sin(elapsed*18));if(active&&horizontalDistance(player.p,vent.p)<.5)damage(12,'Stay clear of the steaming pipes.');}
 if(state!=='playing')return;
 ambientTimer-=dt;if(ambientTimer<=0){ambientTimer=14+rng()*28;const route=level.ventRoutes[Math.floor(rng()*level.ventRoutes.length)],source=wpos(rng()<.5?route.a:route.b,.8);spatialSfx(player.inVent||rng()<.55?'clang':'drip',source,40);}
 for(const [i,flame]of props.flames.entries()){flame.scale.y=.85+.17*Math.sin(elapsed*11+i*1.7);flame.material.opacity=.64+.16*Math.sin(elapsed*17+i);}
 props.flood.position.y=.14+Math.sin(elapsed*1.2)*.018;
 if(toastUntil&&elapsed>toastUntil)ui.toast.classList.add('hidden');if(elapsed>hitUntil)document.body.classList.remove('hit-flash');
 uiTime-=dt;if(uiTime<=0){uiTime=.1;updateHud();}lightTime-=dt;if(lightTime<=0){lightTime=.23;updateLights(camera);}
}
function beginScare(){
 if(state!=='playing')return;closeKeypad(false);interacting=null;state='scare';keys.clear();ui.hud.classList.add('hidden');document.exitPointerLock?.();
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
 if(['paused','ended','scare','journal'].includes(state))return;
 const menuView=state!=='playing';menuTime+=dt;const t=menuView?menuTime:elapsed;
 portal.userData.panel.position.y=THREE.MathUtils.lerp(portal.userData.panel.position.y,progress.exitUnlocked?3.2:0,Math.min(1,dt*2));portalLight.intensity=progress.exitUnlocked?5.2:.25;
 if(menuView){camera.userData.flash.intensity=0;camera.userData.spill.intensity=0;armsRoot.visible=false;flashlight.visible=false;if(ui.shakeToggle.checked)menuCamera.position.x=menuCamera.userData.base.x+Math.sin(t*.13)*.12;}
 pipeline.render(menuView?menuCamera:camera,t);
}

function showOnly(panel){for(const node of [ui.menu,ui.pause,ui.endScreen,ui.hud])node.classList.toggle('hidden',node!==panel);}
async function prepare(){
 if(starting)return;starting=true;ready=false;state='loading';showOnly(ui.menu);ui.playBtn.disabled=true;ui.playLabel.textContent='Opening the temple…';ui.loadStatus.textContent='Restoring the stone halls…';ui.reloadBtn.classList.add('hidden');audioState();
 try{await loadAssets();build();renderer.compile(scene,menuCamera);state='menu';ready=true;ui.playBtn.disabled=false;ui.playLabel.textContent='New escape';ui.loadStatus.textContent=touchMode?'Use the arrows to move. Drag the right side to look.':'Your descent awaits.';if(!assets.wall.diffuse)ui.loadStatus.textContent='Some textures did not load. You can still play.';}catch(error){console.error(error);state='error';ui.playLabel.textContent='Unable to open';ui.loadStatus.textContent='The temple could not load. Check that your browser supports WebGL 2, then try again.';ui.reloadBtn.classList.remove('hidden');}finally{starting=false;updateContinue();}
}
let hadLock=false,lookPointer=null,lookX=0,lookY=0;
function requestLook(){
 if(touchMode)return;
 try{const result=renderer.domElement.requestPointerLock?.();result?.catch(()=>{notifyPlayer('Drag to look, or use the arrow keys to turn.',5);});if(!renderer.domElement.requestPointerLock)notifyPlayer('Drag to look, or use the arrow keys to turn.',5);}catch{notifyPlayer('Drag to look, or use the arrow keys to turn.',5);}
}
function enter(){if(!ready||starting)return;keys.clear();state='playing';showOnly(ui.hud);audioStart();audioState();clock.getDelta();requestLook();if(!hasStarted){hasStarted=true;checkpoint();}notifyPlayer('Find the workshop fuse. Follow the signs downstairs. J opens your task journal.',7);updateLights(camera);}
function pause(hint='Your descent will wait.'){
 if(state!=='playing')return;state='paused';keys.clear();closeKeypad(false);interacting=null;lookPointer=null;ui.pauseHint.textContent=hint;ui.pause.classList.remove('hidden');audioState();if(document.pointerLockElement)document.exitPointerLock?.();ui.resumeBtn.focus();
}
function resume(){if(state!=='paused')return;keys.clear();state='playing';ui.pause.classList.add('hidden');clock.getDelta();audioStart();audioState();requestLook();}
function menu(){keys.clear();state='menu';if(document.pointerLockElement)document.exitPointerLock?.();showOnly(ui.menu);audioState();prepare();}
function finish(win,msg){if(!['playing','scare'].includes(state))return;state='ended';ready=false;keys.clear();document.exitPointerLock?.();showOnly(ui.endScreen);ui.endEyebrow.textContent=win?'SURFACE ACCESS RESTORED':'YOUR PROGRESS IS WAITING';ui.endTitle.textContent=win?'Escaped.':'Lost in the temple.';ui.endText.textContent=msg||(win?'You restored power, opened the stairwell, and survived the Hollow.':'You did not reach the gate.');const seconds=Math.floor(elapsed);ui.runStats.replaceChildren();const count=document.createElement('span'),time=document.createElement('span');count.textContent=`${completedTasks(progress)} / ${TASKS.length} tasks`;time.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} elapsed`;ui.runStats.append(count,time);sfx(win?'portal':'threat');setTimeout(audioState,1200);updateContinue();ui.retryBtn.focus();}
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
function toggleLight(){if(state!=='playing'||puzzleOpen)return;if(player.hidden){notifyPlayer('Leave the locker before using your flashlight.',2);return;}if(!player.light&&player.battery<5){notifyPlayer('Let the flashlight recharge to 5% first.',2);return;}player.light=!player.light;sfx('switch');updateHud();}
function look(dx,dy){if(puzzleOpen)return;const s=Number(ui.sensitivity.value);yaw-=dx*.0022*s;pitch=THREE.MathUtils.clamp(pitch-dy*.0020*s,-1.3,1.3);}
function setupLook(){
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{if(state!=='playing'||document.pointerLockElement===canvas||(touchMode&&e.clientX<innerWidth*.4))return;lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(state!=='playing'||e.pointerId!==lookPointer||document.pointerLockElement===canvas)return;look(e.clientX-lookX,e.clientY-lookY);lookX=e.clientX;lookY=e.clientY;});
 const end=e=>{if(e.pointerId===lookPointer)lookPointer=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
}
ui.playBtn.onclick=enter;ui.resumeBtn.onclick=resume;ui.quitBtn.onclick=menu;ui.endMenuBtn.onclick=menu;ui.retryBtn.onclick=()=>{ui.retryBtn.disabled=true;prepare().finally(()=>{ui.retryBtn.disabled=false;});};ui.reloadBtn.onclick=()=>prepare();ui.settingsBtn.onclick=openSettings;ui.pauseSettingsBtn.onclick=openSettings;ui.settingsClose.onclick=closeSettings;ui.hudPause.onclick=()=>pause();ui.touchJump.onclick=jump;ui.touchFlash.onclick=toggleLight;
for(const id of ['sensitivity','brightness'])ui[id].addEventListener('input',()=>{ui[`${id}Value`].value=Number(ui[id].value).toFixed(1);if(id==='brightness'&&renderer)renderer.toneMappingExposure=Number(ui.brightness.value);});
ui.audioToggle.addEventListener('change',()=>{if(ui.audioToggle.checked)audioStart();audioState();});
for(const button of document.querySelectorAll('[data-key]')){const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='playing')return;keys.add(key);button.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));}
addEventListener('keydown',e=>{
 if(!ui.settings.classList.contains('hidden')){if(e.code==='Escape'){e.preventDefault();closeSettings();return;}if(e.code==='Tab'){const focusable=[...ui.settings.querySelectorAll('button,input,select')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(state==='journal'){if(cycleFocus(e,ui.journal))return;if(e.code==='KeyJ'||e.code==='Escape'){e.preventDefault();if(!e.repeat)closeJournal();}return;}
 if(puzzleOpen){if(cycleFocus(e,ui.keypad))return;e.preventDefault();if(e.repeat)return;if(/^Digit[0-9]$|^Numpad[0-9]$/.test(e.code))keypadDigit(e.code.slice(-1));else if(e.code==='Enter')submitKeypad();else if(e.code==='Backspace'){keypadValue=keypadValue.slice(0,-1);updateKeypad();}else if(e.code==='Escape')closeKeypad();return;}
 if(state!=='playing')return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyF','Escape','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyC','KeyJ','KeyQ'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyC')player.crouchRequested=!player.crouchRequested;if(e.code==='KeyJ')openJournal();if(e.code==='KeyQ')tossDecoy();if(e.code==='Space')jump();if(e.code==='KeyE')interact();if(e.code==='KeyF')toggleLight();if(e.code==='Escape')pause();
});
addEventListener('keyup',e=>{keys.delete(e.code);});addEventListener('mousemove',e=>{if(state==='playing'&&document.pointerLockElement===renderer?.domElement)look(e.movementX,e.movementY);});
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===renderer?.domElement;if(hadLock&&!locked&&state==='playing'&&!puzzleOpen)pause();hadLock=locked;});
document.addEventListener('pointerlockerror',()=>{if(state==='playing')notifyPlayer('Drag to look, or use the arrow keys to turn.',5);});
addEventListener('blur',()=>{keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pause();}});
addEventListener('resize',()=>{if(!renderer||!camera)return;for(const view of [camera,menuCamera]){view.aspect=innerWidth/innerHeight;view.updateProjectionMatrix();}renderer.setSize(innerWidth,innerHeight);pipeline?.resize();if(scare){scare.camera.aspect=innerWidth/innerHeight;scare.camera.updateProjectionMatrix();}if(state==='paused'||state==='ended')pipeline?.render(camera,elapsed);});
$('touchCrouch').onclick=()=>{if(state==='playing')player.crouchRequested=!player.crouchRequested;};

for(const id of ['renderScale','fov','fogAmount','sharpness','volume'])ui[id].addEventListener('input',()=>{const output=$(`${id}Value`);if(output)output.value=ui[id].value+(id==='renderScale'||id==='fogAmount'||id==='volume'?'%':id==='fov'?'°':'');if(id==='volume')audioState();});
ui.qualitySelect.addEventListener('change',()=>{const high=['high','ultra'].includes(qualityKey());ui.bloomToggle.checked=high;ui.aoToggle.checked=qualityKey()==='ultra';ui.shadowSelect.value='auto';ui.textureSelect.value='auto';});
ui.journalClose.onclick=closeJournal;ui.hudJournal.onclick=openJournal;ui.touchJournal.onclick=openJournal;ui.touchDecoy.onclick=tossDecoy;
ui.keypadClose.onclick=()=>closeKeypad();ui.keypadClear.onclick=()=>{keypadValue='';updateKeypad();};ui.keypadSubmit.onclick=submitKeypad;
for(const button of document.querySelectorAll('[data-digit]'))button.onclick=()=>keypadDigit(button.dataset.digit);
ui.touchCollect.addEventListener('pointerdown',e=>{e.preventDefault();keys.add('KeyE');ui.touchCollect.setPointerCapture(e.pointerId);interact();});for(const type of ['pointerup','pointercancel','lostpointercapture'])ui.touchCollect.addEventListener(type,()=>keys.delete('KeyE'));
function continueRun(){const save=readCheckpoint(storage.get(SAVE_KEY,'null'));if(!save||!ready&&state!=='ended')return;build(save);ready=true;ui.endScreen.classList.add('hidden');enter();notifyPlayer('Checkpoint restored. You are back in the arrival hall.',5);}
ui.continueBtn.onclick=continueRun;ui.endContinueBtn.onclick=continueRun;
// Asset loading happens before the Play gesture, so mouse capture stays reliable.
prepare();requestAnimationFrame(animate);
