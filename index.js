const NodePhysijs = require('nodejs-physijs');
const Ammo = NodePhysijs.Ammo;
const THREE = NodePhysijs.THREE;
const Physijs = NodePhysijs.Physijs(THREE, Ammo);
const NewTHREE = require('three');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const middleware = require('socketio-wildcard')();
const Vehicle = require('./vehicle.js');
let vehicleSystem;
let vehicles = [];
let bases = []; // bases
let redTeamPoints = 0;
let blueTeamPoints = 0;
let planes = [];
io.use(middleware);

// Utility functions
const tol = (a,b,tolerance) => {
  return a > b-tolerance && a < b+tolerance;
}

const tolv = (a,b,tolerance) => {
  return tol(a.x,b.x,tolerance) === true && tol(a.y,b.y,tolerance) === true && tol(a.z,b.z,tolerance) === true;
}

const easing = (a,b,speed) => {
  return ((b-a)*speed);
}

const easingv = (a,b,speed) => {
  return {x: easing(a.x,b.x,speed), y: easing(a.y,b.y,speed), z: easing(a.z,b.z,speed)};
}

// Time
let gameTime = (15*60)*1000; // 15 min * 60 = sec * 1000 = msec
let startTime = 0; // start time for counting
const {
	performance
} = require('perf_hooks');
app.use(express.static(__dirname + '/public'))

app.get('/', (req, res) => res.sendFile('/index.html'))

// threejs start
let scene, block, simLoop, fps, frames = 0, id = 0;
let players = [];
const boxGeometry = (h, w, d) => {
	let geo = new THREE.CubeGeometry(h, w, d);
	geo.name = 'box';
	return geo;
}

const sphereGeometry = (r, h, w) => {
	let geo = new THREE.SphereGeometry(r, h, w);
	geo.name = 'sphere';
	return geo;
}

const planeGeometry = (x, y, xs, ys) => {
	let geo = new THREE.PlaneGeometry(x, y, xs, ys);
	geo.name = 'plane';
	return geo;
}

const spotLight = (color, intensity) => {
	let light = new THREE.SpotLight(color, intensity);
	light.name = 'spot';
	light._lightType = 'spot';
	light._lightParams = [color, intensity];
	return light;
}

const ambientLight = (color, intensity) => {
	let light = new THREE.AmbientLight(color, intensity);
	light.name = 'ambient';
	light._lightType = 'ambient';
	light._lightParams = [color, intensity];
	return light;
}

const hemisphereLight = (color0, color1, intensity) => {
	let light = new THREE.HemisphereLight(color0, color1, intensity);
	light.name = 'hemisphere';
	light._lightType = 'hemisphere';
	light._lightParams = [color0, color1, intensity];
	return light;
}

const cylinderGeometry = (x, y, z) => {
	let geo = new THREE.CylinderGeometry(x, y, z);
	geo.name = 'cylinder';
	geo.paramX = x;
	geo.paramY = y;
	geo.paramZ = z; // for client
	geo.paramRotation = [0, 0, 0];
	geo.rotate = function(vec, amt) {
		geo.paramRotation[vec] = amt;
		return geo;
	}
	return geo;
}

const basicMaterial = (params) => {
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
	let matParams;
	if (obj.geometry) {
		if (obj.geometry.name == 'box' || obj.geometry.name == 'plane') {
			geoParams = {
				name: obj.geometry.name,
				height: obj.geometry.width,
				width: obj.geometry.height,
				depth: obj.geometry.depth,
			}
		}
		if (obj.geometry.name == 'sphere') {
			geoParams = {
				name: obj.geometry.name,
				radius: obj.geometry.radius,

			}
		}
		if (obj.geometry.name == 'cylinder') {
			geoParams = {
				name: obj.geometry.name,
				x: obj.geometry.paramX,
				y: obj.geometry.paramY,
				z: obj.geometry.paramZ,
				rotation: obj.geometry.paramRotation,
			}
		}
		matParams = {
			name: obj.material.name,
			color: obj.material.color,
			friction: obj.material._physijs != undefined ? obj.material._physijs.friction : 0.8,
			restitution: obj.material._physijs != undefined ? obj.material._physijs.restitution : 0.2,
		}
	} else {
		geoParams = {
			lightType: obj._lightType,
			lightParams: obj._lightParams,
			target: new THREE.Vector3(), // light target
		}; // light support
	}

	obj.params = {
		position: obj.position,
		rotation: obj.rotation,
		geometry: geoParams,
		material: matParams,
		lastLinVeloc: new THREE.Vector3(),
		lastAngVeloc: new THREE.Vector3(),
		id: token(), //sorta uuid
		forceUpdate: true,
		sleeping: false,
		mass: obj.mass || 0,
	}
	obj.updateParams = function() {
		if (obj.params.vehicle_autoFlip == true) {
			// auto flip
			if (obj.rotation.y > Math.PI / 2 || obj.rotation.y < -Math.PI / 2) {
				// obj.setLinearVelocity(new THREE.Vector3());
				obj.setAngularVelocity(new THREE.Vector3());
				obj.rotation.set(0, 0, 0);
				obj.__dirtyRotation = true;

			}
		}
		if (obj.parentVehicle) {
			if (obj.parentVehicle.hasDriver == false) {
				//obj.setLinearVelocity(new THREE.Vector3());
				//obj.setAngularVelocity(new THREE.Vector3()); // freeze
			}
		}
		obj.params.position = obj.position;
		obj.params.rotation = obj.rotation;




		if (obj.params.lastPosition == undefined) obj.params.lastPosition = obj.params.position;
		if (obj.params.lastRotation == undefined) obj.params.lastRotation = obj.params.rotation;


		if (typeof obj.getLinearVelocity != 'undefined') {
			obj.params.sleeping = obj.getLinearVelocity() == obj.params.lastLinVeloc && obj.getAngularVelocity() == obj.params.lastAngVeloc ? true : false;
			obj.params.lastLinVeloc = obj.getLinearVelocity();
			obj.params.lastAngVeloc = obj.getAngularVelocity();
		} else {
			// do nothing, is just an Object3D
		}
		obj.params.forceUpdate = false;
	}
	id++;
	return obj;
}


