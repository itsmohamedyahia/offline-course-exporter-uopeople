# 🎓 AGENTS.md — Offline Course Exporter for UoPeople

This document is the **single canonical source of truth** and engineering guide for AI agents and developers working on the **Offline Course Exporter for UoPeople** browser extension.

---

## 🧭 Project Purpose & Philosophy

This project is a **Manifest V3 browser extension** designed for University of the People (UoPeople) students. It connects to the Brightspace (D2L) LMS at `https://learn.uopeople.edu` and exports course materials into:
1. **Interactive Offline Website (`index.html` + `assets/`)**: A modern, self-contained single-page application with dark/light themes, live full-text search, offline KaTeX math rendering, Prism code syntax highlighting, collapsible quiz accordions, interactive document preview modal, APA citation copier, reading time estimator, study progress tracker, keyboard shortcuts, and sticky section navigation.
2. **Modular Markdown Archive (`01_Overview.md`, `02_Readings.md`, etc.)**: Structured folders matching academic note-taking standards (Obsidian, Logseq, Notion) with a master reading matrix and unified course companion file (`Master_Course_Complete.md`).

### Fundamental Architectural Tenets
- **100% Client-Side & Zero-Telemetry:** All requests execute directly inside the user's authenticated browser session sandbox. No external servers, no third-party CDNs at runtime, and zero data collection.
- **Academic Integrity Compliance:** Provides a **Peer-Safe Study Guide** mode that automatically strips cohort-based discussion questions, assignment prompts, and quiz banks so students can safely share course reading lists with peers.
- **Copyright Safe (Non-OER Advisory):** Allows toggling attachment downloads off so non-OER / copyrighted textbooks are never redistributed illegally (links default to university portal lookup).

---

## 🗂️ File & Component Structure

```text
uopeople-brightspace-course-export/
├── manifest.json            # Base Manifest V3 configuration (Universal / dev-load)
├── background.js           # MV3 background service worker (downloads coordinator)
├── content.js              # Content script entry point & export pipeline runner
├── d2l_api.js              # Brightspace Valence REST API client & DOM fallback scraper
├── html_builder.js         # Single-page offline HTML application generator
├── markdown_builder.js     # Structured Markdown files generator
├── vendor_assets.js        # 100% offline bundled KaTeX (math) & Prism.js (syntax)
├── zip_builder.js          # Pure JS ZIP packager with UTF-8 support (Bit 11)
├── popup.html              # Extension popup UI (modern, minimalist dark-slate/plum)
├── popup.css               # Popup styling, micro-animations, custom scrollbars
├── popup.js                # Popup event handlers, status listeners, settings persistence
├── build_dist.ps1          # Cross-browser build script (creates Edge/Chrome & Firefox ZIPs)
├── docs/                   # Deep technical documentation & store references
│   ├── ARCHITECTURE.md     # Detailed data flow, API endpoints, and DOM scrapers
│   ├── LESSONS_LEARNED.md  # Comprehensive bug histories, root causes & fixes
│   └── STORE_SUBMISSION_GUIDE.md # Pre-vetted store answers, permissions & certifications
├── icons/                  # 16x16, 48x48, 128x128, 300x300 extension branding icons
└── screenshots/            # Store promo tiles (1280x800, 640x400, 440x280)
```

---

## ⚡ Golden Engineering Rules for Agents

