const assert = require('assert');
const fs = require('fs');

// Global mock state for test tracking
let sentMessages = [];
let downloadedZipPayload = null;
let toastCreated = false;
let toastUpdates = [];

// Lightweight DOM element mock for toast verification
function createMockElement(id = '', tag = 'div') {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    addEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    remove: () => {}
  };
  Object.defineProperty(el, 'innerHTML', {
    set: (val) => {
      toastUpdates.push(val);
    },
    get: () => toastUpdates[toastUpdates.length - 1] || ''
  });
  return el;
}

// Set up global environment before loading modules
global.window = {
  __UOP_COURSE_EXPORTER_LOADED__: false,
  __TEST_ENV__: true,
  location: { href: 'https://learn.uopeople.edu/d2l/home', pathname: '/d2l/home' },
  addEventListener: () => {}
};

global.document = {
  getElementById: (id) => {
    if (id === 'uop-exporter-completion-toast') {
      return toastCreated ? createMockElement(id) : null;
    }
    return null;
  },
  createElement: (tag) => {
    toastCreated = true;
    return createMockElement('', tag);
  },
  body: {
    appendChild: () => {
      toastCreated = true;
    }
  },
  querySelector: () => null,
  querySelectorAll: () => []
};

global.chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener: (fn) => {
        global.chromeRuntimeMessageListener = fn;
      }
    },
    sendMessage: (msg, cb) => {
      sentMessages.push(msg);
      if (msg.action === 'TRIGGER_ZIP_DOWNLOAD') {
        downloadedZipPayload = msg;
      }
      if (cb) cb({ success: true, base64: 'bW9jay1maWxlLWNvbnRlbnQ=' });
    }
  },
  storage: {
    local: {
      get: (keys, cb) => cb({}),
      set: (data, cb) => { if (cb) cb(); }
    },
    onChanged: {
      addListener: () => {}
    }
  }
};

// Mock D2LApi
global.D2LApi = {
  getCourseInfo: async (ouId) => ({
    id: String(ouId),
    name: ouId === '101' ? 'CS 2301 Operating Systems' : (ouId === '102' ? 'MATH 1201 College Algebra' : `Course ${ouId}`),
    code: ouId === '101' ? 'CS 2301' : (ouId === '102' ? 'MATH 1201' : `MATH ${ouId}`)
  }),
  getTOC: async (ouId) => {
    if (ouId === '999') {
      throw new Error('D2L Network Timeout: Could not reach Table of Contents');
    }
    return { Modules: [{ Title: 'Unit 1: Overview', Topics: [] }] };
  },
  getDropboxFolders: async () => [],
  getDiscussionForums: async () => [],
  getRubricsList: async () => [],
  getQuizzesList: async () => [],
  getQuizzesFromLms: async () => [],
  getStudentProfile: async () => ({ fullName: 'Student Test', initials: 'ST' }),
  getCourseInstructor: async () => 'Prof. Test',
  buildCourseMetadata: () => ({ courseName: 'Test' }),
  extractAllTopicsFromToc: () => [],
  getCurrentUser: async () => ({ userId: '123' }),
  getEnrolledCourses: async () => [
    { id: '101', name: 'CS 2301 Operating Systems' },
    { id: '102', name: 'MATH 1201 College Algebra' }
  ],
  parseModules: async (toc, opts, progressCb) => {
    if (progressCb) progressCb(50, 'Extracting Unit 1...');
    return [
      {
        title: 'Unit 1: Introduction',
        topics: [{ title: 'Overview', contentHtml: '<p>Welcome</p>' }],
        attachments: []
      }
    ];
  },
  sanitizeFileName: (name) => name.replace(/[^a-zA-Z0-9_-]+/g, '_')
};

// Mock HTMLBuilder
global.HTMLBuilder = {
  buildOfflineSite: ({ courseInfo, units }) => `<html><head><title>${courseInfo.name}</title></head><body><h1>${courseInfo.name}</h1></body></html>`,
  buildMasterPortal: ({ courses, exportedAt, exportScope, downloadAssets, exportFormat }) => {
    return `<!DOCTYPE html><html><head><title>Master Portal</title></head><body><h1>Master Course Portal</h1><div class="courses">${courses.map(c => `<div class="card" data-folder="${c.folderName}">${c.name} (${c.status})</div>`).join('')}</div></body></html>`;
  }
};