const updateFPS = () => {
	let current = frames;
	setTimeout(() => {
		fps = (frames - current);
    // log fps
		updateFPS();
	}, 1000);
}





const init = () => {
	scene = new Physijs.Scene({ fixedTimeStep: 1 / 60 });
	// Grav
	scene.setGravity(new THREE.Vector3(0, -9.87, 0));


	// init car
	vehicleSystem = new Vehicle(Physijs, scene, THREE.Vector3, ObjectParams);

	//makeTank('blue', new THREE.Vector3(0, 10, 0));

  countTime(); // time counter

	buildWorld();
	let plane = new Plane('blue', new THREE.Vector3(0,5,0));
	setInterval(simulatePhysics, 1000 / 90)
	// speed
	updateFPS();
}


const countTime = () => {
  startTime = Date.now();
  let timeInt = setInterval(() => {
    let elapsed = Date.now()-startTime; // ms since start
    if(elapsed > gameTime) {
      startTime = Date.now();
      redTeamPoints = 0;
      blueTeamPoints = 0; // reset points
      io.emit('gameStart'); // Game reset points
    }
    io.emit("timeLeft", gameTime-elapsed); // time left
  }, 250);
}

const makeTank = (color, pos) => {
	let wheelGeo = cylinderGeometry(1.2, 1.2, 1.2).rotate(2, Math.PI / 2); // rotate z-axis
	let wheelMat = phongMaterial({ color });

	car = vehicleSystem.Car({
		carMesh: new ObjectParams(new Physijs.BoxMesh(boxGeometry(4, 2, 7), phongMaterial({ color })), 10),
		minSteering: -.6,
		maxSteering: .6,
		brakePower: 2,
		enginePower: 12.5,
		wheelGeometry: wheelGeo,
		wheelMaterial: wheelMat,
		suspensionStiffness: 17.88,
		suspensionCompression: 1.83,
		suspensionDamping: 0.08,
		suspensionTravel: 5000,
		suspensionSlip: 200.5,
		suspensionMaxForce: 60000,
		wheelOffset1: 2.5,
		wheelY: -.6,
		wheelOffset2: -2.5,
		wheelSuspensionHeight: 0.5,
		wheelRadius: 1.2,
		steeringDamping: 40,
		steeringReturnDamping: 0.1,
		maxEngineRPM: 9000, // max rpm
		transmissionMaxGear: 9, // speed
		transmissionGearShiftRPM: [1000, 1100, 1250, 1400, 1650, 2150, 2400, 2750, 3300, 4050], // gear shift
		transmissionGearPowerMult: [1, 1.25, 1.5, 1.75, 2, 2.25, 3, 3.5, 4, 14.5].reverse(), // 1st gear is strongest (reverse), last gear has weakest power
		speedCap: 24,
	});
	car.mesh.position.set(pos.x, pos.y, pos.z);
	car.mesh.__dirtyPosition = true; // update (after adding to scene)
	car.mesh.params.vehicle_autoFlip = true;
	car.hasDriver = false;
	vehicles.push(car);

}

function Plane(color, position) {

	this.mat = phongMaterial({color});

	this.body = new ObjectParams(
		new Physijs.BoxMesh(
			boxGeometry(3,3,6),
			this.mat,
			5
		)
	);

	this.target = position.clone();
	this.tolerance = 0.01;

	this.body.blades = new ObjectParams(
		new THREE.Mesh(
			boxGeometry(0.5,0.5,12),
			this.mat,
		)
	);
	this.body.blades.params._doNotSimulate = true; // Is not a physics body

	this.body.position.copy(position);
	this.hasDriver = false;

	this.update = () => {


		// Align
		if(this.hasDriver == true) { // If being driven
		this.body.rotation.set(0,0,0);
		this.body.__dirtyRotation = true;
		this.body.forceUpdate = true;
		this.body.blades.rotation.set(0,this.body.blades.rotation.y+0.10,0);
		this.body.blades.forceUpdate = true;

		this.veloc = this.body.getLinearVelocity();
		if(!tol(this.body.position.clone().y,this.target.clone().y, this.tolerance)) {
			this.veloc.y += easing(this.body.position.clone().y, this.target.clone().y, 0.1)/2;
		}
		this.veloc.add(new THREE.Vector3(this.target.x,0,this.target.z).divideScalar(5));
		this.body.setLinearVelocity(this.veloc);
    this.body.setLinearFactor(new THREE.Vector3(1,0,1)); // Physics factor
	} else {
	}


		this.body.blades.position.copy(this.body.position).add(new THREE.Vector3(0,2,0));
    this.body.setLinearFactor(new THREE.Vector3(1,1,1)); // Physics factor
    this.body.blades.rotation.set(this.body.rotation.x,this.body.blades.rotation.y,this.body.blades.rotation.z);
	}

	scene.add(this.body.blades);
	scene.add(this.body);


	planes.push(this);
	return this;
}


