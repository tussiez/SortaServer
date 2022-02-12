import * as THREE from '/three.module.js';
import Physijs from '/lib/physi.js';
import SortaAccounts from '/login.js';
import Grapher from 'https://sortagrapher.sortagames.repl.co/lib.js';
import PointerLockControls from '/controls.js';
import SpriteTex from '/spritetext.js'
import {OrbitControls} from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'https://threejs.org/examples/jsm/loaders/GLTFLoader.js';

if(window !== window.parent) {
  //Template literals are better - Baocnman321
 /* document.body.innerHTML = `
  <h1>This breaks in Repl.it</h1>
  <p>Open <a href="${window.location.href}" target="_blank">this</a> in a new tab.</p>`;
  */ // Fix for SortaScience
} else {

const globalInfo = {
  noFPSConnecting: false
};
  Physijs.scripts.ammo = '/lib/ammo.js';
Physijs.scripts.worker = '/lib/physiworker.js';

const socket = io();


window.socket = socket;
window.runCommand = (val,e) => { // alternative to inspect
//"===" not "==" - Baconman321"
if(e.key === 'Enter'){
  try {
    eval(val);
  } catch (err) {
    alert("Couldn't run code, here's the error: \n\n"+err)
  }
}
}
let camera,scene,renderer,controls,objects = [],objID = [], fps = 0, serverFPS, lastPing = 0, ping = 0, serverFrame = 0, serverRelativeFPS = 0, drivingVehicle = false,pointerLocked =false,clientObj, canJump = true, background, SpriteText, orbitControls, previousPos, playerName, playerTeam, canMove = false, pingArray = [], avgPing = 0,lastServFrame = 0,sceneHasLoadedYes = false,lastRedTeamPoints = 0, lastBlueTeamPoints = 0, mouse = new THREE.Vector2(), mousePos = new THREE.Vector3(), mouseDir = new THREE.Vector3(),gltfLoader,playerModel,tClock = new THREE.Clock(),drivingPlane = false;

window.isManual = false;
//"const" instead of "let" (because you aren't reassigning it). Also use "dcocument.querySelector()" instead - Baconman321
const textCanvas = document.querySelector('#textCanvas');
let drivingControls = document.querySelector('#driving_controls');
let gearElement = document.querySelector('#gear');
let rpmElement = document.querySelector('#rpm');
//let speedElement = document.querySelector('#speed');
let playbt = document.querySelector('#playbt');
let connectingDiv = document.querySelector('#connecting');
let leaderboard = document.querySelector('#leader');
let timeRemaining = document.querySelector('#timeRemaining');
let pointsRedEle = document.querySelector('#pointsRed');
let pointsBlueEle = document.querySelector('#pointsBlue');
let flyingControls = document.querySelector('#flying_controls');
let keys = new Set();
let socketId = Math.random();

// SortaAccounts login
window.useSortaAccounts = function(bt,uu) {
  SortaAccounts.login().then(resp => {
    if(typeof resp.err === 'undefined') {
      uu.value = resp;
    } else {
      if(resp.err == 'server') bt.disabled = true;
    // if incorrect, allow to try again
    }
  })
}


window.addEventListener('onload', () => {
  connectingDiv.style.display = 'none'; // done pageload
  playbt.disabled = false; // not disabled;
})
const updateVehicleInfo = ({throttle, gear, rpm, output,speed,mspeed,mthrottle,mgear,mrpm,moutput}) => {
  gearElement.innerHTML = 'D'+gear;
  //speedElement.style.width = ((speed/mspeed)*100 ) + '%';
  rpmElement.style.transform = "rotate("+((rpm/mrpm)*180-90)+"deg)";

}

const addLeaderboard = (team, name, pts, lvl) => {
  let tr = document.createElement("tr");
  let tm = document.createElement("td");
  tm.innerHTML = (team === 'red' ? '<span style="font-weight:bold;color: red;">Red</span>' : '<span style="font-weight:bold;color:blue;">Blue</span>');
  tr.appendChild(tm);
  let nm = document.createElement("td");
  nm.innerHTML = name;
  tr.appendChild(nm);
  let pt = document.createElement("td");
  pt.innerHTML = pts;
  pt.thePoints = 0;
  pt.setAttribute("id",'leaderboard-points-'+name);
  tr.appendChild(pt);
  let lv = document.createElement("td");
  lv.setAttribute("id",'leaderboard-levels-'+name);
  lv.innerHTML = lvl;
  tr.appendChild(lv);
  tr.setAttribute("id", 'leaderboard-'+name);
  tr.setAttribute("class", "leaderboard_tr_"+team);
  tr.setAttribute('data-name', name);
  leaderboard.appendChild(tr);
  return tr;
}

const setLeaderboardPoint = (name, pts) => {
  let ele = document.querySelector("#leaderboard-points-"+name);
  if(ele) {
    ele.innerHTML = pts;
  }
}

const setLeaderboardTeamPoint = (team, pts) => {
  let eles = document.getElementsByClassName('leaderboard_tr_'+team);
  for(let el of eles) {
    let nm = el.getAttribute('data-name');
    let pt = document.querySelector('#leaderboard-points-'+nm);
    if(pt) {
      pt.thePoints += pts;
      pt.innerHTML = Math.floor(pt.thePoints);
    }
  }
}

const setLeaderboardLevel = (name, lvl) => {
  let ele = document.querySelector("#leaderboard-levels-"+name);
  if(ele) {
    ele.innerHTML = lvl;
  }
}

const removeLeaderboard = (name) => {
  let ele = document.querySelector("#leaderboard-"+name);
  if(ele) {
    ele.parentNode.removeChild(ele); // remove
  }
}

const emptyLeaderboard = () => {
  let eles = document.getElementsByClassName('leaderboard_tr_red');
  for(let el of eles) {
    el.parentNode.removeChild(el);
  }
  eles = document.getElementsByClassName('leaderboard_tr_blue');
  for(let el of eles) {
    el.parentNode.removeChild(el);
  }
}

socket.on("user_joined", ({team,name}) => {
  addLeaderboard(team, name, 0, 0);
});
socket.on("user_leave", ({name}) => {
  removeLeaderboard(name);
});

socket.on("timeLeft", elap => {
  elap /= 1000; // to sec
  let min = Math.floor(elap/60); // min
  let sec = Math.floor(elap % 60);
  timeRemaining.innerHTML = 'Time left: '+(min)+":"+(sec < 10 ? "0"+sec: sec);
});

socket.on('gameStart', () => {
  // set points to 0
  setLeaderboardTeamPoint('red',0);
  setLeaderboardTeamPoint('blue', 0);
})


socket.on('client_driveVehicle', (bo) => {
  if(bo == true) {
    drivingVehicle = true;
    drivingControls.style.display = 'block';
  } else if(bo == false){
    drivingVehicle = false;
    drivingControls.style.display = 'none';
  }
});

socket.on('client_drivePlane', (bool) => {
  if(bool === true) {
    drivingPlane = true;
    flyingControls.style.display = 'block';
  }
  if(bool === false) {
    flyingControls.style.display = 'none';
    drivingPlane = false;
  }
});

window.removePlane = () => {
  socket.emit('client_deletePlane');
}

window.removeVehicle = () => {
  socket.emit('client_deleteVehicle'); // delete vehicle
}
window.flipVehicle = () => {
  socket.emit('client_flipVehicle');
}
window.setPlayerInfo = (name, team) => {
  playerName = name;
  playerTeam = team;
  socket.emit('setName', name);
  socket.emit('setTeam', team);
  document.getElementById('team_prompt').style.display = 'none';
  canMove = true;
}

socket.on('playerCollision', (other, linv, angv, normal) => {
  canJump = true; // jump
})
let errorText = document.getElementById('center');
let pingGrapher = new Grapher(75,75);
let fpsGrapher = new Grapher(75,75);
let inf = document.getElementById('info');
let infDiv = document.getElementById('inf2');
let infLogger = document.getElementById('logger');
let chatbox = document.getElementById('chatbox_inner');
let chatboxInput = document.getElementById('chatbox_input')
let pingLog = new pingGrapher.Reading(20);
let pingText = new pingGrapher.sortacanvas.Text(2,12,'Ping','12px Arial', 'white', false);
let fpsText =new fpsGrapher.sortacanvas.Text(2,12,'FPS','12px Arial','white',false);
pingGrapher.sortacanvas.add(pingText)
fpsGrapher.sortacanvas.add(fpsText);
window.sendMessage = (e) => {
  if(e.key === "Enter") {
  socket.emit('chat', e.target.value); // send
  chatboxInput.value = ""; // clear
  chatboxInput.blur(); // unselect
  }
}
chatboxInput.onfocus = () => {
  canMove = false;
}
chatboxInput.onblur = () => {
  canMove = true;
}
const onLostConnection = () => {

      errorText.style.display = 'block';
      renderer.domElement.style.filter = 'blur(6px)';
      drivingVehicle = false;
      document.getElementById('team_prompt').style.display = 'block';
      connectingDiv.style.display = 'block'; //loading circl
      playbt.disabled = true; // disabled, cannot play
      drivingControls.style.display = 'none'; // not drivin
      drivingPlane = false;
      flyingControls.style.display = 'none';
      emptyLeaderboard();//fix
}
const onReconnect = () => {
  playbt.disabled = false;
  document.getElementById('team_prompt').style.display = 'block'; // reconnect screen
}
socket.on('connect', function () {
  socketId = socket.id;
  console.log('Socket ID: ', socketId);
  onReconnect(); // when rejoin
});
const showMessage = (msg) => {
  let ele = document.createElement('div');
  ele.setAttribute('class', 'chatbox_msg');
  ele.innerText = msg;
  chatbox.appendChild(ele);
  chatbox.scrollBy(100,100); // scroll
}
socket.on('chat', showMessage);
socket.on('objectUpdated', (id)=> {
  infLogger.innerHTML += '<Br>Object '+id+' updated'
  infLogger.scrollBy(0,100);
});
socket.on('disconnect', (e) => {
  onLostConnection();
})
socket.on('objectNotFound', (id) => {
  infLogger.innerHTML += '<Br>Object '+id+' not found'
  infLogger.scrollBy(0,100)
});
socket.on('missingParameters', () => {
  infLogger.innerHTML += '<br>Missing parameters';
  infLogger.scrollBy(0,100)
});

document.body.addEventListener('keydown', (e) =>{
  keys.add(e.key.toLowerCase());
  if(sceneHasLoadedYes == true) {
    // fire?
    if(keys.has('f')) {
      let dir = clientObj.position.clone().sub(mousePos).normalize().multiplyScalar(50);
      let poz = clientObj.position.clone().add(controls.getDirection(new THREE.Vector3()).multiplyScalar(3)); // from player
      poz.set(poz.x,clientObj.position.y,poz.z);
      // get dir
      socket.emit('createObject',{
        // geometry
        name: 'sphere',
        radius: 0.2,
      },
      {
       // material
       name: 'basic',
       color: {r: 1, g: 0, b: 0}
      },
      0.01, // mass
      //pos
      poz,
      {
        // rotation
        x: 0,
        y: 0,
        z: 0,
      },
      dir, // linear velocity
      {
        // angular velocity
        x:0,
        y:0,
        z:0,
      },
      'BULLET')

    }
  }
});
document.body.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase())

})


