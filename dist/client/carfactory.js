import * as THREE from 'three';

// Stylized body-type stand-ins for the showroom. Each spec draws the side
// profile (p = length axis, front negative; y = height) that is extruded
// across the width; the cab block places the tinted glass panels.
const SPECS={
 hatch:{width:1.72,wheel:.34,axleFront:1.25,axleRear:-1.25,profile:[[-1.97,.25],[-1.95,.58],[-1.72,.68],[-.72,.80],[-.18,1.34],[.80,1.36],[1.62,.95],[1.90,.60],[1.93,.25]],cab:{pA:-.72,pB:-.18,pC:.80,pD:1.62,yBelt:.82,yRoof:1.33}},
 sedan:{width:1.80,wheel:.35,axleFront:1.45,axleRear:-1.45,profile:[[-2.32,.25],[-2.30,.58],[-2.05,.68],[-.85,.80],[-.25,1.30],[.85,1.28],[1.55,.92],[2.15,.86],[2.30,.60],[2.28,.25]],cab:{pA:-.85,pB:-.25,pC:.85,pD:1.55,yBelt:.82,yRoof:1.27}},
 suv:{width:1.90,wheel:.42,axleFront:1.50,axleRear:-1.50,rails:true,profile:[[-2.37,.30],[-2.35,.70],[-2.05,.84],[-.95,.95],[-.40,1.60],[1.55,1.62],[2.20,1.45],[2.33,.75],[2.31,.30]],cab:{pA:-.95,pB:-.40,pC:1.55,pD:2.20,yBelt:.98,yRoof:1.58}},
 pickup:{width:1.95,wheel:.45,axleFront:1.75,axleRear:-1.65,bed:true,profile:[[-2.67,.30],[-2.65,.72],[-2.30,.86],[-1.15,.98],[-.62,1.68],[.42,1.70],[.55,1.06],[2.55,1.06],[2.63,.80],[2.61,.30]],cab:{pA:-1.15,pB:-.62,pC:.42,pD:.55,yBelt:1.00,yRoof:1.66}},
};
export const GENERIC_TYPES=Object.keys(SPECS);

export function createGenericCar(kind){
  const spec=SPECS[kind]||SPECS.sedan;
  const car=new THREE.Group();
  const paint=new THREE.MeshPhysicalMaterial({color:'#758f7b',metalness:.72,roughness:.23,clearcoat:1,clearcoatRoughness:.12});
  const glass=new THREE.MeshStandardMaterial({color:'#142123',roughness:.1,metalness:.4});
  const dark=new THREE.MeshStandardMaterial({color:'#191d1c',roughness:.6,metalness:.2});
  const tire=new THREE.MeshStandardMaterial({color:'#141414',roughness:.9});
  const silver=new THREE.MeshStandardMaterial({color:'#c9ccc9',metalness:.9,roughness:.3});
  const headlight=new THREE.MeshStandardMaterial({color:'#dfe8ec',emissive:'#d4e6ee',emissiveIntensity:.6,roughness:.2});
  const taillight=new THREE.MeshStandardMaterial({color:'#7a1218',emissive:'#8c1a20',emissiveIntensity:.4,roughness:.3});
  const add=(geometry,material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;car.add(mesh);return mesh;};

  const shape=new THREE.Shape();
  spec.profile.forEach(([p,y],i)=>i?shape.lineTo(p,y):shape.moveTo(p,y));
  shape.closePath();
  const depth=spec.width-.1;
  const body=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.05,bevelSize:.045,bevelSegments:3,steps:1,curveSegments:4});
  body.translate(0,0,-depth/2);
  body.rotateY(Math.PI/2); // (p,y,w) → (X=w, Y=y, Z=-p): front lands on +Z like the Porsche
  add(body,paint);

  const {pA,pB,pC,pD,yBelt,yRoof}=spec.cab,half=spec.width/2+.01;
  const cabLength=(pC+pD)/2-(pA+pB)/2,cabCenter=-((pA+pB)/2+(pC+pD)/2)/2;
  for(const side of [-1,1])add(new THREE.BoxGeometry(.02,yRoof-yBelt-.12,cabLength-.2),glass,side*half,(yBelt+yRoof)/2+.02,cabCenter);
  const slanted=(zBase,zTop,tilt)=>{const length=Math.hypot(zBase-zTop,yRoof-yBelt)-.06;const pane=add(new THREE.BoxGeometry(spec.width-.4,length,.03),glass,0,(yBelt+yRoof)/2+.06,(zBase+zTop)/2-tilt*.06);pane.rotation.x=tilt*Math.atan2(Math.abs(zBase-zTop),yRoof-yBelt);};
  slanted(-pA,-pB,-1); // para-brisa
  slanted(-pD,-pC,1);  // vidro traseiro
  if(spec.rails)for(const side of [-1,1])add(new THREE.BoxGeometry(.05,.05,cabLength-.3),dark,side*(spec.width/2-.24),yRoof+.12,cabCenter);
  if(spec.bed)add(new THREE.BoxGeometry(spec.width-.34,.05,-spec.cab.pD+2.45),dark,0,1.13,-(spec.cab.pD+2.45)/2);

  const front=-spec.profile[0][0],rear=-spec.profile[spec.profile.length-1][0];
  add(new THREE.BoxGeometry(spec.width-.8,.16,.06),dark,0,.52,front+.02); // grade
  for(const side of [-1,1]){
    add(new THREE.BoxGeometry(.34,.1,.06),headlight,side*(spec.width/2-.32),.62,front+.02);
    add(new THREE.BoxGeometry(.3,.1,.06),taillight,side*(spec.width/2-.3),.66,rear-.02);
  }
  const wheelX=spec.width/2-.04,tyre=new THREE.CylinderGeometry(spec.wheel,spec.wheel,.26,24),hub=new THREE.CylinderGeometry(spec.wheel*.55,spec.wheel*.55,.27,24);
  for(const [x,z] of [[wheelX,spec.axleFront],[-wheelX,spec.axleFront],[wheelX,spec.axleRear],[-wheelX,spec.axleRear]]){
    add(tyre,tire,x,spec.wheel,z).rotation.z=Math.PI/2;
    add(hub,silver,x,spec.wheel,z).rotation.z=Math.PI/2;
  }
  car.userData={paint};
  return car;
}
