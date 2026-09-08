import * as THREE from 'three';
import {CELL,VENT_HEIGHT,DIRS} from './world.js';
import {groundHeight,roomCenter} from './campaign.js';

export function buildEscapeProps({scene,level,box,sharedMaterial,wpos,lowAreas}){
 const entities=[],doors=[],indicators=[],lockers=[],steam=[],flames=[],cages=[];
 const metal=sharedMaterial('equipment-metal',{color:0x455051,metalness:.68,roughness:.65});
 const brass=sharedMaterial('equipment-brass',{color:0xc0a46c,metalness:.6,roughness:.4});
 const dark=sharedMaterial('equipment-dark',{color:0x131b1d,roughness:.7,metalness:.4});
 const paper=sharedMaterial('equipment-paper',{color:0xd3ccb4,roughness:.98});
 const blue=sharedMaterial('equipment-blue',{color:0x668e98,roughness:.55,metalness:.4});
 const mesh=(g,geometry,material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const cube=(g,w,h,d,mat,x=0,y=0,z=0)=>mesh(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 const group=(p)=>{const g=new THREE.Group();g.position.copy(p);scene.add(g);return g;};
 const label=(parent,text,y=2.6,width=2.8)=>{
  const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#192427';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#a59268';ctx.lineWidth=5;ctx.strokeRect(8,8,752,144);ctx.fillStyle='#e1d4ad';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 44px Arial';ctx.fillText(text,384,82,720);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const m=mesh(parent,new THREE.PlaneGeometry(width,width*160/768),new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.3,roughness:.8,side:THREE.DoubleSide}),0,y,0);return m;
 };
 const entity=(id,p,labelText,kind='task',duration=0)=>{const root=group(p);root.userData.dynamic=true;const e={id,root,point:p.clone(),label:labelText,kind,duration};entities.push(e);return e;};
 const led=(parent,x,y,z)=>{const mat=new THREE.MeshStandardMaterial({color:0xcf9876,emissive:0xcf7653,emissiveIntensity:.8});const m=mesh(parent,new THREE.SphereGeometry(.045,8,5),mat,x,y,z);indicators.push(m);return m;};
 function bench(p){box(p.x,.92,p.z,1.5,.12,.8,metal);for(const dx of [-.6,.6])box(p.x+dx,.44,p.z,.08,.88,.65,dark);}

 for(const [i,room]of level.rooms.entries()){
  const center=wpos(level.maze[room.r][room.c]).add(new THREE.Vector3((room.w-1)*CELL/2,0,(room.h-1)*CELL/2));
  const sign=group(center.clone().add(new THREE.Vector3(0,0,-room.h*CELL/2+.2)));label(sign,`${String(i+1).padStart(2,'0')} / ${room.name.toUpperCase()}`,2.7,4.5);
  const trim=sharedMaterial(`room-trim-${room.id}`,{color:new THREE.Color(room.color),emissive:new THREE.Color(room.color),emissiveIntensity:.12,metalness:.3,roughness:.8});
  for(const dx of [-room.w*CELL/2+.65,room.w*CELL/2-.65])box(center.x+dx,.008,center.z,.07,.015,room.h*CELL-1.5,trim,false);
  if(['arrival','refuge','atrium','archive'].includes(room.id)){
   for(const [dr,dc]of [[1,1],[room.h-2,room.w-2]]){
    const p=wpos(level.maze[room.r+dr][room.c+dc]).add(new THREE.Vector3(1.2,0,-1.1));
    box(p.x,.28,p.z,.75,.56,1.25,metal);
    const statue=group(p);const torso=mesh(statue,new THREE.DodecahedronGeometry(.34,0),trim,0,1.08,0);torso.scale.set(.8,1.65,.7);mesh(statue,new THREE.IcosahedronGeometry(.19,0),metal,.07,1.75,-.02);cube(statue,.13,.75,.16,trim,-.3,1.22,0).rotation.z=-.25;
    if(room.id==='refuge'){torso.visible=false;box(p.x,.62,p.z,.8,.12,1.3,trim);}
   }
   for(const dx of [-room.w*CELL/2+.6,room.w*CELL/2-.6]){
    const g=group(center.clone().add(new THREE.Vector3(dx,0,-1.4)));cube(g,.16,.7,.19,brass,0,1.5,0);
    const flame=mesh(g,new THREE.ConeGeometry(.07,.43,5),new THREE.MeshBasicMaterial({color:0xe5a25f,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}),0,1.97,.04);g.userData.dynamic=true;flames.push(flame);
   }
  }
 }
 for(const hall of level.halls){
  const a=wpos(hall.a),b=wpos(hall.b),dir=b.clone().sub(a).normalize();
  const sign=group(a.clone().add(dir.clone().multiplyScalar(1.65)));label(sign,hall.label,2.72,2.7);sign.rotation.y=hall.a.r===hall.b.r?-Math.PI/2:Math.PI;
  const back=group(b.clone().add(dir.clone().multiplyScalar(-1.65))),room=level.rooms.find(r=>r.id===hall.a.roomId);label(back,room?.name.toUpperCase()||'RETURN',2.72,2.7);back.rotation.y=sign.rotation.y+Math.PI;
 }
 for(const c of level.maze.flat().filter(c=>c.duct)){
  const p=wpos(c),width=1.28,half=width/2,arm=(CELL-width)/2;
  box(p.x,VENT_HEIGHT+.06,p.z,width+.08,.12,width+.08,metal);
  for(const [dr,dc,dir]of DIRS){
   if(c.vents?.[dir]){
    const alongX=!!dc,cx=p.x+dc*(half+arm/2),cz=p.z+dr*(half+arm/2);
    box(cx,VENT_HEIGHT+.06,cz,alongX?arm+.06:width+.08,.12,alongX?width+.08:arm+.06,metal);
    for(const sign of [-1,1])box(cx+(alongX?0:sign*(half+.04)),VENT_HEIGHT/2,cz+(alongX?sign*(half+.04):0),alongX?arm+.04:.08,VENT_HEIGHT,alongX?.08:arm+.04,metal);
   }else box(p.x+dc*(half+.04),VENT_HEIGHT/2,p.z+dr*(half+.04),dc?.08:width+.08,VENT_HEIGHT,dc?width+.08:.08,metal);
  }
  lowAreas.push({x1:p.x-2,x2:p.x+2,z1:p.z-2,z2:p.z+2,center:p});
 }
 for(const gate of level.gates){
  const p=wpos(gate.a).add(wpos(gate.b)).multiplyScalar(.5),width=2.2,jamb=(CELL+.3-width)/2;p.y=groundHeight(level,p.x,p.z);
  for(const sign of [-1,1])box(p.x,2,p.z+sign*(width+jamb)/2,.35,4,jamb,metal);
  box(p.x,3.65,p.z,.35,.7,width,metal);
  const body=group(p);body.userData.dynamic=true;const panel=cube(body,.2,3.15,width,metal,0,1.575,0);for(let i=0;i<7;i++)cube(body,.25,.06,width-.06,brass,0,.28+i*.42,0);
  const collider={x1:p.x-.14,x2:p.x+.14,z1:p.z-width/2,z2:p.z+width/2,y1:p.y,y2:p.y+3.15,disabled:false};
  const door={gate,root:body,panel,collider,baseY:p.y,opening:0,targetOpening:0,manualClosed:false};doors.push(door);
  for(const side of [-1,1]){const handle=entity(`door-${gate.id}-${side}`,p.clone().add(new THREE.Vector3(side*.48,1.16,-.7)),'Operate door','door',.7);handle.door=door;cube(handle.root,.09,.28,.11,brass);}
  const lamp=group(p.clone().add(new THREE.Vector3(-.24,2.4,.82)));led(lamp,0,0,0);
  if(gate.id==='archiveGate'){const e=entity('archiveGate',p.clone().add(new THREE.Vector3(-.42,1.2,.65)),'Unlock archive');cube(e.root,.11,.3,.14,brass);}
 }

 const fusePos=wpos(level.cells.fuse).add(new THREE.Vector3(1.3,0,-1.15));bench(fusePos);
 const fuse=entity('fuse',fusePos.clone().add(new THREE.Vector3(0,1.06,0)),'Take replacement fuse');
 const tube=mesh(fuse.root,new THREE.CylinderGeometry(.07,.07,.38,12),paper);tube.rotation.z=Math.PI/2;for(const x of [-.2,.2]){const cap=mesh(fuse.root,new THREE.CylinderGeometry(.08,.08,.08,12),brass,x);cap.rotation.z=Math.PI/2;}
 label(fuse.root,'SPARE FUSE',.38,1.05);

 const generatorPos=wpos(level.cells.generator).add(new THREE.Vector3(1.25,0,-1.18));
 box(generatorPos.x,.75,generatorPos.z,1.1,1.5,1.3,metal);
 const generator=entity('generator',generatorPos.clone().add(new THREE.Vector3(0,1.18,.69)),'Install fuse & repair generator','task',2.8);
 cube(generator.root,.72,.65,.08,dark);for(const x of [-.2,0,.2])led(generator.root,x,.13,.06);cube(generator.root,.16,.13,.13,brass,0,-.17,.05);label(generator.root,'MAIN POWER',.58,1.25);
 for(let i=0;i<6;i++)box(generatorPos.x-.42+i*.16,.6,generatorPos.z+.68,.07,.4,.03,dark,false);

 const valve=entity('valve',wpos(level.cells.valve).add(new THREE.Vector3(1.2,1.12,-.5)),'Turn drainage wheel','task',3.4);
 mesh(valve.root,new THREE.CylinderGeometry(.13,.13,2.25,12),metal,0,0,-.2);
 const wheel=new THREE.Group();valve.root.add(wheel);valve.wheel=wheel;mesh(wheel,new THREE.TorusGeometry(.33,.05,6,24),blue);
 for(let i=0;i<4;i++){const spoke=cube(wheel,.6,.035,.05,blue);spoke.rotation.z=i*Math.PI/4;}label(valve.root,'DRAIN CONTROL',.62,1.45);
 const basin=wpos(level.cells.key);const waterGroup=group(basin);waterGroup.userData.dynamic=true;const water=mesh(waterGroup,new THREE.CircleGeometry(1.6,32),new THREE.MeshStandardMaterial({color:0x355c62,metalness:.4,roughness:.22,transparent:true,opacity:.86}),0,.39,0);water.rotation.x=-Math.PI/2;
 const ring=mesh(waterGroup,new THREE.TorusGeometry(1.65,.13,6,32),metal,0,.16,0);ring.rotation.x=-Math.PI/2;
 const key=entity('key',basin.clone().add(new THREE.Vector3(0,.2,0)),'Take archive key');mesh(key.root,new THREE.TorusGeometry(.085,.02,5,12),brass);cube(key.root,.025,.25,.025,brass,0,-.16,0);cube(key.root,.08,.03,.04,brass,.025,-.26,0);key.root.rotation.x=-Math.PI/2;

 const logPos=wpos(level.cells.log).add(new THREE.Vector3(1.3,0,-1.1));bench(logPos);const log=entity('log',logPos.clone().add(new THREE.Vector3(0,1.0,0)),'Read operator’s log');cube(log.root,.5,.025,.36,paper);label(log.root,'OPERATOR LOG',.35,1.3);
 const archive=wpos(level.cells.log);for(const dz of [-4.7,4.7]){const shelf=group(archive.clone().add(new THREE.Vector3(0,0,dz)));for(let y=.4;y<2.8;y+=.55){cube(shelf,5,.06,.55,metal,0,y,0);for(let i=0;i<9;i++)cube(shelf,.17,.34,.27,i%2?paper:brass,-2+i*.47,y+.2,0);}}

 const keypad=entity('keypad',wpos(level.cells.keypad).add(new THREE.Vector3(1.2,1.25,-.95)),'Use exit keypad');
 box(keypad.point.x,.6,keypad.point.z,.6,1.2,.6,metal);cube(keypad.root,.64,.7,.12,metal);cube(keypad.root,.48,.18,.02,dark,0,.18,.07);
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)cube(keypad.root,.095,.085,.04,brass,(x-1)*.15,-.01-y*.12,.1);label(keypad.root,'SURFACE LOCK',.62,1.5);
 const exit=entity('exit',wpos(level.cells.exit).add(new THREE.Vector3(0,1.2,-.95)),'Escape to the surface','task',1.2);label(exit.root,'SURFACE ACCESS',1.45,2.9);

 const supplyPositions=[['battery-1',2,1,'battery'],['battery-2',9,10,'battery'],['battery-3',17,2,'battery'],['battery-4',4,10,'battery'],['medical-1',17,9,'medical'],['medical-2',10,4,'medical']];
 for(const [id,r,c,kind]of supplyPositions){const e=entity(id,wpos(level.maze[r][c]).add(new THREE.Vector3(.9,.46,-1.05)),kind==='battery'?'Take battery':'Use first-aid kit',kind);
  cube(e.root,kind==='battery'?.2:.4,.3,.19,kind==='battery'?brass:paper);if(kind==='medical'){cube(e.root,.18,.055,.02,blue,0,0,.105);cube(e.root,.055,.18,.02,blue,0,0,.105);}else{cube(e.root,.1,.035,.1,dark,0,.17,0);}box(e.point.x,.16,e.point.z,.8,.32,.65,metal);
 }
 for(const [id,r,c]of [['locker-workshop',19,11],['locker-atrium',9,9],['locker-burial',4,11],['locker-maintenance',17,1],['locker-upper',4,1]]){
  const p=wpos(level.maze[r][c]).add(new THREE.Vector3(1.25,0,-1.25));const g=group(p);cube(g,1.18,2.25,.08,metal,0,1.125,-.44);
  for(const x of [-.57,.57])cube(g,.08,2.25,.9,metal,x,1.125,0);cube(g,1.18,.08,.9,metal,0,2.22,0);
  cube(g,1.18,1.4,.06,metal,0,.7,.45);cube(g,1.18,.65,.06,metal,0,1.925,.45);cube(g,.08,.26,.1,brass,.37,1.05,.5);
  const e=entity(id,p.clone().add(new THREE.Vector3(0,1.5,.72)),'Hide in locker','locker');e.hide=p.clone().add(new THREE.Vector3(0,1.5,.12));e.leave=p.clone().add(new THREE.Vector3(0,1.72,1.15));
  e.collider={x1:p.x-.6,x2:p.x+.6,z1:p.z-.5,z2:p.z+.5,y1:p.y,y2:p.y+2.25};lockers.push(e);label(g,'HIDE',2.5,.95);
 }
 const recorder=entity('recorder',wpos(level.maze[4][3]).add(new THREE.Vector3(1.3,1,-1.1)),'Save progress & rest','checkpoint',1.6);cube(recorder.root,.45,.3,.23,metal);for(const x of [-.12,.12])mesh(recorder.root,new THREE.CylinderGeometry(.07,.07,.04,12),brass,x,0,.14).rotation.x=Math.PI/2;label(recorder.root,'FIELD RECORDER',.4,1.4);bench(recorder.point.clone().setY(0));

 for(const [r,c,phase]of [[14,3,0],[18,6,3],[14,10,1]]){const p=wpos(level.maze[r][c]),root=group(p);root.userData.dynamic=true;const cloud=mesh(root,new THREE.ConeGeometry(.4,1.25,8),new THREE.MeshBasicMaterial({color:0xc7ddd8,transparent:true,opacity:.18,depthWrite:false}),.96,.55,0);cloud.rotation.z=Math.PI;
   cube(root,.4,.07,.55,brass,.96,.03,0);steam.push({p:p.clone().add(new THREE.Vector3(.96,0,0)),mesh:cloud,phase});}
 const floodRoom=level.rooms.find(r=>r.id==='cistern'),flood=group(wpos(roomCenter(level,floodRoom)));flood.userData.dynamic=true;
 const surface=mesh(flood,new THREE.PlaneGeometry(21.5,17.5,20,20),new THREE.MeshStandardMaterial({color:0x214047,roughness:.2,metalness:.4,transparent:true,opacity:.72}),-2,.14,0);surface.rotation.x=-Math.PI/2;
 for(const id of ['sealA','sealB']){const e=entity(id,wpos(level.cells[id]).add(new THREE.Vector3(1.25,1.15,-1.1)),id==='sealA'?'Pull burial seal lever':'Pull lower seal lever','task',2.6);cube(e.root,.55,.8,.16,metal);const pivot=new THREE.Group();e.root.add(pivot);e.lever=pivot;cube(pivot,.08,.7,.09,brass,0,.3,.17).rotation.x=.3;cube(pivot,.36,.1,.13,dark,0,.66,.26);label(e.root,id==='sealA'?'BURIAL SEAL':'LOWER SEAL',.8,1.5);}
 const altar=wpos(level.cells.artifact).add(new THREE.Vector3(-1.5,0,-1.5));box(altar.x,.45,altar.z,1.65,.9,1.65,metal);box(altar.x,.98,altar.z,2,.16,2,brass);
 const artifact=entity('artifact',altar.clone().add(new THREE.Vector3(0,1.32,0)),'Take ritual artifact');mesh(artifact.root,new THREE.DodecahedronGeometry(.2,0),new THREE.MeshStandardMaterial({color:0xc9bb85,emissive:0x9b7c3e,emissiveIntensity:.8,roughness:.38,metalness:.8}));
 const cage=group(altar);cage.userData.dynamic=true;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;cube(cage,.05,1.2,.05,metal,Math.sin(a)*.58,1.6,Math.cos(a)*.58);}mesh(cage,new THREE.ConeGeometry(.68,.4,8),metal,0,2.3,0);cages.push(cage);
 return {entities,doors,indicators,water,waterGroup,lockers,steam,flames,cages,flood:surface};
}

