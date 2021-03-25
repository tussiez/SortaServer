const NodePhysijs = require('nodejs-physijs');
const Ammo = NodePhysijs.Ammo;
const THREE = NodePhysijs.THREE;
const Physijs = NodePhysijs.Physijs(THREE, Ammo);
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const {
  performance
} = require('perf_hooks')
app.use(express.static(__dirname + '/public'))

app.get('/',(req,res)=> res.sendFile('/index.html'))

// threejs start
let scene, block, simLoop, fps, frames = 0, id = 0;

const boxGeometry = (h,w,d) => {
  let geo = new THREE.CubeGeometry(h,w,d);
  geo.name ='box';
  return geo;
}

const sphereGeometry = (r, h, w) =>{
  let geo = new THREE.SphereGeometry(r, h, w);
  geo.name ='sphere';
  return geo;
}

const planeGeometry = (x,y,xs,ys) =>{
  let geo = new THREE.PlaneGeometry(x,y,xs,ys);
  geo.name = 'plane';
  return geo;
}

const basicMaterial = (params) =>{
  let mat = new THREE.MeshBasicMaterial(params);
  mat.name = 'basic';
  return mat;
}

const phongMaterial = (params) => {
  let mat = new THREE.MeshPhongMaterial(params);
  mat.name = 'phong';
  return mat;
}

const lambertMaterial = (params) => {
  let mat = new THREE.MeshLambertMaterial(params);
  mat.name = 'lambert';
  return mat;
}

const ObjectParams = function(obj) {
  let geoParams;
  if(obj.geometry.name == 'box' || obj.geometry.name == 'plane') {
    geoParams = {
      name: obj.geometry.name,
      height: obj.geometry.height,
      width: obj.geometry.width,
      depth: obj.geometry.depth,
    }
  }
  
  obj.params = {
    position: obj.position,
    rotation: obj.rotation,
    geometry: geoParams,
    material: obj.material,
    id,
    forceUpdate: true,
  }
  obj.updateParams = function () {
    obj.params.position = obj.position;
    obj.params.rotation = obj.rotation;
    obj.params.forceUpdate = false;
  }
  id++;
  return obj;
}

const updateFPS = () => {
  let current = frames;
  setTimeout(() => {
    fps = (frames - current);
    updateFPS();
  },1000);
}

const init = () => {
  scene = new Physijs.Scene();
  block =new ObjectParams(new Physijs.BoxMesh(
    boxGeometry(1,1,1),
    phongMaterial({color:'green'}),
    1 // mass
  )
  );
  block.position.set(0,10,0);
  scene.add(block);

  let plane = new ObjectParams(
    new Physijs.BoxMesh(
      planeGeometry(10,10,10),
      phongMaterial({color: 'blue'}),
      0
    )
  );
  plane.rotation.set(-Math.PI/2, 0, 0);
  scene.add(plane);

  setInterval(() => {
    block.position.set(0,10,0);
    block.params.forceUpdate = true;
    block.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    block.__dirtyPosition = true;
    block.__dirtyRotation = true;
  },5000);
  setInterval(simulatePhysics, 1000/60)
  // Would be better to run at 90 fps, to compensate for any lag. Dunno if this will consume too much CPU tho
  updateFPS();
}

const simulatePhysics = () => {
  if(scene.simulate() != false){
  frames++;
  let bigData = {
    fps,
    objects: [],
    time: performance.now()
  }
  for(let i = 0; i < scene.children.length; i++){
    let obj = scene.children[i];
    if(obj.params) {
      bigData.objects.push(obj.params)
    }
  }
  io.volatile.emit('simulate',bigData)
  for(i = 0; i < scene.children.length; i++){
    let obj = scene.children[i];
    if(obj.params) {
      obj.updateParams();
    }
  }
  }
}

init();


// threejs end



io.on('connection', (socket) => {
  console.log('Client connected.');
  socket.on('disconnect',() => {
    console.log('Client left.')
  })
})

http.listen(8080, () => console.log('hi'))