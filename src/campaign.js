import {CELL,DIRS,seededRandom} from './world.js';

export const ROOMS=[
 {id:'arrival',name:'Upper Temple',r:0,c:0,h:6,w:6,floor:0,color:'#b8b3a2'},
 {id:'refuge',name:'Burial Chambers',r:0,c:8,h:6,w:5,floor:-1.5,color:'#b29a87'},
 {id:'archive',name:'Sealed Archive',r:0,c:16,h:6,w:5,floor:-1.5,color:'#bea2bd'},
 {id:'cistern',name:'Flooded Lower Temple',r:8,c:0,h:5,w:6,floor:-3.5,color:'#85b8bf'},
 {id:'atrium',name:'Ritual Sanctuary',r:8,c:8,h:6,w:6,floor:-1.5,color:'#b3c2af'},
 {id:'control',name:'Seal Control',r:8,c:16,h:5,w:5,floor:-1.5,color:'#bfab86'},
 {id:'generator',name:'Underground Maintenance',r:16,c:0,h:5,w:6,floor:-3.5,color:'#d4b675'},
 {id:'workshop',name:'Maintenance Workshop',r:16,c:8,h:5,w:5,floor:-3.5,color:'#c19774'},
 {id:'exit',name:'Escape Wing',r:16,c:16,h:5,w:5,floor:0,color:'#e8dcac'},
];
export const TASKS=[
 {id:'fuse',flag:'fuseFound',requires:[],title:'Find the replacement fuse',room:'workshop',hint:'Follow MAINTENANCE signs down through the lower temple. Search the workshop benches.'},
 {id:'generator',flag:'power',requires:['fuseFound'],title:'Restore the generator',room:'generator',hint:'West of the workshop. Hold E to install the fuse and repair the generator.'},
 {id:'valve',flag:'drained',requires:['power'],title:'Drain the lower temple',room:'cistern',hint:'Return north to the flooded chamber. Turn the blue drainage wheel.'},
 {id:'key',flag:'keyFound',requires:['drained'],title:'Recover the archive key',room:'cistern',hint:'Search the exposed basin on the west side of the flooded chamber.'},
 {id:'archiveGate',flag:'archiveOpen',requires:['keyFound'],title:'Unlock the archive',room:'archive',hint:'Go back upstairs. The archive is east of the Burial Chambers.'},
 {id:'log',flag:'codeKnown',requires:['archiveOpen'],title:'Read the operator’s log',room:'archive',hint:'The archive log explains the two seals and records the surface access code.'},
 {id:'sealA',flag:'sealA',requires:['codeKnown'],title:'Release the burial seal',room:'refuge',hint:'Pull the heavy lever in the Burial Chambers. The two seals can be activated in either order.'},
 {id:'sealB',flag:'sealB',requires:['codeKnown'],title:'Release the lower seal',room:'control',hint:'The second lever is in Seal Control, east of the Ritual Sanctuary.'},
 {id:'artifact',flag:'artifactFound',requires:['sealA','sealB'],title:'Retrieve the ritual artifact',room:'atrium',hint:'Both mechanisms released the sanctuary cage. Take the artifact from the altar.'},
 {id:'keypad',flag:'exitUnlocked',requires:['artifactFound'],title:'Release the surface lock',room:'control',hint:'Return to Seal Control and enter the operator’s code from your journal.'},
 {id:'exit',flag:'escaped',requires:['exitUnlocked'],title:'Reach the surface',room:'exit',hint:'Go south to the workshop, then east to the newly opened Escape Wing.'},
];
export function newProgress(){return {...Object.fromEntries(TASKS.map(t=>[t.flag,false])),pickups:[],notes:[],decoys:3};}
export const currentTask=p=>TASKS.find(t=>!p[t.flag])||TASKS.at(-1);
export const completedTasks=p=>TASKS.filter(t=>p[t.flag]).length;
export function taskStatus(p,id){const t=TASKS.find(t=>t.id===id);if(!t)return {allowed:false,reason:'Nothing to use here.'};if(p[t.flag])return {allowed:false,reason:'Already complete.'};const need=t.requires.find(flag=>!p[flag]);return need?{allowed:false,reason:TASKS.find(t=>t.flag===need).title+'.'}:{allowed:true,reason:t.title};}
export function completeTask(p,id,{code,expectedCode}={}){const status=taskStatus(p,id);if(!status.allowed)return {...status,changed:false};if(id==='keypad'&&String(code)!==String(expectedCode))return {allowed:false,changed:false,reason:'Code rejected. Check the operator’s log in your journal.'};p[TASKS.find(t=>t.id===id).flag]=true;if(id==='log'&&!p.notes.includes('operator'))p.notes.push('operator');return {allowed:true,changed:true,reason:status.reason};}
export const roomCenter=(level,room)=>level.maze[room.r+Math.floor(room.h/2)][room.c+Math.floor(room.w/2)];
export const cellHeight=(cell,x,z)=>cell?.ramp?cell.ramp.y0+(cell.ramp.y1-cell.ramp.y0)*Math.max(0,Math.min(1,((cell.ramp.axis==='x'?x:z)-cell.ramp.start)/(cell.ramp.end-cell.ramp.start))):(cell?.floor??0);
export function groundHeight(level,x,z){const n=level.maze.length,r=Math.max(0,Math.min(n-1,Math.round(z/CELL+(n-1)/2))),c=Math.max(0,Math.min(n-1,Math.round(x/CELL+(n-1)/2)));return cellHeight(level.maze[r][c],x,z);}
export const levelPosition=(level,c,y=0)=>({x:(c.c-(level.maze.length-1)/2)*CELL,y:(c.floor||0)+y,z:(c.r-(level.maze.length-1)/2)*CELL});
export const roomAt=(level,p)=>{const n=level.maze.length,r=Math.round(p.z/CELL+(n-1)/2),c=Math.round(p.x/CELL+(n-1)/2);return ROOMS.find(room=>room.id===level.maze[r]?.[c]?.roomId);};

