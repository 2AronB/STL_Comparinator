import { initViewer, loadBaseline, loadStudent, rotateStudent, resetStudentOrientation, getNormalizedGeometries } from './viewer.js';
import { compareModels } from './compare.js';

const APP_VERSION = 'v1.1.0';
const LOG_LIMIT = 30;

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
  elements.appVersion = document.getElementById('app-version');
  elements.eventLog = document.getElementById('event-log');
  elements.errorLog = document.getElementById('error-log');
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? '#b42318' : '#0b5c2d';
}

function logBadgeFor(level) {
  switch (level) {
    case 'success':
      return '✓';
    case 'warn':
      return '!';
    case 'error':
      return '!';
    default:
      return 'i';
  }
}

function trimLog(list) {
  if (!list) return;
  while (list.children.length > LOG_LIMIT) {
    list.removeChild(list.firstChild);
  }
}

function appendEventLog(message, level = 'info') {
  if (!elements.eventLog) return;
  const li = document.createElement('li');
  li.className = 'log-item';

  const badge = document.createElement('span');
  badge.className = `badge ${level}`;
  badge.textContent = logBadgeFor(level);

  const text = document.createElement('span');
  text.textContent = `${new Date().toLocaleTimeString()} — ${message}`;

  li.appendChild(badge);
  li.appendChild(text);
  elements.eventLog.appendChild(li);
  trimLog(elements.eventLog);
}

function clearEventLog() {
  if (!elements.eventLog) return;
  elements.eventLog.innerHTML = '';
}

function resetErrorLog() {
  if (elements.errorLog) {
    elements.errorLog.textContent = 'No errors yet.';
  }
}

function appendErrorLog(message, error) {
  if (!elements.errorLog) return;
  const details = [];
  details.push(`${new Date().toLocaleTimeString()} — ${message}`);
  if (error) {
    if (error.message) details.push(`Message: ${error.message}`);
    if (error.stack) details.push(`Stack: ${error.stack}`);
  }
  const combined = details.join('\n');
  elements.errorLog.textContent = elements.errorLog.textContent === 'No errors yet.'
    ? combined
    : `${elements.errorLog.textContent}\n\n${combined}`;
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
    clearEventLog();
    resetErrorLog();
    appendEventLog('Load button clicked. Starting baseline load.', 'info');
    setStatus('Loading baseline…');

    await loadBaseline(getInputOrDefault(elements.baselineInput, './baseline.stl'));
    appendEventLog('Baseline loaded, centered, and ready.', 'success');

    setStatus('Loading student model…');
    appendEventLog('Loading student model with scale normalization.', 'info');
    await loadStudent(getInputOrDefault(elements.studentInput, './variant.stl'));
    appendEventLog('Student loaded, scaled to baseline, orientation reset.', 'success');

    updateMetrics();
    appendEventLog('Metrics computed for normalized meshes.', 'success');
    setStatus('Models loaded. Use the orientation controls if needed.');
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load STL: ${err.message}`, true);
    appendEventLog('Model loading failed. See error details below.', 'error');
    appendErrorLog('Model load error', err);
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
    const axisLabel = axis.toUpperCase();
    const directionLabel = direction > 0 ? '+90°' : '-90°';
    setStatus('Student orientation adjusted. Metrics refreshed.');
    appendEventLog(`Rotated student ${directionLabel} around ${axisLabel}.`, 'info');
  };

  elements.rotateXPos.addEventListener('click', () => rotateAndReport('x', 1));
  elements.rotateXNeg.addEventListener('click', () => rotateAndReport('x', -1));
  elements.rotateYPos.addEventListener('click', () => rotateAndReport('y', 1));
  elements.rotateYNeg.addEventListener('click', () => rotateAndReport('y', -1));
  elements.resetOrientation.addEventListener('click', () => {
    resetStudentOrientation();
    updateMetrics();
    setStatus('Student orientation reset to default.');
    appendEventLog('Student orientation reset.', 'warn');
  });
}

function main() {
  cacheDom();
  if (elements.appVersion) {
    elements.appVersion.textContent = APP_VERSION;
  }
  appendEventLog('Viewer booted. Ready to load models.', 'info');
  initViewer(elements.rendererRoot);
  wireEvents();
  setStatus('Ready. Load the models to begin.');
}

main();