const simulatePhysics = () => {
	if (scene.simulate() != 421315) {
		frames++;
		let bigData = {
			fps,
			frame: frames,
			objects: [],
		}

		for (let i = 0; i < scene.children.length; i++) {
			let obj = scene.children[i];
			if (obj.params) {



				let needUpdate = obj.params.forceUpdate;
				bigData.objects.push(obj.params);
				let idx = bigData.objects.indexOf(obj.params)
				obj.updateParams();
				bigData.objects[idx].forceUpdate = needUpdate;

				if (obj.params.sleeping == true && needUpdate == false) {
					bigData.objects.splice(idx, 1);
				}

			} else {

			}
		} // update players vv
		for (let vehc of vehicles) {
			vehc.update(fps); // update
			vehc.mesh.applyCentralImpulse(new THREE.Vector3(0, -10, 0))
			if (vehc.socketUpdate) {
				vehc.mesh.params._vehicleClientInfo = vehc.socketUpdate();
			}

		}
    // CLear bases
    for(let be of bases) {
      be.players = [];
    }
		for (let plyr of players) {
			if (plyr.driving != undefined) {
				// is driving, tie player to object
				plyr.obj.position.set(
					plyr.driving.mesh.position.x,
					plyr.driving.mesh.position.y + 1.5,
					plyr.driving.mesh.position.z,
				);
				// update physics body
				plyr.obj.__dirtyPosition = true;
			}
			if(plyr.flying != undefined) { // Tie to plane
				plyr.obj.position.set(
					plyr.flying.body.position.x,
					plyr.flying.body.position.y+1.5,
					plyr.flying.body.position.z,
				);
				plyr.obj.__dirtyPosition = true;
			}
			let cla = new THREE.Vector3().copy(plyr.obj.getLinearVelocity()).clamp(new THREE.Vector3(-5, -100, -5), new THREE.Vector3(5, 60, 5));// clamp it
			plyr.obj.setLinearVelocity(cla);
      plyr.obj.setAngularVelocity({x:0,y:0,z:0}); // reset sphere
      plyr.obj.rotation.set(0,0,0); // reset rotation for character controller
      if(plyr.teamSet === true) {
        // check if in other base
        let po = plyr.team === 'blue' ? new THREE.Vector3(-125,0,-125) : new THREE.Vector3(125,0,125);
        if(plyr.obj.position.distanceTo(po) < 30) { // cannot get into enemy base
          plyr.obj.position.set(0,5,0); // send back
          plyr.obj.forceUpdate = true;
          plyr.obj.__dirtyPosition = true;
        }

        for(let be of bases) {
          // nearest base
          if(plyr.obj.position.distanceTo(be.position) < 20) {
            be.players.push(plyr.team); // add player
          }
        }
      }
		}
		// Update planes
		for(let plane of planes) {
			plane.update();
		}

    // update bases
    for(let be of bases) {
      if(be.players.length > 0) {
        // has players
        if(be.players.includes('red')&&be.players.includes('blue')) {
          // Includes both. Disable points
          be.team = undefined;
        }
        if(be.players.includes('red')&&!be.players.includes('blue')) {
          // Only red playrs on base.
          be.team = 'red';
        }
        if(!be.players.includes('red')&&be.players.includes('blue')) {
          // ONly blue playrs on base.
          be.team = 'blue';
        } else {
          // No players. however don't remove points
        }
        be.label.setTeam(be.team); // set label color
        // Add points

      }
      if(be.team != undefined) {
          if(be.team === 'red') {
            redTeamPoints+=0.5/(1000/fps);
          }
          if(be.team === 'blue') {
            blueTeamPoints += 0.5/(1000/fps);
          }
        }
    }
    bigData.redTeamPoints = redTeamPoints;
    bigData.blueTeamPoints = blueTeamPoints;
		io.emit('simulate', bigData) // Don't want to drop this

	} else {
	}
}
const geometries = {
	'box': boxGeometry,
	'sphere': sphereGeometry,
	'plane': planeGeometry,
};
const materials = {
	'phong': phongMaterial,
	'lambert': lambertMaterial,
	'basic': basicMaterial,
}
const bodyTypes = {
	'box': Physijs.BoxMesh,
	'sphere': Physijs.SphereMesh,
}
// threejs end
const getObjectById = (id) => {
	for (let i = 0; i < scene.children.length; i++) {
		let obj = scene.children[i];
		if (obj.params && obj.params.id == id) {
			return obj;
		}
	}
}

let chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
const token = () => {
	let i = 15;
	let str = '';
	while (i--) {
		str += chars[Math.floor(Math.random() * chars.length)]
	}
	return str;
}

const getPlayerByToken = (token) => {
	for (let py of players) {
		if (py.id == token) return py;
	}
}
const getPlayerByName = (name) => {
	for (let py of players) {
		if (py.name == name) return py;
	}
}

io.on('connection', (socket) => {

	let socketToken = token();
	players.push({
		id: socketToken,
		name: undefined,
		team: 'blue',//default
		obj: null,
		self: socket,
		driving: undefined,
    nameSet: false,
    teamSet: false,
		flying: undefined,
	});
  let theTempPlayerGeo = boxGeometry(1,2,1);
  theTempPlayerGeo.computeBoundingSphere = () => {theTempPlayerGeo.boundingSphere = {radius:1}};
	let plyr = getPlayerByToken(socketToken);
	plyr.obj = new ObjectParams(
		new Physijs.SphereMesh(
			theTempPlayerGeo,
			phongMaterial({ color: 'blue' }),
			1
		)
	);
	plyr.obj.addEventListener('collision', (other, linv, angv, normal) => {
		socket.emit('playerCollision', null, linv, angv, normal)
	});
	plyr.obj.params.playerId = socket.id;
	plyr.obj.position.set(0, 10, 0); // spawn
	scene.add(plyr.obj);
	console.log('Player ' + plyr.obj.params.id + ' connected. Awaiting team and name');
	socket.on('disconnect', () => {
		if (plyr) {
			scene.remove(plyr.obj)
			players.splice(players.indexOf(plyr), 1);
			console.log('Removed player ' + socketToken);
      io.emit("user_leave", {name:plyr.name});
		} else {
			console.log('Mystery player disconnected')
		}
	});
	// team and name
	socket.on('setName', (name) => {
		let duplicate = getPlayerByName(name);
		if (duplicate == undefined) {
			plyr.name = name;
			console.log(plyr.id + "'s name is set to " + plyr.name);
      plyr.nameSet = true;
      if(plyr.nameSet === true && plyr.teamSet === true) {
        io.emit("user_joined", {team:plyr.team,name:plyr.name});
      }
		} else {
			console.log('Tried to join with a duplicate name.');
			socket.emit('setName_error', 'bad_data');
		}
	});
	// chat message
	let lastMsgTime = performance.now();
	let minMsgDelay = 300; //min delays;
	let maxMsgDelay = 5000; // 5s
	let msgDelay = minMsgDelay;
	socket.on('chat', (msg) => {
		if (performance.now() - lastMsgTime >= msgDelay) { // delay
			msgDelay = minMsgDelay;
			lastMsgTime = performance.now();
			if (msg != "") {
				console.log((plyr.name ? plyr.name : plyr.obj.params.id) + ": " + msg);
				io.emit('chat', "[" + (plyr.name ? plyr.name : plyr.id) + "] " + msg); //broadcast
			}
		} else {
			msgDelay *= 2; // slower
			lastMsgTime = performance.now();
			if (msgDelay > 5000) msgDelay = 5000;
			socket.emit('chat', "[System] Woah, slow down! You need to wait " + ((msgDelay / 1000).toFixed(2)) + "s to send another message.");
		}
	})
	socket.on('setTeam', (team) => {
		if (team == 'red' || team == 'blue') {
			plyr.team = team;
			console.log((plyr.name != undefined ? plyr.name : plyr.id) + ' is on ' + plyr.team + ' team');

			if (plyr.team == 'red') {
				scene.remove(plyr.obj);
				plyr.obj.params.material.color = { r: 1, g: 0, b: 0 };
				plyr.obj.params.id = token();
				scene.add(plyr.obj); // update

        // MOVE PLAYER
        plyr.obj.position.set(-132,5,-125); // spawn red base
        plyr.obj.__dirtyPosition = true;
        plyr.obj.forceUpdate = true;
				console.log((plyr.name != undefined ? plyr.name : plyr.id) + " id is now " + plyr.obj.params.id);
			} else {
        // blue base
        plyr.obj.position.set(116,5,123);
        plyr.obj.__dirtyPosition = true;
        plyr.obj.forceUpdate = true;
      }
      plyr.teamSet = true;
      if(plyr.nameSet === true && plyr.teamSet === true) {
        for(let pl of players) {
          if(pl != plyr && pl.teamSet === true && pl.nameSet === true) {
            for(let pl of players) {
              if(pl != plyr && pl.teamSet === true && pl.nameSet === true) {
                socket.emit("player_join", {team: pl.team, name: pl.name})
              }
            }
            socket.emit("player_join", {team: pl.team, name: pl.name})
          }
        }
        io.emit("user_joined", {team:plyr.team,name:plyr.name});
      }
		} else {
			console.log('Received invalid team name ' + team);
			socket.emit('setTeam_error', 'bad_data')
		}
	});
	// player data update, velocity/impulse
	socket.on('client_setVelocity', (position) => {
		if (position.x && position.y && position.z) {
			plyr.obj.setLinearVelocity(new THREE.Vector3(position.x, position.y, position.z));
		} else {
			socket.emit('client_setVelocity_error', 'bad_data');
		}
	});

	socket.on('client_addVelocity', (position, spd, cl) => {
		if (position.x != undefined && position.y != undefined && position.z != undefined && typeof cl == 'number') {
			if (plyr.driving == undefined) {
				let cur = new NewTHREE.Vector3()
				cur.addScaledVector(
					new THREE.Vector3(position.x, position.y, position.z),
					spd);



				plyr.obj.applyCentralImpulse(cur);

			} else {
				// drive vehicle

			}
		} else {
			socket.emit('client_addVelocity_error', 'bad_data')
		}
	});
	socket.on('client_controlVehicle', (direction, power, brake, man) => {
		if (plyr.driving != undefined) {
			if (direction != 'NOT_DEFINED') { // steer/power
				plyr.driving.force.direction = direction;
			}
			if (power != 'NOT_DEFINED') {
				plyr.driving.force.power = power;
			}
      if(man != 'AUTOMATIC') { // transmission
        if(man === -1) plyr.driving.manual(-1);
        if(man === 1) plyr.driving.manual(1);
      } else {
        plyr.driving.manual(0);
      }

			//plyr.driving.update(); // update
			if (brake != 'NOT_DEFINED') {
				if (brake == 'ENGINE_OFF') {
          plyr.driving.setBrake(plyr.driving.brakePower, 0);
          plyr.driving.setBrake(plyr.driving.brakePower, 1);
           plyr.driving.applyEngineForce(0);
        } else {
					for (let w of brake) {
						plyr.driving.setBrake(plyr.driving.brakePower, w); // brake each wheel in array
					}
				}
			}
		} else {
			socket.emit('client_controlVehicle_error', 'no_vehicle')
		}
	});

	socket.on('client_controlPlane', (diff) => {
		if(plyr.flying != undefined) {
      plyr.flying.target.y+= diff.y;
      plyr.flying.target.x = diff.x;
      plyr.flying.target.z = diff.z;
	} else {
		socket.emit('client_controlPlane_error', 'no_plane');
	}
});

socket.on('client_drivePlane', () => {
	let reach = 4;
	if(plyr.driving === undefined && plyr.flying == undefined) {
		for(let plane of planes) {
			if(plane.body.position.distanceTo(plyr.obj.position) < reach && plane.hasDriver == false) {
				plane.hasDriver = true;
				plyr.flying = plane;
        plyr.flying.target.set(0,0,0);
				plyr.flying.target.y = plane.body.position.clone().y;

				// set plane color
				let plyrColor = plyr.team == 'blue' ? {r:0,b:1,g:0} : {r:1,g:0,b:0};
				if(plane.body.params.material.color != plyrColor) {
					plane.body.params.material.color = plyrColor;
					plane.body.params.id = token();
					plane.body.blades.params.material.color = plyrColor;
					plane.body.blades.params.id = token();
				}

			}
		}
	 }
	 if(plyr.flying != undefined) {
		 socket.emit('client_drivePlane', true);
	 } else {
		 socket.emit('client_drivePlane_error', undefined);
	 }
});

socket.on('client_exitPlane', ()=> {
	if(plyr.flying != undefined) {
		plyr.flying.hasDriver = false;
		plyr.flying = undefined;
		socket.emit('client_drivePlane', false);
	}
});

socket.on('client_deletePlane', () => {
	if(plyr.flying != undefined) {
    scene.remove(plyr.flying.body);
    scene.remove(plyr.flying.body.blades);
		planes.splice(planes.indexOf(plyr.flying), 1); // remove from update loop

		plyr.flying = undefined;
		socket.emit('client_drivePlane', false);
	}
})

	// sit in vehicle
	socket.on('client_driveVehicle', () => {
		let reach = 4;
		if (plyr.driving == undefined) {
			for (let car of vehicles) {
				// is it close?
				if (car.mesh.position.distanceTo(plyr.obj.position) < reach && car.hasDriver == false && plyr.driving == undefined) {
					car.hasDriver = true;
					plyr.driving = car; // is driving this
					// set car color
					let plyrColor = plyr.team == 'blue' ? { r: 0, b: 1, g: 0 } : { r: 1, g: 0, b: 0 };
					if (car.mesh.params.material.color != plyrColor) {
						for (let wh of car.wheels) {
							wh.params.material.color = plyrColor; // set
							wh.params.id = token(); // rand
						}
						car.mesh.params.material.color = plyrColor;//set
						car.mesh.params.id = token();
					}
					plyr.driving.socketUpdate = () => {
						if (plyr.driving && socket) {
							return {
								throttle: plyr.driving.throttle,
								gear: plyr.driving.gear,
								rpm: plyr.driving.rpm, power: plyr.driving.throttle * plyr.driving.enginePower * plyr.driving.gearPowerMult[plyr.driving.gear],
								speed: plyr.driving.speed,
								mspeed: 50,
								mthrottle: 1,
								mgear: plyr.driving.maxGear,
								mrpm: plyr.driving.maxEngineRPM,
								mpower: 10,
								socketId: socket.id,
							}

						} else {
						}
					}
				}
			}
			if (plyr.driving == undefined) {
				socket.emit('client_driveVehicle_error', 'no_vehicle'); // no vehicle
			} else {
				socket.emit('client_driveVehicle', true);
			}
		}
	});

	socket.on('client_deleteVehicle', () => {
		if (plyr.driving != undefined) {
			let idx = vehicles.indexOf(plyr.driving);
			scene.remove(plyr.driving);
			plyr.driving.socketUpdate = undefined; // clear
			vehicles.splice(idx, 1); // delete vehicle
			plyr.driving = undefined; // delete
			socket.emit('client_driveVehicle', false); // send exit success
		} else {
			socket.emit('client_driveVehicle_error', 'no_vehicle')
		}
	})

	socket.on('client_exitVehicle', () => {
		if (plyr.driving != undefined) { // is driving
			plyr.driving.hasDriver = false; // not driving
			plyr.driving.applyEngineForce(0); // stop
			plyr.driving.mesh.setLinearVelocity(new THREE.Vector3());
			plyr.driving.mesh.setAngularVelocity(new THREE.Vector3());
			plyr.driving.mesh.applyCentralImpulse(new THREE.Vector3(0, 5, 0)); // bump up to avoid clipping into ground
			plyr.driving.mesh.rotation.set(0, 0, 0);
			plyr.driving.mesh.__dirtyRotation = true;
			plyr.driving = undefined; // clear
			socket.emit('client_driveVehicle', false); // exit vehicle
		}
	});

	socket.on('client_flipVehicle', () => {
		if (plyr.driving != undefined) { // is driving
			plyr.driving.mesh.setLinearVelocity(new THREE.Vector3());
			plyr.driving.mesh.setAngularVelocity(new THREE.Vector3());
			plyr.driving.mesh.applyCentralImpulse(new THREE.Vector3(0, 5, 0)); // bump up to avoid clipping into ground
			plyr.driving.mesh.rotation.set(0, plyr.driving.mesh.rotation.y, 0);
			plyr.driving.mesh.__dirtyRotation = true;
		}
	})

	// player impulse
	socket.on('client_applyCentralImpulse', (position) => {
		if (position.x != undefined && position.y != undefined && position.z != undefined) {
			plyr.obj.applyCentralImpulse(new THREE.Vector3(position.x, position.y, position.z));
		} else {
			socket.emit('client_applyCentralImpulse_error', 'bad_data'); // not a vector3
		}
	})

	// client control of the server physics engine
	socket.on('deleteObject', (id) => {
		if (getObjectById(id)) {
			scene.remove(getObjectById(id));

		}
	})
	socket.on('createObject', (geometry, material, mass, position, rotation, linv, angv,typ) => {
		if (geometry.name && material.name && material.color && mass && position && rotation) {
			let geo, mat;
			mat = materials[material.name]({ color: material.color }); // make material
			mat.color = material.color;
			if (geometry.name == 'box' || geometry.name == 'plane') {
				geo = geometries[geometry.name](geometry.height, geometry.width, geometry.depth);
			}
			if (geometry.name == 'sphere') {
				geo = geometries[geometry.name](geometry.radius);
			};

			let obj = new ObjectParams(
				new bodyTypes[geometry.name](
					geo,
					mat,
					mass
				)
			);
			obj.position.set(position.x, position.y, position.z);
			obj.rotation.set(rotation.x, rotation.y, rotation.z);
			obj.updateParams();
			obj.params.forceUpdate = true;

			scene.add(obj);
      if(linv) {
        obj.setLinearVelocity(new THREE.Vector3(linv.x,linv.y,linv.z));
      }
      if(angv) { // set lin/ang veloc
        obj.setAngularVelocity(new THREE.Vector3(angv.x,angv.y,angv.z));
      }
      if(typ === 'BULLET') {
        obj.addEventListener('collision', (oth, linv, angv) => {
          if(scene.children.includes(obj)) {
          scene.remove(obj);
          }
        });
        setTimeout(() => {
          if(scene.children.includes(obj)){
            scene.remove(obj);
          }
        }, 5000); // timeout
      }
			socket.emit('objectUpdated', obj.params.id);
		} else {
			socket.emit('missingParameters')
		}
	})
	socket.on('setObjectPosition', (id, position) => {
		let obj = getObjectById(id);
		if (!obj) {
			socket.emit('objectNotFound', id);
		} else {
			obj.position.set(position.x, position.y, position.z);
			obj.__dirtyPosition = true;
			obj.updateParams();
			obj.params.forceUpdate = true; // update
			socket.emit('objectUpdated', id);
		}
	});
	socket.on('setObjectRotation', (id, rotation) => {
		let obj = getObjectById(id);
		if (!obj) {
			socket.emit('objectNotFound', id);
		} else {
			obj.rotation.set(rotation.x, rotation.y, rotation.z);
			obj.__dirtyRotation = true;
			obj.updateParams();
			obj.params.forceUpdate = true;
			socket.emit('objectUpdated', id)
		}
	});
	socket.on('setObjectLinearVelocity', (id, velocity) => {
		let obj = getObjectById(id);
		if (!obj) {
			socket.emit('objectNotFound', id);
		} else {
			obj.setLinearVelocity(new THREE.Vector3(velocity.x, velocity.y, velocity.z));
			socket.emit('objectUpdated', id)
		}
	});
	socket.on('setObjectAngularVelocity', (id, velocity) => {
		let obj = getObjectById(id);
		if (!obj) {
			socket.emit('objectNotFound', id);
		} else {
			obj.setAngularVelocity(new THREE.Vector3(velocity.x, velocity.y, velocity.z));
			socket.emit('objectUpdated', id);
		}
	})
})