let fpsLog = new fpsGrapher.Reading(10)
inf.appendChild(fpsGrapher.canvas)

inf.appendChild(pingGrapher.canvas);

const controlVehicle = () => {
  let direction = 'NOT_DEFINED';
  let power = 'NOT_DEFINED';
  let brake = 'NOT_DEFINED'; // default values
  let trans = window.isManual === false ? 'AUTOMATIC' : 0;
  if(window.isManual === true) {
  if(keys.has('q')) {
    // Switch down
    trans = -1;
    keys.delete('q');
  }
  if(keys.has('e')) {
    // Switch up
    trans = 1;
    keys.delete('e');
  }
  }
  if(keys.has('w')) {
    power = true; // forward
  }
  if(keys.has('s')) {
    power = 2; // backward
  }
  if(keys.has('d')) {
    direction = 1; // right
  }
  if(keys.has('a')) {
    direction = -1; // left
  }
  if(!keys.has('d') && !keys.has('a')) {
    direction = null; // not steering
  }
  if(!keys.has('w') && !keys.has('s')) {
    power = null; // not pressing gas
    brake = 'ENGINE_OFF';
  }
  if(keys.has('shift')) {
    brake = 'ENGINE_OFF'; // shutoff engine
  }
  socket.emit('client_controlVehicle', direction, power, brake, trans);
}

