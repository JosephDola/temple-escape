import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeEscapeLevel,levelPosition,wallPlan,newProgress,TASKS,syncDoors,groundHeight} from '../src/campaign.js';
import {buildEscapeProps,buildCrawlways} from '../src/escape-props.js';
import {neighbors,corridorClear,bodyBlocked,sightClear,CROUCH_HEIGHT,horizontalDistance} from '../src/world.js';
import {advanceHunter,createNavigation} from '../src/hunter.js';

// CPU geometry only: no browser, WebGL context or screenshots are involved.
function fixture(){
 const oldDocument=globalThis.document;
 globalThis.document={createElement(){return {getContext(){return {fillRect(){},strokeRect(){},fillText(){}};}};}};
 const level=makeEscapeLevel(3),scene=new THREE.Scene(),lowAreas=[],boxes=wallPlan(level.maze).map(s=>s.box),cache=new Map();
 const sharedMaterial=(id,props)=>{if(!cache.has(id))cache.set(id,new THREE.MeshStandardMaterial(props));return cache.get(id);};
 const wpos=(cell,y=0)=>{const p=levelPosition(level,cell,y);return new THREE.Vector3(p.x,p.y,p.z);};
 const box=(x,y,z,w,h,d,mat,collide=true)=>{y+=groundHeight(level,x,z);const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);scene.add(m);if(collide)boxes.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2,y1:y-h/2,y2:y+h/2});return m;};
 let props;
 try{buildCrawlways({scene,vents:level.vents,box,sharedMaterial,wpos,makeWallMaterial:()=>sharedMaterial('wall',{color:0x777777}),lowAreas});props=buildEscapeProps({scene,level,box,sharedMaterial,wpos,lowAreas});}finally{globalThis.document=oldDocument;}
 boxes.push(...props.doors.map(d=>d.collider),...props.lockers.map(l=>l.collider));
 return {level,scene,boxes,props,lowAreas,wpos,floorAt:(x,z)=>groundHeight(level,x,z)};
}

test('actual equipment and duct colliders leave navigable lanes and usable interaction points',()=>{
 const {level,boxes,props,wpos,floorAt}=fixture();
 for(const cell of level.maze.flat().filter(c=>c.active)){
  const p=wpos(cell);assert.equal(bodyBlocked(boxes,p.x,p.z,.31,cell.duct?CROUCH_HEIGHT:1.9,p.y),false,`blocked cell ${cell.r},${cell.c}`);
  for(const next of neighbors(level.maze,cell))assert.equal(corridorClear(p,wpos(next),boxes,.31,1.9,floorAt),true,`equipment blocks ${cell.r},${cell.c} to ${next.r},${next.c}`);
  for(const next of Object.values(cell.vents||{}))assert.equal(corridorClear(p,wpos(next),boxes,.31,CROUCH_HEIGHT,floorAt),true,`duct ${cell.r},${cell.c} to ${next.r},${next.c} obstructed: ${JSON.stringify(boxes.filter(b=>!corridorClear(p,wpos(next),[b],.31,CROUCH_HEIGHT,floorAt)))}`);
 }
 for(const e of props.entities){
  let accessible=false;
  for(const radius of [1.25,1.65,2.0])for(let i=0;i<24;i++){const a=i/24*Math.PI*2,p={x:e.point.x+Math.sin(a)*radius,y:e.point.y,z:e.point.z+Math.cos(a)*radius};
   p.y=floorAt(p.x,p.z)+1.72;if(!bodyBlocked(boxes,p.x,p.z,.3,1.72,floorAt(p.x,p.z))&&sightClear(p,e.point,boxes))accessible=true;
  }
  assert.equal(accessible,true,`${e.id} has an accessible interaction point`);
 }
 for(const locker of props.lockers)assert.equal(bodyBlocked(boxes,locker.leave.x,locker.leave.z,.3,1.72,floorAt(locker.leave.x,locker.leave.z)),false,`${locker.id} exit is clear`);
});


test('the hunter traverses every complete crawlway in both directions including a right-angle turn',()=>{
 const {level,boxes,lowAreas,wpos,floorAt}=fixture();
 for(const route of level.ventRoutes)for(const reverse of [false,true]){
  const p=wpos(reverse?route.b:route.a),goal=reverse?route.a:route.b,nav=createNavigation();let crawled=false;
  for(let frame=0;frame<1800;frame++){const result=advanceHunter(nav,p,goal,level.maze,boxes,lowAreas,1/60,{mode:'chase',floorAt});crawled ||= result.crawl;assert.equal(bodyBlocked(boxes,p.x,p.z,.31,result.crawl?CROUCH_HEIGHT:1.9,floorAt(p.x,p.z)),false,`vent ${route.id} collision`);if(horizontalDistance(p,wpos(goal))<.15)break;}
  assert.equal(crawled,true,`never crawled ${route.id}`);assert.ok(horizontalDistance(p,wpos(goal))<.2,`did not emerge ${route.id} reverse ${reverse}: ${JSON.stringify(p)}`);
 }
});

test('the physical hunter reaches every task over the actual floors and equipment',()=>{
 const {level,boxes,lowAreas,wpos,floorAt,props}=fixture(),p=wpos(level.spawn),progress=newProgress();
 for(const task of TASKS){
  const target=level.cells[task.id],nav=createNavigation();
  for(let frame=0;frame<10000&&horizontalDistance(p,wpos(target))>.2;frame++)advanceHunter(nav,p,target,level.maze,boxes,lowAreas,1/30,{mode:'chase',floorAt});
  assert.ok(horizontalDistance(p,wpos(target))<.25,`failed to reach ${task.id} at ${JSON.stringify(p)}`);assert.ok(Math.abs(p.y-floorAt(p.x,p.z))<.001);
  progress[task.flag]=true;syncDoors(level,progress);for(const door of props.doors)door.collider.disabled=progress[door.gate.flag];
 }
});