### 1. ⚠️ Template Literal Escaping in `html_builder.js`
`html_builder.js` constructs a complete HTML file containing embedded client-side JavaScript wrapped inside a large ES6 template literal.
* **CRITICAL:** Any nested template literals (`` ` ``), template placeholders (`${...}`), or regex backslashes (`\d+`) inside the generated client script **MUST be escaped** (e.g. `\${`, `\``, `\\d+`).
* **Failure Mode:** Forgetting to escape inner backticks immediately causes a fatal `SyntaxError: Unexpected token` or `ReferenceError: HTMLBuilder is not defined` when the content script is loaded.
* **Rule:** Always test syntax parsing (`node -c html_builder.js`) before completing any edit.

### 2. 📑 Strict Section & Topic Ordering
When processing course units in both `html_builder.js` and `markdown_builder.js`, adhere to the standard academic sequence:
1. **Overview** (`01_Overview.md` / `#overview`)
2. **Reading Assignments** (`02_Readings.md` / `#readings`)
3. **Discussions** (`03_Discussions.md` / `#discussions`) — *Omitted in Peer-Safe Mode*
4. **Assignment Activity** (`04_Assignments.md` / `#assignments`) — *Omitted in Peer-Safe Mode*
5. **Knowledge Checks** (`05_Knowledge_Checks.md` / `#knowledge-checks`) — *Omitted in Peer-Safe Mode*
6. **Self-Quizzes** (`06_Self_Quizzes.md` / `#self-quizzes`) — *Omitted in Peer-Safe Mode*
7. **Assessment Section** (`07_Assessment.md` / `#assessment`) — *Formerly Graded Quiz; Omitted in Peer-Safe Mode*
8. **Conclusion** (`08_Conclusion.md` / `#conclusion`)
9. **Attachments & Files** (`assets/` / `#attachments`)

> [!NOTE]
> **No Learning Journals:** UoPeople removed Learning Journals from the curriculum. All references to Learning Journals must remain omitted/skipped.

### 3. 🚀 Early Crawler Filtering in Peer-Safe Mode
* When `exportScope === 'shareable'`, `d2l_api.js:parseModules()` skips querying discussion forums, assignments, and quiz attempts at the crawler stage, avoiding wasted network calls and emitting accurate progress messages (`Extracting unit overviews & reading assignments...`).

### 4. 🧹 Course Title Sanitization (`cleanCourseName`)
* Brightspace page titles contain noisy page prefixes (e.g., `Homepage - `, `Course Home - `, `Table of Contents - `, `Assignment Activity ... - `, `Learning Guide ... - `, `Unit X - `).
* `d2l_api.js`, `popup.js`, and `background.js` use `cleanCourseName()` regex to strip these prefixes, ensuring ZIP packages and UI headers reflect only the clean course code and title (e.g., `UoPeople_CS_2301-01_Operating_Systems_-_AY2026-T5_Offline.zip`).

### 5. 🎥 YouTube Embeds & Error 153 Fix
Brightspace embeds YouTube videos in restrictive iframes with referrer restrictions, causing YouTube to display `Error 153: Video player configuration error`.
* **Fix:** `d2l_api.js` converts embedded YouTube iframes into responsive thumbnail cards featuring the video title, high-res poster image (`img.youtube.com/vi/{id}/hqdefault.jpg`), and a direct red `Watch on YouTube` button (`https://www.youtube.com/watch?v={id}`).

### 6. 📎 Redundant Attachment Filtering
* Syllabus documents, Course Overview PDFs, and universal intro files must **only** be saved in `01_Course_Introduction/assets/` (or the top-level introduction).
* `d2l_api.js:shouldKeepAttachment()` automatically filters out duplicate syllabus/overview attachments from appearing redundantly across Units 1 through 8.

### 7. 🌐 Attachment Download Toggle Handling (`downloadAssets`)
* When user unchecks **"Download Attachments & PDFs"** (`downloadAssets = false`):
  - Do **not** generate broken local relative links (`href="assets/file.pdf"`).
  - Instead, link directly to the online Brightspace URL (`href="https://learn.uopeople.edu/..."`), and label the section `🌐 Online Resources & References`.
  - In Markdown export, render: `* [File Name](https://learn.uopeople.edu/...) *(Online Resource)*`.

### 8. 📦 ZIP Encoding & UTF-8 Header Flag
* `zip_builder.js` must set General Purpose Bit Flag Bit 11 (`0x0800`) on all Local File Headers and Central Directory Headers. This ensures UTF-8 filenames (Arabic characters, special accents) extract cleanly across all operating systems without mojibake.

### 9. 🎨 UI & Palette Standards
* **Popup Theme:** Stealthy dark-slate titanium (`#0f172a`, `#1e293b`), deep plum/wine accents (`#581c87`, `#3b1c32`), electric indigo (`#6366f1`), and coral rose (`#f43f5e`).
* **Header/Footer Standard Links:**
  - Help & Feedback: `mailto:reachmyk@gmail.com`
  - LinkedIn: `https://www.linkedin.com/in/myahiakhidr/`
  - GitHub Repository: `https://github.com/itsmohamedyahia/offline-course-exporter-uopeople`
  - Support/Donate: `https://ko-fi.com/myahiakhidr`

---

## 🛠️ Multi-Browser Packaging & Release Protocol

Because Chrome/Edge and Firefox have conflicting Manifest V3 requirements:
- **Chrome & Edge:** Require `"background": { "service_worker": "background.js" }`. Reject `"scripts"`.
- **Firefox AMO:** Requires `"background": { "scripts": ["background.js"] }` or specific `browser_specific_settings.gecko`.

### Automated Build Script:
Always run the automated build script to generate store-ready ZIPs:
```powershell
powershell -ExecutionPolicy Bypass -File .\build_dist.ps1
```
This produces:
- `dist/uopeople-course-exporter-v<VERSION>-edge-chrome.zip`
- `dist/uopeople-course-exporter-v<VERSION>-firefox.zip`

---

## 📚 Related Documentation Links

- Detailed Architecture & API Flow: [ARCHITECTURE.md](file:///s:/02_PROJECTS_CODE/code%20projects%20mine/uopeople-brightspace-course-export/docs/ARCHITECTURE.md)
- Historical Bugs & Root Cause Analyses: [LESSONS_LEARNED.md](file:///s:/02_PROJECTS_CODE/code%20projects%20mine/uopeople-brightspace-course-export/docs/LESSONS_LEARNED.md)
- Web Store Submission Guide & Answers: [STORE_SUBMISSION_GUIDE.md](file:///s:/02_PROJECTS_CODE/code%20projects%20mine/uopeople-brightspace-course-export/docs/STORE_SUBMISSION_GUIDE.md)
- Privacy Policy: [PRIVACY.md](file:///s:/02_PROJECTS_CODE/code%20projects%20mine/uopeople-brightspace-course-export/PRIVACY.md)
