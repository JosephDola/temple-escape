import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEscapeLevel,newProgress,TASKS,completeTask,currentTask,completedTasks,syncDoors,wallPlan,levelPosition,makeCheckpoint,readCheckpoint,groundHeight,cellHeight} from '../src/campaign.js';
import {navigationPath,bodyBlocked,corridorClear,sightClear,slideBody,neighbors} from '../src/world.js';

test('a full escape is reachable in order and locked rooms cannot be bypassed by vents',()=>{
 for(let seed=0;seed<50;seed++){
  const level=makeEscapeLevel(seed),p=newProgress();let cell=level.spawn;
  assert.equal(level.rooms.length,9);assert.equal(navigationPath(level.maze,cell,level.cells.log).length,0);assert.equal(navigationPath(level.maze,cell,level.exit).length,0);
  assert.equal(completeTask(p,'exit').changed,false);
  for(const task of TASKS){
   const target=level.cells[task.id];assert.ok(cell===target||navigationPath(level.maze,cell,target).length>0,`${seed} ${task.id} reachable`);cell=target;
   assert.equal(currentTask(p).id,task.id);
   if(task.id==='keypad'){assert.equal(completeTask(p,'keypad',{code:'000',expectedCode:level.code}).changed,false);assert.equal(p.exitUnlocked,false);}
   assert.equal(completeTask(p,task.id,{code:level.code,expectedCode:level.code}).changed,true);assert.equal(completeTask(p,task.id,{code:level.code,expectedCode:level.code}).changed,false);
   syncDoors(level,p);
  }
  assert.equal(completedTasks(p),11);assert.equal(p.escaped,true);
 }
});

test('room and corridor boundaries include edges next to unused cells',()=>{
 const level=makeEscapeLevel(7),segments=wallPlan(level.maze),boxes=segments.map(w=>w.box);
 for(const cell of level.maze.flat().filter(c=>c.active&&!c.duct)){
  const center=levelPosition(level,cell);assert.equal(bodyBlocked(boxes,center.x,center.z,.3,1.9,center.y),false);
  for(const next of neighbors(level.maze,cell))assert.equal(corridorClear(center,levelPosition(level,next),boxes,.31,1.9,(x,z)=>groundHeight(level,x,z)),true);
 }
 for(const wall of segments){const p=levelPosition(level,wall.cell),target={x:wall.x*2-p.x,z:wall.z*2-p.z};assert.equal(corridorClear(p,target,boxes,.3,1.9,p.y),false);}
 // The unused gap below the workshop must have a real southern wall.
 assert.ok(segments.some(s=>s.cell===level.maze[5][9]&&s.dir==='s'));
});

test('opening a door updates physical movement, line of sight and route availability together',()=>{
 const level=makeEscapeLevel(4),p=newProgress(),g=level.gates[0],a=levelPosition(level,g.a),b=levelPosition(level,g.b),x=(a.x+b.x)/2;
 const door={x1:x-.14,x2:x+.14,z1:a.z-1.1,z2:a.z+1.1,y1:a.y,y2:a.y+3.15,disabled:false};
 const moving={...a};slideBody(moving,b.x-a.x,0,[door],.3,1.72,a.y);assert.ok(moving.x<x-.3);assert.equal(sightClear({...a,y:a.y+1.7},{...b,y:a.y+1.7},[door]),false);
 p.archiveOpen=true;syncDoors(level,p);door.disabled=true;slideBody(moving,b.x-moving.x,0,[door],.3,1.72,a.y);assert.ok(Math.abs(moving.x-b.x)<.01);
 assert.equal(sightClear({...a,y:a.y+1.7},{...b,y:a.y+1.7},[door]),true);assert.equal(navigationPath(level.maze,g.a,g.b).length,1);
});

test('checkpoints preserve completed tasks, code seed and explored rooms, rejecting invalid saves',()=>{
 const level=makeEscapeLevel(891),p=newProgress();for(const task of TASKS.slice(0,6))completeTask(p,task.id);
 p.decoys=2;p.pickups=['battery-1'];const restored=readCheckpoint(JSON.stringify(makeCheckpoint(level,p,156,new Set([level.spawn,level.cells.fuse]))));
 assert.equal(restored.progress.codeKnown,true);assert.equal(makeEscapeLevel(restored.seed).code,level.code);assert.equal(restored.elapsed,156);assert.equal(restored.progress.decoys,2);assert.equal(restored.visited.length,2);
 assert.equal(readCheckpoint('{broken'),null);assert.equal(readCheckpoint('{"version":2}'),null);
 const inconsistent=readCheckpoint(JSON.stringify({...restored,progress:{...p,power:false,exitUnlocked:true}}));assert.equal(inconsistent.progress.exitUnlocked,false);assert.equal(inconsistent.progress.codeKnown,false);
});

test('expanded zones have continuous traversable slopes and both seals can be used in either order',()=>{
 const level=makeEscapeLevel(71);assert.ok(level.maze.flat().filter(c=>c.active).length>=300);assert.equal(new Set(level.rooms.map(r=>r.floor)).size,3);
 for(const hall of level.halls){for(let i=1;i<hall.route.length;i++){const a=hall.route[i-1],b=hall.route[i],pa=levelPosition(level,a),pb=levelPosition(level,b),x=(pa.x+pb.x)/2,z=(pa.z+pb.z)/2;assert.ok(Math.abs(cellHeight(a,x,z)-cellHeight(b,x,z))<.001,'continuous floor across cells');}}
 for(const order of [['sealA','sealB'],['sealB','sealA']]){
  const p=newProgress();for(const task of TASKS.slice(0,6))assert.equal(completeTask(p,task.id).changed,true);
  assert.equal(completeTask(p,'artifact').changed,false);assert.equal(completeTask(p,order[0]).changed,true);assert.equal(completeTask(p,'artifact').changed,false);
  const save=readCheckpoint(JSON.stringify(makeCheckpoint(level,p,100,new Set())));assert.equal(save.progress[order[0]],true);
  assert.equal(completeTask(p,order[1]).changed,true);assert.equal(completeTask(p,'artifact').changed,true);
 }
});
