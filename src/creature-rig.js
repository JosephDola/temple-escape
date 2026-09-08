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
   const moveRate=moving?(chase?10.5:7.5):2.1;
   for(const [i,j]of joints.entries()){
    const {bone}=j;j.pose.copy(bone.quaternion);let x=0,y=0,z=0;const phase=time*moveRate+i*.83;
    if(/Center/.test(bone.name)){z=Math.sin(time*(chase?5.2:1.8)+i*.7)*(.018+(chase?.012:0));x=-crawl*.095+Math.sin(time*2.3+i)*.008;}
    if(/Tentacle/.test(bone.name)){x=Math.sin(phase+i*.47)*(.028+crawl*.17+(chase?.025:0));z=Math.cos(phase*.72+i*.9)*(.012+crawl*.075);y=Math.sin(phase*.45+i)*chase*.018;}
    if(/TopFace|FrontFace/.test(bone.name)){y=THREE.MathUtils.clamp(look,-.7,.7)*.23;x=Math.sin(time*(chase?3.4:2.3)+i*.3)*.022-crawl*.115;z=Math.sin(time*1.7+i)*crawl*.02;}
    if(/Jaw|Mouth/i.test(bone.name)){x+=Math.sin(time*(chase?8:3)+i)*(.018+(chase?.03:0));}
    rotation.set(x,y,z);offset.setFromEuler(rotation);bone.quaternion.multiply(offset).normalize();
   }
   for(const [i,eye]of eyes.entries()){
    const pulse=.5+.5*Math.sin(time*(chase?5.5:2)+i*1.7),base=illuminated?.42:.008;
    eye.material.opacity=THREE.MathUtils.clamp(base+(illuminated?.28:.012)*pulse+(chase?.08:0),0,.8);
    eye.scale.setScalar(1+(chase?.16:.03)*pulse);
   }
  },
 };
}
