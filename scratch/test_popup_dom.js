const assert = require('assert');
const fs = require('fs');

const popupHtml = fs.readFileSync('popup.html', 'utf8');

assert(popupHtml.includes('id="target-switcher"'), 'Must have target-switcher');
assert(popupHtml.includes('id="btn-target-single"'), 'Must have btn-target-single');
assert(popupHtml.includes('id="btn-target-batch"'), 'Must have btn-target-batch');
assert(popupHtml.includes('id="batch-courses-container"'), 'Must have batch-courses-container');
assert(popupHtml.includes('id="batch-courses-list"'), 'Must have batch-courses-list');
assert(popupHtml.includes('id="batch-select-all-btn"'), 'Must have batch-select-all-btn');
assert(popupHtml.includes('id="btn-export-combined-label"'), 'Must have btn-export-combined-label');
assert(popupHtml.includes('id="btn-export-label"'), 'Must have btn-export-label');
assert(popupHtml.includes('id="btn-export-markdown-label"'), 'Must have btn-export-markdown-label');

console.log('✓ popup DOM structure verified');
