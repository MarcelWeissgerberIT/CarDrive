// Rotating 3D car preview for the garage screen
import * as THREE from 'three';
import { buildCar, mat } from './cars3d.js';

export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(5.5, 3.2, 6.5); this.camera.lookAt(0, 0.8, 0);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#ff9ecf', 1.2));
    const d = new THREE.DirectionalLight('#ffffff', 1.1); d.position.set(4, 8, 5); this.scene.add(d);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.3, 40), mat('#ff9ecf'));
    disc.position.y = -0.15; this.scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.12, 8, 40), mat('#ffe23f'));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; this.scene.add(ring);
    this.car = null; this.active = false; this.t = 0;
  }
  setCar(opts) {
    if (this.car) this.scene.remove(this.car);
    this.car = buildCar(opts); this.scene.add(this.car);
  }
  resize() {
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 200;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  start() { if (this.active) return; this.active = true; this.resize(); const loop = () => { if (!this.active) return; this.t += 0.012; if (this.car) this.car.rotation.y = this.t; this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.active = false; }
}
