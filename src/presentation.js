import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';

export function createPipeline(renderer,scene,camera,settings){
 const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType});
 const composer=new EffectComposer(renderer,target),render=new RenderPass(scene,camera);composer.addPass(render);
 let ao=null;
 if(settings.ao){ao=new SSAOPass(scene,camera,innerWidth,innerHeight);ao.kernelRadius=1.2;ao.minDistance=.004;ao.maxDistance=.16;composer.addPass(ao);}
 const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.24,.45,1.1);bloom.enabled=settings.bloom;composer.addPass(bloom);
 composer.addPass(new OutputPass());
 const fxaa=new ShaderPass(FXAAShader);fxaa.enabled=settings.aa;composer.addPass(fxaa);
 const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2()},time:{value:0},grain:{value:settings.grain?.018:0},sharpness:{value:settings.sharpness}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
  uniform sampler2D tDiffuse;uniform vec2 resolution;uniform float time,grain,sharpness;varying vec2 vUv;
  void main(){vec2 d=resolution;vec3 c=texture2D(tDiffuse,vUv).rgb;
   vec3 edges=(texture2D(tDiffuse,vUv+vec2(d.x,0)).rgb+texture2D(tDiffuse,vUv-vec2(d.x,0)).rgb+texture2D(tDiffuse,vUv+vec2(0,d.y)).rgb+texture2D(tDiffuse,vUv-vec2(0,d.y)).rgb)*.25;
   c=clamp(c+(c-edges)*sharpness,0.,1.);float noise=fract(sin(dot(vUv,vec2(12.9898,78.233))+floor(time*24.))*43758.5453)-.5;
   c+=noise*grain;gl_FragColor=vec4(c,1.);
  }`});composer.addPass(finish);
 const resize=()=>{composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);const w=innerWidth*renderer.getPixelRatio(),h=innerHeight*renderer.getPixelRatio();fxaa.uniforms.resolution.value.set(1/w,1/h);finish.uniforms.resolution.value.set(1/w,1/h);};resize();
 return {resize,render(view,time){render.camera=view;if(ao){ao.camera=view;ao.enabled=view===camera;}finish.uniforms.time.value=time;composer.render();},dispose(){for(const pass of composer.passes)pass.dispose?.();composer.dispose();}};
}

// A physical torch that follows a skeleton's grip, with a separate beam target.
export function createFlashlight(){
 const root=new THREE.Group();root.name='Handheld flashlight';root.userData.dynamic=true;
 const metal=new THREE.MeshStandardMaterial({color:0x252c29,metalness:.78,roughness:.37});
 const rubber=new THREE.MeshStandardMaterial({color:0x151a17,roughness:.92});
 const trim=new THREE.MeshStandardMaterial({color:0xada17d,metalness:.86,roughness:.28});
 const cylinder=(r1,r2,length,z,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,length,16),mat);m.rotation.x=Math.PI/2;m.position.z=z;root.add(m);return m;};
 cylinder(.036,.036,.22,0,metal);cylinder(.075,.038,.09,-.145,metal);cylinder(.079,.079,.023,-.199,trim);cylinder(.039,.039,.025,.12,trim);
 for(let i=0;i<7;i++)cylinder(.038,.038,.014,-.076+i*.023,rubber);
 const reflector=new THREE.Mesh(new THREE.ConeGeometry(.069,.036,20,1,true),trim);reflector.rotation.x=-Math.PI/2;reflector.position.z=-.193;root.add(reflector);
 const lens=new THREE.Mesh(new THREE.CircleGeometry(.066,24),new THREE.MeshStandardMaterial({color:0xffecc5,emissive:0xffe2a2,emissiveIntensity:2,metalness:.3,roughness:.2,side:THREE.DoubleSide}));lens.position.z=-.213;root.add(lens);
 const button=new THREE.Mesh(new THREE.BoxGeometry(.023,.01,.035),rubber);button.position.set(0,.04,.04);root.add(button);
 root.userData.lens=lens;return root;
}

export const SKINS={basalt:{body:0x46514a,eye:0xe5bf71,roughness:.68},ash:{body:0xb7b4a3,eye:0x8abbc1,roughness:.83},oxide:{body:0x704c3b,eye:0xe5a160,roughness:.55}};
export function skinCreature(model,skinName='basalt'){
 if(!model)return;const skin=SKINS[skinName]||SKINS.basalt;
 model.traverse(o=>{if(o.userData.eyeGlint){o.material.color.set(skin.eye);return;}if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const next=m.clone();next.color?.set(skin.body);next.roughness=skin.roughness;next.metalness=.05;next.emissive?.set(0x101714);next.emissiveIntensity=.08;next.userData.templeOwned=true;if(m.userData.templeOwned)m.dispose();return next;});o.material=Array.isArray(o.material)?materials:materials[0];}});
}
