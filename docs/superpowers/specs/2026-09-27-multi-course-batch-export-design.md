# Multi-Course One-Click Batch Export Design Specification

- **Date:** 2026-09-27
- **Target Project:** Offline Course Exporter for UoPeople
- **Component:** Browser Extension (Manifest V3)
- **Status:** Approved for Implementation

---

## 1. Overview & Problem Statement

Currently, the **Offline Course Exporter for UoPeople** requires the user to navigate into a specific course page (e.g. `/d2l/home/{ou}` or `/d2l/le/content/{ou}`) to export that individual course. When opened from a general Brightspace page (such as the portal home `/d2l/home` or `/d2l/lp/...`), single-course detection reports "No Course ID", disabling the export actions.

This specification defines the architecture, data flow, and user interface for **One-Click Multi-Course Batch Export**:
- Enables exporting **all enrolled courses** in one click from **any Brightspace page**.
- Discovers all enrolled courses via the Brightspace Valence LP API (`/d2l/api/lp/1.30/enrollments/myenrollments/`) with robust DOM card fallbacks.
- Packages all selected courses into a **single consolidated Master ZIP archive** with per-course subfolders and a top-level **Master Course Portal Dashboard** (`index.html`).
- Employs resilient progress reporting to both the popup and an on-page floating toast widget on the active tab so exports continue smoothly even if the popup is closed.

---

## 2. Architecture & Component Interaction

```text
┌────────────────────────────────────────────────────────┐
│                      popup.html / popup.js             │
│  - Mode Switcher: [ This Course ] | [ All Courses (N)] │
│  - Enrolled Course Checklist (multi-select)            │
│  - Export Buttons: Full Package / HTML / Markdown      │
└───────────────────────────┬────────────────────────────┘
                            │ chrome.tabs.sendMessage
                            ▼
┌────────────────────────────────────────────────────────┐
│                   content.js (Active Tab)              │
│  - GET_ENROLLED_COURSES handler                        │
│  - START_BATCH_EXPORT orchestrator                     │
│  - Sequential extraction loop (TOC, rubrics, quizzes)  │
│  - On-page toast progress updates                      │
└───────┬───────────────────────────────┬────────────────┘
        │ D2LApi                        │ ZipBuilder / HTMLBuilder
        ▼                               ▼
┌───────────────────────┐       ┌────────────────────────┐
│ Brightspace Valence   │       │ Master ZIP Generation  │
│ REST API & DOM Fallback       │ - Course subfolders    │
└───────────────────────┘       │ - Root index.html      │
                                └───────────┬────────────┘
                                            │ TRIGGER_ZIP_DOWNLOAD
                                            ▼
                                ┌────────────────────────┐
                                │ background.js Worker   │
                                │ chrome.downloads API   │
                                └────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1 Course Discovery (`d2l_api.js`)
- **API Endpoint:** `/d2l/api/lp/1.30/enrollments/myenrollments/?canAccess=true&orgUnitTypeId=3&isActive=true`
- **Fallback Versions:** `1.45`, `1.26`, `1.0` if `1.30` returns non-200.
- **Filter Criteria:**
  - Exclude root institution OrgUnit `6606`.
  - Exclude enrollments where `Access.CanAccess === false`.
  - Deduplicate by `OrgUnit.Id`.
- **DOM Fallback:** When Valence REST API is unavailable, inspect `d2l-enrollment-card`, `.d2l-course-tile`, `.d2l-card`, and `a[href*="/d2l/home/"]`.
- **Title Sanitization:** Apply `D2LApi.cleanCourseName()` to strip Brightspace portal headers, activity prefixes, and system suffixes.

### 3.2 Popup Interface (`popup.html` & `popup.js`)
- **Target Mode Switcher:**
  - Rendered above the course info card:
    - Pill 1: `This Course` (active when `currentCourseId` is detected).
    - Pill 2: `All Courses (N)` (shows count of discovered courses).
  - **Auto-Selection Rule:**
    - On a specific course page (`ou` present): Defaults to `This Course`.
    - On general Brightspace pages (home, grades, account): Defaults automatically to `All Courses (N)`. `This Course` pill is disabled with tooltip "Navigate to a course page to export individually".
- **Course Checklist in All Courses View:**
  - Replaces single course title with a scrollable list of checkboxes.
  - Each item displays: `☑ [Course Code] Course Title`.
  - Includes a "Select All / Deselect All" header toggle.
- **Batch Export Trigger Buttons:**
  - The 3 existing format buttons dynamically change label when in All Courses mode:
    - `Export All Courses (HTML + MD)`
    - `Export All Courses (HTML)`
    - `Export All Courses (Markdown)`
  - Options (Full Personal vs Peer-Safe, Attachments toggle) apply across all selected courses.

### 3.3 Batch Orchestration Pipeline (`content.js`)
- **Action:** `START_BATCH_EXPORT`
- **Payload:** `{ courses, downloadAssets, exportFormat, exportScope }`
- **Sequential Pipeline:**
  1. For each course in `courses`:
     - Emit progress: `[Course X/N] Course Name: Initializing...`
     - Extract TOC via `D2LApi.getTOC(orgUnitId)`.
     - In Full mode, fetch discussion topics, dropbox folders, rubrics, and quizzes.
     - Parse modules via `D2LApi.parseModules()`.
     - Download attachments into that course's asset folder if `downloadAssets` is true.
     - Generate HTML and/or Markdown files namespaced under `[Sanitized_Course_Folder]/`.
     - Catch & isolate course-level errors: if one course fails, write `EXPORT_ERROR.txt` in that folder and proceed to subsequent courses.
  2. Generate Root Master Portal (`index.html`):
     - A dark-mode dashboard styled consistently with `vendor_assets.js` and `html_builder.js`.
     - Displays cards for all exported courses with direct relative links (`./[Course_Folder]/index.html`), unit counts, and generation timestamp.
  3. Pack into single ZIP archive via `ZipBuilder.createZip()`.
  4. Dispatch `TRIGGER_ZIP_DOWNLOAD` with filename `UoPeople_All_Courses_Offline.zip` (or `UoPeople_All_Courses_StudyGuide.zip`).

### 3.4 Progress Feedback & Toast Notifications
- **Popup:** Updates progress bar with overall percentage across all courses:
  `overallPct = (cIdx / totalCourses) * 100 + (courseInternalPct / totalCourses)`.
- **On-Page Toast (`showCompletionToast`):** Floats at bottom-right of Brightspace page. Shows `[Course X/N] Course Code: Step description`. Persists across popup closures.

---

## 4. Master ZIP File Layout

```text
UoPeople_All_Courses_Offline.zip
│
├── index.html                                 # Master Dashboard Portal
│
├── 01_CS_2301_Operating_Systems/
│   ├── index.html                             # Interactive course app
│   ├── 01_Overview.md                         # Markdown documents
│   ├── 02_Readings.md
│   ├── 03_Discussions.md
│   ├── 04_Assignments.md
│   ├── 05_Knowledge_Checks.md
│   ├── 06_Self_Quizzes.md
│   ├── 07_Assessment.md
│   ├── 08_Conclusion.md
│   ├── Master_Course_Complete.md
│   ├── course_metadata.json
│   └── 01_Unit_1_Processes/assets/            # Per-unit assets
│
└── 02_MATH_1201_College_Algebra/
    ├── index.html
    ├── ...
    └── assets/
