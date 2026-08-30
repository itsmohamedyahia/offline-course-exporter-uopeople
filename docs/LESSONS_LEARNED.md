# 🧠 Lessons Learned & Historical Bug Resolution Log

This document records the historical challenges, edge cases, root cause analyses, and architectural solutions discovered across all development cycles of the **Offline Course Exporter for UoPeople**.

---

## 📋 Comprehensive Bug & Resolution Index

### 1. 🚨 Uncaught SyntaxError / ReferenceError in `html_builder.js`
* **Symptoms:** Extension crashed on export with `Uncaught SyntaxError: Unexpected token 'class'` or `ReferenceError: HTMLBuilder is not defined`.
* **Root Cause:** `html_builder.js` generates the offline website by returning a massive ES6 template literal (`return \`<!DOCTYPE html>...\``). Inside this template, client-side JavaScript code contained unescaped backticks (`` ` ``), template expressions (`${item.title}`), or regex backslashes (`\d+`). These were evaluated at module definition time rather than inside the generated HTML, destroying the module AST.
* **Solution:**
  - All inner backticks in the client script must be escaped as `\``.
  - All inner string interpolations must be written as `\${var}`.
  - All regular expressions must use double-escaped backslashes (e.g. `\\d+`, `\\s+`).
  - Automated syntax verification: Always run `node -c html_builder.js` during builds.

---

### 2. 🎥 Brightspace YouTube Embeds Throwing "Error 153"
* **Symptoms:** Exported HTML iframes displayed `Error 153: Video player configuration error` when attempting to play embedded course lectures.
* **Root Cause:** Brightspace embeds YouTube videos in restricted iframes with strict `Referrer-Policy` headers. When loaded from a local `file://` or offline origin, YouTube blocks playback.
* **Solution:**
  - `d2l_api.js:processHtmlContent()` intercepts all YouTube `<iframe>` elements and regex-extracts the YouTube Video ID.
  - Replaces the broken iframe with a responsive, high-definition thumbnail preview card (`https://img.youtube.com/vi/{videoId}/hqdefault.jpg`) and a direct, styled `Watch on YouTube` red button (`https://www.youtube.com/watch?v={videoId}`).

---

### 3. 📎 Redundant Attachment Downloads Across Units
* **Symptoms:** Every unit folder (`02_Unit_1/assets/`, `03_Unit_2/assets/`, etc.) repeatedly downloaded the same 5MB course syllabus and course overview documents.
* **Root Cause:** D2L Brightspace's Table of Contents (TOC) API includes course-wide introduction documents in multiple sub-module trees.
* **Solution:**
  - Implemented `d2l_api.js:shouldKeepAttachment(title, url)`.
  - Automatically filters out attachments matching syllabus, course policies, or universal overview titles if they belong to subsequent unit modules, restricting them to the course introduction section.

---

### 4. 🌐 Broken Attachment Links When Download Toggle is OFF
* **Symptoms:** When users unchecked "Download Attachments & PDFs", clicking attachment buttons in the exported HTML resulted in broken 404 links to local files.
* **Root Cause:** The export builder unconditionally converted attachment URLs to local relative paths (`href="assets/filename.pdf"`), but the files were never downloaded.
* **Solution:**
  - Passed `downloadAssets` boolean across the entire pipeline (`content.js` $\rightarrow$ `d2l_api.js` $\rightarrow$ `html_builder.js` / `markdown_builder.js`).
  - When `downloadAssets = false`:
    - Retains original live Brightspace HTTPS URLs (`href="https://learn.uopeople.edu/..."`).
    - Renames section header to `🌐 Online Resources & References`.
    - In Markdown: Appends `*(Online Resource)*` to notify the student.

---

### 5. ⚙️ Cross-Browser Manifest V3 Validation Incompatibilities
* **Symptoms:**
  - Microsoft Edge & Chrome Web Store rejected ZIP packages containing `"background": { "scripts": ["background.js"] }` with `Package Validation Errors: The background.scripts field cannot be used with manifest version 3. Use the background.service_worker field instead.`
  - Firefox AMO rejected packages containing `"background": { "service_worker": "background.js" }` without fallback scripts or gecko configuration.
* **Solution:**
  - Engineered `build_dist.ps1` to build two targeted, POSIX-compliant production archives:
    1. `uopeople-course-exporter-v<ver>-edge-chrome.zip`: Strict Chromium MV3 (`service_worker`, no gecko settings).
    2. `uopeople-course-exporter-v<ver>-firefox.zip`: Firefox MV3 (`scripts: ["background.js"]` and `browser_specific_settings.gecko`).

---

### 6. 🛡️ Microsoft Edge Policy 1.3.1 (Product is Testable) Compliance
* **Symptoms:** Microsoft Edge review failed with: `Please provide test account credentials, or a reasonable explanation as to why test credentials cannot be provided...`
* **Root Cause:** Edge testers do not possess active student credentials for `learn.uopeople.edu`.
* **Solution:**
  - Formulated compliant certification notes explaining that the tool is an authenticated browser utility that activates only on active student sessions, provided mock data workflows, and documented the single-purpose architecture.

---

### 7. 🔤 ZIP Header Encoding & Non-ASCII Filename Corruption
* **Symptoms:** Course titles or attachments containing Arabic characters, accents, or special symbols extracted as garbled gibberish (mojibake) on Windows File Explorer.
* **Root Cause:** Default PKZIP headers use IBM Code Page 437 unless the Language Encoding Flag (Bit 11) is set.
* **Solution:**
  - Updated `zip_builder.js` to set Bit 11 (`0x0800`) on all Local File Headers and Central Directory File Headers.

---

### 8. 📴 100% Offline KaTeX Math & Prism.js Syntax Bundling
* **Symptoms:** When studying offline during travel, math formulas (`$...$`) and programming code blocks failed to render or format.
* **Root Cause:** External CDN links (`cdn.jsdelivr.net`, `fonts.googleapis.com`) failed to load when network access was disconnected.
* **Solution:**
  - Inlined minified KaTeX CSS/JS and Prism.js syntax definitions inside `vendor_assets.js`.
  - Injected directly into the generated `index.html`, achieving 100% offline rendering independence.

---

### 9. 🧹 Duplicate Unit Titles & Stray HTML Comments
* **Symptoms:** Unit overviews showed repeated headings like:
  ```text
  Unit 2: Process Management & CPU Scheduling
  UNIT 2: Process Management & CPU Scheduling
  ```
* **Root Cause:** UoPeople Brightspace courseware HTML includes hardcoded `<h2>` title banners inside the topic body that duplicate the LMS module title.
* **Solution:**
  - Created `cleanUnitDescription()` in both `html_builder.js` and `markdown_builder.js`.
  - Uses regex to strip redundant H1-H3 title matches, remove leading `<hr>` dividers, and clean stray `&nbsp;` and `<!-- -->` comment delimiters.

---

### 10. 📜 Unit Tab Navigation Scroll Position Reset
* **Symptoms:** Switching from Unit 1 to Unit 2 while scrolled to the bottom of the page caused Unit 2 to render at the bottom of the screen instead of the top.
* **Root Cause:** The `main` scrolling container maintained its `scrollTop` offset when re-rendering content.
* **Solution:**
  - Added `main.scrollTop = 0;` at the beginning of `renderMain()` in `html_builder.js`.

---

### 11. 🔄 Extension Injection on Previously-Opened Tabs
* **Symptoms:** Clicking the extension popup on a Brightspace tab that was opened *before* loading or updating the unpacked extension resulted in `Could not establish connection. Receiving end does not exist`.
* **Root Cause:** Content scripts declared in `manifest.json` only inject on page navigation or reload.
* **Solution:**
  - In `popup.js:ensureContentScriptInjected()`, added a dynamic injection fallback using `chrome.scripting.executeScript` that injects all builder files in sequence if ping fails.

---

### 12. 🏷️ Negative Margin Clipping on Peer-Safe Banner
* **Symptoms:** The bottom border of the Peer-Safe Study Guide notice box was clipped off when rendered in the HTML site.
* **Root Cause:** Negative margins and parent container `overflow: hidden` collided on subpixel font scaling.
* **Solution:**
  - Created a dedicated `.peer-safe-banner` CSS class with explicit padding and border-box sizing in `html_builder.js`.

---

### 13. ⚡ Client-Side Scoping of `escapeHtml` & Sidebar Event Bubbling
* **Symptoms:** Exported `index.html` showed an empty sidebar unit list and blank main content area on load (`ReferenceError: escapeHtml is not defined`). Checkboxes in sidebar failed to toggle completion.
* **Root Cause:**
  - `escapeHtml` was escaped inside the generated client script (`\${escapeHtml(...)}`) but was not defined in client-side script scope, aborting `renderNav()` on `DOMContentLoaded`.
  - Checkbox clicks bubbled up to parent unit row click handlers rather than toggling completion status.
* **Solution:**
  - Added `escapeHtml(str)` definition directly inside the embedded client-side script block in `html_builder.js`.
  - Added dedicated `stopPropagation` click and keyboard handlers to `.unit-nav-checkbox`.
  - Added `expandedUnits` Set to support toggling and collapsing unit sub-item hierarchies independently.

---

### 14. 📊 Assignment & Discussion Grading Rubrics Extraction & Student Permission Handling
* **Symptoms:** Exported assignment activities and discussions lacked grading evaluation rubrics, showing only text prompts even when Brightspace assignments referenced "the rubric below".
* **Root Cause:**
  - `d2l_api.js` previously only inspected `matchedDropbox.Evaluation.RubricIds`. In modern Brightspace Valence LE APIs, rubrics are attached inside `Assessment.Rubrics` (`RubricId`), `RubricIds`, or `Rubrics`.
  - The Valence collection endpoint `/d2l/api/le/1.30/{orgUnitId}/rubrics/` often returns `403 Forbidden` for student role accounts because students lack course-level "Manage Rubrics" instructor permissions.
  - In some Valence rubric models, `Levels` are defined inside individual `CriteriaGroup.Levels` rather than at the root `rubric.Levels`.
* **Solution:**
  - Implemented `D2LApi.extractRubricIds()` inspecting `Assessment.Rubrics`, `Evaluation.RubricIds`, `Rubrics`, and `RubricId`.
  - Added activity-specific query fallback `/d2l/api/le/{version}/{orgUnitId}/rubrics?objectType=Dropbox&objectId={folderId}` and student LMS view scraping `/d2l/lms/rubrics/rubric_view.d2l?ou={orgUnitId}&rubricId={rubricId}`.
  - Updated `buildRubricHtml()` to support Analytic and Holistic rubrics, fallback to `group.Levels`, render responsive matrix tables with criteria weights, and convert cleanly into GitHub-Flavored Markdown tables.

