# The Story Behind Offline Course Exporter for UoPeople
### *Solving Syllabus Gaps, Offline Study, and High-Yield AI Exam Prep*

---

**TL;DR:** I built a free, open-source browser extension called **Offline Course Exporter for UoPeople** (available on the Chrome, Firefox, and Edge web stores). It lets you export any Brightspace course in one click into either a standalone, interactive offline website or an organized Markdown folder. It includes a "Peer-Safe" mode (syllabus + reading lists only) to help peers evaluate upcoming courses without violating academic integrity, and a "Full Archive" mode to keep your assignments, discussion prompts, and learning guides for offline study.

---

Hello everyone,

I was registering for courses the previous term, and I had one course left to register for. I was conflicted between two courses. So I looked up the Syllabus Repository, and while I gained some information about what each course included, one of the syllabi didn't mention the textbook or any sources that would be read/studied during the course. At that time, looking at the learning guides of that course would have given me valuable information to assess which course would be more useful and provide a better learning opportunity. However, it would have been a somewhat large ask to make a peer tell me what's in each learning guide/unit readings. And so, I decided to make an extension that would, by one click, extract all learning guides of a course into an html file.

While working on the extension, I discovered a second usecase, arguably more important than the one I have just discussed, for this program. To study the course well and prepare for exams, I ask AI to generate questions (mostly MCQ) on the readings text. However, after a while of using this method, I discovered quickly, especially when I am under a time constraint, that generating questions on the readings text introduce low-yield questions or questions on low-level concepts that have a low probability of appearing on the exam. I could just adjust the prompt to get the high-yield questions I want, but I could also ask it to generate questions based on the learning guide. This focuses the questions on the high-level concepts, and is probably the source that the exam/quiz setter use when writing the questions (since reading materials are usually very long). And thus, having the learning guides offline with one click and then asking an AI agent to generate questions based on the learning guide(s) proved to be very useful.

From that, I figured out that exporting other course data such as prompts of discussion forums and assignment activities and quiz attempts would be useful too since I won't have to open Brightspace, click on multiple links just to know what I have to write for my assignment this week. It would also be useful for those who get power/internet outages in their countries.

I ended up making the **Offline Course Exporter for UoPeople** extension.

---

### What the extension does & main features:

**Two Export Scopes:**
* 👥 **Peer-Safe Study Guide:** Exports only the syllabus, unit overviews, and reading assignment lists. It automatically strips all graded discussion questions, written assignment prompts, and quiz banks. This directly solves the problem I had: peers can safely share their reading lists and learning guides with you ahead of registration without any academic integrity concerns.
* 🔒 **Full Course Archive (Personal):** Backs up everything (syllabus, learning guides, readings, discussion forum prompts, assignment prompts, and self-quizzes) for your own offline study.
  * *NOTE:* There is some functionality built for exporting quizzes, but I am kinda sure it doesn't work at the moment. Maybe I will work on a fix. Maybe not 😅, I didn't have much need for it, so I didn't bother fixing it. You are welcome to make a pull request for a fix though.

**Two Output Formats:**
* 🌐 **Interactive Offline Website (`index.html`):** A single self-contained web app that works without internet. It has instant full-text search, dark/light theme, KaTeX math formula rendering, code syntax highlighting, and collapsible quiz browsers.
* 📝 **Modular Markdown Notes:** Clean unit folders (`01_Overview.md`, `02_Readings.md`, etc.) formatted out-of-the-box for note apps like **Obsidian**, **Logseq**, or **Notion**.

**Optional Attachment Downloader:**
* You can choose whether to download course PDFs and attachments into an `assets/` folder, or leave it unchecked if you just want a lightweight guide with direct links to the university library lookup.

**100% Client-Side & Private:**
* Everything runs directly inside your own browser using your active session. There are no external servers, no telemetry, and zero data collection.
* **Safe API Integration:** Uses Brightspace’s native client-side Valence REST APIs (`/d2l/api/`) within your active login session. It only reads what your student account already has permission to view.
* The code is [publicly shared on GitHub](https://github.com/itsmohamedyahia/offline-course-exporter-uopeople).

---

### 📦 Where to get it:

It is published and verified on all official extension stores:

* 🌐 **Chrome Web Store (Chrome, Brave, Opera):** [Offline Course Exporter for UoPeople](https://chromewebstore.google.com/detail/offline-course-exporter-f/lpglgahkacibnflhbibibaefdhgobhoh?authuser=0&hl=en)
* 🦊 **Firefox Add-ons:** [Offline Course Exporter for UoPeople](https://addons.mozilla.org/en-US/firefox/addon/course-exporter-for-uopeople/)
* 🌊 **Microsoft Edge Add-ons:** [Offline Course Exporter for UoPeople](https://microsoftedge.microsoft.com/addons/detail/offline-course-exporter-f/oiacomfdegoplpljjhlemiakobjggopl)
* 💻 **Open-Source Code:** [GitHub Repository (GPL-3.0)](https://github.com/itsmohamedyahia/offline-course-exporter-uopeople)

---

### 🚀 How to use it:
1. Install it from your browser's store above.
2. Log into Brightspace and navigate to any page inside your course.
3. Click the extension icon in your toolbar, choose your preferred export mode, and hit export!

---

⚖️ **A quick note on academic integrity, permissions & non-affiliation:**
* **Non-Affiliation:** This is an independent, unofficial, open-source student utility and is not affiliated with, endorsed by, or connected to University of the People or D2L Brightspace.
* **No Special Access or Bypasses:** The extension cannot access anything you don't already have permission to see. Everything it exports could be copied and pasted manually by hand — the extension simply automates that repetitive clicking and formats it for offline studying.
* **Responsible Use:** 
  * The **Full Archive** mode is intended strictly for your own private, personal revision.
  * If you wish to share a course overview or reading list with a peer preparing for an upcoming term, please use the **Peer-Safe Study Guide** mode (and uncheck attachment downloads if needed) so graded evaluation materials and copyrighted PDFs are never redistributed.
* **Disclaimer:** This tool is provided as-is for personal study and note organization. Users are responsible for how they use exported files and for complying with university policies and copyright laws.

---

I hope this helps anyone who wants to prepare for courses in advance, study offline, or keep clean notes for AI-assisted study workflows. Feel free to share feedback, report any bugs, or suggest new features!
