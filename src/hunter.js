import {CELL,CROUCH_HEIGHT,horizontalDistance,navigationPath,corridorClear,slideBody,overlapsBox} from './world.js';

export const cellPosition=(maze,c)=>({x:(c.c-(maze.length-1)/2)*CELL,z:(c.r-(maze.length-1)/2)*CELL});
export const positionCell=(maze,p)=>maze[Math.max(0,Math.min(maze.length-1,Math.round(p.z/CELL+(maze.length-1)/2)))][Math.max(0,Math.min(maze.length-1,Math.round(p.x/CELL+(maze.length-1)/2)))];
export function createNavigation(){return {route:[],goal:null,cooldown:0,stuck:0};}

// Uses the same collision body as the player. No frame-rate-dependent teleporting.
export function advanceHunter(nav,position,goal,maze,boxes,lowAreas,dt,{visible=false,playerPosition=null,lastPosition=null,mode='patrol',aggression=0,floorAt=()=>0,speedScale=1,allowVents=true}={}){
 position.y=floorAt(position.x,position.z);const cell=positionCell(maze,position),crawl=lowAreas.some(b=>overlapsBox(b,position.x,position.z,.55));
 nav.cooldown-=dt;
 if(nav.cooldown<=0||nav.goal!==goal||nav.allowVents!==allowVents){nav.cooldown=.28;nav.goal=goal;nav.allowVents=allowVents;nav.route=navigationPath(maze,cell,goal,{allowVents,ventCost:mode==='chase'?1.3:1.9});}
 let target=null;
 if(visible&&playerPosition&&corridorClear(position,playerPosition,boxes,.31,crawl?CROUCH_HEIGHT:1.9,floorAt))target=playerPosition;
 else if(nav.route.length){const next=cellPosition(maze,nav.route[0]),throughVent=Object.values(cell.vents||{}).includes(nav.route[0]);target=corridorClear(position,next,boxes,.31,throughVent||crawl?CROUCH_HEIGHT:1.9,floorAt)?next:cellPosition(maze,cell);}
 else if(lastPosition&&goal===cell&&corridorClear(position,lastPosition,boxes,.31,crawl?CROUCH_HEIGHT:1.9,floorAt))target=lastPosition;
 else if(horizontalDistance(position,cellPosition(maze,cell))>.08)target=cellPosition(maze,cell);
 const speed=crawl?1.9:mode==='chase'?3.9+aggression*.06:mode==='investigate'?2.6:1.8;
 let moving=false,heading=null;
 if(target){const dx=target.x-position.x,dz=target.z-position.z,dist=Math.hypot(dx,dz);if(dist>.04){const step=Math.min(speed*speedScale*dt,dist),traveled=slideBody(position,dx/dist*step,dz/dist*step,boxes,.31,crawl?CROUCH_HEIGHT:1.9,floorAt);moving=traveled>.0001;nav.stuck=moving?0:nav.stuck+dt;heading=Math.atan2(dx,dz);}
  else if(nav.route.length&&horizontalDistance(position,cellPosition(maze,nav.route[0]))<.15){nav.route.shift();nav.cooldown=0;}
 }
 const stuck=nav.stuck>.65;if(stuck){nav.cooldown=0;nav.goal=null;nav.stuck=0;}
 position.y=floorAt(position.x,position.z);return {moving,heading,crawl,stuck,cell:positionCell(maze,position)};
}
