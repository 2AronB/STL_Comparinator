import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

let scene;
let camera;
let renderer;
let controls;
let baselineMesh;
let studentMesh;
let baselineGeometry;
let studentGeometry;
let studentTransform = new THREE.Matrix4();

const loader = new STLLoader();

function createMaterials() {
  const baselineMat = new THREE.MeshStandardMaterial({ color: 0xb0b7c3, metalness: 0.1, roughness: 0.6 });
  const studentMat = new THREE.MeshStandardMaterial({ color: 0x7fc8f8, metalness: 0.1, roughness: 0.5, opacity: 0.9, transparent: true });
  return { baselineMat, studentMat };
}

export function initViewer(container) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1221');

  const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
  camera.position.set(0, 0, 150);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const light = new THREE.HemisphereLight(0xffffff, 0x111118, 1.0);
  scene.add(light);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(50, 120, 100);
  scene.add(dirLight);

  window.addEventListener('resize', () => handleResize(container));
  animate();
}

function handleResize(container) {
  if (!renderer || !camera) return;
  const width = container.clientWidth;
  const height = Math.max(container.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

async function loadGeometryFromSource(source) {
  // source can be a File (from input) or a URL string.
  if (source instanceof File) {
    const buffer = await readFileAsArrayBuffer(source);
    return loader.parse(buffer, source.name);
  }

  return new Promise((resolve, reject) => {
    loader.load(
      source,
      (geometry) => resolve(geometry),
      undefined,
      (err) => reject(err)
    );
  });
}

function centerGeometry(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  box.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
}

function computeMaxDimension(geometry) {
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z);
}

function buildMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export async function loadBaseline(source = './baseline.stl') {
  if (!scene) throw new Error('Viewer not initialized.');
  if (baselineMesh) {
    scene.remove(baselineMesh);
    baselineMesh.geometry.dispose();
  }

  const geometry = await loadGeometryFromSource(source);
  centerGeometry(geometry);
  geometry.computeVertexNormals();

  const { baselineMat } = createMaterials();
  baselineMesh = buildMesh(geometry, baselineMat);
  baselineGeometry = geometry;
  scene.add(baselineMesh);

  fitCameraToModels();
  return geometry;
}

export async function loadStudent(source = './variant.stl') {
  if (!scene) throw new Error('Viewer not initialized.');
  if (!baselineGeometry) throw new Error('Load the baseline before loading a student model.');

  if (studentMesh) {
    scene.remove(studentMesh);
    studentMesh.geometry.dispose();
  }

  const geometry = await loadGeometryFromSource(source);
  centerGeometry(geometry);
  geometry.computeVertexNormals();

  const baselineMax = computeMaxDimension(baselineGeometry);
  const studentMax = computeMaxDimension(geometry);
  const scale = studentMax > 0 ? baselineMax / studentMax : 1;
  geometry.scale(scale, scale, scale);

  studentGeometry = geometry;
  studentTransform = new THREE.Matrix4(); // reset orientation for new loads

  const { studentMat } = createMaterials();
  studentMesh = buildMesh(studentGeometry, studentMat);
  studentMesh.matrixAutoUpdate = false;
  studentMesh.matrix.copy(studentTransform);
  scene.add(studentMesh);

  fitCameraToModels();
  return geometry;
}

export function rotateStudent(axis, direction) {
  if (!studentMesh || !studentGeometry) return;
  const angle = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  const rotation = new THREE.Matrix4();
  if (axis === 'x') {
    rotation.makeRotationX(angle);
  } else if (axis === 'y') {
    rotation.makeRotationY(angle);
  } else {
    return;
  }

  studentTransform = rotation.multiply(studentTransform);
  studentMesh.matrix.copy(studentTransform);
  studentMesh.matrixWorldNeedsUpdate = true;

  fitCameraToModels();
}

export function resetStudentOrientation() {
  if (!studentMesh) return;
  studentTransform.identity();
  studentMesh.matrix.copy(studentTransform);
  studentMesh.matrixWorldNeedsUpdate = true;
  fitCameraToModels();
}

export function getNormalizedGeometries() {
  if (!baselineGeometry || !studentGeometry) return null;
  const studentClone = studentGeometry.clone();
  studentClone.applyMatrix4(studentTransform);
  return { baseline: baselineGeometry, student: studentClone };
}

function fitCameraToModels() {
  if (!camera || !scene || !renderer) return;

  const box = new THREE.Box3();
  if (baselineMesh) box.expandByObject(baselineMesh);
  if (studentMesh) box.expandByObject(studentMesh);
  if (box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.3;

  const direction = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize()
    .multiplyScalar(distance);

  controls.target.copy(center);
  camera.position.copy(center).add(direction);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  controls.update();
}
