# How??

Easy

## Making object
**NOTE: REPLACE `THREE.BoxGeometry` with `THREE.CubeGeometry` (old threejs)**

Because some extra data is required to make objects that can be sent thru server, use the following functions as a replacement:

### geometeries
they take same params as threejs, DO NOT use `new`
```
boxGeometry 
planeGeometry 
sphereGeometry
cylinderGeometry
```

### materials
Takes same as threejs, in object.DO NOT USE `new`
```
basicMaterial
phongMaterial
lambertMaterial
```

### textures [important]
If you want to include the texture, don't load it into the material (shouldn't work anyway).
Instead, include a URL into the object paramaters (this is transferred to the player).

EXAMPLE:
```javascript
// after you create the object, BEFORE adding to scene!!

obj.params.texture = 'https://HEY.foodandmoarfood.repl.co/img/wheat.png';

```



### MAKING FINAL object
Just make the object body normally, like `new Physijs.BoxMesh(geo,mat)` etc.
However, again, for client to make object, you need to wrap the body in `new ObjectParams`. Like this:

```javascript
let obj = new ObjectParams(
  new Physijs.BoxMesh(
    boxGeometry(1,1,1),
    basicMaterial({color: 'sus'}),
  )
)
```
All the normal functions like `scene.add(obj)` and `.position` etc work.

## Moving/Rotating/Updating objects.
if you want to force move an object after added to scene, must set `obj.forceUpdate = true` otherwise it will act weird on the client (will try to compensate like it is lag)

Remember to do `.__dirtyPosition = true / .__dirtyRotation = true` (physijs)
How to do:
```javascript
obj.position.set(2197,155,562);
obj.__dirtyPosition = true; // physijs

// update:
obj.forceUpdate = true;
```

### Updating object properties e.g color
If you want to change some parameters of an object, in this case, color,change PARAMETER in `.params` and then change the id`.params.id` to a new one `token()`.

This will delete the other one in client and add a new one with the new params.

Now you can change things like the color geometr etc.



example: change color to blue
```javascript

someObj.params.material.color =  new THREE.Color('blue');
someObj.params.id = token(); // regenerate
```

# EXAMPLE CODES
Codes if you are confused.

Making a box, size 1, color of blue, and position 10,10,10 AFTER added.Also the mass is 10 since itsheavy

```javascript
let geo = boxGeometry(1,1,1);
let mat = phongMaterial({color: 'blue'});

let obj = new ObjectParams(
  new Physijs.BoxMesh(geo, mat, 10), // lotsa weight
);

scene.add(obj);

obj.position.set(10,10,10);
obj.__dirtyPosition = true;
obj.forceUpdate = true;
```