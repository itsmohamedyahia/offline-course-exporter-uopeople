const assert = require('assert');
const fs = require('fs');

const htmlBuilderCode = fs.readFileSync('html_builder.js', 'utf8');
eval(htmlBuilderCode);

assert.strictEqual(typeof HTMLBuilder.buildMasterPortal, 'function', 'buildMasterPortal must be a function on HTMLBuilder');

// Case 1: Standard full batch export
const mockCourses = [
  { id: '12345', folderName: '01_CS_2301_Operating_Systems', name: 'CS 2301 Operating Systems', code: 'CS 2301', unitsCount: 8 },
  { id: '12346', folderName: '02_MATH_1201_College_Algebra', name: 'MATH 1201 College Algebra', code: 'MATH 1201', unitsCount: 8 }
];

const portalHtml = HTMLBuilder.buildMasterPortal({
  courses: mockCourses,
  exportedAt: 'Sep 27, 2026',
  exportScope: 'full',
  downloadAssets: true
});

assert(portalHtml.includes('01_CS_2301_Operating_Systems/index.html'), 'Portal must link to first course index.html');
assert(portalHtml.includes('02_MATH_1201_College_Algebra/index.html'), 'Portal must link to second course index.html');
assert(portalHtml.includes('CS 2301'), 'Portal must show course code');
assert(portalHtml.includes('MATH 1201'), 'Portal must show math course code');
assert(portalHtml.includes('8 Units'), 'Portal must show units count');
assert(portalHtml.includes('Full Personal (Complete Courseware)'), 'Portal must show full archive mode');
assert(portalHtml.includes('Downloaded Offline'), 'Portal must show downloaded offline badge');
assert(portalHtml.includes('theme-toggle-btn'), 'Portal must have theme toggle button');
assert(portalHtml.includes('search-input'), 'Portal must have search filter input');

// Case 2: Shareable / Peer-Safe mode with assets false
const shareablePortal = HTMLBuilder.buildMasterPortal({
  courses: mockCourses,
  exportedAt: 'Sep 27, 2026',
  exportScope: 'shareable',
  downloadAssets: false
});

assert(shareablePortal.includes('Peer-Safe Study Guides'), 'Portal must show peer-safe title in shareable mode');
assert(shareablePortal.includes('Online Links'), 'Portal must show online links badge when downloadAssets is false');

// Case 3: Markdown-only export format
const mdOnlyPortal = HTMLBuilder.buildMasterPortal({
  courses: mockCourses,
  exportFormat: 'md'
});

assert(mdOnlyPortal.includes('01_CS_2301_Operating_Systems/01_Overview.md'), 'Markdown-only export must link to 01_Overview.md');
assert(!mdOnlyPortal.includes('01_CS_2301_Operating_Systems/index.html'), 'Markdown-only export must not link to index.html');
assert(mdOnlyPortal.includes('View Markdown Study Guide'), 'CTA must indicate Markdown Guide');

// Case 4: Failed course handling
const failedCourse = [
  { id: '999', folderName: '03_FAILED_COURSE', name: 'CS 9999 Advanced Machine Learning', code: 'CS 9999', error: '403 Forbidden' }
];
const failedPortal = HTMLBuilder.buildMasterPortal({
  courses: failedCourse
});
assert(failedPortal.includes('Export Incomplete'), 'Failed course must have incomplete badge');

// Case 5: Empty courses array and default params
const emptyPortal = HTMLBuilder.buildMasterPortal({});
assert(emptyPortal.includes('0 Courses Available'), 'Empty courses must display 0 Courses Available');
assert(emptyPortal.includes('<!DOCTYPE html>'), 'Empty courses must return valid HTML page');

// Case 6: XSS Escaping
const xssCourses = [
  { id: '1', folderName: 'xss_folder', name: '<script>alert(1)</script>', code: '<b>EVIL</b>' }
];
const xssPortal = HTMLBuilder.buildMasterPortal({ courses: xssCourses });
assert(!xssPortal.includes('<script>alert(1)</script>'), 'Course name must be HTML-escaped');
assert(xssPortal.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Course name must be converted to HTML entities');
assert(!xssPortal.includes('<b>EVIL</b>'), 'Course code must be HTML-escaped');

console.log('✓ buildMasterPortal passed all 6 test suites');