// Mock MarkdownBuilder
global.MarkdownBuilder = {
  sanitizeFolderName: (name) => name.replace(/[^a-zA-Z0-9_-]+/g, '_'),
  buildMarkdownZip: (courseInfo, units) => [
    { name: '01_Unit_1/01_Overview.md', content: `# ${courseInfo.name}\n\nUnit 1 notes` },
    { name: 'README.md', content: `# ${courseInfo.name} Readme` }
  ]
};

// Mock ZipBuilder
global.ZipBuilder = {
  createZip: async (files) => {
    // Record files compressed
    global.lastCompressedZipFiles = files;
    return new Uint8Array([0x50, 0x4B, 0x03, 0x04]); // PK zip header bytes
  }
};

async function runTests() {
  console.log('--- Starting Task 5 Batch Runner Tests ---');

  // Load content.js
  const contentCode = fs.readFileSync('content.js', 'utf8');
  eval(contentCode);

  const contentModule = (typeof module !== 'undefined' && module.exports) ? module.exports : {};
  const runBatchExportPipeline = contentModule.runBatchExportPipeline || global.runBatchExportPipeline;
  const sanitizeCourseFolderName = contentModule.sanitizeCourseFolderName || global.sanitizeCourseFolderName;

  assert.strictEqual(typeof runBatchExportPipeline, 'function', 'runBatchExportPipeline must be defined and callable');

  // Test 1: Course Folder Name Sanitization
  console.log('Test 1: sanitizeCourseFolderName cleans LMS prefixes and brand suffixes');
  if (typeof sanitizeCourseFolderName === 'function') {
    const clean1 = sanitizeCourseFolderName('CS 2301 Operating Systems - Brightspace');
    assert.strictEqual(clean1, 'CS_2301_Operating_Systems', `Expected clean CS_2301_Operating_Systems, got ${clean1}`);

    const clean2 = sanitizeCourseFolderName('Homepage - MATH 1201 College Algebra - AY2026-T5');
    assert.strictEqual(clean2, 'MATH_1201_College_Algebra_AY2026-T5', `Expected clean MATH_1201_College_Algebra_AY2026-T5, got ${clean2}`);

    const clean3 = sanitizeCourseFolderName('Table of Contents - UNIV 1001 Online Education Strategies');
    assert.strictEqual(clean3, 'UNIV_1001_Online_Education_Strategies', `Expected clean UNIV_1001_Online_Education_Strategies, got ${clean3}`);
    console.log('✓ sanitizeCourseFolderName passed all test cases');
  }

  // Test 2: Standard 2-Course Batch Export (Folder Namespacing & Master Portal)
  console.log('Test 2: Standard multi-course batch export produces namespaced files and root index.html');
  sentMessages = [];
  downloadedZipPayload = null;
  global.lastCompressedZipFiles = null;

  const mockCourses = [
    { id: '101', name: 'CS 2301 Operating Systems' },
    { id: '102', name: 'MATH 1201 College Algebra' }
  ];

  await new Promise((resolve) => {
    runBatchExportPipeline(mockCourses, true, 'combined', 'full', (response) => {
      assert.strictEqual(response.success, true, 'Batch export response should indicate success');
      assert.strictEqual(response.exportedCount, 2, 'Batch export should report 2 exported courses');
      resolve();
    });
  });

  assert(global.lastCompressedZipFiles, 'ZipBuilder.createZip must have been called with zipFiles');
  const fileNames = global.lastCompressedZipFiles.map(f => f.name);

  // Assert Master Portal at root
  assert(fileNames.includes('index.html'), 'Root index.html (Master Portal) must be present');
  const rootIndex = global.lastCompressedZipFiles.find(f => f.name === 'index.html');
  assert(rootIndex.content.includes('Master Course Portal'), 'Root index.html must be master portal');
  assert(rootIndex.content.includes('01_CS_2301_Operating_Systems'), 'Master portal must reference course 1 folder');
  assert(rootIndex.content.includes('02_MATH_1201_College_Algebra'), 'Master portal must reference course 2 folder');

  // Assert Course 1 files namespaced under 01_CS_2301_Operating_Systems/
  assert(fileNames.includes('01_CS_2301_Operating_Systems/index.html'), 'Course 1 index.html must be namespaced');
  assert(fileNames.includes('01_CS_2301_Operating_Systems/01_Unit_1/01_Overview.md'), 'Course 1 unit markdown must be namespaced');
  assert(fileNames.includes('01_CS_2301_Operating_Systems/README.md'), 'Course 1 README.md must be namespaced');
  assert(fileNames.includes('01_CS_2301_Operating_Systems/course_metadata.json'), 'Course 1 course_metadata.json must be namespaced');

  // Assert Course 2 files namespaced under 02_MATH_1201_College_Algebra/
  assert(fileNames.includes('02_MATH_1201_College_Algebra/index.html'), 'Course 2 index.html must be namespaced');
  assert(fileNames.includes('02_MATH_1201_College_Algebra/01_Unit_1/01_Overview.md'), 'Course 2 unit markdown must be namespaced');
  assert(fileNames.includes('02_MATH_1201_College_Algebra/README.md'), 'Course 2 README.md must be namespaced');

  // Assert TRIGGER_ZIP_DOWNLOAD was dispatched
  assert(downloadedZipPayload, 'TRIGGER_ZIP_DOWNLOAD message must be sent to background');
  assert.strictEqual(downloadedZipPayload.courseName, 'All_Courses', 'courseName must be All_Courses for master batch');
  assert.strictEqual(downloadedZipPayload.suffix, 'Offline', 'suffix must be Offline for full scope');
  console.log('✓ Standard multi-course export folder namespacing verified');

  // Test 3: Error Isolation & Resilience
  console.log('Test 3: Error isolation preserves succeeding courses when one fails');
  sentMessages = [];
  global.lastCompressedZipFiles = null;

  const mockCoursesWithError = [
    { id: '101', name: 'CS 2301 Operating Systems' },
    { id: '999', name: 'CS 9999 Broken Course' }, // Throws in D2LApi.getTOC
    { id: '102', name: 'MATH 1201 College Algebra' }
  ];

  await new Promise((resolve) => {
    runBatchExportPipeline(mockCoursesWithError, true, 'combined', 'full', (response) => {
      assert.strictEqual(response.success, true, 'Batch export should succeed overall even with partial course failures');
      assert.strictEqual(response.exportedCount, 2, 'Exported count should be 2 successful courses');
      assert.strictEqual(response.totalCourses, 3, 'Total courses should be 3');
      resolve();
    });
  });

  const errorFileNames = global.lastCompressedZipFiles.map(f => f.name);

  // Successful courses must still be packed
  assert(errorFileNames.includes('01_CS_2301_Operating_Systems/index.html'), 'Course 1 must succeed');
  assert(errorFileNames.includes('03_MATH_1201_College_Algebra/index.html'), 'Course 3 must succeed');

  // Failed course must have EXPORT_ERROR.txt and no index.html
  assert(errorFileNames.includes('02_CS_9999_Broken_Course/EXPORT_ERROR.txt'), 'Failed course must have EXPORT_ERROR.txt');
  const errorFile = global.lastCompressedZipFiles.find(f => f.name === '02_CS_9999_Broken_Course/EXPORT_ERROR.txt');
  assert(errorFile.content.includes('D2L Network Timeout'), 'EXPORT_ERROR.txt must describe root cause error');

  // Root Master Portal must still be generated
  assert(errorFileNames.includes('index.html'), 'Master portal must be generated');
  const masterPortalErr = global.lastCompressedZipFiles.find(f => f.name === 'index.html');
  assert(masterPortalErr.content.includes('02_CS_9999_Broken_Course'), 'Master portal must include failed course folder');
  assert(masterPortalErr.content.includes('error'), 'Master portal must record error status');
  console.log('✓ Error isolation verified: failed course did not halt batch');

  // Test 4: Peer-Safe Scope & Suffix Handling
  console.log('Test 4: Peer-Safe Study Guide mode dispatches StudyGuide suffix');
  sentMessages = [];
  downloadedZipPayload = null;

  await new Promise((resolve) => {
    runBatchExportPipeline([{ id: '101', name: 'CS 2301 Operating Systems' }], false, 'combined', 'shareable', (response) => {
      assert.strictEqual(response.success, true);
      resolve();
    });
  });

  assert(downloadedZipPayload, 'TRIGGER_ZIP_DOWNLOAD must be dispatched');
  assert.strictEqual(downloadedZipPayload.suffix, 'StudyGuide', 'suffix must be StudyGuide in shareable mode');
  console.log('✓ Peer-Safe Study Guide suffix verified');

  // Test 5: Progress Broadcasting to Popup (BATCH_EXPORT_PROGRESS)
  console.log('Test 5: BATCH_EXPORT_PROGRESS messages are sent to popup');
  const progressMessages = sentMessages.filter(m => m.action === 'BATCH_EXPORT_PROGRESS');
  assert(progressMessages.length > 0, 'Must dispatch BATCH_EXPORT_PROGRESS messages');
  const finalProgress = progressMessages[progressMessages.length - 1];
  assert.strictEqual(finalProgress.percent, 100, 'Final batch export progress must reach 100%');
  console.log(`✓ Progress broadcasting verified (${progressMessages.length} updates sent)`);

  // Test 6: Runtime Message Listeners (GET_ENROLLED_COURSES & START_BATCH_EXPORT)
  console.log('Test 6: Runtime message listener handles GET_ENROLLED_COURSES and START_BATCH_EXPORT');
  assert(global.chromeRuntimeMessageListener, 'chrome.runtime.onMessage listener must be registered');

  // 6a. GET_ENROLLED_COURSES
  await new Promise((resolve) => {
    global.chromeRuntimeMessageListener(
      { action: 'GET_ENROLLED_COURSES' },
      {},
      (res) => {
        assert.strictEqual(res.success, true, 'GET_ENROLLED_COURSES should return success');
        assert(Array.isArray(res.courses), 'courses must be an array');
        assert.strictEqual(res.courses.length, 2, 'should return 2 enrolled courses');
        resolve();
      }
    );
  });

  // 6b. START_BATCH_EXPORT with empty courses validation
  await new Promise((resolve) => {
    global.chromeRuntimeMessageListener(
      { action: 'START_BATCH_EXPORT', courses: [] },
      {},
      (res) => {
        assert.strictEqual(res.success, false, 'Empty courses array should fail validation');
        assert(res.error, 'Error message should explain failure');
        resolve();
      }
    );
  });
  // Test 7: Export Concurrency Guard (isExportingInProgress)
  console.log('Test 7: Concurrency guard prevents simultaneous single/batch exports');
  const slowCourses = [{ id: '101', name: 'CS 2301 Operating Systems' }];
  let resolveSlowToc;
  const originalGetToc = global.D2LApi.getTOC;
  global.D2LApi.getTOC = () => new Promise((r) => { resolveSlowToc = r; });

  const firstExportPromise = new Promise((resolve) => {
    runBatchExportPipeline(slowCourses, false, 'combined', 'full', resolve);
  });

  // Second simultaneous export must be rejected immediately
  const secondExportResult = await new Promise((resolve) => {
    runBatchExportPipeline(slowCourses, false, 'combined', 'full', resolve);
  });

  assert.strictEqual(secondExportResult.success, false, 'Simultaneous export must be rejected');
  assert.strictEqual(secondExportResult.error, 'An export is already in progress.', 'Error message must match concurrency guard');

  // Let the first export finish
  resolveSlowToc({ Modules: [{ Title: 'Unit 1: Overview', Topics: [] }] });
  await firstExportPromise;
  global.D2LApi.getTOC = originalGetToc;
  console.log('✓ Export concurrency guard verified');

  // Test 8: Isomorphic Global Fallback Guard on Toast Functions
  console.log('Test 8: showCompletionToast and hideCompletionToast are safe in headless Node (document undefined)');
  const savedDoc = global.document;
  try {
    global.document = undefined;
    // Neither call should throw ReferenceError or TypeError
    assert.doesNotThrow(() => {
      // Trigger pipeline extraction or direct toast invocation
      if (typeof global.showCompletionToast === 'function') {
        global.showCompletionToast('Test Course', 1, 1, 50, 'Processing...');
      }
      if (typeof global.hideCompletionToast === 'function') {
        global.hideCompletionToast(true);
      }
    });
  } finally {
    global.document = savedDoc;
  }
  console.log('✓ Isomorphic document fallback guard verified');

  console.log('--- ALL TASK 5 TESTS PASSED SUCCESSFULLY! ---');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
