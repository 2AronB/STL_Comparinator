// Numerical comparison helpers for normalized THREE.BufferGeometry objects.
// All functions operate on geometries that have already been centered, scaled,
// and oriented as desired. The metrics aim to be unit-agnostic and resilient
// to orientation differences addressed elsewhere.

import * as THREE from 'three';

export function computeBoundingBox(geometry) {
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  const size = new THREE.Vector3();
  box.getSize(size);
  const min = box.min.clone();
  const max = box.max.clone();
  return { box, size, min, max };
}

export function computeTriangleCount(geometry) {
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  return position.count / 3;
}

export function computeApproxVolume(geometry) {
  // Approximates the signed volume of a closed mesh by summing the volumes of
  // tetrahedra formed by each triangle and the origin. This assumes the mesh is
  // watertight and that triangle winding is consistent. If the mesh is open or
  // poorly oriented, the result will be an approximation but still useful for
  // relative comparisons between two similarly prepared meshes.
  const position = geometry.getAttribute('position');
  if (!position || position.count < 3) return 0;

  let volume = 0;
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 3) {
    p1.fromBufferAttribute(position, i);
    p2.fromBufferAttribute(position, i + 1);
    p3.fromBufferAttribute(position, i + 2);
    volume += p1.dot(p2.cross(p3)) / 6; // Signed volume of tetrahedron.
  }

  return Math.abs(volume);
}

function percentDifference(baseline, student) {
  if (baseline === 0) return student === 0 ? 0 : Infinity;
  return ((student - baseline) / baseline) * 100;
}

export function compareModels(baselineGeometry, studentGeometry) {
  const baselineBox = computeBoundingBox(baselineGeometry);
  const studentBox = computeBoundingBox(studentGeometry);

  const baselineTriangles = computeTriangleCount(baselineGeometry);
  const studentTriangles = computeTriangleCount(studentGeometry);

  const baselineVolume = computeApproxVolume(baselineGeometry);
  const studentVolume = computeApproxVolume(studentGeometry);

  return {
    boundingBoxes: {
      baseline: baselineBox,
      student: studentBox,
    },
    triangleCounts: {
      baseline: baselineTriangles,
      student: studentTriangles,
      percentDifference: percentDifference(baselineTriangles, studentTriangles),
    },
    volumes: {
      baseline: baselineVolume,
      student: studentVolume,
      percentDifference: percentDifference(baselineVolume, studentVolume),
    },
    dimensions: {
      x: {
        baseline: baselineBox.size.x,
        student: studentBox.size.x,
        percentDifference: percentDifference(baselineBox.size.x, studentBox.size.x),
      },
      y: {
        baseline: baselineBox.size.y,
        student: studentBox.size.y,
        percentDifference: percentDifference(baselineBox.size.y, studentBox.size.y),
      },
      z: {
        baseline: baselineBox.size.z,
        student: studentBox.size.z,
        percentDifference: percentDifference(baselineBox.size.z, studentBox.size.z),
      },
    },
  };
}
