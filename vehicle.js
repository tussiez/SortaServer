/*
Physijs Vehicle Maker
Maks aa car goo
*/
// ADJUSTED FOR NODEJS

const Vehicle = function (Physijs, scene, Vector3, ObjectParams) {
  this.Car = (options) => {
    const { 
      carMesh,
      minSteering,
      maxSteering,
      brakePower,
      wheelGeometry, 
      wheelMaterial, 
      suspensionStiffness, 
      suspensionCompression, 
      suspensionDamping, 
      suspensionTravel, 
      suspensionSlip, 
      suspensionMaxForce, 
      wheelOffset1, 
      wheelY, 
      wheelOffset2, 
      wheelSuspensionHeight, 
      wheelRadius, 
      enginePower, 
      steeringDamping, 
      steeringReturnDamping,
      maxEngineRPM,
      transmissionMaxGear,
      transmissionGearShiftRPM, // array up to max gear-1
      transmissionGearPowerMult,
      speedCap, // max speed
     } = options;

    let tuning = new Physijs.VehicleTuning(
      suspensionStiffness || 10.88,
      suspensionCompression || 1.83,
      suspensionDamping || 0.28,
      suspensionTravel || 500,
      suspensionSlip || 10.5,
      suspensionMaxForce || 6000
    );
    if(carMesh.params) {
      carMesh.params._doNotSimulate = true;
    }
    let car = new Physijs.Vehicle(
      carMesh,
      tuning
    );
    let wheelDir = new Vector3(0, -1, 0);
    let wheelAxle = new Vector3(-1, 0, 0);
    car.mesh.parentVehicle = car; //parent
    scene.add(car); //important!
    car.mesh.setLinearFactor(new Vector3(1, 0.5, 1))

    // params
    car.force = {
      direction: null,
      power: null,
      steering: 0,
    };
    car.__isVehicle = true; // is a vehicle
    car.minSteering = minSteering;
    car.maxSteering = maxSteering;
    car.enginePower = enginePower;
    car.steeringDamping = steeringDamping;
    car.brakePower = brakePower;
    car.steeringReturnDamping = steeringReturnDamping;
    car.maxEngineRPM = maxEngineRPM || 7500;
    car.gear = 1;
    car.maxGear = transmissionMaxGear || 5;
    car.speedCap = speedCap || 10;
    car.throttle = 0; // throttle (e.g gas pedal by key);
    car.throttleHoldTime = 0; // multiplier
    car.maxThrottle = 1;
    car.gearShiftRPM = transmissionGearShiftRPM || [1500, 2000, 2500, 3000, 3500]; // stepped
    car.gearPowerMult = transmissionGearPowerMult || [1, 1.5, 2, 2.5, 3];
    
    car.rpm = 1000; // 1000rpm start
    car.isManual = false;


    car.applyEngine = (force) => {
      force *=(1-(car.rpm/car.maxEngineRPM)); // Higher RPM, less performance on engine
      car.applyEngineForce(force,0);
      car.applyEngineForce(force,1); // all wheels
      car.applyEngineForce(force, 2);
      car.applyEngineForce(force, 3);
    }


    for (let i = 0; i < 4; i++) {
      car.addWheel(
        ObjectParams, // for object to be constructed correctly so it can be seen on client
        wheelGeometry,
        wheelMaterial,
        new Vector3(
          0 === (i & 1) ? wheelOffset1 : -wheelOffset1,
          wheelY,
          i < 2 ? wheelOffset1 : wheelOffset2,
        ),
        wheelDir,
        wheelAxle,
        wheelSuspensionHeight,
        wheelRadius,
        i < 2,
        
      );

    }

    car.manual = (dir) => {
      if(dir === 1 || dir === -1) car.isManual = true;
      if(dir === 0) car.isManual = false;
      if(dir === 1) {
        if(car.gearShiftRPM[car.gear+1]) {
          // can shift up
          car.gear += 1;
          if(car.rpm-(car.gearShiftRPM[car.gear]) >= 1000) { // > idle rpm
            car.rpm -= car.gearShiftRPM[car.gear]; // reduce rpm
            
            // improve perf
          } 
        }
      }
      if(dir === -1) {
        if(car.gearShiftRPM[car.gear-1]) {
          car.rpm += car.gearShiftRPM[car.gear]/8;
          car.gear -= 1;
        }
      }
    }


    car.update = (fps) => {
      if (car.force.direction != null) {
        // Steer car.
        car.force.steering -= car.force.direction / car.steeringDamping;
        if (car.force.steering < car.minSteering) car.force.steering = car.minSteering;
        if (car.force.steering > car.maxSteering) car.force.steering = car.maxSteering; // Minimum and maximum steer
        car.setSteering(car.force.steering, 0);
        car.setSteering(car.force.steering, 1);
      } else {
       if(car.force.steering > 0) car.force.steering -= car.steeringReturnDamping * car.force.steering;
       if(car.force.steering < 0) car.force.steering -= car.steeringReturnDamping * car.force.steering;
        car.force.steering = Number(car.force.steering.toFixed(2));
        if(car.force.steering < car.steeringReturnDamping && car.force.steering > -car.steeringReturnDamping) car.force.steering = 0; // clamping
        car.setSteering(car.force.steering, 0);
        car.setSteering(car.force.steering, 1)
      }

      if(car.force.power == true || car.force.power == 2) {
        // up throttle
        car.throttleHoldTime += 0.04;
        if(car.throttleHoldTime > 1) car.throttleHoldTime = 1;
        car.throttle += (car.enginePower/500)*(car.throttleHoldTime);
        car.rpm += ((car.enginePower*7)*(car.throttleHoldTime))/(car.gearShiftRPM[car.gear]/1000);
        if(car.rpm > car.maxEngineRPM) car.rpm = car.maxEngineRPM; // capped
        if(car.throttle > 1) car.throttle = 1;
      } else {
        // no power? slowly drop throttle
        car.throttleHoldTime = 0; // reset
        car.throttle -= car.enginePower/500;
        if(car.throttle < 0) car.throttle = 0;
        car.applyEngine(car.throttle*car.enginePower*car.gearPowerMult[car.gear]);
        car.rpm -= car.enginePower*10;
        if(car.rpm < 0) car.rpm = 0;
      }
    //  car.rpm = car.throttle*car.maxEngineRPM; // rpm

      // GEAR SWITCH
      if(car.isManual === false) { //
      let range = car.gearShiftRPM[car.gear+1] != undefined ? car.gearShiftRPM[car.gear+1] - car.gearShiftRPM[car.gear] : 500;
      if(car.speed > (car.gearShiftRPM[car.gear]+range)/350) {
        if(car.gearShiftRPM[car.gear+1]) {
          // can shift up
          car.gear += 1;
          if(car.rpm-(car.gearShiftRPM[car.gear]) >= 1000) { // > idle rpm
            car.rpm -= car.gearShiftRPM[car.gear]; // reduce rpm
            
            // improve perf
          } 
        }
        
      }
      if(car.speed < (car.gearShiftRPM[car.gear]-range)/750) {
        // shift down
        if(car.gearShiftRPM[car.gear-1]) {
          car.rpm += car.gearShiftRPM[car.gear]/8;
          car.gear -= 1;
        }
      }
      }
      // console.log('GEAR: '+ car.gear +' RPM:' + car.rpm);
      

      if (car.force.power == true) {
        car.applyEngine(car.throttle*car.enginePower*car.gearPowerMult[car.gear]);
        car.setBrake(0,1);
        car.setBrake(0,0)
      } else if (car.force.power == 2) {
        car.applyEngine(-car.throttle*car.enginePower*car.gearPowerMult[car.gear]);
        car.setBrake(0,1);
        car.setBrake(0,0); // clear brakes
      } else if (car.force.power == false) {
        car.applyEngine(0); // Force brakes!
        car.setBrake(car.brakePower, 0);
        car.setBrake(car.brakePower, 1);
        car.setBrake(car.brakePower, 2);
        car.setBrake(car.brakePower, 3);
      } else {
        //car.applyEngineForce(0); would brake
      }

      let carVeloc = car.mesh.getLinearVelocity();
      carVeloc.clamp(new Vector3(
        -car.speedCap,
        -car.speedCap,
        -car.speedCap,
      ),
      new Vector3(
        car.speedCap,
        car.speedCap,
        car.speedCap
      ));
      car.mesh.setLinearVelocity(carVeloc); // clamp
       // Compute speed
      if(car.mesh._vehicleLastPosition === undefined) {car.mesh._vehicleLastPosition = new Vector3().copy(car.mesh.position);}
      car.mesh._vehicleLastPosition.y = car.mesh.position.y; // correct suspension error

      if(!car.speedSamples) car.speedSamples = [];
      car.speedSamples.push(car.mesh.position.distanceTo(car.mesh._vehicleLastPosition)*1000/fps);
      if(car.speedSamples.length > fps) car.speedSamples.shift();
      
      let someCounter = 0;
      for(let sp of car.speedSamples) someCounter+=sp;
      car.speed = someCounter/car.speedSamples.length; //for fps variation

      car.mesh._vehicleLastPosition.copy(car.mesh.position);
    }
    
    return car;
  }
};
module.exports = Vehicle;