export function makeEscapeLevel(seed=1){
 const n=21,maze=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>({r,c,n:true,s:true,e:true,w:true,active:false,floor:0})));
 const connect=(a,b,vent=false)=>{const d=DIRS.find(([dr,dc])=>a.r+dr===b.r&&a.c+dc===b.c);if(!d)throw new Error('Non-adjacent passage');a.active=b.active=true;if(vent){(a.vents??={})[d[2]]=b;(b.vents??={})[d[3]]=a;}else{a[d[2]]=false;b[d[3]]=false;}return d;};
 for(const room of ROOMS)for(let r=room.r;r<room.r+room.h;r++)for(let c=room.c;c<room.c+room.w;c++){
  const a=maze[r][c];Object.assign(a,{active:true,room:true,roomId:room.id,floor:room.floor,surface:room.id==='cistern'?'water':['generator','workshop','control'].includes(room.id)?'metal':'stone'});
  if(r>room.r)connect(a,maze[r-1][c]);if(c>room.c)connect(a,maze[r][c-1]);
 }
 // Keep interior walls purposeful and leave broad sightline breaks rather than maze-like clutter.
 const partition=(roomId,axis,offset,openings)=>{const room=ROOMS.find(r=>r.id===roomId),length=axis==='x'?room.h:room.w;for(let i=0;i<length;i++){if(openings.includes(i))continue;const a=maze[room.r+(axis==='x'?i:offset)][room.c+(axis==='x'?offset:i)],b=maze[a.r+(axis==='x'?0:1)][a.c+(axis==='x'?1:0)];a[axis==='x'?'e':'s']=true;b[axis==='x'?'w':'n']=true;}};
 partition('arrival','x',2,[1,4]);partition('refuge','z',1,[1,3]);partition('refuge','z',3,[0,3]);partition('archive','x',2,[1,4]);partition('generator','x',3,[1,3]);partition('workshop','z',1,[1,3]);partition('cistern','x',2,[1,3]);partition('exit','z',1,[1,3]);

 const halls=[];
 function hall(r,c,dr,dc,length,label,width=2){
  const lanes=[],axis=dc?'x':'z';
  for(let lane=0;lane<width;lane++){
   const rr=r+(dc?lane:0),cc=c+(dr?lane:0),route=[],a=maze[rr][cc],b=maze[rr+dr*length][cc+dc*length];
   const dir=dc||dr,start=(axis==='x'?cc-(n-1)/2+(dir>0?.5:-.5):rr-(n-1)/2+(dir>0?.5:-.5))*CELL,end=(axis==='x'?b.c-(n-1)/2-(dir>0?.5:-.5):b.r-(n-1)/2-(dir>0?.5:-.5))*CELL;
   for(let i=0;i<=length;i++){
    const cell=maze[rr+dr*i][cc+dc*i];route.push(cell);cell.corridor=true;if(i>0)connect(route[i-1],cell);
    if(i>0&&i<length){const center=(axis==='x'?cell.c-(n-1)/2:cell.r-(n-1)/2)*CELL,t=Math.max(0,Math.min(1,(center-start)/(end-start)));cell.floor=a.floor+(b.floor-a.floor)*t;cell.ramp={axis,start,end,y0:a.floor,y1:b.floor};cell.surface='stone';}
   }
   lanes.push(route);
  }
  if(width>1)for(let lane=1;lane<lanes.length;lane++)for(let i=0;i<=length;i++)connect(lanes[lane-1][i],lanes[lane][i]);
  const route=lanes[0],a=route[0],b=route.at(-1);halls.push({a,b,route,lanes,label,width,ramp:a.floor!==b.floor});
 }
 // Broad paired galleries make the temple read as one place instead of nine boxes linked by thin strips.
 hall(2,5,0,1,3,'BURIAL CHAMBERS',2);
 hall(3,12,0,1,4,'SEALED ARCHIVE',1);
 hall(5,2,1,0,3,'LOWER TEMPLE',2);
 hall(12,2,1,0,4,'MAINTENANCE',2);
 hall(18,5,0,1,3,'WORKSHOP',2);
 hall(18,12,0,1,4,'ESCAPE WING',1);
 hall(10,5,0,1,3,'RITUAL SANCTUARY',2);
 hall(10,13,0,1,3,'SEAL CONTROL',2);
 hall(5,10,1,0,3,'SANCTUARY',2);
 hall(13,10,1,0,3,'WORKSHOP',2);

 const gates=[{id:'archiveGate',a:maze[3][15],b:maze[3][16],dir:'e',back:'w',flag:'archiveOpen'},{id:'surfaceGate',a:maze[18][15],b:maze[18][16],dir:'e',back:'w',flag:'exitUnlocked'}];
 for(const gate of gates){gate.a[gate.dir]=true;gate.b[gate.back]=true;(gate.a.doors??={})[gate.dir]=gate;(gate.b.doors??={})[gate.back]=gate;}
 const vents=[],ventRoutes=[];
 const ducts=[[[5,12],[6,12],[7,12],[8,12]],[[16,5],[16,6],[16,7],[16,8]],[[12,0],[13,0],[14,0],[15,0],[16,0]],[[12,13],[12,14],[12,15],[12,16]],[[12,5],[13,5],[14,5],[15,5],[15,6],[15,7],[15,8],[16,8]]];
 for(const [index,coords]of ducts.entries()){
  const route=coords.map(([r,c])=>maze[r][c]);for(let i=1;i<route.length-1;i++){Object.assign(route[i],{active:true,duct:true,floor:route[0].floor,surface:'metal'});}
  for(let i=1;i<route.length;i++){const [,,dir,back]=connect(route[i-1],route[i],true);vents.push({a:route[i-1],b:route[i],dir,back,network:index});}
  ventRoutes.push({id:index,a:route[0],b:route.at(-1),cells:route});
 }
 const random=seededRandom(seed),code=String(100+Math.floor(random()*900));
 const cells={fuse:maze[18][random()<.5?9:11],generator:maze[18][3],valve:maze[10][3],key:maze[10][1],archiveGate:maze[3][15],log:maze[3][18],sealA:maze[3][10],sealB:maze[10][18],artifact:maze[11][11],keypad:maze[11][18],exit:maze[19][18]};
 const level={maze,gates,vents,ventRoutes,halls,cells,rooms:ROOMS,spawn:maze[3][3],hunterSpawn:maze[11][9],exit:cells.exit,code,seed};return level;
}
export function syncDoors(level,p){for(const gate of level.gates){const closed=!p[gate.flag];gate.a[gate.dir]=closed;gate.b[gate.back]=closed;}}
export function wallPlan(maze,height=4){const segments=[],n=maze.length;for(const cell of maze.flat()){
 if(!cell.active)continue;const x=(cell.c-(n-1)/2)*CELL,z=(cell.r-(n-1)/2)*CELL;
 for(const [dr,dc,dir]of DIRS){if(!cell[dir]||cell.vents?.[dir]||cell.doors?.[dir])continue;if((dir==='s'||dir==='e')&&maze[cell.r+dr]?.[cell.c+dc]?.active)continue;
  const vertical=dir==='w'||dir==='e',cx=x+dc*CELL/2,cz=z+dr*CELL/2,w=vertical?.3:CELL+.3,d=vertical?CELL+.3:.3,lo=Math.min(cellHeight(cell,cx-w/2,cz-d/2),cellHeight(cell,cx+w/2,cz+d/2)),hi=Math.max(cellHeight(cell,cx-w/2,cz-d/2),cellHeight(cell,cx+w/2,cz+d/2))+height;
  segments.push({cell,dir,x:cx,y:(lo+hi)/2,z:cz,w,d,h:hi-lo,box:{x1:cx-w/2,x2:cx+w/2,z1:cz-d/2,z2:cz+d/2,y1:lo,y2:hi}});
 }}return segments;}
export function makeCheckpoint(level,progress,elapsed,visited){return {version:4,seed:level.seed,progress:JSON.parse(JSON.stringify(progress)),elapsed,visited:[...visited].map(c=>[c.r,c.c]),savedAt:Date.now()};}
export function readCheckpoint(raw){try{const save=JSON.parse(raw);if(save?.version!==4||!Number.isInteger(save.seed)||save.seed<0||save.seed>0xffffffff||!save.progress||save.progress.escaped)return null;const progress=newProgress();
 for(const t of TASKS)progress[t.flag]=save.progress[t.flag]===true&&t.requires.every(f=>progress[f]);progress.pickups=Array.isArray(save.progress.pickups)?save.progress.pickups.filter(v=>typeof v==='string').slice(0,40):[];progress.notes=progress.codeKnown?['operator']:[];progress.decoys=Math.max(0,Math.min(3,Number(save.progress.decoys)||0));
 return {...save,progress,elapsed:Math.max(0,Math.min(86400,Number(save.elapsed)||0)),visited:Array.isArray(save.visited)?save.visited.filter(c=>Array.isArray(c)&&c.length===2&&c.every(v=>Number.isInteger(v)&&v>=0&&v<21)):[]};}catch{return null;}}