const controlPlane = () => {
  let vec = new THREE.Vector3();
  if(keys.has('w')) {
    let moveFwd = controls.moveForward(0.1,true);
    vec.add(moveFwd);
  }
  if(keys.has('s')) {
    let moveBwd = controls.moveForward(-0.1,true);
    vec.add(moveBwd);
  }
  if(keys.has('a')) {
    let moveLeft = controls.moveRight(-0.1,true);
    vec.add(moveLeft);
  }
  if(keys.has('d')) {
    let moveRight = controls.moveRight(0.1,true);
    vec.add(moveRight);
  }
  if(keys.has('q')) {
    vec.y = -0.2;
  }
  if(keys.has('e')) {
    vec.y = 0.2;
  }
  if(vec.x != 0 && vec.y != 0 && vec.z != 0) {
  socket.emit('client_controlPlane', vec);
}
}

const movePlayer = () => {
  if(clientObj) {
    window.clientObj = clientObj;
    //camera.position.copy(clientObj.position);
    if(!previousPos) previousPos = clientObj.position.clone();
    let diff = clientObj.position.clone().sub(previousPos);
    camera.position.add(diff); // move camera
    orbitControls.target.copy(clientObj.position);
    orbitControls.update();

    previousPos.copy(clientObj.position);

    if(canMove == true) {
    if(drivingVehicle == true) {
      controlVehicle();
    }
    if(drivingPlane == true) {
      controlPlane();
    }
    // drive vehicle

    if(keys.has('q')) {
      if(drivingVehicle == false) {
      socket.emit('client_driveVehicle'); // drive nearby empty vehicle
      }
      if(drivingPlane == false) {
        socket.emit('client_drivePlane'); // Drive nearby empty plane
      }
      keys.delete('q'); // hmm
    }
    if(keys.has(' ')) {
      if(drivingVehicle == true) {
        socket.emit('client_exitVehicle'); // exit vehicle
      }
      if(drivingPlane == true) {
        socket.emit('client_exitPlane');
      }
    }

    controls.velocDir.set(0,0,0);

    if(keys.has('/')) {
      chatboxInput.focus(); // chat
    }
    if(keys.has('w')) {
      controls.moveForward(5);
    }
    if(keys.has('s')) {
      controls.moveForward(-5)
    }
    if(keys.has('a')) {
      controls.moveRight(-5)
    }
    if(keys.has('d')) {
      controls.moveRight(5)
    }
    if(keys.has('w')||keys.has('a')||keys.has('s')||keys.has('d')) {
      if(clientObj && clientObj.children[0]) {
        for(let act of playerModel._modelAnimations) {
          clientObj.children[0]._aniMixer.clipAction(act).play();
        }
      }
    } else {
      if(clientObj && clientObj.children[0]) {
        clientObj.children[0]._aniMixer.stopAllAction();
      }
    }
    if(keys.has(' ')) {
      if(canJump == true) {
        canJump = false;// now wait for next collision till we can jump
        socket.emit('client_applyCentralImpulse', new THREE.Vector3(0,4,0)); // jump!
      }
    }


  }
  }
}


