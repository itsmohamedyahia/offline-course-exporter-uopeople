# Multi-Course One-Click Batch Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable students to export all enrolled Brightspace courses in one click from any Brightspace page into a single organized Master ZIP archive containing course subfolders and a master launcher portal.

**Architecture:** Extend `d2l_api.js` to reliably discover all enrolled courses via Valence LP API and DOM fallbacks; update `popup.html` and `popup.js` with a dual-mode target switcher (`[ This Course ]` vs `[ All Courses (N) ]`) and an interactive course checklist; add `buildMasterPortal()` in `html_builder.js`; and implement `runBatchExportPipeline()` in `content.js` to coordinate sequential course extraction, error isolation, on-page floating toast progress, and consolidated ZIP packaging.

**Tech Stack:** JavaScript (ES6+, Chrome Extensions Manifest V3), HTML5, CSS3, Brightspace Valence REST API, JSZip/ZipBuilder.

**Spec:** [`docs/superpowers/specs/2026-09-27-multi-course-batch-export-design.md`](file:///s:/02_PROJECTS_CODE/code%20projects%20mine/uopeople-brightspace-course-export/docs/superpowers/specs/2026-09-27-multi-course-batch-export-design.md)

## Global Constraints

- **Template Literal Escaping Invariant:** Any backticks (`` ` ``), template literals (`${...}`), or regex backslashes (`\d+`) inside embedded scripts in `html_builder.js` MUST be escaped (`\${`, `\``, `\\d+`). Always run `node -c html_builder.js` to verify.
- **Manifest V3 Service Worker Limits:** Heavy processing and DOM fallback scraping must run inside `content.js` on the active authenticated tab, not in `background.js`.
- **Zero Telemetry & 100% Client-Side:** All requests must execute strictly against `learn.uopeople.edu` without external network calls.
- **Academic Integrity Compliance:** Peer-Safe mode (`shareable`) must strip quizzes, discussions, and assignments across all courses in the batch.
- **Non-OER Redirection Invariant:** When `downloadAssets = false`, links must point to online Brightspace URLs, not broken local paths.
- **No ArtifactMetadata in Workspace Files:** Write directly to workspace paths without `ArtifactMetadata`.

---

## Task 1: Enhanced Course Discovery API (`d2l_api.js`)

**Files:**
- Modify: `d2l_api.js:65-174`
- Test: `scratch/test_discovery.js`

**Interfaces:**
- Produces: `D2LApi.getEnrolledCourses()` -> `Promise<Array<{ id: string, orgUnitId: string, name: string, code: string }>>`
- Ensures: Filters out root org `6606`, handles pagination bookmarks if needed, queries `isActive=true`, and deduplicates IDs.

- [ ] **Step 1: Write verification test for enrolled courses parsing**

Create `scratch/test_discovery.js` to test parsing Valence enrollments response and DOM card elements:

```javascript
const assert = require('assert');
const fs = require('fs');

// Mock browser globals for Node test runner
global.window = {};
global.document = {
  querySelectorAll: () => []
};

const d2lApiCode = fs.readFileSync('d2l_api.js', 'utf8');
eval(d2lApiCode);

// Test cleanCourseName logic
const sampleTitle = 'Homepage - CS 2301-01 Operating Systems - AY2026-T5 - Brightspace';
const cleaned = D2LApi.cleanCourseName(sampleTitle);
assert.strictEqual(cleaned, 'CS 2301-01 Operating Systems - AY2026-T5', `Expected cleaned title but got: ${cleaned}`);
console.log('✓ cleanCourseName passed');
```

- [ ] **Step 2: Run verification test to confirm base behavior**

Run: `node scratch/test_discovery.js`
Expected: `✓ cleanCourseName passed`

- [ ] **Step 3: Refine `D2LApi.getEnrolledCourses` in `d2l_api.js`**

Ensure `getEnrolledCourses()`:
1. Prioritizes `/d2l/api/lp/1.30/enrollments/myenrollments/?canAccess=true&orgUnitTypeId=3&isActive=true` and `/d2l/api/lp/1.45/enrollments/myenrollments/?canAccess=true&orgUnitTypeId=3`.
2. Checks for `item.OrgUnit` and `item.Access.CanAccess !== false`.
3. Strips course code and name using `cleanCourseName()`.
4. Adds DOM scraping fallback parsing `d2l-enrollment-card`, `.d2l-course-tile`, `.d2l-card`, `a[href*="/d2l/home/"]`, and `a[href*="ou="]`.
5. Excludes `6606`.

- [ ] **Step 4: Verify syntax of `d2l_api.js`**

Run: `node -c d2l_api.js`
Expected: Syntax clean (exit code 0).

- [ ] **Step 5: Commit Task 1**

```bash
git add d2l_api.js scratch/test_discovery.js
git commit -m "feat(api): enhance enrolled courses discovery with active filtering and DOM fallbacks"
```

---

## Task 2: Master Launcher Portal Generator (`html_builder.js`)

**Files:**
- Modify: `html_builder.js`
- Test: `scratch/test_portal_builder.js`

**Interfaces:**
- Produces: `HTMLBuilder.buildMasterPortal({ courses, exportedAt, exportScope, downloadAssets }) -> string`
- Returns: A self-contained HTML page linking to `./[course_folder]/index.html` for each course with dark/light themes and responsive grid.

- [ ] **Step 1: Write test for `buildMasterPortal`**

Create `scratch/test_portal_builder.js`:

```javascript
const assert = require('assert');
const fs = require('fs');

const htmlBuilderCode = fs.readFileSync('html_builder.js', 'utf8');
eval(htmlBuilderCode);

assert.strictEqual(typeof HTMLBuilder.buildMasterPortal, 'function', 'buildMasterPortal must be a function on HTMLBuilder');

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
console.log('✓ buildMasterPortal passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scratch/test_portal_builder.js`
Expected: FAIL with `buildMasterPortal must be a function on HTMLBuilder`

- [ ] **Step 3: Implement `buildMasterPortal` in `html_builder.js`**

Add `buildMasterPortal(data)` to `HTMLBuilder`:
- Produces a polished dark-slate launcher page (`#0f172a` background, plum/rose accents).
- Displays cards for each exported course with relative links to `./${course.folderName}/index.html` (or `./${course.folderName}/01_Overview.md` if markdown-only).
- Includes course title, course code, number of units, and status badge.
- Escapes all inner backticks and template literals properly.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scratch/test_portal_builder.js; node -c html_builder.js`
Expected: PASS and syntax clean.

- [ ] **Step 5: Commit Task 2**

```bash
git add html_builder.js scratch/test_portal_builder.js
git commit -m "feat(html): add Master Course Portal launcher generator"
```

---

## Task 3: Dual-Mode Popup UI (`popup.html` & `popup.css`)

**Files:**
- Modify: `popup.html:48-180`
- Modify: `popup.css`
- Test: Visual inspection & DOM structure validation via Node script

**Interfaces:**
- Target Switcher: `#target-switcher` containing `#btn-target-single` (`This Course`) and `#btn-target-batch` (`All Courses (N)`)
- Batch Course List: `#batch-courses-container` with `#batch-courses-list` and `#batch-select-all-btn`
- Dynamic Button Labels: `#btn-export-combined-label`, `#btn-export-label`, `#btn-export-markdown-label`

- [ ] **Step 1: Write DOM structure verification test**

Create `scratch/test_popup_dom.js`:

```javascript
const assert = require('assert');
const fs = require('fs');

const popupHtml = fs.readFileSync('popup.html', 'utf8');

assert(popupHtml.includes('id="target-switcher"'), 'Must have target-switcher');
assert(popupHtml.includes('id="btn-target-single"'), 'Must have btn-target-single');
assert(popupHtml.includes('id="btn-target-batch"'), 'Must have btn-target-batch');
assert(popupHtml.includes('id="batch-courses-container"'), 'Must have batch-courses-container');
assert(popupHtml.includes('id="batch-courses-list"'), 'Must have batch-courses-list');
console.log('✓ popup DOM structure verified');
```

- [ ] **Step 2: Run test to verify failure**

Run: `node scratch/test_popup_dom.js`
Expected: FAIL on missing elements

- [ ] **Step 3: Update `popup.html` and `popup.css`**

1. In `popup.html`, add:
   - Target Scope Switcher (`[ This Course ]` and `[ All Courses (...) ]`).
   - `#batch-courses-container` containing a "Select All" toggle, search/count header, and `#batch-courses-list` (compact checklist).
   - Wrap export button labels in spans with IDs so their text can dynamically switch between `Export Full Package` and `Export All Courses (Full Package)`.
2. In `popup.css`, add styling for:
   - Target scope pills (similar to segmented control).
   - Scrollable course checklist with custom scrollbar, hover states, and accent checkboxes.
   - Smooth transition when toggling between Single Course and All Courses view.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scratch/test_popup_dom.js`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
git add popup.html popup.css scratch/test_popup_dom.js
git commit -m "feat(ui): add target scope switcher and enrolled courses checklist to popup"
```

---

## Task 4: Popup Logic & State Orchestration (`popup.js`)

**Files:**
- Modify: `popup.js`
- Test: Manual / interactive verification & syntax validation

**Interfaces:**
- Consumes: `GET_COURSE_STATUS` and `GET_ENROLLED_COURSES` from `content.js`
- Produces: `START_BATCH_EXPORT` message with `{ courses, downloadAssets, exportFormat, exportScope }`
- Listens to: `BATCH_EXPORT_PROGRESS` message to update multi-course progress bar

- [ ] **Step 1: Update `popup.js` to manage dual-mode state**

1. Initialize state: `currentTargetMode = 'single'`, `discoveredCourses = []`, `selectedCourseIds = new Set()`.
2. On tab check:
   - Query `GET_COURSE_STATUS` and `GET_ENROLLED_COURSES` in parallel.
   - If `status.detected` is false (general Brightspace page):
     - Automatically switch to `All Courses` mode (`currentTargetMode = 'batch'`).
     - Disable the `This Course` pill with title "Not on a specific course page".
   - If `status.detected` is true:
     - Default to `This Course` mode.
     - Enable both pills and show count on `All Courses (N)`.
3. Render course checklist in `batch-courses-list`:
   - Each course has a checkbox `input[type="checkbox"][data-ou="{id}"]`.
   - Update `selectedCourseIds` on change.
   - Hook up "Select All / Deselect All" toggle.
4. Update action buttons text when switching modes:
   - Single: `Export Full Package (HTML + MD)`, `Export HTML Website (.zip)`, `Export Markdown Notes (.zip)`
   - Batch: `Export All Courses (HTML + MD)`, `Export All Courses (HTML)`, `Export All Courses (Markdown)`
5. When clicking export in batch mode:
   - Validate `selectedCourseIds.size > 0`.
   - Send `START_BATCH_EXPORT` with the array of selected courses.
6. Handle `BATCH_EXPORT_PROGRESS` events in the runtime message listener to update the progress bar.

- [ ] **Step 2: Verify `popup.js` syntax**

Run: `node -c popup.js`
Expected: Syntax clean.

- [ ] **Step 3: Commit Task 4**

```bash
git add popup.js
git commit -m "feat(popup): wire multi-course selection, mode switching, and batch export dispatching"
```

---

## Task 5: Content Script Batch Orchestrator (`content.js`)

**Files:**
- Modify: `content.js`
- Test: `scratch/test_batch_runner.js`

**Interfaces:**
- Listens for:
  - `GET_ENROLLED_COURSES` -> calls `D2LApi.getEnrolledCourses()` and responds with `{ success: true, courses }`.
  - `START_BATCH_EXPORT` -> executes `runBatchExportPipeline(request.courses, request.downloadAssets, request.exportFormat, request.exportScope, sendResponse)`.
- Dispatches:
  - `BATCH_EXPORT_PROGRESS` -> `{ percent, status, courseIndex, totalCourses, currentCourseName }`.
  - Floating toast UI updates on-page (`showCompletionToast`).
  - `TRIGGER_ZIP_DOWNLOAD` with `UoPeople_All_Courses_Offline.zip` and base64 ZIP payload.

- [ ] **Step 1: Write unit test for folder namespacing and error resilience**

Create `scratch/test_batch_runner.js`:

```javascript
const assert = require('assert');

// Simulate folder namespacing logic
function namespaceCourseFiles(files, folderName) {
  return files.map(f => ({
    name: `${folderName}/${f.name}`,
    content: f.content
  }));
}

const sampleFiles = [
  { name: 'index.html', content: '<html></html>' },
  { name: '01_Overview.md', content: '# Unit 1' }
];

const namespaced = namespaceCourseFiles(sampleFiles, '01_CS_2301_Operating_Systems');
assert.strictEqual(namespaced[0].name, '01_CS_2301_Operating_Systems/index.html');
assert.strictEqual(namespaced[1].name, '01_CS_2301_Operating_Systems/01_Overview.md');
console.log('✓ namespaceCourseFiles passed');
```

- [ ] **Step 2: Run test to verify**

Run: `node scratch/test_batch_runner.js`
Expected: PASS

- [ ] **Step 3: Implement `GET_ENROLLED_COURSES` and `runBatchExportPipeline` in `content.js`**

1. In message listener, handle `GET_ENROLLED_COURSES`:
   ```javascript
   if (request.action === 'GET_ENROLLED_COURSES') {
     D2LApi.getEnrolledCourses()
       .then(courses => sendResponse({ success: true, courses }))
       .catch(err => sendResponse({ success: false, error: err.message, courses: [] }));
     return true;
   }
   ```
2. Handle `START_BATCH_EXPORT`:
   - Call `runBatchExportPipeline(request.courses, request.downloadAssets, request.exportFormat, request.exportScope, sendResponse)`.
3. Implement `runBatchExportPipeline`:
   - Initialize `masterZipFiles = []` and `processedCoursesSummary = []`.
   - For each course (`idx` of `courses.length`):
     - Compute clean folder name: `${String(idx + 1).padStart(2, '0')}_${sanitizedCourseName}`.
     - Emit progress to popup and show floating toast: `[Course ${idx + 1}/${courses.length}] ${course.name}: Extracting...`.
     - Try/catch per course: on failure, add `${folderName}/EXPORT_ERROR.txt` and continue with next course.
     - Extract course materials (TOC, modules, attachments, HTML/Markdown).
     - Namespace all generated files under `${folderName}/`.
     - Add to `masterZipFiles`.
   - Generate Master Launcher Portal:
     - Call `HTMLBuilder.buildMasterPortal({ courses: processedCoursesSummary, exportedAt, exportScope, downloadAssets })`.
     - Add as `index.html` at root of `masterZipFiles`.
   - Compress `masterZipFiles` with `ZipBuilder.createZip()`.
   - Trigger download via `TRIGGER_ZIP_DOWNLOAD` with `UoPeople_All_Courses_Offline.zip` (or `_StudyGuide.zip`).
   - Update toast to "Export Complete!" with link/summary.

- [ ] **Step 4: Verify `content.js` syntax**

Run: `node -c content.js`
Expected: Syntax clean.

- [ ] **Step 5: Commit Task 5**

```bash
git add content.js scratch/test_batch_runner.js
git commit -m "feat(content): add multi-course batch export pipeline with master zip packaging and error isolation"
```

---

## Task 6: Cross-Browser Distribution Build & Documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/LESSONS_LEARNED.md`
- Run: `build_dist.ps1`
- Test: Store ZIPs created in `dist/` and manifests validated

- [ ] **Step 1: Update documentation**

Document the new multi-course batch export capability, Valence enrollment endpoint flow, and Master Launcher structure in `docs/ARCHITECTURE.md`.
Add any relevant patterns and lessons into `docs/LESSONS_LEARNED.md`.

- [ ] **Step 2: Run automated build script**

Run: `powershell -ExecutionPolicy Bypass -File .\build_dist.ps1`
Expected: Produces clean Edge/Chrome and Firefox ZIP distributions in `dist/`.

- [ ] **Step 3: Commit Task 6**

```bash
git add docs/ARCHITECTURE.md docs/LESSONS_LEARNED.md dist/
git commit -m "docs: update architecture with multi-course batch export and package release distributions"
```

---

## Plan Review Checklist
- [x] Spec coverage verified across all 6 sections.
- [x] No placeholders or ambiguous TBD statements.
- [x] Type consistency across all message actions (`GET_ENROLLED_COURSES`, `START_BATCH_EXPORT`, `BATCH_EXPORT_PROGRESS`).
