import { initViewer, loadBaseline, loadStudent, rotateStudent, resetStudentOrientation, getNormalizedGeometries } from './viewer.js';
import { compareModels } from './compare.js';

const elements = {};

function cacheDom() {
  elements.baselineInput = document.getElementById('baseline-file');
  elements.studentInput = document.getElementById('student-file');
  elements.loadBtn = document.getElementById('load-btn');
  elements.status = document.getElementById('status');
  elements.metricsTable = document.getElementById('metrics-table');
  elements.rendererRoot = document.getElementById('renderer-root');
  elements.rotateXPos = document.getElementById('rotate-x-pos');
  elements.rotateXNeg = document.getElementById('rotate-x-neg');
  elements.rotateYPos = document.getElementById('rotate-y-pos');
  elements.rotateYNeg = document.getElementById('rotate-y-neg');
  elements.resetOrientation = document.getElementById('reset-orientation');
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? '#b42318' : '#0b5c2d';
}

function getInputOrDefault(input, defaultUrl) {
  return input.files && input.files[0] ? input.files[0] : defaultUrl;
}

function renderMetricsTable(result) {
  if (!result) {
    elements.metricsTable.textContent = 'No metrics available yet.';
    return;
  }

  const rows = [];
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

  rows.push(`
    <tr><th>Metric</th><th>Baseline</th><th>Student</th><th>% Difference</th></tr>
  `);

  rows.push(`
    <tr><td>Volume</td><td>${formatter.format(result.volumes.baseline)}</td><td>${formatter.format(result.volumes.student)}</td><td>${formatter.format(result.volumes.percentDifference)}</td></tr>
  `);

  rows.push(`
    <tr><td>Triangles</td><td>${formatter.format(result.triangleCounts.baseline)}</td><td>${formatter.format(result.triangleCounts.student)}</td><td>${formatter.format(result.triangleCounts.percentDifference)}</td></tr>
  `);

  rows.push(`
    <tr><td>Size X</td><td>${formatter.format(result.dimensions.x.baseline)}</td><td>${formatter.format(result.dimensions.x.student)}</td><td>${formatter.format(result.dimensions.x.percentDifference)}</td></tr>
    <tr><td>Size Y</td><td>${formatter.format(result.dimensions.y.baseline)}</td><td>${formatter.format(result.dimensions.y.student)}</td><td>${formatter.format(result.dimensions.y.percentDifference)}</td></tr>
    <tr><td>Size Z</td><td>${formatter.format(result.dimensions.z.baseline)}</td><td>${formatter.format(result.dimensions.z.student)}</td><td>${formatter.format(result.dimensions.z.percentDifference)}</td></tr>
  `);

  elements.metricsTable.innerHTML = `
    <table>
      ${rows.join('')}
      <caption>Values use normalized geometry: baseline is fixed; student is centered, scaled to match size, and rotated via the controls.</caption>
    </table>
  `;
}

async function handleLoadModels() {
  try {
    setStatus('Loading baseline…');
    await loadBaseline(getInputOrDefault(elements.baselineInput, './baseline.stl'));

    setStatus('Loading student model…');
    await loadStudent(getInputOrDefault(elements.studentInput, './variant.stl'));

    updateMetrics();
    setStatus('Models loaded. Use the orientation controls if needed.');
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load STL: ${err.message}`, true);
  }
}

function updateMetrics() {
  const geometries = getNormalizedGeometries();
  if (!geometries) return;
  const result = compareModels(geometries.baseline, geometries.student);
  renderMetricsTable(result);
}

function wireEvents() {
  elements.loadBtn.addEventListener('click', () => handleLoadModels());

  const rotateAndReport = (axis, direction) => {
    rotateStudent(axis, direction);
    updateMetrics();
    setStatus('Student orientation adjusted. Metrics refreshed.');
  };

  elements.rotateXPos.addEventListener('click', () => rotateAndReport('x', 1));
  elements.rotateXNeg.addEventListener('click', () => rotateAndReport('x', -1));
  elements.rotateYPos.addEventListener('click', () => rotateAndReport('y', 1));
  elements.rotateYNeg.addEventListener('click', () => rotateAndReport('y', -1));
  elements.resetOrientation.addEventListener('click', () => {
    resetStudentOrientation();
    updateMetrics();
    setStatus('Student orientation reset to default.');
  });
}

function main() {
  cacheDom();
  initViewer(elements.rendererRoot);
  wireEvents();
  setStatus('Ready. Load the models to begin.');
}

main();