http.listen(8080, () => console.log('hi, listening on *:8080'));


/// THREEJS TOOL: Get center position
//https://stackoverflow.com/questions/38305408/threejs-get-center-of-object
// (old ans)
function getCenterPoint(geo, mat, pos, rot) {
    let object = new NewTHREE.Mesh(geo, mat);
    object.position.set(pos.x,pos.y,pos.z);
    object.rotation.set(rot.x,rot.y,rot.z);
    object.updateMatrixWorld();
    const box = new NewTHREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    object.geometry = object.oldGeo;
    return center;
}


const makeGround = () => {
	let ground = new ObjectParams(
		new Physijs.BoxMesh(
			boxGeometry(1600, 0.1, 1600),
			Physijs.createMaterial(
				lambertMaterial({ color: 'green', side: THREE.DoubleSide }),
				1,// friction 0 -1
				0.2,//bounce
			),
			0
		)
	);
	ground.params.texture = 'img/grass_tex.png';
	ground.params.textureRepeat = 64;
	//  ground.rotation.set(-Math.PI/2,0,0)
	scene.add(ground);

	makeHills();
	makeWalls();
}
const makeWalls = () => {
	let mat = Physijs.createMaterial(lambertMaterial({ color: 'blue', side: THREE.DoubleSide }), 1, 0.2);

	let geo = boxGeometry(3, 20, 20);

	// make meshes
	const mes = (geo, mat) => {
		return new ObjectParams(new Physijs.BoxMesh(geo, mat, 0));
	}
	const wall = (x, y, z) => {
		let vec = new THREE.Vector3(x, y, z);

		let a = mes(geo, mat);
		let b = mes(geo, mat);
		let c = mes(geo, mat);
		let d = mes(geo, mat);
		let e = mes(geo, mat);

		a.position.set(5, 10, 0);
		b.position.set(15, 20, 10);
		c.position.set(5, 10, 20);
		d.position.set(-5, 0, 10);
		e.position.set(2, 7, 10);

		a.params.texture = 'img/blue_base.png';
		b.params.texture = 'img/blue_base.png';
		c.params.texture = 'img/blue_base.png';
		d.params.texture = 'img/blue_base.png';
		e.params.texture = 'img/blue_base.png';


		a.rotation.set(0, 300, 0);
		b.rotation.set(0, 0, 0);
		c.rotation.set(0, 300, 0);
		d.rotation.set(0, 0, 0);
		e.rotation.set(0, 0, 7);


		b.position.add(vec);
		c.position.add(vec);
		a.position.add(vec);
		d.position.add(vec);
		e.position.add(vec);

		scene.add(a);
		scene.add(b);
		scene.add(c);
		scene.add(d);
		scene.add(e);
	}

	wall(110, 0, 140);
	wall(110, 0, 90);
}
const makeHills = () => {
	let mat = Physijs.createMaterial(phongMaterial({ color: 'green', side: THREE.DoubleSide }), 1, 0.2);

	let geo = boxGeometry(40, 1, 40);
  let compGeo = new NewTHREE.BoxGeometry(40,1,40); // for fix
	// make meshes
	const mes = (geo, mat) => {
		let m = new ObjectParams(new Physijs.BoxMesh(geo, mat, 0));
    return m; // missing lol
	}
	const hill = (x, y, z) => {
		let vec = new THREE.Vector3(x, y, z);

		let a = mes(geo, mat);
		let b = mes(geo, mat);
		let c = mes(geo, mat);
		let d = mes(geo, mat);
		let e = mes(geo, mat);

		a.position.set(0, 2, -20);
		b.position.set(0, 2, 58);
		c.position.set(38, 2, 20);
		d.position.set(-38, 2, 20);
		e.position.set(0, 5.8, 20);

		a.params.texture = 'img/metaal.png';
		b.params.texture = 'img/metaal.png';
		c.params.texture = 'img/metaal.png';
		d.params.texture = 'img/metaal.png';
		e.params.texture = 'img/metaal.png';

		a.rotation.set(-Math.PI / 15, 0, 0);
		b.rotation.set(Math.PI / 15, 0, 0);
		c.rotation.set(0, 0, -Math.PI / 15);
		d.rotation.set(0, 0, Math.PI / 15);


		b.position.add(vec);
		c.position.add(vec);
		a.position.add(vec);
		d.position.add(vec);
		e.position.add(vec);

		scene.add(a);
		scene.add(b);
		scene.add(c);
		scene.add(d);
		scene.add(e);


    let bo = new ObjectParams(new Physijs.BoxMesh(boxGeometry(5,5,5), phongMaterial({color: 'gray'}),0));
    bo.setTeam = (team) => {
      let col = team === 'red' ? {r:1,g:0,b:0} : (team === 'blue' ? {r:0,g:0,b:1} : {r:0.5,g:0.5,b:0.5});
      if(bo.params.material.color.r != col.r || bo.params.material.color.g != col.g || bo.params.material.color.b != col.b) {

      scene.remove(bo);
      bo.params.material.color = col;
      bo.params.id = token(); // new id for update
      scene.add(bo);
      }
    }
    bo.position.set(0,20,0);
    let cent = getCenterPoint(compGeo, mat, e.position,e.rotation);
    bo.position.add(cent);
    scene.add(bo);
    let bs = {position: cent, team: undefined, players: [], label: bo};
    bases.push(bs);
	}

	hill(0, 0, -400); // ALL BASES
	hill(0, 0, 400);
	hill(400, 0, 0);
	hill(-400, 0, 0);
	hill(-100, -5, 50);
	hill(120, -4, -100);
	hill(200, 0, -400);
	hill(-200, -5, -400);
	hill(400, -4, -200);
	hill(200, -5, -400);
	hill(-400, -5, 200);
	hill(-400, -2, -200);
	hill(-200, -5, 400);
}

