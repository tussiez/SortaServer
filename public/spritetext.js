import {Vector3, Frustum, Matrix4, Object3D} from '/three.module.js';
import SortaCanvas from 'https://sortacanvas.sortagames.repl.co/lib2.js';
let SpriteText = function(camera, renderer, canvas) {
  this.sc = new SortaCanvas();
  this.sc.init(canvas, false);
 // this.sc.clearRect = true; // transparent
  let scope = this;

  this.sprs = [];

  this.Sprite = function(ob, text, color, font) {
    console.log(text)
    this.obj = new scope.sc.Text(0,0,text, font, color, false, '');
    this.pos = new Vector3();
    scope.sprs.push(this)
    scope.sc.add(this.obj);
    this.idx = scope.sprs.indexOf(this);
  }

  const projectPosition = (x,y,z) => {
    let vector = new Vector3(x,y,z);
    vector.project(camera);
    let newVector = new Vector3();
    newVector.z = vector.z;
    vector.x = ( vector.x + 1) * this.sc.canvas.width / 2;
    vector.y = - ( vector.y - 1) * this.sc.canvas.height / 2;
    newVector.x = vector.x;
    newVector.y = vector.y;
    vector.z = 0;
    return newVector;
  }

  const render = () => {
    requestAnimationFrame(render);
    camera.updateMatrix();
    camera.updateMatrixWorld();

    let frustum = new Frustum();

    frustum.setFromProjectionMatrix(
      new Matrix4()
      .multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );

    for(let sprite of this.sprs){
      if (frustum.containsPoint(sprite.pos)) {
        let coords = projectPosition(sprite.pos.x,sprite.pos.y,sprite.pos.z);
        sprite.obj.x = coords.x;
        sprite.obj.y = coords.y;
      } else {
        sprite.obj.x = -999;
        sprite.obj.y = -999;
      }
    }
    this.sc.render(); 
  }
  //render();
}
export default SpriteText;