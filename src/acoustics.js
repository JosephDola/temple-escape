import {sightClear} from './world.js';
export function acousticPosition(listener,source,yaw,boxes,range=26){
 const dx=source.x-listener.x,dz=source.z-listener.z,distance=Math.hypot(dx,dz),occluded=!sightClear(listener,source,boxes);
 return {pan:Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,distance))),gain:Math.pow(Math.max(0,1-distance/range),1.5)*(occluded?.28:1),muffle:occluded?.35:1};
}