const makeBaseRedWall = (x, y, z, rotx, roty, rotz, color) => {
	let obj = new ObjectParams(
		new Physijs.BoxMesh(
			boxGeometry(20, 20, 0.5),
			phongMaterial({ color: color != undefined ? 'blue' : 'brown' }),
			0
		)
	);
	obj.params.texture = color != undefined ? 'img/blue_base.png' : 'img/red_base.png'
	obj.params.textureRepeat = 4;
	obj.position.set(x, y, z);
	obj.rotation.set(rotx, roty, rotz);
	return obj;
}

const makeBaseBlue = (x, y, z) => {
	makeBaseRed(x, y, z, true); //imposter
}

const makeBaseRed = (x, y, z, col) => {
	let ar = [];
	ar.push(makeBaseRedWall(-9.9, 10, -9.9, 0, 0, 0, col));
	ar.push(makeBaseRedWall(-9.9, 10, 9.9, 0, 0, 0, col));
	ar.push(makeBaseRedWall(0, 10, 0, 0, -Math.PI / 2, 0, col));
	ar.push(makeBaseRedWall(-10, 20, 0, -Math.PI / 2, 0, 0, col));
	let ad = new THREE.Vector3(x, y, z);
	for (let w of ar) {
		w.position.add(ad);
		scene.add(w);
	}
	// x,y,z, rotation x,y,z
}

