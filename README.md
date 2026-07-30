# 🎓 UoPeople Brightspace Offline Course Exporter

A Manifest V3 browser extension designed for University of the People students to export course materials into an offline, interactive HTML website with downloadable attachments.

---

## ✨ Features

- 📌 **Universal Course Detection**: Initiates export from **any** page within a course (e.g. `https://learn.uopeople.edu/d2l/home/8437` or `https://learn.uopeople.edu/d2l/le/lessons/8437/units/90688`).
- 📖 **Complete Module Coverage**:
  - Course Overview & Syllabus
  - Unit-by-Unit Overviews (Unit 1 to Unit 8)
  - Reading Assignments
  - Discussion Forum Prompts
  - Written Assignments
  - Graded Quiz / Assessment Mentions
- 📁 **Attachment Offloading**: Downloads PDFs and attachments into a dedicated `assets/` subfolder, linked directly within the offline HTML site.
- 🎨 **Modern Interactive UI**:
  - Interactive Unit Selector & Sidebar
  - Instant Search Filter across all units and topics
  - Light & Dark Mode Toggle
  - `@media print` optimized CSS for printing units to PDF

---

## 🚀 Installation Guide

1. Download or clone this repository to your local computer:
   `s:\02_PROJECTS_CODE\code projects mine\uopeople-brightspace-course-export`
2. Open **Google Chrome**, **Microsoft Edge**, or **Brave Browser**.
3. Navigate to `chrome://extensions` (or `edge://extensions`).
4. Toggle **Developer mode** ON (top right corner).
5. Click **Load unpacked** (top left corner).
6. Select the folder:
   `s:\02_PROJECTS_CODE\code projects mine\uopeople-brightspace-course-export`

---

## 📖 How to Use

1. Log into your UoPeople Brightspace account at [https://learn.uopeople.edu](https://learn.uopeople.edu).
2. Open any course page (homepage, unit page, syllabus, or lesson view).
3. Click the **UoPeople Course Exporter** extension icon in your browser toolbar.
4. The popup will automatically detect your course title and OrgUnit ID.
5. Click **Export Course Website**.
6. The extension will fetch the Table of Contents and download an offline package to your default Downloads folder:
   ```
   Downloads/
   └── UoPeople_CS_3340_Offline/
       ├── index.html           <-- Open this in any web browser!
       └── assets/
           ├── Textbook_Ch1.pdf
           └── Unit2_Reading.pdf
   ```

---

## 🔒 Privacy & Security

- **Runs 100% locally in your browser**: Uses your existing logged-in Brightspace session cookies.
- No third-party servers or external tracking.
- Quiz questions are logged as metadata mentions only to respect assessment security.
