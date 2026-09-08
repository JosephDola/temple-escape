import * as THREE from 'three';

// Layer bounded procedural motion over the artist's skeletal animation clips.
// Restore the animation pose before the next mixer update; offsets never accumulate.
export function createCreatureRig(model){
 const joints=[],eyes=[],offset=new THREE.Quaternion(),rotation=new THREE.Euler();
 model.traverse(bone=>{if(!bone.isBone)return;joints.push({bone,pose:bone.quaternion.clone()});
  if(/^Eye\d+$/.test(bone.name)){
   const glint=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xe5bf71,transparent:true,opacity:0,depthWrite:false}));
   glint.name=`${bone.name} reflection`;glint.userData.eyeGlint=true;glint.castShadow=false;bone.add(glint);eyes.push(glint);
  }
 });
 return {
  joints,eyes,
  restore(){for(const j of joints)j.bone.quaternion.copy(j.pose);},
  apply(time,{crawl=0,moving=false,chase=false,look=0,illuminated=false}={}){
   for(const [i,j]of joints.entries()){
    const {bone}=j;j.pose.copy(bone.quaternion);let x=0,y=0,z=0;
    if(/Center/.test(bone.name)){z=Math.sin(time*(chase?4.4:1.8)+i*.7)*.018;x=-crawl*.09;}
    if(/Tentacle/.test(bone.name)){x=Math.sin(time*(moving?8:2.2)+i*1.3)*(.025+crawl*.16);z=Math.cos(time*6+i*.9)*crawl*.07;}
    if(/TopFace|FrontFace/.test(bone.name)){y=THREE.MathUtils.clamp(look,-.6,.6)*.2;x=Math.sin(time*2.5)*.02-crawl*.11;}
    rotation.set(x,y,z);offset.setFromEuler(rotation);bone.quaternion.multiply(offset).normalize();
   }
   for(const [i,eye]of eyes.entries()){eye.material.opacity=illuminated?.5+.25*Math.sin(time*2+i):.015;eye.scale.setScalar(1+(chase?.15:0));}
  },
 };
}
