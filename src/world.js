export const CELL = 4;
export const PLAYER_HEIGHT = 1.72;
export const TOTAL = 5;
export const CROUCH_HEIGHT = .72;
export const VENT_HEIGHT = 1.08;
export const DIRS = [[-1,0,'n','s'],[1,0,'s','n'],[0,-1,'w','e'],[0,1,'e','w']];
export function seededRandom(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function neighbors(maze,cell){return DIRS.filter(d=>!cell[d[2]]&&maze[cell.r+d[0]]?.[cell.c+d[1]]).map(d=>maze[cell.r+d[0]][cell.c+d[1]]);}
export function makeMaze(n=9,rng=Math.random){
 const g=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>({r,c,n:true,s:true,e:true,w:true})));
 const stack=[g[0][0]],seen=new Set(stack);
 const open=(a,b)=>{const d=DIRS.find(d=>a.r+d[0]===b.r&&a.c+d[1]===b.c);if(d){a[d[2]]=false;b[d[3]]=false;}};
 while(stack.length){const a=stack[stack.length-1];const choices=DIRS.map(d=>g[a.r+d[0]]?.[a.c+d[1]]).filter(b=>b&&!seen.has(b));if(!choices.length){stack.pop();continue;}const b=choices[Math.floor(rng()*choices.length)];open(a,b);seen.add(b);stack.push(b);}
 // Four open chambers and a few loops let the player break a chase.
 const rooms=[[0,0],[2,4],[5,1],[n-2,n-2]];
 for(const [r,c]of rooms){for(let y=r;y<r+2;y++)for(let x=c;x<c+2;x++){const a=g[y]?.[x];if(!a)continue;a.room=true;if(x<c+1&&g[y][x+1])open(a,g[y][x+1]);if(y<r+1&&g[y+1]?.[x])open(a,g[y+1][x]);}}
 for(let i=0;i<n+3;i++){const r=Math.floor(rng()*(n-1)),c=Math.floor(rng()*(n-1));open(g[r][c],rng()<.5?g[r+1][c]:g[r][c+1]);}
 return g;
}
export function findPath(maze,a,b){
 if(!a||!b||a===b)return [];
 const queue=[a],prev=new Map([[a,null]]);
 for(let i=0;i<queue.length;i++){const c=queue[i];if(c===b)break;for(const next of neighbors(maze,c))if(!prev.has(next)){prev.set(next,c);queue.push(next);}}
 if(!prev.has(b))return [];
 const out=[];for(let c=b;c&&c!==a;c=prev.get(c))out.push(c);return out.reverse();
}
export function farthestCell(maze,start){let best=start,dist=0;for(const c of maze.flat()){const d=findPath(maze,start,c).length;if(d>dist){dist=d;best=c;}}return best;}
export function chooseCrystals(maze,spawn,exit,count=TOTAL,rng=Math.random){
 const pool=maze.flat().filter(c=>c!==exit&&findPath(maze,spawn,c).length>=3);const picks=[];
 // Start with one approachable goal, then spread the rest throughout the temple.
 pool.sort((a,b)=>findPath(maze,spawn,a).length-findPath(maze,spawn,b).length);
 if(pool.length)picks.push(pool.splice(Math.min(2,pool.length-1),1)[0]);
 while(picks.length<count&&pool.length){let idx=0,best=-1;for(let i=0;i<pool.length;i++){const score=Math.min(...picks.map(p=>findPath(maze,p,pool[i]).length))+rng()*.75;if(score>best){best=score;idx=i;}}picks.push(pool.splice(idx,1)[0]);}return picks;
}
export const horizontalDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function overlapsBox(box,x,z,radius=0){return x+radius>box.x1&&x-radius<box.x2&&z+radius>box.z1&&z-radius<box.z2;}
export function lineClear(a,b,boxes){
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const box of boxes){let low=0,high=1;for(const [p,d,min,max]of [[a.x,dx,box.x1,box.x2],[a.z,dz,box.z1,box.z2]]){if(Math.abs(d)<1e-9){if(p<min||p>max){low=2;break;}}else{let t0=(min-p)/d,t1=(max-p)/d;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);}}if(low<=high&&low<=1&&high>=0)return false;}return true;
}
export function canCollect(player,crystal,boxes,radius=2){return crystal.active&&horizontalDistance(player,crystal)<=radius&&Math.abs(player.y-crystal.y)<2.2&&lineClear(player,crystal,boxes);}
export function trapHits(player,center){return player.y<PLAYER_HEIGHT+.48&&Math.abs(player.x-center.x)<.84&&Math.abs(player.z-center.z)<.28;}
export function updateStamina(value,exhausted,wantsSprint,moving,dt){
 if(exhausted&&value>=30)exhausted=false;
 const running=wantsSprint&&moving&&!exhausted&&value>0;
 value=Math.max(0,Math.min(100,value+(running?-19:16)*dt));
 if(value<=0)exhausted=true;return {value,exhausted,running};
}
export function senseGuardian(brain,{visible,heard,playerCell,dt}){
 if(visible){brain.mode='chase';brain.lastSeen=playerCell;brain.memory=4;brain.target=playerCell;}
 else if(brain.memory>0){brain.memory=Math.max(0,brain.memory-dt);brain.mode='investigate';brain.target=brain.lastSeen;}
 else if(heard){brain.mode='investigate';brain.target=playerCell;brain.lastSeen=playerCell;brain.memory=2;}
 else {brain.mode='patrol';}
 return brain;
}

