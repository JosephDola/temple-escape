import {neighbors} from './world.js';

export function reachableCells(maze,start,maxDistance=Infinity){
 const queue=[start],distance=new Map([[start,0]]);
 for(let i=0;i<queue.length;i++){const cell=queue[i],d=distance.get(cell);if(d>=maxDistance)continue;
  for(const next of [...neighbors(maze,cell),...Object.values(cell.vents||{})])if(!distance.has(next)){distance.set(next,d+1);queue.push(next);}
 }
 return distance;
}
export function pickHuntTarget(level,cell,brain,random){
 const nearby=reachableCells(level.maze,cell,brain.mode==='search'?5:Infinity);
 let pool=[...nearby.keys()].filter(c=>c!==cell&&!c.duct);
 if(brain.mode==='search'){
  const mouths=level.ventRoutes.flatMap(v=>[v.a,v.b]).filter(c=>c!==cell&&nearby.has(c));
  if(mouths.length&&random()<.7)pool=mouths;
 }else{
  const rooms=pool.filter(c=>level.rooms.some(r=>c.r===r.r+Math.floor(r.h/2)&&c.c===r.c+Math.floor(r.w/2)));
  if(rooms.length)pool=rooms;
 }
 return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]||cell;
}
export function createVentMemory(){return {uses:new Map(),inside:null,observed:null,prediction:null};}
// This receives only observations. Hidden player positions are never stored.
export function observeVentUse(memory,routes,{visible,cell,inVent,time}){
 if(!visible)return null;
 if(!inVent){memory.inside=null;memory.prediction=null;return null;}
 const route=routes.find(v=>v.cells.includes(cell));if(!route||memory.inside===route.id)return null;
 memory.inside=route.id;const count=(memory.uses.get(route.id)||0)+1;memory.uses.set(route.id,count);
 const index=route.cells.indexOf(cell),fromA=index<route.cells.length/2,exit=fromA?route.b:route.a;
 memory.observed={route:route.id,exit,time};
 if(count>=2)memory.prediction={exit,until:time+12,route:route.id};
 return memory.prediction;
}