const render = () => {
  requestAnimationFrame(render);
  TWEEN.update(); // animation
  ping = performance.now() - lastPing;
  movePlayer();
  //simulatePhysicsUpdate();
  if(scene.simulate(1000/serverRelativeFPS,1) != false) {
  //  lastServFrame++; // advance simulation
  }

  // animation update
  let delt = tClock.getDelta();
  if(playerModel && playerModel._aniMixer && clientObj) {
    for(let ob of objects) {
      if(ob._isAPlayer === true) {
        if(ob._isModel === true) {
        ob.children[0]._aniMixer.update(delt);
        }
      }
    }
  }


  renderer.render(scene,camera);
}

const toVec3 = (v) => {
  return new THREE.Vector3(v.x,v.y,v.z); // easier
}

const addVec3 = (a,b) => {
  return new THREE.Vector3(a.x+b.x, a.y+b.y,a.z+b.z); // *new* vector
}


const init = () => {
  camera = new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.1,1000);
  scene = new Physijs.Scene({fixedTimeStep: 1/60});
  scene.onLoad = () => {
    sceneHasLoadedYes = true;
      scene.setGravity(new THREE.Vector3(0,-9.87,0)); // correct gravsss

  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.domElement.setAttribute('id', 'webgl_canvas');
  document.body.appendChild(renderer.domElement);
    const loader = new THREE.TextureLoader();
  const texture = loader.load(
    'img/skybox.png',
    () => {
      const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
      rt.fromEquirectangularTexture(renderer, texture);
      scene.background = rt;
    });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    let v = new THREE.Vector3();
    v.set(
    ( e.clientX / window.innerWidth ) * 2 - 1,
    - ( e.clientY / window.innerHeight ) * 2 + 1,
    0.5 );
    v.unproject( camera );
    v.sub( camera.position ).normalize();
    let distance = - camera.position.z / v.z;
    mousePos.copy( camera.position ).add( v.multiplyScalar( distance ) );
  })
  camera.position.set(5,5,5)
  controls = new PointerLockControls(camera, renderer.domElement, socket);
  orbitControls = new OrbitControls(camera, renderer.domElement)
  pointerLocked = true;
  controls.isLocked = true;


  // setup spritetext
  SpriteText = new SpriteTex(camera, renderer, textCanvas);

  SpriteText.sc.setSize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => {
    SpriteText.sc.setSize(window.innerWidth, window.innerHeight);
  })

  loadPlayerModel();
  getFPS();
  setInterval(logPing, 50);
  setInterval(updateCounters,250);
  render();
  };
}

