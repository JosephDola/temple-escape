import * as THREE from 'three';
import { PING_SLOTS as N, PING_LIFETIME, WAVE_SPEED, pingRadius, nextPingSlot } from './echo-rules.js';

// The monster is blind. It sees the world as red dots that outline everything,
// but only where a sound has recently washed over it. Noisy players glow white-hot.
const VERT = 'void main(){gl_Position=vec4(position.xy,0.,1.);}';
const FRAG = `
#define N ${N}
#define WAVE ${WAVE_SPEED.toFixed(1)}
uniform sampler2D tNormal,tDepth;
uniform mat4 projInv,camWorld;
uniform vec2 texel,screenInv;
uniform float near,far,sense;
uniform vec4 pings[N];   // xyz = where the sound was, w = age in seconds (-1 = unused)
uniform float radius[N]; // how far each sound is heard
uniform vec4 glow[4];    // xyz = player eye position, w = how noisy (0..1)
float linZ(float d){return near*far/(far-d*(far-near));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 uv=gl_FragCoord.xy*screenInv;
 float d=texture2D(tDepth,uv).x;
 if(d>=.9999){gl_FragColor=vec4(0.,0.,0.,1.);return;}
 vec2 uR=uv+vec2(texel.x,0.),uU=uv+vec2(0.,texel.y);
 vec3 n=texture2D(tNormal,uv).xyz*2.-1.,nR=texture2D(tNormal,uR).xyz*2.-1.,nU=texture2D(tNormal,uU).xyz*2.-1.;
 float z=linZ(d),zR=linZ(texture2D(tDepth,uR).x),zU=linZ(texture2D(tDepth,uU).x);
 float edge=clamp(step(.35,length(n-nR)+length(n-nU))+step(.05,(abs(z-zR)+abs(z-zU))/z),0.,1.);
 vec4 v=projInv*vec4(uv*2.-1.,d*2.-1.,1.);v/=v.w;
 vec3 w=(camWorld*v).xyz,wn=normalize((camWorld*vec4(n,0.)).xyz);
 // Dots are pinned to the world (not the screen) and always lie on the surface's own plane.
 vec3 a=abs(wn);
 vec2 p=(a.y>=a.x&&a.y>=a.z)?w.xz:(a.x>=a.z?w.zy:w.xy);
 vec2 g=p*14.,id=floor(g),f=fract(g)-.5,jit=vec2(hash(id),hash(id+7.3))-.5;
 float dotMask=1.-smoothstep(.12,.22,length(f-jit*.35));
 float dots=dotMask*step(hash(id+3.1),mix(.2,.9,edge));  // sparse on flat walls, dense on outlines
 float reveal=sense*(1.-smoothstep(1.5,5.,z));            // a faint sense of what is right in front of it
 for(int i=0;i<N;i++){
  if(pings[i].w<0.)continue;
  float age=pings[i].w,dist=distance(w,pings[i].xyz),front=age*WAVE;
  float fall=1.-smoothstep(radius[i]*.55,radius[i],dist);
  float wave=smoothstep(front-2.5,front,dist)*step(dist,front);      // bright leading edge
  float trail=step(dist,front)*exp(-age*.9)*.55;                     // slowly fading wake
  reveal=max(reveal,(wave+trail)*fall);
 }
 float hot=0.;
 for(int i=0;i<4;i++){if(glow[i].w<=0.)continue;hot=max(hot,glow[i].w*(1.-smoothstep(.5,1.3,distance(w,glow[i].xyz-vec3(0.,.6,0.)))));}
 vec3 base=wn.y<-.5?vec3(.45,.35,1.):vec3(1.,.14,.1);               // ceilings violet, the rest red
 vec3 col=base*dots*reveal*(.88+.12*sin(gl_FragCoord.y*1.6));       // faint scanlines
 col+=vec3(1.,.88,.75)*hot*max(dots,dotMask*edge)*2.4;              // noisy players glow
 gl_FragColor=vec4(col,1.);
}`;

export function createEchoVision(renderer, scene, { scale = 0.75, hide = () => [] } = {}) {
  const size = new THREE.Vector2(), last = new THREE.Vector2();
  const target = new THREE.WebGLRenderTarget(2, 2, { depthTexture: new THREE.DepthTexture(2, 2), minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const normalMaterial = new THREE.MeshNormalMaterial();
  const pings = Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, -1));
  const radius = new Array(N).fill(0), glow = Array.from({ length: 4 }, () => new THREE.Vector4());
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tNormal: { value: target.texture }, tDepth: { value: target.depthTexture },
      projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      texel: { value: new THREE.Vector2() }, screenInv: { value: new THREE.Vector2() },
      near: { value: 0.1 }, far: { value: 100 }, sense: { value: 0.45 },
      pings: { value: pings }, radius: { value: radius }, glow: { value: glow },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCamera = new THREE.Camera();

  function resize() {
    renderer.getDrawingBufferSize(size); last.copy(size);
    target.setSize(Math.max(2, Math.floor(size.x * scale)), Math.max(2, Math.floor(size.y * scale)));
    material.uniforms.texel.value.set(1 / target.width, 1 / target.height);
    material.uniforms.screenInv.value.set(1 / size.x, 1 / size.y);
  }
  resize();

  return {
    // A sound happened at `position`. loudness: 0 (quiet) to 1 (sprint).
    ping(position, loudness = 0.5) {
      const i = nextPingSlot(pings.map(p => p.w));
      pings[i].set(position.x, position.y, position.z, 0);
      radius[i] = pingRadius(loudness);
    },
    // Players the monster can hear right now: [{position, noise}] with noise 0..1. Up to 4.
    setPlayers(list) {
      for (let i = 0; i < 4; i++) {
        const p = list[i];
        if (p) glow[i].set(p.position.x, p.position.y, p.position.z, p.noise); else glow[i].set(0, 0, 0, 0);
      }
    },
    render(camera, time, dt) {
      renderer.getDrawingBufferSize(size);
      if (!size.equals(last)) resize();
      for (const p of pings) if (p.w >= 0) { p.w += dt; if (p.w > PING_LIFETIME) p.w = -1; }
      const u = material.uniforms;
      u.near.value = camera.near; u.far.value = camera.far;
      u.projInv.value.copy(camera.projectionMatrixInverse); u.camWorld.value.copy(camera.matrixWorld);
      // Points, sprites and lines (dust, glints) don't suit the normal pass: hide them for one frame.
      const hidden = [];
      scene.traverseVisible(o => { if (o.isPoints || o.isSprite || o.isLine) hidden.push(o); });
      for (const o of hide()) if (o?.visible) hidden.push(o);
      for (const o of hidden) o.visible = false;
      const bg = scene.background, fog = scene.fog;
      scene.background = null; scene.fog = null; scene.overrideMaterial = normalMaterial;
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
      for (const o of hidden) o.visible = true;
      renderer.render(quadScene, quadCamera);
    },
    resize,
    dispose() { target.dispose(); target.depthTexture.dispose(); material.dispose(); quad.geometry.dispose(); normalMaterial.dispose(); },
  };
}
