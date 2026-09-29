import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const bytes=await readFile('dist/models/porsche.glb');
const loader=new GLTFLoader();loader.register(()=>({name:'NO_TEXTURE_TEST',loadTexture:()=>Promise.resolve(null)}));
const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.getObjectByName('Plane')?.removeFromParent();scene.updateMatrixWorld(true);
console.log('bounds',new THREE.Box3().setFromObject(scene));
scene.traverse(m=>{if(!m.isMesh||m.material.name!=='paint')return;let g=m.geometry.clone().applyMatrix4(m.matrixWorld);g.computeBoundingBox();console.log(m.name,g.attributes.position.count,g.boundingBox.min.toArray().map(v=>v.toFixed(2)),g.boundingBox.max.toArray().map(v=>v.toFixed(2)));});