const loadPlayerModel = () => {
  gltfLoader = new GLTFLoader();
  gltfLoader.load('/aplayer.glb', (mod) => {
    playerModel = mod.scene.children[0];
    playerModel.scale.set(0.5,0.5,0.5);
    playerModel._aniMixer = new THREE.AnimationMixer(playerModel);
    playerModel._modelAnimations = mod.animations;
    playerModel._isModel = true;

  });
}


const logPing = () => {
   pingLog.log(pingLog.mapNumber(avgPing,0,150));
   // update pong
   pingArray.push(ping);
   if(pingArray.length > 50) pingArray.shift();

   let ad = 0;
   for(let pi of pingArray) ad += pi;
   avgPing = ad/pingArray.length;

}
const updateCounters = () => {
  pingText.text = `Ping: ${ping.toFixed(1)}ms`;
  fpsText.text = `FPS: ${serverRelativeFPS}`;
}

const getFPS = () => {
  let current = renderer.info.render.frame;
  let ser = serverFrame;
  setTimeout(() => {
    fps = renderer.info.render.frame - current;
    serverRelativeFPS = serverFrame - ser;
    fpsLog.log(fpsLog.mapNumber(serverRelativeFPS,0,100));

    // 0 fps? bad connection
    if(avgPing>5000) {
      onLostConnection();
    } else {
      errorText.style.display = 'none';
      playbt.disabled = false; // not disabled
      connectingDiv.style.display = 'none';
      renderer.domElement.style.filter = '';
    }

    getFPS();
  },1000)
}

init();

