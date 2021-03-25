import * as THREE from 'https://threejs.org/build/three.module.js';
import {OrbitControls} from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';
const socket = io();
let camera,scene,renderer,controls,objects = [],objID = [], fps = 0, serverFPS, lastPing = 0, ping = 0, serverFrame = 0, serverRelativeFPS = 0;
let inf = document.getElementById('info');
const render = () => {
  requestAnimationFrame(render);
  TWEEN.update(); // animation
  ping = performance.now() - lastPing;
  renderer.render(scene,camera);
}

const init = () => {
  camera = new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.1,500);
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth,window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });
  camera.position.set(5,5,5)
  controls = new OrbitControls(camera, renderer.domElement)
  getFPS();
  setInterval(updateCounters,250);
  render();
}

const updateCounters = () => {
  inf.innerHTML = `
  Ping: ${ping.toFixed(1)}ms<br>
  Server Perf: ${serverFPS} fps<br>
  Actual FPS: ${serverRelativeFPS}<br>
  Client FPS: ${fps}<br>
  `
}

const getFPS = () => {
  let current = renderer.info.render.frame;
  let ser = serverFrame;
  setTimeout(() => {
    fps = renderer.info.render.frame - current;
    serverRelativeFPS = serverFrame - ser;
    getFPS();
  },1000)
}

init();


socket.on('simulate', (dat) => {
  // handle
  serverFrame++;
  serverFPS = dat.fps;
  lastPing = performance.now();
  for(let i = 0; i < dat.objects.length; i++){
    let obj = dat.objects[i];
    if(!objID.includes(obj.id)) {
      makeObject(obj)
    } else {
      let ob = objects[objID.indexOf(obj.id)];
      if(obj.forceUpdate == true || ob.forceUpdate == true){
        ob.forceUpdate = false;
      ob.position.set(
        obj.position.x,
        obj.position.y,
        obj.position.z
      );
      ob.rotation.set(
        obj.rotation.x,
        obj.rotation.y,
        obj.rotation.z
      );
      } else {
      
      // Animate
      //if(ob.tweenPos != undefined) ob.tweenPos.stop();
      let dist = Math.abs(new THREE.Vector3(obj.position.x,obj.position.y,obj.position.z).distanceTo(ob.position))*50
      let fr = new THREE.Vector3().copy(ob.position)
      let tween = new TWEEN.Tween(fr).to(obj.position, dist).start().onUpdate(() => {
        ob.position.copy(fr);
      });
      ob.tweenPos = tween;
      
      if(ob.tweenRot != undefined) ob.tweenRot.stop();
      let dist2 = Math.abs(ob.rotation.toVector3(new THREE.Vector3()).distanceTo(new THREE.Vector3(obj.rotation.x,obj.rotation.y,obj.rotation.z)));
      let tween2 = new TWEEN.Tween(ob.rotation).to(obj.rotation, dist2).start()
      ob.tweenRot = tween2;
      
      }
    }
  }
})

const geometries = {
  'box': THREE.BoxGeometry,
  'sphere': THREE.SphereGeometry,
  'plane': THREE.PlaneGeometry,
}


const makeObject = (obj)=> {
  let geo;
  console.log(obj)
  if(obj.geometry.name == 'box'){
    geo = new geometries.box(obj.geometry.height,obj.geometry.width,obj.geometry.depth);
  }
  if(obj.geometry.name == 'plane') {
    geo = new geometries.plane(obj.geometry.width, obj.geometry.height)
  }
  let ob = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({color: Math.random()*0xffffff})
  );
  ob.forceUpdate = true;
  objects.push(ob);
  objID.push(obj.id);
  scene.add(ob)
}