export function buildCrawlways({scene,vents,box,sharedMaterial,wpos,makeWallMaterial,lowAreas}){
 const H=4;
 const metal=sharedMaterial('duct-metal',{color:0x555c53,metalness:.64,roughness:.62}),seam=sharedMaterial('duct-seam',{color:0x917c59,metalness:.64,roughness:.48});
 for(const vent of vents){const pa=wpos(vent.a),pb=wpos(vent.b),mid=pa.clone().add(pb).multiplyScalar(.5),alongX=vent.dir==='e',width=1.28,length=2.2;
  const part=(u,y,v,w,h,d,mat,collide=true)=>alongX?box(mid.x+v,y,mid.z+u,d,h,w,mat,collide):box(mid.x+u,y,mid.z+v,w,h,d,mat,collide);
  const jamb=(CELL+.3-width)/2;part(-(width+jamb)/2,H/2,0,jamb,H,.3,makeWallMaterial());part((width+jamb)/2,H/2,0,jamb,H,.3,makeWallMaterial());
  part(0,(H+VENT_HEIGHT)/2,0,width,H-VENT_HEIGHT,.3,makeWallMaterial());
  part(0,VENT_HEIGHT+.06,0,width+.2,.12,length,metal);part(0,.02,0,width,.035,length,metal,false);
  part(-width/2-.04,VENT_HEIGHT/2,0,.08,VENT_HEIGHT,length,metal);part(width/2+.04,VENT_HEIGHT/2,0,.08,VENT_HEIGHT,length,metal);
  for(let j=-1;j<=1;j++){const depth=j*.95;part(0,VENT_HEIGHT-.03,depth,width,.04,.045,seam,false);part(-width/2+.018,VENT_HEIGHT/2,depth,.03,VENT_HEIGHT,.045,seam,false);part(width/2-.018,VENT_HEIGHT/2,depth,.03,VENT_HEIGHT,.045,seam,false);}
  // Warm markers make the low opening findable in flashlight darkness.
  const marker=sharedMaterial('vent-marker',{color:0xbca77b,emissive:0xa4793d,emissiveIntensity:.38,roughness:.8});
  part(0,1.38,alongX?-.18:-.18,.4,.095,.025,marker,false);part(0,1.38,.18,.4,.095,.025,marker,false);
  lowAreas.push({x1:mid.x-(alongX?length:width)/2,x2:mid.x+(alongX?length:width)/2,z1:mid.z-(alongX?width:length)/2,z2:mid.z+(alongX?width:length)/2,vent,center:mid});
 }
}