socket.on('simulate', (dat) => {
  if(sceneHasLoadedYes == true) {
  // handle
  serverFrame++;
  serverFPS = dat.fps;
  lastPing = performance.now();
  // Update points
  pointsRedEle.innerHTML = Math.floor(dat.redTeamPoints);
  pointsBlueEle.innerHTML = Math.floor(dat.blueTeamPoints);
  let difr = dat.redTeamPoints - lastRedTeamPoints;
  let difb = dat.blueTeamPoints - lastBlueTeamPoints;
  setLeaderboardTeamPoint('red', difr);
  setLeaderboardTeamPoint('blue', difb);
  lastBlueTeamPoints = dat.blueTeamPoints;
  lastRedTeamPoints =  dat.redTeamPoints;


  if(dat.frame > lastServFrame) {

  for(let i = 0; i < dat.objects.length; i++){
    let obj = dat.objects[i];
    if(!objID.includes(obj.id)) {
      makeObject(obj)
    } else {
      let ob = objects[objID.indexOf(obj.id)];
      //store movement
      ob._server.positionMovement = obj.positionMovement || new THREE.Vector3();
      ob._server.rotationMovement = obj.rotationMovement || new THREE.Vector3();
      if(ob._isLight == true && ob.target) {
        ob.target.position.set(obj.geometry.target.x,obj.geometry.target.y,obj.geometry.target.z); // move target
      }

      if(obj.playerId == socketId) {
        clientObj = ob;
        controls.lastVelocity.set(obj.lastLinVeloc.x,obj.lastLinVeloc.y,obj.lastLinVeloc.z);
      }
      if(obj.playerId != undefined) {
        ob._isAPlayer = true;
        // player
        // do we have model ready?
        if(playerModel) {
          if(ob._isModel === undefined) { //not already a model?
          ob.material.transparent = true;
            ob.material.opacity = 0;
            ob.add(playerModel.clone());
            ob.children[0].position.y = -1;
            ob.children[0]._aniMixer = new THREE.AnimationMixer(ob.children[0]);
            for(let ani of playerModel._modelAnimations) {
              ob.children[0]._aniMixer.clipAction(ani).play();
            }
            ob._isModel = true;
          }
        }
      }
      if(obj._vehicleClientInfo) {
        if(obj._vehicleClientInfo.socketId == socketId) {
          // update vehicle info
          updateVehicleInfo(obj._vehicleClientInfo)
        }
      }
      if(obj.playerId != undefined && ob.hasSprite == undefined && typeof SpriteText != 'undefined') {
        ob.hasSprite = true;
        ob.sprite = new SpriteText.Sprite(new THREE.Object3D(), obj.id, 'white', '20px Arial');
        ob.spriteIdx = ob.sprite.idx;
      }
      if(ob.sprite != undefined) {
       let sp = ob.sprite;
       if(sp) {
       sp.pos.set(ob.position.x,ob.position.y,ob.position.z)
       }
      }
      if(obj.forceUpdate == true || ob.forceUpdate == true || obj._doNotSimulate === true){
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
      ob.__dirtyRotation = true;
      ob.__dirtyPosition = true;
      } else {
      /*
      // Animate
      if(ob.tweenPos != undefined) ob.tweenPos.stop();
      let dist = Math.abs(new THREE.Vector3(obj.position.x,obj.position.y,obj.position.z).distanceTo(ob.position))*80
      let fr = new THREE.Vector3().copy(ob.position)
      let tween = new TWEEN.Tween(fr).to(obj.position, dist).start().onUpdate(() => {
        ob.position.copy(fr);
      });
      ob.tweenPos = tween;

      if(ob.tweenRot != undefined) ob.tweenRot.stop();
      let dist2 = Math.abs(ob.rotation.toVector3(new THREE.Vector3()).distanceTo(new THREE.Vector3(obj.rotation.x,obj.rotation.y,obj.rotation.z)));
      let tween2 = new TWEEN.Tween(ob.rotation).to(obj.rotation, dist2).start()
      ob.tweenRot = tween2;
      */
      }
      if(ob.setLinearVelocity) {
        ob.setLinearVelocity(new THREE.Vector3(
          obj.lastLinVeloc.x,
          obj.lastLinVeloc.y,
          obj.lastLinVeloc.z,
        ));
        ob.setAngularVelocity(new THREE.Vector3(
          obj.lastAngVeloc.x,
          obj.lastAngVeloc.y,
          obj.lastAngVeloc.z,
        ))
      }
    }
  }
  removeObjects(dat.objects)
  } else {
    // backed up
  }
  lastServFrame = dat.frame;
  }
});

