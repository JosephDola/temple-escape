import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCreatureRig} from '../src/creature-rig.js';
import {makeEscapeLevel,levelPosition} from '../src/campaign.js';
import {createVentMemory,observeVentUse,pickHuntTarget} from '../src/hunt-director.js';
import {acousticPosition} from '../src/acoustics.js';
import {advanceDoor} from '../src/doors.js';
import {navigationPath,bodyBlocked} from '../src/world.js';

test('vent prediction needs two observed entries and never learns from hidden movement',()=>{
 const level=makeEscapeLevel(6),memory=createVentMemory(),v=level.ventRoutes[4];
 for(let time=0;time<5;time++)observeVentUse(memory,level.ventRoutes,{visible:false,cell:v.a,inVent:true,time});
 assert.equal(memory.uses.size,0);
 observeVentUse(memory,level.ventRoutes,{visible:true,cell:v.a,inVent:true,time:6});
 for(let time=7;time<10;time++)observeVentUse(memory,level.ventRoutes,{visible:true,cell:v.cells[1],inVent:true,time});
 assert.equal(memory.uses.get(v.id),1);assert.equal(memory.prediction,null);
 observeVentUse(memory,level.ventRoutes,{visible:true,cell:level.spawn,inVent:false,time:11});
 const guess=observeVentUse(memory,level.ventRoutes,{visible:true,cell:v.a,inVent:true,time:12});
 assert.equal(guess.exit,v.b);assert.equal(guess.until,24);
 observeVentUse(memory,level.ventRoutes,{visible:false,cell:level.spawn,inVent:false,time:13});
 assert.equal(memory.prediction.exit,v.b);assert.equal(memory.observed.time,12);
});

test('patrol and local vent searches select reachable rooms without knowing the player position',()=>{
 const level=makeEscapeLevel(3);
 for(const mode of ['patrol','search'])for(let i=0;i<20;i++){
  const target=pickHuntTarget(level,level.hunterSpawn,{mode},()=>i/20);
  assert.ok(navigationPath(level.maze,level.hunterSpawn,target).length>0);
  assert.notEqual(target.roomId,'archive');assert.notEqual(target.roomId,'exit');
 }
});

test('world sounds pan with camera heading, attenuate with distance and muffle behind a wall',()=>{
 const listener={x:0,y:1.7,z:0},source={x:4,y:1,z:0};
 const clear=acousticPosition(listener,source,0,[]),wall={x1:2,x2:2.3,z1:-1,z2:1,y1:0,y2:4};
 assert.equal(clear.pan,1);assert.equal(acousticPosition(listener,source,Math.PI,[]).pan,-1);
 const muffled=acousticPosition(listener,source,0,[wall]);assert.ok(muffled.gain<clear.gain*.3);assert.ok(muffled.muffle<clear.muffle);
 assert.ok(acousticPosition(listener,{...source,x:24},0,[]).gain<clear.gain);assert.equal(acousticPosition(listener,{...source,x:50},0,[]).gain,0);
});

test('moving doors synchronize the route, delay the hunter, and stop before closing onto the player',()=>{
 const level=makeEscapeLevel(2),gate=level.gates[0],a=levelPosition(level,gate.a),b=levelPosition(level,gate.b),x=(a.x+b.x)/2;
 const door={gate,root:{position:{x,y:a.y,z:a.z}},baseY:a.y,opening:0,targetOpening:3.3,manualClosed:false,collider:{x1:x-.14,x2:x+.14,z1:a.z-1.1,z2:a.z+1.1,y1:a.y,y2:a.y+3.15}};
 for(let i=0;i<120;i++)advanceDoor(door,1/60,a,null,true);
 assert.equal(gate.a.e,false);assert.equal(door.collider.disabled,true);
 door.manualClosed=true;door.targetOpening=0;advanceDoor(door,.5,{x,z:a.z},null,true);assert.equal(door.opening,3.3);
 for(let i=0;i<120;i++)advanceDoor(door,1/60,{x:x-5,z:a.z},null,true);
 assert.equal(door.opening,0);assert.equal(gate.a.e,true);assert.equal(bodyBlocked([door.collider],x,a.z,.3,1.72,a.y),true);
 let forced=false;for(let i=0;i<240;i++){const result=advanceDoor(door,1/60,{x:x-5,z:a.z},{x:x+2,z:a.z},true);if(result.forced)forced=true;}
 assert.equal(forced,true);assert.equal(door.collider.disabled,true);
});

test('the shipped eighteen-bone creature animates, fits its crawlway, and procedural offsets do not drift',async()=>{
 const bytes=await fs.readFile('public/models/maw-gooey.glb'),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const model=gltf.scene;model.rotation.y=-Math.PI/2;model.scale.set(.39,.67,.43);model.position.y=.28;
 const root=new THREE.Group();root.add(model);const rig=createCreatureRig(model),mixer=new THREE.AnimationMixer(model);
 assert.equal(rig.joints.length,18);assert.equal(rig.eyes.length,3);assert.deepEqual(gltf.animations.map(c=>c.name).sort(),['Attack','Death','IdleFinal','Walk']);
 for(const name of ['IdleFinal','Walk','Attack']){
  mixer.stopAllAction();mixer.clipAction(gltf.animations.find(a=>a.name===name)).play();
  for(let frame=0;frame<240;frame++){
   rig.restore();mixer.update(1/60);const poses=rig.joints.map(j=>j.bone.quaternion.clone());rig.apply(frame/60,{crawl:name==='Walk'?1:0,moving:true,chase:true,look:.4,illuminated:true});
   for(const joint of rig.joints)assert.ok(Math.abs(joint.bone.quaternion.length()-1)<1e-8);
   rig.restore();for(let i=0;i<poses.length;i++)assert.deepEqual(rig.joints[i].bone.quaternion.toArray(),poses[i].toArray());
  }
 }
 mixer.stopAllAction();mixer.clipAction(gltf.animations.find(a=>a.name==='Walk')).play();mixer.update(.2);rig.apply(.2,{crawl:1,moving:true});root.scale.set(.57,.35,.57);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());assert.ok(bounds.y<1.08,`crawl height ${bounds.y}`);assert.ok(bounds.x<1.28,`crawl width ${bounds.x}`);
});
