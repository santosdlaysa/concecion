import * as THREE from 'three';

// Split the licensed mesh itself into articulated panels. Each polygon is
// clipped at the panel boundaries so the closed car has no overlapping copies.
function splitPolygon(poly, axis, boundary, greater) {
  const inside=[],outside=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const da=(a[axis]-boundary)*(greater?1:-1),db=(b[axis]-boundary)*(greater?1:-1);
    (da>=0?inside:outside).push(a);
    if((da>=0)!==(db>=0)){
      const t=da/(da-db),p=a.map((v,k)=>v+(b[k]-v)*t);
      inside.push(p);outside.push(p);
    }
  }
  return [inside,outside];
}
function partition(poly,planes){
  let candidate=poly;const remainder=[];
  for(const [axis,boundary,greater] of planes){
    if(candidate.length<3)break;
    const [yes,no]=splitPolygon(candidate,axis,boundary,greater);
    if(no.length>=3)remainder.push(no);
    candidate=yes;
  }
  return {selected:candidate.length>=3?[candidate]:[],remainder};
}
function append(target,poly){for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]])target.push(...v);}
function makeGeometry(data){
  const p=[],n=[],uv=[];
  for(let i=0;i<data.length;i+=8){p.push(data[i],data[i+1],data[i+2]);n.push(data[i+3],data[i+4],data[i+5]);uv.push(data[i+6],data[i+7]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeBoundingSphere();return g;
}
export function createArticulatedCar(source){
  source.getObjectByName('Plane')?.removeFromParent();
  const oldCoat=[];source.traverse(object=>{if(object.isMesh&&object.material.name==='coat')oldCoat.push(object);});oldCoat.forEach(object=>object.removeFromParent());
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=4.6/size.z;
  const normalization=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
  const car=new THREE.Group(),body=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group(),trunk=new THREE.Group();
  left.position.set(.70,.65,.72);right.position.set(-.70,.65,.72);trunk.position.set(0,.88,1.00);
  car.add(body,left,right,trunk);
  const paint=new THREE.MeshPhysicalMaterial({color:'#758f7b',metalness:.72,roughness:.23,clearcoat:1,clearcoatRoughness:.12,side:THREE.DoubleSide});
  const regions=[[[0,.70,true],[2,-.62,true],[2,.72,false],[1,.30,true],[1,1.16,false]],[[0,-.70,false],[2,-.62,true],[2,.72,false],[1,.30,true],[1,1.16,false]],[[0,-.52,true],[0,.52,false],[2,1.00,true],[2,2.07,false],[1,.64,true]]];
  const groups=[body,left,right,trunk];
  source.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.name==='coat')return;
    const g=mesh.geometry.clone().applyMatrix4(normalization.clone().multiply(mesh.matrixWorld));
    const pos=g.attributes.position,norm=g.attributes.normal,uv=g.attributes.uv,index=g.index;
    const fixed=/Cylinder|underbody/.test(mesh.name)||mesh.material.name==='full_black';
    const buffers=[[],[],[],[]];
    for(let i=0;i<(index?index.count:pos.count);i+=3){
      let polygons=[[0,1,2].map(k=>{const j=index?index.getX(i+k):i+k;return [pos.getX(j),pos.getY(j),pos.getZ(j),norm.getX(j),norm.getY(j),norm.getZ(j),uv?uv.getX(j):0,uv?uv.getY(j):0];})];
      for(let r=0;r<(fixed?0:regions.length);r++){
        const rest=[];
        for(const polygon of polygons){const cut=partition(polygon,regions[r]);cut.selected.forEach(p=>append(buffers[r+1],p));rest.push(...cut.remainder);}
        polygons=rest;
      }
      polygons.forEach(p=>append(buffers[0],p));
    }
    const mat=mesh.material.name==='paint'?paint:mesh.material.clone();
    mat.side=THREE.DoubleSide;
    if(mat.name==='rubber'){mat.roughness=.88;mat.metalness=.02;}
    if(mat.name==='window'){mat.color.set('#142123');mat.opacity=.78;mat.roughness=.08;mat.metalness=.35;mat.depthWrite=false;}
    if(mat.name==='glass'){mat.color.set('#d0dedc');mat.opacity=.22;mat.roughness=.08;mat.depthWrite=false;}
    if(mat.name==='lights'){mat.transmission=0;mat.opacity=.5;mat.emissive=new THREE.Color('#d4e6ee');mat.emissiveIntensity=.25;}
    buffers.forEach((data,i)=>{if(!data.length)return;const geometry=makeGeometry(data);geometry.translate(-groups[i].position.x,-groups[i].position.y,-groups[i].position.z);const part=new THREE.Mesh(geometry,mat);part.castShadow=true;part.receiveShadow=true;groups[i].add(part);});
    g.dispose();
  });
  car.userData={left,right,trunk,paint};
  return car;
}

