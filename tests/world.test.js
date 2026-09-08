import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMaze,seededRandom,neighbors,findPath,chooseCrystals,DIRS,CELL,PLAYER_HEIGHT,lineClear,canCollect,trapHits,updateStamina,senseGuardian} from '../src/world.js';

test('100 maze seeds: every cell is reachable, borders closed, goals unique, routes avoid walls',()=>{
 for(let seed=1;seed<=100;seed++){
  const rng=seededRandom(seed),maze=makeMaze(9,rng),spawn=maze[0][0],exit=maze[7][7];
  const visited=new Set([spawn]),queue=[spawn];for(let i=0;i<queue.length;i++)for(const c of neighbors(maze,queue[i]))if(!visited.has(c)){visited.add(c);queue.push(c);}
  assert.equal(visited.size,81,`seed ${seed}`);
  for(const cell of maze.flat())for(const d of DIRS){const next=maze[cell.r+d[0]]?.[cell.c+d[1]];if(next)assert.equal(cell[d[2]],next[d[3]]);else assert.equal(cell[d[2]],true);}
  const crystals=chooseCrystals(maze,spawn,exit,5,rng);assert.equal(new Set(crystals).size,5);assert.ok(!crystals.includes(spawn)&&!crystals.includes(exit));
  let current=spawn;for(const target of [...crystals,exit]){for(const c of findPath(maze,current,target)){assert.ok(neighbors(maze,current).includes(c));current=c;}assert.equal(current,target);}
 }
});
test('walls block sight and pickups, including through a corner',()=>{
 const wall={x1:1,x2:1.3,z1:-2,z2:2},a={x:0,y:PLAYER_HEIGHT,z:0};
 assert.equal(lineClear(a,{x:2,z:0},[wall]),false);assert.equal(lineClear(a,{x:0,z:3},[wall]),true);assert.equal(lineClear({x:0,z:3},{x:2,z:1},[wall]),false);
 assert.equal(canCollect(a,{x:1.8,y:1.1,z:0,active:true},[wall]),false);assert.equal(canCollect(a,{x:.7,y:1.1,z:0,active:true},[wall],.8),true);assert.equal(canCollect(a,{x:.7,y:1.1,z:0,active:false},[]),false);
});
test('trap footprints leave a way around and jumping clears them',()=>{
 const spike={x:0,z:0};assert.equal(trapHits({x:0,y:PLAYER_HEIGHT,z:0},spike),true);assert.equal(trapHits({x:1.2,y:PLAYER_HEIGHT,z:0},spike),false);assert.equal(trapHits({x:0,y:PLAYER_HEIGHT,z:.8},spike),false);assert.equal(trapHits({x:0,y:PLAYER_HEIGHT+.6,z:0},spike),false);
});
test('sprinting stays exhausted until stamina recovers and does not flicker at zero',()=>{
 let s={value:1,exhausted:false};s=updateStamina(s.value,s.exhausted,true,true,.1);assert.equal(s.exhausted,true);assert.equal(s.value,0);
 for(let i=0;i<18;i++){s=updateStamina(s.value,s.exhausted,true,true,.1);assert.equal(s.running,false);}
 assert.ok(s.value<30);for(let i=0;i<3;i++)s=updateStamina(s.value,s.exhausted,true,true,.1);assert.equal(s.running,true);
});
test('Guardian investigates last seen position, then loses track instead of following through walls',()=>{
 const seenCell={r:1,c:2},hiddenCell={r:4,c:4},b={mode:'patrol',target:null,lastSeen:null,memory:0};
 senseGuardian(b,{visible:true,heard:false,playerCell:seenCell,dt:.1});assert.equal(b.mode,'chase');
 senseGuardian(b,{visible:false,heard:false,playerCell:hiddenCell,dt:1});assert.equal(b.mode,'investigate');assert.equal(b.target,seenCell);
 for(let i=0;i<5;i++)senseGuardian(b,{visible:false,heard:false,playerCell:hiddenCell,dt:1});assert.equal(b.mode,'patrol');assert.notEqual(b.target,hiddenCell);
 senseGuardian(b,{visible:false,heard:true,playerCell:hiddenCell,dt:.1});assert.equal(b.mode,'investigate');assert.equal(b.target,hiddenCell);
});
