# 🎓 UoPeople Brightspace Offline Course Exporter

A modern Manifest V3 browser extension designed for University of the People students to export course materials into an offline, interactive HTML website or an organized Markdown directory structure with downloadable attachments.

---

## ✨ Key Features

- 📌 **Universal Course Detection**: Automatically detects course OrgUnit IDs and course titles from **any** Brightspace page (e.g. course homepage, syllabus, or specific lesson/unit URLs).
- 📦 **Dual Export Modes**:
  1. **Interactive HTML Website**: Complete single-page interactive application featuring an instant search filter across all units, light/dark mode switcher, `@media print` optimized styling for printing units to PDF, and an interactive quiz browser.
  2. **Markdown Folders Export**: Structured unit folders (`Unit 1/`, `Unit 2/`, etc.) containing clean Markdown files (`overview.md`, `reading-assignments.md`, `discussion-assignment.md`, `written-assignment.md`, `learning-journal.md`, `self-quiz.md`) formatted for Obsidian, Logseq, Notion, or local study notes.
- 📁 **Attachment & Asset Offloading**: Downloads PDFs, textbooks, syllabus documents, and supplementary files directly into a dedicated `assets/` directory and updates all links locally.
- 🔒 **Privacy-First Architecture**: Runs 100% locally in your browser using active session cookies. No external analytics, tracking, or remote servers.

---

## 🚀 Installation Guide

### Option 1: Clone with Git
1. Clone this repository to your local computer:
   ```bash
   git clone https://github.com/<your-username>/uopeople-brightspace-course-export.git
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
3. Click the **UoPeople Course Exporter** extension icon in your browser toolbar.
4. The extension popup will verify your active course tab and display the detected course title.
5. Choose your export format:
   - **Export Course Website**: Generates a self-contained offline website (`index.html` + `assets/`).
   - **Export Markdown Folders**: Generates an organized ZIP archive containing modular Markdown files by unit.
6. The files will download automatically to your default browser Downloads directory.

---

## 📂 Exported Folder Structures

### HTML Export (`Export Course Website`)
```
Downloads/
└── UoPeople_<Course_Code>_Offline/
    ├── index.html           <-- Interactive offline website
    └── assets/              <-- Downloaded PDFs, readings, and attachments
        ├── Textbook_Ch1.pdf
        └── Syllabus.pdf
```

### Markdown Export (`Export Markdown Folders`)
```
Downloads/
└── UoPeople_<Course_Code>_Markdown.zip
    ├── Course-Overview/
    │   └── syllabus.md
    ├── Unit-01/
    │   ├── overview.md
    │   ├── reading-assignments.md
    │   ├── discussion-assignment.md
    │   └── self-quiz.md
    ├── Unit-02/
    │   └── ...
    └── assets/
        └── Unit1_Reading.pdf
```

---

## 🔒 Privacy & Security

- **Local Execution**: All API requests and file formatting occur client-side within your browser session.
- **Academic Integrity**: Quiz questions are formatted for personal revision and study preservation without compromising exam delivery systems.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)** — a strong copyleft license that guarantees the software remains free and open-source. Any modifications or derivative works must also be open-sourced under the GPL-3.0. See the [LICENSE](LICENSE) file for full details.
