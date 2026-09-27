const assert = require('assert');

// Create a lightweight DOM mock environment for testing popup logic
function createMockElement(id = '', tag = 'div') {
  const classListSet = new Set();
  const listeners = {};
  const attributes = {};
  const children = [];

  const el = {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    checked: false,
    disabled: false,
    title: '',
    textContent: '',
    _innerHTML: '',
    style: {},
    classList: {
      add: (...cls) => cls.forEach(c => classListSet.add(c)),
      remove: (...cls) => cls.forEach(c => classListSet.delete(c)),
      contains: (c) => classListSet.has(c),
      toggle: (c, force) => {
        if (force === true) classListSet.add(c);
        else if (force === false) classListSet.delete(c);
        else if (classListSet.has(c)) classListSet.delete(c);
        else classListSet.add(c);
      }
    },
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    trigger: (event, payload = {}) => {
      if (listeners[event]) {
        listeners[event].forEach(fn => fn({ ...payload, target: el, stopPropagation: () => {} }));
      }
    },
    setAttribute: (name, val) => { attributes[name] = String(val); },
    getAttribute: (name) => attributes[name] || null,
    appendChild: (child) => {
      children.push(child);
      child.parentElement = el;
      return child;
    },
    querySelectorAll: (selector) => {
      const results = [];
      function recurse(node) {
        if (!node || !node.children) return;
        node.children.forEach(c => {
          if (selector.startsWith('.') && c.classList.contains(selector.slice(1))) {
            results.push(c);
          } else if (selector.startsWith('#') && c.id === selector.slice(1)) {
            results.push(c);
          } else if (selector.includes('[data-ou]')) {
            if (c.getAttribute && c.getAttribute('data-ou')) results.push(c);
          }
          recurse(c);
        });
      }
      recurse({ children });
      return results;
    },
    querySelector: (selector) => {
      const res = el.querySelectorAll(selector);
      return res.length > 0 ? res[0] : null;
    }
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => el._innerHTML,
    set: (val) => {
      el._innerHTML = val;
      children.length = 0;
    }
  });

  Object.defineProperty(el, 'children', {
    get: () => children
  });

  return el;
}

function createMockDocument() {
  const elements = {};

  const doc = {
    createElement: (tag) => createMockElement('', tag),
    getElementById: (id) => {
      if (!elements[id]) {
        elements[id] = createMockElement(id, 'div');
      }
      return elements[id];
    },
    querySelector: (sel) => {
      if (sel.startsWith('#')) return doc.getElementById(sel.slice(1));
      if (sel.includes('input[name="export-scope"]:checked')) {
        return { value: 'full' };
      }
      return createMockElement('', 'div');
    },
    querySelectorAll: (sel) => {
      if (sel.includes('export-scope')) {
        return [
          { value: 'full', addEventListener: () => {}, checked: true },
          { value: 'shareable', addEventListener: () => {}, checked: false }
        ];
      }
      return [];
    },
    addEventListener: () => {}
  };

  return { doc, elements };
}

function createMockChrome() {
  const messageListeners = [];
  const sentMessages = [];

  const chromeMock = {
    runtime: {
      getManifest: () => ({ version: '1.2.0' }),
      onMessage: {
        addListener: (fn) => messageListeners.push(fn)
      },
      sendMessage: (msg, cb) => {
        sentMessages.push(msg);
        if (cb) cb({ success: true });
      }
    },
    tabs: {
      query: (opts, cb) => {
        cb([{ id: 101, url: 'https://learn.uopeople.edu/d2l/home/12345' }]);
      },
      sendMessage: (tabId, msg, cb) => {
        sentMessages.push({ tabId, ...msg, _callback: cb });
      }
    },
    storage: {
      local: {
        get: (keys, cb) => cb({ optDownloadAssets: true, exportScope: 'full' }),
        set: (obj, cb) => { if (cb) cb(); }
      }
    },
    _sentMessages: sentMessages,
    _triggerRuntimeMessage: (msg) => {
      messageListeners.forEach(fn => fn(msg));
    }
  };

  return chromeMock;
}