```

---

## 5. Error Handling & Edge Cases

| Edge Case | Mitigation |
|---|---|
| No courses returned by Valence API | Fall back to scraping course cards on `/d2l/home`. If still empty, display actionable message to open `/d2l/home`. |
| One course in batch fails (e.g. 403 or empty TOC) | Catch error per course, log `EXPORT_ERROR.txt` in that course's directory, and continue batch. |
| Popup closed during batch export | Batch runner runs in `content.js` tab context with floating on-page toast. Download triggers automatically when done. |
| Non-OER textbooks / large files | Attachment toggle (`downloadAssets`) allows skipping asset downloads; external links are preserved. |
| Peer-Safe mode selected | Strips discussion prompts, assignments, and quizzes across all courses in the batch. |

---

## 6. Verification & Testing Criteria
1. **General Brightspace Page Test:** Open `https://learn.uopeople.edu/d2l/home` -> popup should automatically switch to All Courses mode and show enrolled courses list.
2. **Specific Course Page Test:** Open a specific course -> popup defaults to This Course, but shows `[ All Courses (N) ]` tab option.
3. **One-Click Batch Export Test:** Click `Export All Courses (HTML + MD)` -> verifies sequential processing, on-page toast updates, and output of a single Master ZIP containing root `index.html` and course subfolders.
4. **Build Distribution Test:** Run `build_dist.ps1` to ensure package bundles cleanly for Chrome/Edge and Firefox without syntax errors.