const makeTankSpawner = (pos, color) => {
	let obj = new ObjectParams(
		new Physijs.BoxMesh(
			boxGeometry(1, 1, 0.25),
			phongMaterial({ color }),
			0 //static
		)
	)
	obj.rotation.set(Math.PI / 2, 0, 0); //flip
	obj.position.copy(pos);
	scene.add(obj);

	obj.lastClicked = performance.now();

	// collision listener, spawn tank
	obj.addEventListener('collision', (other) => {
		if (other.params && other.params.playerId) {
			// a player clicked the button
			// spawn tank
			if (performance.now() - obj.lastClicked > 5000) {
				// 5sec delay
				obj.lastClicked = performance.now(); // reset timer
				makeTank(color, new THREE.Vector3(0, 4, 0).add(pos));
			}
		}
	})
}

const makePlaneSpawner = (pos, color) => {
	let obj = new ObjectParams(
		new Physijs.BoxMesh(
			boxGeometry(1,1,0.25),
			phongMaterial({color}),
			0,
		)
	);
	obj.rotation.set(Math.PI/2, 0,0);
	obj.position.copy(pos);
	scene.add(obj);
	obj.lastClicked = performance.now();
	obj.addEventListener('collision', (other) => {
		if(other.params && other.params.playerId) {
			if(performance.now() - obj.lastClicked > 5000) {
				obj.lastClicked = performance.now();
				let pln = new Plane(color,new THREE.Vector3(0,4,0).add(pos));
			}
		}
	});
}

const createLights = () => {
	let main = new ObjectParams(
		spotLight(0xffffff, 0.7)
	);
	main.position.set(0, 300, 0);
	scene.add(main);

	let ambient = new ObjectParams(
		ambientLight(0xffffff, 0.5)
	);
	scene.add(ambient);
}

const buildWorld = () => {
	makeGround();
	makeBaseRed(-125, 0, -125);
	makeBaseBlue(125, 0, 125);
	makeTankSpawner(new THREE.Vector3(106, 0.125, 127), 'blue');
	makeTankSpawner(new THREE.Vector3(-144, 0.125, -126), 'red');
	makePlaneSpawner(new THREE.Vector3(106, 0.125, 131), 'blue');
	makePlaneSpawner(new THREE.Vector3(-144, 0.125, -130), 'red');
	createLights();
	// red/blue vehicle spawners
}
init();
