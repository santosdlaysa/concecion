import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {KTX2Loader} from './vendor/KTX2Loader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {createArticulatedCar} from './rig.js';
import {createGenericCar,GENERIC_TYPES} from './carfactory.js';

const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={rotation:!reduced.matches,doors:false,trunk:false,color:'#758f7b',ready:false,hasParts:true};
let renderer,controls,car,scene,camera,visible=true;
function announce(text){$('announcement').textContent=text;}
function sync(){
  $('rotate').setAttribute('aria-pressed',String(state.rotation));$('rotation-state').textContent=state.rotation?'Em movimento':'Pausada';
  for(const key of ['doors','trunk']){const b=$(key);b.disabled=!state.ready||!state.hasParts;b.setAttribute('aria-pressed',String(state[key]));b.querySelector('small').textContent=key==='doors'?(state.hasParts?(state[key]?'Fechar portas':'Abrir portas'):'Só no Porsche 911'):(state.hasParts?(state[key]?'Fechar compartimento':'Abrir compartimento'):'Só no Porsche 911');b.querySelector('.plus').textContent=state[key]?'−':'+';}
  if(controls)controls.autoRotate=state.rotation;
}
function setPart(key,open){if(!state.ready)throw new Error('O modelo ainda está carregando.');state[key]=open;state.rotation=false;sync();announce(key==='doors'?(open?'Portas abertas':'Portas fechadas'):(open?'Porta-malas dianteiro aberto':'Porta-malas fechado'));}
function setColor(color){const button=document.querySelector(`[data-color="${color}"]`);if(!button)throw new Error('Cor inválida.');state.color=color;if(car?.userData.paint)car.userData.paint.color.set(color);document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});$('color-name').textContent=button.getAttribute('aria-label');announce('Acabamento: '+$('color-name').textContent);}
function initialView(){const mobile=$('scene').clientWidth<600;camera.position.set(mobile?6.4:5.9,mobile?3.3:2.8,mobile?7.7:6.8);controls.target.set(0,.52,0);controls.update();}
function failure(message){state.ready=false;sync();$('loading').hidden=false;$('loading').style.display='flex';$('loading').replaceChildren();const p=document.createElement('p');p.textContent=message;const b=document.createElement('button');b.className='error-retry';b.textContent='Tentar novamente';b.onclick=()=>location.reload();$('loading').append(p,b);}
async function init(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0x101413,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    $('scene').appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failure('A visualização 3D foi interrompida. Recarregue para continuar.');});
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(33,1,.1,70);
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.06).texture;room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xe3f0df,0x303932,2.2));
    const key=new THREE.DirectionalLight(0xf5ffe9,4.5);key.position.set(3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.normalBias=.035;key.shadow.bias=-.0003;scene.add(key);
    const rim=new THREE.DirectionalLight(0xc4dfdd,3);rim.position.set(-4,3,-4);scene.add(rim);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.34}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
    const ring=new THREE.Mesh(new THREE.RingGeometry(2.95,2.96,100),new THREE.MeshBasicMaterial({color:0x7f9784,transparent:true,opacity:.17,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.scale.y=.84;ring.position.y=-.01;scene.add(ring);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.36;controls.autoRotateSpeed=.65;initialView();sync();
    controls.addEventListener('start',()=>{state.rotation=false;sync();});
    const resize=()=>{const {clientWidth:w,clientHeight:h}=$('scene');camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);};new ResizeObserver(resize).observe($('scene'));resize();
    let previous=0;
    renderer.setAnimationLoop(time=>{const dt=Math.min((time-previous)/1000,.05);previous=time;if(document.hidden||!visible)return;if(car&&car.userData.left){const speed=reduced.matches?1:1-Math.exp(-dt*7);const target=state.doors?1.06:0;car.userData.left.rotation.y=THREE.MathUtils.lerp(car.userData.left.rotation.y,-target,speed);car.userData.right.rotation.y=THREE.MathUtils.lerp(car.userData.right.rotation.y,target,speed);car.userData.trunk.rotation.x=THREE.MathUtils.lerp(car.userData.trunk.rotation.x,state.trunk?-1.1:0,speed);}controls.update(dt);renderer.render(scene,camera);});
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe($('showroom'));
    await showCar('sport');
  }catch(error){console.error(error);failure('Não foi possível carregar o showroom 3D. Verifique sua conexão e o suporte a WebGL do navegador.');}
}
let gltfLoader=null;
function loader(){if(!gltfLoader){gltfLoader=new GLTFLoader();gltfLoader.setDRACOLoader(new DRACOLoader().setDecoderPath('./vendor/draco/'));gltfLoader.setKTX2Loader(new KTX2Loader().setTranscoderPath('./vendor/basis/').detectSupport(renderer));}return gltfLoader;}
const modelProgress=progress=>{if(progress.total)$('loading-text').textContent=`Preparando o modelo 3D… ${Math.round(progress.loaded/progress.total*100)}%`;};
let porscheCar=null;
async function loadPorsche(){if(porscheCar)return porscheCar;const gltf=await loader().loadAsync('./models/porsche.glb',modelProgress);porscheCar=createArticulatedCar(gltf.scene);return porscheCar;}
// Modelos reais licenciados (créditos em credits.html); mantêm as cores originais do autor
const MODEL_CATALOG={
  classic:{url:'./models/cutlass.glb',length:5.2,rotateY:Math.PI,skipMaterial:'M_Dome'},
  golf:{url:'./models/golf.glb',length:4.2,rotateY:0},
  hilux:{url:'./models/hilux.glb',length:5.3,rotateY:0},
};
const catalogCache=new Map();
async function loadCatalogModel(kind){
  if(catalogCache.has(kind))return catalogCache.get(kind);
  const spec=MODEL_CATALOG[kind];
  const gltf=await loader().loadAsync(spec.url,modelProgress);
  const source=gltf.scene,doomed=[];
  source.traverse(node=>{if(node.isMesh){if(spec.skipMaterial&&node.material?.name===spec.skipMaterial)doomed.push(node);else{node.castShadow=true;node.receiveShadow=true;}}});
  doomed.forEach(node=>node.removeFromParent());
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  source.position.set(-center.x,-bounds.min.y,-center.z);
  const wrap=new THREE.Group();wrap.add(source);wrap.scale.setScalar(spec.length/Math.max(size.z,size.x));wrap.rotation.y=spec.rotateY;
  const car=new THREE.Group();car.add(wrap);
  car.userData={paint:null}; // pintura de fábrica: o arquivo traz as cores originais
  catalogCache.set(kind,car);
  return car;
}
const genericCache=new Map();
const KIND_INFO={
  sport:{brand:'PORSCHE',name:'911 Carrera 4S',tagline:'O espírito de um original.',listingTagline:'Modelo 3D ilustrativo: Porsche 911 Carrera 4S.',watermark:'911',caption:'01 — PORSCHE 911 CARRERA 4S'},
  classic:{brand:'OLDSMOBILE',name:'Cutlass Supreme 1971',tagline:'Um clássico de 1971 na cor original de época.',listingTagline:'Modelo 3D ilustrativo: Oldsmobile Cutlass Supreme 1971.',watermark:'71',caption:'02 — OLDSMOBILE CUTLASS SUPREME'},
  golf:{brand:'VOLKSWAGEN',name:'Golf',tagline:'Modelo low poly com as cores do artista.',listingTagline:'Modelo 3D ilustrativo: Volkswagen Golf (low poly).',watermark:'GOLF',caption:'03 — VOLKSWAGEN GOLF'},
  hilux:{brand:'TOYOTA',name:'Hilux',tagline:'Modelo low poly com as cores do artista.',listingTagline:'Modelo 3D ilustrativo: Toyota Hilux (low poly).',watermark:'HILUX',caption:'04 — TOYOTA HILUX'},
  hatch:{brand:'VÉRTICE',name:'Hatch',tagline:'Modelo ilustrativo do tipo de carroceria.',listingTagline:'Modelo 3D ilustrativo do tipo de carroceria.',watermark:'HATCH',caption:'05 — TIPO HATCH'},
  sedan:{brand:'VÉRTICE',name:'Sedã',tagline:'Modelo ilustrativo do tipo de carroceria.',listingTagline:'Modelo 3D ilustrativo do tipo de carroceria.',watermark:'SEDÃ',caption:'06 — TIPO SEDÃ'},
  suv:{brand:'VÉRTICE',name:'SUV',tagline:'Modelo ilustrativo do tipo de carroceria.',listingTagline:'Modelo 3D ilustrativo do tipo de carroceria.',watermark:'SUV',caption:'07 — TIPO SUV'},
  pickup:{brand:'VÉRTICE',name:'Picape',tagline:'Modelo ilustrativo do tipo de carroceria.',listingTagline:'Modelo 3D ilustrativo do tipo de carroceria.',watermark:'PICAPE',caption:'08 — TIPO PICAPE'},
};
function setShowroomInfo(kind,meta){const base=KIND_INFO[kind]||KIND_INFO.sport;const info=meta?{brand:String(meta.make||'').toUpperCase(),name:String(meta.model||''),tagline:base.listingTagline,watermark:String(meta.model||'').split(' ')[0].toUpperCase().slice(0,6),caption:`${meta.make} ${meta.model}`.toUpperCase()}:base;$('showroom-brand').textContent=info.brand;$('showroom-name').textContent=info.name;$('showroom-tagline').textContent=info.tagline;$('showroom-watermark').textContent=info.watermark;$('showroom-caption').textContent=info.caption;document.querySelectorAll('.model-picker [data-model]').forEach(b=>{const on=b.dataset.model===kind;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});}
async function showCar(kind='sport',meta=null){
  try{
    state.doors=false;state.trunk=false;state.ready=false;state.hasParts=kind==='sport';sync();
    const loading=$('loading');loading.hidden=false;loading.style.display='flex';
    let next;
    if(kind==='sport')next=await loadPorsche();
    else if(MODEL_CATALOG[kind])next=await loadCatalogModel(kind);
    else{next=genericCache.get(kind);if(!next){next=createGenericCar(kind);genericCache.set(kind,next);}}
    if(car&&car!==next)scene.remove(car);
    car=next;if(car.parent!==scene)scene.add(car);
    if(car.userData.paint)car.userData.paint.color.set(state.color);
    document.querySelector('.paint-panel').hidden=!car.userData.paint;
    state.ready=true;loading.style.display='none';sync();setShowroomInfo(kind,meta);
    announce(meta?`${meta.make} ${meta.model} em exibição no showroom 360°.`:'Porsche carregado. Explore o carro e abra as portas ou o porta-malas.');
  }catch(error){console.error(error);failure('Não foi possível carregar o showroom 3D. Verifique sua conexão e o suporte a WebGL do navegador.');}
}
window.showroomShowCar=(kind,meta)=>{if(!renderer||!scene)return;showCar(kind==='sport'||MODEL_CATALOG[kind]||GENERIC_TYPES.includes(kind)?kind:'sport',meta);};
document.querySelectorAll('.model-picker [data-model]').forEach(b=>b.addEventListener('click',()=>{if(scene)showCar(b.dataset.model);}));
$('rotate').onclick=()=>{state.rotation=!state.rotation;sync();};
$('doors').onclick=()=>setPart('doors',!state.doors);$('trunk').onclick=()=>setPart('trunk',!state.trunk);
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>setColor(b.dataset.color));
$('reset').onclick=()=>{if(!controls)return;state.doors=false;state.trunk=false;state.rotation=!reduced.matches;initialView();sync();announce('Vista inicial restaurada.');};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('showroom').requestFullscreen)await $('showroom').requestFullscreen();else announce('Tela cheia não está disponível neste navegador.');}catch{announce('Não foi possível abrir em tela cheia.');}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Sair da tela cheia':'Abrir showroom em tela cheia');});
$('scene').addEventListener('keydown',e=>{if(!controls)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();state.rotation=false;sync();const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')s.theta-=.15;if(e.key==='ArrowRight')s.theta+=.15;if(e.key==='ArrowUp')s.phi-=.08;if(e.key==='ArrowDown')s.phi+=.08;if(e.key==='+')s.radius-=.5;if(e.key==='-')s.radius+=.5;s.phi=THREE.MathUtils.clamp(s.phi,.36,Math.PI*.48);s.radius=THREE.MathUtils.clamp(s.radius,4,12);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();}});
reduced.addEventListener('change',()=>{if(reduced.matches){state.rotation=false;sync();}});
const lifecycle=new AbortController();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'configure_porsche_showroom',title:'Configurar showroom Porsche',description:'Abre ou fecha as portas e o porta-malas, altera a cor e controla a rotação do Porsche visível.',inputSchema:{type:'object',properties:{doors:{type:'boolean'},trunk:{type:'boolean'},rotation:{type:'boolean'},color:{type:'string',enum:['#758f7b','#b8bdc4','#262a2c','#951f28']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuração inválida.');for(const [key,value]of Object.entries(input)){if(!['doors','trunk','rotation','color'].includes(key)|| (key==='color'?!['#758f7b','#b8bdc4','#262a2c','#951f28'].includes(value):typeof value!=='boolean'))throw new Error('Configuração inválida.');}if(!state.ready)throw new Error('O modelo ainda está carregando.');for(const key of ['doors','trunk'])if(key in input)setPart(key,input[key]);if('color'in input)setColor(input.color);if('rotation'in input)state.rotation=input.rotation;sync();await new Promise(resolve=>setTimeout(resolve,reduced.matches?40:1200));return {...state};}},{signal:lifecycle.signal})).catch(console.warn);}catch(error){console.warn(error);}}
window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
init();
