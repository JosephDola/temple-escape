import {horizontalDistance,overlapsBox} from './world.js';

export function advanceDoor(door,dt,playerPosition,hunterPosition,unlocked){
 let forced=false;
 const occupied=overlapsBox(door.collider,playerPosition.x,playerPosition.z,.5)||hunterPosition&&overlapsBox(door.collider,hunterPosition.x,hunterPosition.z,.5);
 if(door.manualClosed&&hunterPosition&&unlocked&&horizontalDistance(hunterPosition,door.root.position)<3.1){
  door.force=(door.force||0)+dt;
  if(door.force>1.7){door.manualClosed=false;door.targetOpening=3.3;door.force=0;forced=true;}
 }else door.force=0;
 const difference=door.targetOpening-door.opening;
 if(!(difference<0&&occupied))door.opening+=Math.sign(difference)*Math.min(Math.abs(difference),dt*1.8);
 door.root.position.y=door.baseY+door.opening;
 const previous=door.collider.disabled;
 door.collider.y1=door.baseY+door.opening;door.collider.y2=door.collider.y1+3.15;door.collider.disabled=door.opening>2.05;
 door.gate.a[door.gate.dir]=door.gate.b[door.gate.back]=!door.collider.disabled;
 return {forced,changed:previous!==door.collider.disabled};
}
