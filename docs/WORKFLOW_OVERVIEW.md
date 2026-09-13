# 📖 Workflow & Algorithm Overview
### Offline Course Exporter for UoPeople — Plain-Language Guide

This document explains **what the extension does, step by step**, in plain language — no programming knowledge required.

---

## 🧭 What Does the Extension Do?

When you are logged into your UoPeople Brightspace course, this extension reads all your course materials and packages them into a single downloadable file (a ZIP) that you can open and study **100% offline** — no internet, no login required.

You choose one of two output formats:
- **Interactive Website** — a polished, searchable, dark/light-mode study portal (`index.html`)
- **Markdown Archive** — a set of organized text files for note-taking apps like Obsidian or Notion

---

## 🔄 The Full Workflow — Step by Step

### Step 1 — You Click the Extension Icon
You open your UoPeople course in the browser, then click the extension icon in the toolbar.

A small popup panel appears where you configure two settings:
- **Export Scope** — Full Course (everything) OR Peer-Safe Mode (readings & overviews only, no assignment/quiz questions)
- **Download Attachments** — Yes (save PDFs locally) or No (keep original online links)

You click **Export**.

---

### Step 2 — The Extension Wakes Up the Page
The extension quietly injects itself into your active browser tab (the UoPeople page you already have open).

It reads your settings and begins working in the background. A progress bar appears in the popup so you can track what is happening in real time.

---

### Step 3 — Identifying the Course
Before downloading anything, the extension figures out **which course** you are in by reading the page URL and calling the Brightspace server to get the official course name (e.g., "CS 2301 — Operating Systems").

It also cleans up any noisy prefixes that Brightspace adds to the title (like "Homepage - " or "Table of Contents - ") so the final ZIP file has a clean, readable name.

---

### Step 4 — Mapping the Course Structure
The extension asks Brightspace for the **full Table of Contents** of your course — a complete list of every unit, every topic, and every piece of content inside it.

Think of this like the extension reading the book's index before deciding what to copy.

The result is a structured map:

```
Course
 └── Course Introduction
 └── Unit 1
      ├── Overview
      ├── Reading Assignments
      ├── Discussions
      ├── Assignments
      ├── Quizzes
      └── Conclusion
 └── Unit 2
      └── ...
```

> **Peer-Safe Mode shortcut:** If you chose Peer-Safe Mode, the extension stops here for Discussions, Assignments, and Quizzes — it never even requests them from the server. This saves time and keeps the export clean.

---

### Step 5 — Collecting All Content

For each section in the map, the extension fetches the actual content:

| Section | What Gets Collected |
|---|---|
| **Overview** | The unit description and learning objectives |
| **Readings** | Textbook chapters, article links, and PDF attachments |
| **Discussions** | The discussion prompt and instructions |
| **Assignments** | The assignment instructions and grading rubric |
| **Quizzes / Knowledge Checks** | Your completed quiz attempts with questions, your answers, correct answers, and instructor feedback |
| **Conclusion** | The unit wrap-up content |
| **Attachments** | PDF files linked throughout the unit |

Along the way, the extension also:

- **Cleans up messy HTML** — strips invisible tracking pixels, broken banners, duplicate titles, and junk left behind by the Brightspace platform
- **Fixes YouTube videos** — Brightspace embeds YouTube in a way that breaks offline. The extension converts each video into a clean thumbnail card with a direct "Watch on YouTube" link
- **Filters duplicate files** — The course syllabus and intro documents appear in multiple units on Brightspace. The extension keeps them only once (in the Course Introduction folder)
- **Handles rubrics** — If an assignment has a grading rubric, the extension fetches and formats it into a readable table, even if the standard method is blocked; it falls back to scraping the rubric directly from the page

---

### Step 6 — Assembling the Output

Once all content is collected and cleaned, the extension builds the output file(s).

#### If you chose the Interactive Website format:
A single `index.html` file is built that contains everything — all text, all styling, all interactive features — baked directly in. No internet needed to open it.

Features packed into this one file:
- 🌙 Dark / light theme toggle
- 🔍 Live full-text search across all units (Ctrl+K)
- 📚 Collapsible unit sidebar navigation
- ✅ Study progress checkboxes (saved in your browser)
- 📐 Math formula rendering (e.g., for CS or Math courses)
- 💻 Code syntax highlighting with one-click copy
- 📋 APA citation copier
- ❓ Quiz accordions you can expand/collapse
- ⌨️ Keyboard shortcuts ([ and ] to navigate units, t for theme, f for focus mode)

#### If you chose the Markdown format:
A folder structure is created:

```
01_Course_Introduction/
02_Unit_1_[Title]/
    01_Overview.md
    02_Readings.md
    03_Discussions.md
    04_Assignments.md
    ...
    assets/
03_Unit_2_[Title]/
    ...
README.md                     <- Master reading matrix (all readings in one table)
Master_Course_Complete.md     <- Everything in one giant file (great for AI tools like NotebookLM)
```

---

### Step 7 — Packing the ZIP File
Everything (the HTML file or the Markdown folder tree plus any downloaded PDFs) is packed into a single `.zip` file entirely inside your browser — no data ever leaves your computer to a third-party server.

Special care is taken to ensure filenames with Arabic characters or special symbols extract correctly on Windows, Mac, and Linux.

The ZIP is named cleanly, for example:
```
UoPeople_CS_2301-01_Operating_Systems_-_AY2026-T5_Offline.zip
```

---

### Step 8 — Downloading to Your Computer
The final ZIP is handed off to the browser's built-in download system and saved to your **Downloads** folder automatically.

You are done. Open the ZIP, double-click `index.html`, and your offline course portal is ready.

---

## 🛡️ Peer-Safe Mode — How It Works

When you select **Peer-Safe Mode**, the export is designed to be safely shareable with classmates without violating academic integrity policies.

| Content | Included? |
|---|---|
| Unit Overviews & Learning Objectives | Yes |
| Reading Assignments & Textbook Links | Yes |
| Conclusion Content | Yes |
| Discussion Prompts | No |
| Assignment Instructions | No |
| Quiz Questions & Answers | No |
| Graded Assessment Content | No |

A visible **"Peer-Safe Study Guide"** banner is also shown at the top of the exported website to make the intent clear.

---

## ⚙️ What Happens If Something Goes Wrong?

The extension is designed to be resilient:

- If the main Brightspace API is unavailable or blocked for a section, the extension **falls back to reading the page directly** (just like a human would — it looks at the HTML on screen)
- If you open the popup on a tab that was opened before the extension was installed, the extension **automatically injects itself** without requiring a page reload
- If a file download fails, the extension skips it and keeps going rather than crashing the entire export

---

## 📦 Output Summary

| Setting | Output |
|---|---|
| Full Course + Download Attachments | ZIP with index.html + assets/ PDFs |
| Full Course + No Attachments | ZIP with index.html (all links point online) |
| Peer-Safe + Download Attachments | ZIP with readings-only site + assets/ PDFs |
| Peer-Safe + No Attachments | ZIP with readings-only site (links point online) |
| Markdown Mode | ZIP with structured .md folder tree |

---

*For the technical deep-dive — API endpoints, DOM scraper logic, and module architecture — see [ARCHITECTURE.md](ARCHITECTURE.md).*
