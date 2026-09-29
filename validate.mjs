import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createArticulatedCar} from './dist/rig.js';
const bytes=await readFile('dist/models/porsche.glb');
const loader=new GLTFLoader();loader.register(()=>({name:'GEOMETRY_VALIDATION_NO_TEXTURES',loadTexture:()=>Promise.resolve(null)}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const car=createArticulatedCar(gltf.scene);
for(const name of ['left','right','trunk']){
 const part=car.userData[name];assert.ok(part.children.length,`${name} must contain actual model geometry`);
 const before=new THREE.Box3().setFromObject(part);part.rotation[name==='trunk'?'x':'y']=1;
 const after=new THREE.Box3().setFromObject(part);assert.ok(before.min.distanceTo(after.min)+before.max.distanceTo(after.max)>.1,`${name} must move`);part.rotation.set(0,0,0);
}
const bounds=new THREE.Box3().setFromObject(car);console.log('Car dimensions:',bounds.getSize(new THREE.Vector3()).toArray());assert.ok(bounds.getSize(new THREE.Vector3()).z>4.2 && bounds.getSize(new THREE.Vector3()).z<4.7);
car.traverse(mesh=>{if(!mesh.isMesh)return;for(const v of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});
const html=await readFile('dist/index.html','utf8');
for(const path of ['dist/app.js','dist/rig.js','dist/style.css','dist/credits.html','dist/vendor/three.module.js','dist/vendor/three.core.js','dist/utils/BufferGeometryUtils.js'])await access(path);
for(const id of ['showroom','detalhes','inicio','scene','doors','trunk','rotate'])assert.ok(html.includes(`id="${id}"`));
console.log('PASS: GLB parsed, both doors and trunk contain articulated geometry, movement changes bounds, coordinates finite, local assets and menu anchors exist.');