// Low service ducts add deliberate shortcuts without breaking the normal maze.
export function makeVents(maze, rng=Math.random, count=9){
 const candidates=[];
 for(const a of maze.flat())for(const [dr,dc,dir,back] of DIRS.filter(d=>d[2]==='s'||d[2]==='e')){
  const b=maze[a.r+dr]?.[a.c+dc];
  if(b&&a[dir]&&a.r+a.c>1&&findPath(maze,a,b).length>=4)candidates.push({a,b,dir,back,score:findPath(maze,a,b).length+rng()*8});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const selected=[],used=new Map();
 for(const v of candidates){if(selected.length>=count)break;if((used.get(v.a)||0)>=2||(used.get(v.b)||0)>=2)continue;
  (v.a.vents??={})[v.dir]=v.b;(v.b.vents??={})[v.back]=v.a;used.set(v.a,(used.get(v.a)||0)+1);used.set(v.b,(used.get(v.b)||0)+1);selected.push(v);
 }return selected;
}
export function navigationPath(maze,start,goal,{allowVents=true,ventCost=1.9}={}){
 if(!start||!goal||start===goal)return [];
 const costs=new Map([[start,0]]),previous=new Map(),open=[start],closed=new Set();
 const heuristic=c=>Math.abs(c.r-goal.r)+Math.abs(c.c-goal.c);
 while(open.length){open.sort((a,b)=>costs.get(a)+heuristic(a)-costs.get(b)-heuristic(b));const a=open.shift();if(a===goal)break;if(closed.has(a))continue;closed.add(a);
  const edges=neighbors(maze,a).map(cell=>({cell,cost:1}));if(allowVents)for(const cell of Object.values(a.vents||{}))edges.push({cell,cost:ventCost});
  for(const {cell,cost}of edges){const score=costs.get(a)+cost;if(score<(costs.get(cell)??Infinity)){costs.set(cell,score);previous.set(cell,a);open.push(cell);}}
 }
 if(!previous.has(goal))return [];const out=[];for(let c=goal;c!==start;c=previous.get(c))out.push(c);return out.reverse();
}
export function bodyBlocked(boxes,x,z,radius=.3,height=PLAYER_HEIGHT){return boxes.some(b=>(b.y1??0)<height+.08&&(b.y2??10)>.12&&overlapsBox(b,x,z,radius));}
export function corridorClear(a,b,boxes,radius=.3,height=PLAYER_HEIGHT){
 return lineClear(a,b,boxes.filter(box=>(box.y1??0)<height+.08&&(box.y2??10)>.12).map(box=>({...box,x1:box.x1-radius,x2:box.x2+radius,z1:box.z1-radius,z2:box.z2+radius})));
}
export function sightClear(a,b,boxes){
 for(const box of boxes){let near=0,far=1;for(const [p,d,lo,hi]of [[a.x,b.x-a.x,box.x1,box.x2],[a.y,b.y-a.y,box.y1??0,box.y2??10],[a.z,b.z-a.z,box.z1,box.z2]]){
   if(Math.abs(d)<1e-8){if(p<lo||p>hi){near=2;break;}}else{let t1=(lo-p)/d,t2=(hi-p)/d;if(t1>t2)[t1,t2]=[t2,t1];near=Math.max(near,t1);far=Math.min(far,t2);}
  }if(near<=far&&near<=1&&far>=0)return false;
 }return true;
}
export function slideBody(pos,dx,dz,boxes,radius=.3,height=PLAYER_HEIGHT){
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));let traveled=0;
 for(let i=0;i<n;i++){const ox=pos.x,oz=pos.z;if(!bodyBlocked(boxes,pos.x+dx/n,pos.z,radius,height))pos.x+=dx/n;if(!bodyBlocked(boxes,pos.x,pos.z+dz/n,radius,height))pos.z+=dz/n;traveled+=Math.hypot(pos.x-ox,pos.z-oz);}return traveled;
}
export function updateHunter(brain,{visible,heard,playerCell,playerPosition,reached,dt}){
 brain.memory=Math.max(0,(brain.memory||0)-dt);brain.searchTime=Math.max(0,(brain.searchTime||0)-dt);
 if(visible){brain.mode='chase';brain.target=playerCell;brain.lastSeen=playerCell;brain.lastPosition={x:playerPosition.x,z:playerPosition.z};brain.memory=8;brain.searchTime=5;}
 else if(heard){brain.mode='investigate';brain.target=playerCell;brain.lastSeen=playerCell;brain.lastPosition=null;brain.memory=7;brain.searchTime=5;}
 else if(brain.memory>0){brain.mode='investigate';if(reached){brain.mode='search';brain.memory=0;brain.target=null;brain.searchTime=5;}}
 else if(brain.searchTime>0){brain.mode='search';if(reached)brain.target=null;}
 else{if(brain.mode!=='patrol')brain.target=null;brain.mode='patrol';}
 return brain;
}
