# 🎓 Offline Course Exporter for UoPeople

A modern Manifest V3 browser extension designed for University of the People students to export course materials into an offline, interactive HTML website or an organized Markdown directory structure with downloadable attachments for personal offline study.

---

## ⚖️ Legal, Academic Integrity & Non-Affiliation Disclaimer

> [!IMPORTANT]
> **Non-Affiliation Notice:** This project is an independent, unofficial, student-created open-source utility. It is **not** affiliated with, endorsed by, sponsored by, or connected to **University of the People (UoPeople)** or **D2L Corporation (Brightspace)**. All trademarks and brand names belong to their respective owners.

> [!NOTE]
> **Academic Integrity & Sharing Guidelines:**
> - **Personal Full Archive Mode:** Backs up all course components (syllabus, readings, discussions, assignments, self-quizzes) for your own personal revision and study.
> - **Peer-Safe Study Guide Mode:** Exports only the syllabus, unit overviews, and reading assignment lists while automatically stripping all graded discussion prompts, written assignments, learning journals, and quiz question banks. This mode is 100% compliant with university policies to share with prospective students preparing for upcoming courses.

> [!WARNING]
> **⚠️ Copyright Advisory for Sharing (Non-OER Textbooks):**
> If your course uses **proprietary, copyrighted textbooks or non-OER reading PDFs**, you should **UNCHECK "Download Attachments & PDFs"** before exporting for a peer. This ensures the exported study guide contains only the syllabus citations, reading guides, chapter pointers, and official UoPeople LIRN library lookup instructions, without illegally redistributing copyrighted PDF files. Students can then access the books legally via their own university library portal.

---

## ✨ Key Features

- 📌 **Universal Course Detection**: Automatically detects course OrgUnit IDs and course titles from **any** Brightspace page (e.g. course homepage, syllabus, or specific lesson/unit URLs).
- 🛡️ **Flexible Export Scopes**:
  - 🔒 **Full Course Archive (Personal)**: Complete archive including syllabus, readings, discussions, assignments, and practice quizzes.
  - 👥 **Shareable Study Guide (Peer-Safe)**: Curated syllabus, unit learning goals, and reading lists only. Excludes graded evaluation prompts and quizzes for safe peer sharing.
- 📦 **Dual Output Formats**:
  1. **Interactive HTML Website**: Single-page interactive web application with instant search, dark/light mode toggle, `@media print` PDF support, and collapsible quiz browsers.
  2. **Markdown Folders Export**: Modular unit folders (`01_Overview.md`, `02_Readings.md`, etc.) formatted for Obsidian, Logseq, Notion, or local note systems.
- 📁 **Attachment Offloading**: Downloads PDFs, textbooks, syllabus documents, and supplementary files directly into a dedicated `assets/` directory and re-links them locally.
- 🔒 **Privacy-First Architecture**: Runs 100% locally in your browser using active session cookies. Zero telemetry, zero external servers, and zero data tracking.

---

## 🚀 Installation Guide

### Option 1: Clone with Git
1. Clone this repository to your local computer:
   ```bash
   git clone https://github.com/itsmohamedyahia/offline-course-exporter-uopeople.git
   ```

### Option 2: Download ZIP
1. Click **Code** > **Download ZIP** on GitHub and extract the folder to a convenient location on your computer.

### Loading into Your Browser
1. Open **Google Chrome**, **Microsoft Edge**, or **Brave Browser**.
2. Navigate to `chrome://extensions` (or `edge://extensions`).
3. Toggle **Developer mode** **ON** (top right corner).
4. Click **Load unpacked** (top left corner).
5. Select the root folder of this project (the folder containing `manifest.json`).

---

## 📖 How to Use

1. Log into your UoPeople Brightspace account at [https://learn.uopeople.edu](https://learn.uopeople.edu).
2. Open any page within the course you want to export.
3. Click the **Offline Course Exporter for UoPeople** extension icon in your browser toolbar.
4. Select your **Export Mode**:
   - 🔒 **Full Archive (Personal)**: Includes all syllabus, readings, discussions, assignments, and quizzes.
   - 👥 **Study Guide (Peer-Safe)**: Includes syllabus and reading lists only (safe to share with fellow students).
5. Choose your output format:
   - **Export Course Website**: Generates a self-contained offline website (`index.html` + `assets/`).
   - **Export Markdown Folders**: Generates an organized ZIP archive containing modular Markdown files by unit.
   - *(Optional)* **Toggle Attachments:** Leave "Download Attachments & PDFs" **unchecked** if you wish to export a pure, lightweight text-and-link guide without downloading any proprietary PDF files.
6. The archive will download automatically to your default browser Downloads directory.

---

## 📂 Exported Folder Structures

### HTML Export (`Export Course Website`)
```
Downloads/
└── UoPeople_<Course_Code>_Offline.zip (or _StudyGuide_Offline.zip)
    ├── index.html           <-- Interactive offline website
    └── assets/              <-- Downloaded PDFs, readings, and attachments
        ├── Textbook_Ch1.pdf
        └── Syllabus.pdf
```

### Markdown Export (`Export Markdown Folders`)
```
Downloads/
└── UoPeople_<Course_Code>_Markdown_Offline.zip (or _StudyGuide_Markdown.zip)
    ├── README.md
    ├── 01_Course_Introduction/
    │   └── 01_Overview.md
    ├── 02_Unit_1_Introduction/
    │   ├── 01_Overview.md
    │   ├── 02_Readings.md
    │   ├── 03_Discussions.md     <-- (Omitted in Peer-Safe Mode)
    │   ├── 04_Assignments.md     <-- (Omitted in Peer-Safe Mode)
    │   ├── 06_Self_Quizzes.md    <-- (Omitted in Peer-Safe Mode)
    │   └── assets/
    └── ...
```

---

## 🔒 Privacy & Security

- **100% Client-Side Processing**: All API requests and file formatting occur directly inside your browser session sandbox.
- **Zero Data Collection**: No cookies, passwords, telemetry, or user analytics are ever collected or sent to external servers.
- Read our full [Privacy Policy](PRIVACY.md).

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)** — a strong copyleft license that guarantees the software remains free and open-source. Any modifications or derivative works must also be open-sourced under the GPL-3.0. See the [LICENSE](LICENSE) file for full details.
