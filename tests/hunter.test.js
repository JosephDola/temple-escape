import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMaze,seededRandom,makeVents,navigationPath,findPath,bodyBlocked,sightClear,slideBody,updateHunter,CROUCH_HEIGHT} from '../src/world.js';
import {advanceHunter,createNavigation,cellPosition} from '../src/hunter.js';

function grid(n){return Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>({r,c,n:true,s:true,w:true,e:true})));}
function connect(a,b){if(a.r===b.r){a[a.c<b.c?'e':'w']=false;b[a.c<b.c?'w':'e']=false;}else{a[a.r<b.r?'s':'n']=false;b[a.r<b.r?'n':'s']=false;}}
function walls(maze){const boxes=[],add=(x,z,w,d)=>boxes.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2,y1:0,y2:4});for(const c of maze.flat()){const {x,z}=cellPosition(maze,c);if(c.n)add(x,z-2,4.3,.3);if(c.w)add(x-2,z,.3,4.3);if(c.r===maze.length-1&&c.s)add(x,z+2,4.3,.3);if(c.c===maze.length-1&&c.e)add(x+2,z,.3,4.3);}return boxes;}

test('hunter turns through a winding passage and reacts to a changed target without wall crossings',()=>{
 const maze=grid(3),route=[[2,0],[1,0],[1,1],[0,1],[0,2],[1,2],[2,2]].map(([r,c])=>maze[r][c]);for(let i=1;i<route.length;i++)connect(route[i-1],route[i]);const boxes=walls(maze),nav=createNavigation(),position={...cellPosition(maze,route[0])};
 let goal=route.at(-1);
 for(let frame=0;frame<1200;frame++){
  if(frame===100)goal=route[2];if(frame===250)goal=route.at(-1);
  advanceHunter(nav,position,goal,maze,boxes,[],1/60,{mode:'chase',visible:true,playerPosition:cellPosition(maze,goal)});
  assert.equal(bodyBlocked(boxes,position.x,position.z,.31,1.9),false,`wall collision on frame ${frame}`);
 }
 assert.ok(Math.hypot(position.x-4,position.z-4)<.2,JSON.stringify(position));
});

test('the hunter crawls through a low duct, emerges, and stands again',()=>{
 const maze=grid(2),a=maze[0][0],b=maze[0][1];a.vents={e:b};b.vents={w:a};
 const boxes=[{x1:-1.1,x2:1.1,z1:-2.64,z2:-1.36,y1:1.08,y2:1.2},{x1:-1.1,x2:1.1,z1:-2.74,z2:-2.64,y1:0,y2:1.1},{x1:-1.1,x2:1.1,z1:-1.36,z2:-1.26,y1:0,y2:1.1}];
 const low=[{x1:-1.1,x2:1.1,z1:-2.64,z2:-1.36}],position={x:-2,z:-2},nav=createNavigation();let entered=false,last;
 assert.equal(bodyBlocked(boxes,0,-2,.3,1.72),true);assert.equal(bodyBlocked(boxes,0,-2,.3,CROUCH_HEIGHT),false);
 for(let i=0;i<240;i++){last=advanceHunter(nav,position,b,maze,boxes,low,1/60,{mode:'chase'});entered ||= last.crawl;assert.equal(bodyBlocked(boxes,position.x,position.z,.31,last.crawl?CROUCH_HEIGHT:1.9),false);}
 assert.equal(entered,true);assert.equal(last.crawl,false);assert.ok(Math.abs(position.x-2)<.1);
});

test('100 layouts: reciprocal vent links give useful shortcuts without removing normal escape paths',()=>{
 for(let seed=1;seed<=100;seed++){const random=seededRandom(seed),maze=makeMaze(9,random),vents=makeVents(maze,random);assert.ok(vents.length>=4);
  for(const v of vents){assert.equal(v.a.vents[v.dir],v.b);assert.equal(v.b.vents[v.back],v.a);assert.equal(v.a[v.dir],true);assert.ok(findPath(maze,v.a,v.b).length>=4);assert.deepEqual(navigationPath(maze,v.a,v.b),[v.b]);}
  assert.ok(findPath(maze,maze[0][0],maze[8][8]).length>0);
 }
});

test('low ceilings block standing sight while allowing crouched sight; large steps cannot tunnel through walls',()=>{
 const roof={x1:-1,x2:1,z1:-1,z2:1,y1:1.08,y2:4};
 assert.equal(sightClear({x:-2,y:1.72,z:0},{x:2,y:1.72,z:0},[roof]),false);
 assert.equal(sightClear({x:-2,y:.72,z:0},{x:2,y:.72,z:0},[roof]),true);
 const wall={x1:0,x2:.3,z1:-5,z2:5},p={x:-1,z:0};slideBody(p,8,1,[wall],.3,1.72);assert.ok(p.x<=-.3);assert.ok(p.z>.9);
});

test('last known location persists through lost sight, followed by a bounded search and patrol',()=>{
 const a={r:0,c:0},b={r:5,c:5},brain={mode:'patrol',memory:0};
 updateHunter(brain,{visible:true,heard:false,playerCell:a,playerPosition:{x:1,z:2},dt:.1});
 updateHunter(brain,{visible:false,heard:false,playerCell:b,playerPosition:{x:30,z:30},dt:1,reached:false});assert.equal(brain.mode,'investigate');assert.equal(brain.target,a);assert.deepEqual(brain.lastPosition,{x:1,z:2});
 updateHunter(brain,{visible:false,heard:false,dt:.1,reached:true});assert.equal(brain.mode,'search');
 updateHunter(brain,{visible:false,heard:false,dt:6,reached:false});assert.equal(brain.mode,'patrol');
});