async function runTests() {
  console.log('--- Running Popup Logic Unit Tests ---');

  // Test 1: Require popup.js and inspect exports
  const popupModule = require('../popup.js');
  assert(typeof popupModule.initPopup === 'function', 'popup.js must export initPopup function');
  console.log('✓ Step 1: popup.js exports initPopup');

  // Test 2: Clean course name helper
  assert.strictEqual(popupModule.cleanCourseName('Homepage - CS 1102 Programming 1 - Brightspace'), 'CS 1102 Programming 1');
  assert.strictEqual(popupModule.cleanCourseName('Table of Contents - CS 2301 Operating Systems'), 'CS 2301 Operating Systems');
  console.log('✓ Step 2: cleanCourseName normalizes Brightspace page titles');

  // Test 3: Initialize Popup with mock DOM and Chrome
  const { doc, elements } = createMockDocument();
  const chromeMock = createMockChrome();

  const controller = await popupModule.initPopup(doc, chromeMock);
  assert(controller, 'initPopup should return controller instance');
  assert.strictEqual(controller.getState().currentTargetMode, 'single', 'Initial mode must be single');
  console.log('✓ Step 3: Initial popup state initialized to single course mode');

  // Test 4: Mode Switching
  controller.switchTargetMode('batch');
  assert.strictEqual(controller.getState().currentTargetMode, 'batch', 'Mode must switch to batch');
  assert(elements['btn-target-batch'].classList.contains('active'), 'Batch pill must be active');
  assert(!elements['btn-target-single'].classList.contains('active'), 'Single pill must not be active');
  assert(elements['course-card'].classList.contains('hidden'), 'Single course card must be hidden in batch mode');
  assert(!elements['batch-courses-container'].classList.contains('hidden'), 'Batch container must be visible in batch mode');
  assert.strictEqual(elements['btn-export-combined-label'].textContent, 'Export All Courses (HTML + MD)');
  assert.strictEqual(elements['btn-export-label'].textContent, 'Export All Courses (HTML)');
  assert.strictEqual(elements['btn-export-markdown-label'].textContent, 'Export All Courses (Markdown)');
  console.log('✓ Step 4: Mode switching to batch updates DOM and button labels');

  controller.switchTargetMode('single');
  assert.strictEqual(controller.getState().currentTargetMode, 'single', 'Mode must switch back to single');
  assert(elements['btn-target-single'].classList.contains('active'), 'Single pill must be active');
  assert(!elements['course-card'].classList.contains('hidden'), 'Single course card must be visible in single mode');
  assert(elements['batch-courses-container'].classList.contains('hidden'), 'Batch container must be hidden in single mode');
  assert.strictEqual(elements['btn-export-combined-label'].textContent, 'Export Full Package (HTML + MD)');
  console.log('✓ Step 5: Mode switching back to single updates DOM and button labels');

  // Test 5: Handling Enrolled Courses Discovery
  const mockCourses = [
    { id: 1001, orgUnitId: 1001, code: 'CS 1102', name: 'Programming 1' },
    { id: 1002, orgUnitId: 1002, code: 'CS 2301', name: 'Operating Systems' },
    { id: 1003, orgUnitId: 1003, code: 'MATH 1201', name: 'College Algebra' }
  ];

  controller.handleEnrolledCoursesResponse({ success: true, courses: mockCourses });
  const stateAfterDiscovery = controller.getState();
  assert.strictEqual(stateAfterDiscovery.discoveredCourses.length, 3, 'Must discover 3 courses');
  assert.strictEqual(stateAfterDiscovery.selectedCourseIds.size, 3, 'Must select all 3 courses by default');
  assert.strictEqual(elements['batch-course-count'].textContent, '3', 'Batch count badge must be 3');
  assert.strictEqual(elements['btn-target-batch-label'].textContent, 'All Courses (3)', 'Pill label must show count 3');
  console.log('✓ Step 6: Enrolled courses discovery renders count and selects all courses');

  // Test 6: Checkbox toggling and Select All button
  controller.switchTargetMode('batch');
  assert.strictEqual(elements['batch-select-all-btn'].textContent, 'Deselect All', 'When all selected, toggle button must be Deselect All');

  // Toggle Select All -> Deselect All
  elements['batch-select-all-btn'].trigger('click');
  assert.strictEqual(controller.getState().selectedCourseIds.size, 0, 'Deselect all must clear selected courses');
  assert.strictEqual(elements['batch-select-all-btn'].textContent, 'Select All', 'Button must change to Select All');
  assert(elements['btn-export-combined'].disabled, 'Export button must be disabled when 0 courses selected');

  // Toggle Select All -> Select All
  elements['batch-select-all-btn'].trigger('click');
  assert.strictEqual(controller.getState().selectedCourseIds.size, 3, 'Select all must select all 3 courses');
  assert(!elements['btn-export-combined'].disabled, 'Export button must be enabled when courses selected');
  console.log('✓ Step 7: Select All / Deselect All button toggles all courses');

  // Test 7: Auto-switch to batch mode when not on a specific course page
  controller.handleCourseStatusResponse({ detected: false });
  assert.strictEqual(controller.getState().currentTargetMode, 'batch', 'Must auto-switch to batch mode when status.detected is false');
  assert(elements['btn-target-single'].disabled, 'Single course pill must be disabled on general pages');
  assert.strictEqual(elements['btn-target-single'].title, 'Not on a specific course page');
  console.log('✓ Step 8: Auto-switches to batch mode and disables This Course pill when detected: false');

  // Test 8: Dispatch START_BATCH_EXPORT
  chromeMock._sentMessages.length = 0;
  controller.startBatchExport('combined');

  const batchExportMsg = chromeMock._sentMessages.find(m => m.action === 'START_BATCH_EXPORT');
  assert(batchExportMsg, 'Must dispatch START_BATCH_EXPORT message to active tab');
  assert.strictEqual(batchExportMsg.courses.length, 3, 'Payload must include all 3 selected courses');
  assert.strictEqual(batchExportMsg.exportFormat, 'combined', 'Format must match combined');
  assert.strictEqual(batchExportMsg.exportScope, 'full', 'Scope must match full');
  assert.strictEqual(batchExportMsg.downloadAssets, true, 'downloadAssets must match checkbox');
  console.log('✓ Step 9: startBatchExport dispatches START_BATCH_EXPORT with correct payload');

  // Test 9: Handle BATCH_EXPORT_PROGRESS runtime events
  chromeMock._triggerRuntimeMessage({
    action: 'BATCH_EXPORT_PROGRESS',
    percent: 45,
    status: '[2/3] Exporting CS 2301 Operating Systems...',
    courseIndex: 2,
    totalCourses: 3,
    currentCourseName: 'CS 2301 Operating Systems'
  });

  assert.strictEqual(elements['progress-fill'].style.width, '45%', 'Progress bar fill must be 45%');
  assert.strictEqual(elements['progress-percent'].textContent, '45%', 'Progress percent must show 45%');
  assert.strictEqual(elements['progress-detail'].textContent, '[2/3] Exporting CS 2301 Operating Systems...', 'Progress detail must match status');
  console.log('✓ Step 10: BATCH_EXPORT_PROGRESS updates progress fill, percent, and detail');

  // Test 10: Review Finding 1 - isExporting Active Export Guard
  assert.strictEqual(controller.getState().isExporting, true, 'isExporting must be true while export is running');
  assert(elements['btn-target-single'].disabled, 'Single course pill must be disabled mid-export');
  assert(elements['btn-target-batch'].disabled, 'Batch course pill must be disabled mid-export');

  // Attempt mode switch mid-export
  controller.switchTargetMode('single');
  assert.strictEqual(controller.getState().currentTargetMode, 'batch', 'Mode switch must be blocked while isExporting is true');

  // Resolve active export
  if (batchExportMsg._callback) {
    batchExportMsg._callback({ success: true, exportedCount: 3 });
  }

  // Simulate completion timeout resolution
  await new Promise(r => setTimeout(r, 1100));
  assert.strictEqual(controller.getState().isExporting, false, 'isExporting must reset to false after completion');
  assert(!elements['btn-target-batch'].disabled, 'Batch course pill must be re-enabled after export');
  console.log('✓ Step 11: isExporting guards mode switching and buttons mid-export');

  // Test 11: Review Finding 2 - No Double Escaping in Filter Query Empty State
  controller.renderBatchCoursesList('CS & Math <test>');
  const emptyStateHtml = elements['batch-courses-list'].innerHTML;
  assert(emptyStateHtml.includes('No courses matching &quot;CS &amp; Math &lt;test&gt;&quot;'), 'Empty state must properly escape filterQuery once');
  assert(!emptyStateHtml.includes('&amp;quot;'), 'Empty state must NOT double escape quotes (&amp;quot;)');
  assert(!emptyStateHtml.includes('&amp;amp;'), 'Empty state must NOT double escape ampersands (&amp;amp;)');
  console.log('✓ Step 12: Empty state filter query avoids double-escaping');

  console.log('\n ALL POPUP LOGIC TESTS PASSED!');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