const removeObjects = (gr) => {
  let ids = [];
  for(let gro of gr) ids.push(gro.id); // populate

  for(let i = 0; i < objects.length;i++) {
    let obj = objects[i];
    if(obj && obj.__serverObjectID) {
      if(!ids.includes(obj.__serverObjectID)) {
        // Object no longer exists. Delete?
        if(scene.children.includes(obj)) {
        if(obj.geometry && obj.material) {
        obj.geometry.dispose(); // clear mem
        obj.material.dispose();
        }
        scene.remove(obj);

        // remove from arrays
        objID.splice(objID.indexOf(obj.__serverObjectID),1);
        objects.splice(i, 1); // delete this object
        if(i > 0) i -=1;
        }
      }
    } else {
      // not a server object
    }
  }
}

const geometries = {
  'box': THREE.BoxGeometry,
  'sphere': THREE.SphereGeometry,
  'plane': THREE.PlaneGeometry,
  'cylinder': THREE.CylinderGeometry,
}

const materials = {
  'basic': THREE.MeshBasicMaterial,
  'phong': THREE.MeshPhongMaterial,
  'lambert': THREE.MeshLambertMaterial,
}

const lights =  {
  'spot': THREE.SpotLight,
  'ambient': THREE.AmbientLight,
  'hemisphere': THREE.HemisphereLight
}

const physiMesh = {
  'box': Physijs.BoxMesh,
  'plane': Physijs.BoxMesh,
  'sphere': Physijs.SphereMesh,
  'cylinder': Physijs.CylinderMesh,
}

const makeObject = (obj)=> {
  let geo;
  let ob;
  if(obj.geometry.lightType==undefined) { // not a light
  let objColor = new THREE.Color(obj.material.color.r,obj.material.color.g,obj.material.color.b);
  let mat = new materials[obj.material.name]({
  });
  if(!obj.texture) {
    mat.color = objColor;
  } else {
    mat.map = new THREE.TextureLoader().load(obj.texture);
    if(obj.textureRepeat) {
      mat.map.wrapS = THREE.RepeatWrapping;
      mat.map.wrapT = THREE.RepeatWrapping;
      mat.map.repeat.set(obj.textureRepeat,obj.textureRepeat)

    }

  }
  if(obj.geometry.name == 'box'){
    geo = new geometries.box(obj.geometry.height,obj.geometry.width,obj.geometry.depth);
  }
  if(obj.geometry.name == 'plane') {
    geo = new geometries.plane(obj.geometry.width, obj.geometry.height)
  }
  if(obj.geometry.name == 'sphere'){
    geo = new geometries.sphere(obj.geometry.radius, obj.geometry.width,obj.geometry.height)
  }
  if(obj.geometry.name == 'cylinder') {
    geo = new geometries.cylinder(obj.geometry.x,obj.geometry.y,obj.geometry.z);
    geo.rotateX(obj.geometry.rotation[0]); // rotation
    geo.rotateY(obj.geometry.rotation[1]);
    geo.rotateZ(obj.geometry.rotation[2]);

  }
  let tai = obj._doNotSimulate === true ? THREE.Mesh : physiMesh[obj.geometry.name];
  ob = new tai(
    geo,
    Physijs.createMaterial(mat, obj.material.friction, obj.material.restitution), // accurate fric/rest
    obj.mass
  );
  ob.castShadow = true;
  ob.receiveShadow = true;

  } else {
    // is a light
    ob = new lights[obj.geometry.lightType](
      ...obj.geometry.lightParams // set params
    )
    ob._isLight = true; // is a light
    if(ob.target) {
    scene.add(ob.target);
    ob.target.position.set(obj.geometry.target.x,obj.geometry.target.y,obj.geometry.target.z);
    ob.castShadow = true;
    ob.receiveShadow = true;
    }
  }
  ob.forceUpdate = true;
  ob.__serverObjectID = obj.id;
  ob._server = {
    // server-related info
  }
  objects.push(ob);
  objID.push(obj.id);
  scene.add(ob)
}

} // closing else
