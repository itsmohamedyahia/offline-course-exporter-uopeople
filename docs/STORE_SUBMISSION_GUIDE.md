# 🚀 Web Store Publishing & Submission Reference Guide

This document contains pre-vetted, policy-compliant submission forms, permissions justifications, review notes, and graphic asset specifications for publishing the **Offline Course Exporter for UoPeople** across the **Chrome Web Store**, **Microsoft Edge Add-ons**, and **Mozilla Firefox AMO**.

---

## 🏬 1. Chrome Web Store (CWS) Submission Details

### 📝 Listing Information
* **Item Name:** `Offline Course Exporter for UoPeople`
* **Summary (Short Description, <=132 chars):**  
  `Export UoPeople Brightspace courses into offline interactive HTML study packages or Markdown notes with attachments.`
* **Category:** `Productivity`
* **Language:** `English (United States)`
* **Privacy Policy URL:**  
  `https://github.com/itsmohamedyahia/offline-course-exporter-uopeople/blob/main/PRIVACY.md`
* **Homepage / Support URL:**  
  `https://github.com/itsmohamedyahia/offline-course-exporter-uopeople`

---

### 🇪🇺 EEA Trader Status Declaration
* **Question:** Declare if your publisher account is considered a trader or non-trader with respect to European Economic Area (EEA) consumer protection laws.
* **Selection:** **"This is a non-trader account"**
* **Rationale & Privacy Protection:**
  - The extension is a 100% free, open-source educational utility with zero in-app purchases, paid tiers, or commercial transactions.
  - Under the EU Digital Services Act (DSA), declaring as a "Trader" legally forces Google to publicly display your personal home address and phone number on the Chrome Web Store listing. Selecting "Non-trader" keeps your personal contact information completely private.
  - You can update your declaration anytime in the future if you launch commercial products.

---

### 📦 Chrome Web Store Extension Limit Note
* **Developer Account Quota:** New developer accounts display a starting quota notice (e.g. *You've used 0 of 2 allowed published extensions*).
* **Context:** This is a default anti-spam safety measure implemented by Google for new accounts, not a permanent limitation. You can submit support requests to Google to increase the limit once your account is established.

---

### 🛡️ Privacy & Permission Justifications

#### Single Purpose Description (<=1,000 chars):
> Allows University of the People students to export course learning materials, overviews, reading lists, assignments, and self-quizzes from the Brightspace LMS into offline HTML packages or organized Markdown notes for personal offline study and revision.

#### Permission Justifications:
* **`activeTab`:**  
  > Used to detect the active course OrgUnit ID and title when the user explicitly clicks the extension popup action.
* **`scripting`:**  
  > Used to execute the client-side course parser and export builders (`d2l_api.js`, `html_builder.js`, `markdown_builder.js`) directly in the active tab context.
* **`downloads`:**  
  > Used to save the locally generated course archive ZIP file directly to the user's default browser Downloads directory.
* **`storage`:**  
  > Used to remember the user's export mode preference (Full Personal Archive vs Peer-Safe Study Guide) and attachment download toggle.
* **`host_permissions` (`https://learn.uopeople.edu/*`):**  
  > Required to communicate with the native Brightspace LMS REST APIs (Valence) and retrieve course documents and reading attachments using the student's active authenticated session.

#### Remote Code:
* **Option:** `No, I am not using Remote code`
* **Justification:**  
  > All JavaScript, CSS, icons, KaTeX math parsing, and Prism.js syntax highlighting assets are bundled 100% locally inside the extension package. Zero remote scripts or dynamic code evaluation (eval) are used.

#### Data Collection Disclosures:
* **Checkboxes:** **LEAVE ALL DATA COLLECTION CATEGORIES UNCHECKED.**
* **Certifications:** Certify all three statements (No selling of user data, No unrelated usage, No creditworthiness assessment).

---

### 🧪 Reviewer Test Instructions (<=500 chars limit)

```text
This extension operates 100% client-side on active University of the People Brightspace course pages (https://learn.uopeople.edu). When a logged-in student opens any course page and clicks the extension icon in the toolbar, the popup displays export options (Interactive HTML or Markdown). Clicking either export button reads course content via standard LMS session cookies and packages it into a downloadable ZIP archive. No credentials or external servers are required.
```

---

## 🌐 2. Microsoft Edge Add-ons Store Details

### 🔑 Policy 1.3.1 (Product is Testable) & Certification Notes
When submitting to the Microsoft Edge Partner Center:
* **Does a tester need credentials?** Select **"Yes, I need to provide credentials, accounts, or other info for testers"**. *(Selecting 'No' greys out the explanation field).*
* **Notes for Certification (<=2,000 chars):**

```text
Dear Microsoft Edge Certification Team,

This extension is an offline study packaging utility designed for students enrolled at University of the People accessing their course materials at https://learn.uopeople.edu.

HOW TO TEST:
1. The extension activates when the user navigates to any active course page on https://learn.uopeople.edu.
2. Clicking the extension action icon opens the popup interface displaying export configurations:
   - Export Mode: 'Full Archive (Personal)' or 'Study Guide (Peer-Safe)'
   - Output Options: 'Export Course Website' (HTML) or 'Export Markdown Folders'
   - Toggle: 'Download Attachments & PDFs'
3. Upon clicking an export button, the extension utilizes the user's existing authenticated LMS session cookies to query the native Brightspace Valence API endpoints, compiles the course content into a clean client-side ZIP package, and triggers a download via the browser's Downloads API.

NOTE REGARDING TEST CREDENTIALS:
Because user accounts are bound to enrolled students at University of the People under strict institutional identity verification, external demo login credentials cannot be generated. However, the popup UI, validation, and client logic can be inspected, and the full open-source repository and documentation are publicly available at: https://github.com/itsmohamedyahia/offline-course-exporter-uopeople

Thank you for your review!
```

### 🏷️ Vetted Search Terms (Up to 7 terms, <=21 total words)
1. `uopeople`
2. `brightspace exporter`
3. `course exporter`
4. `uopeople offline`
5. `study guide`
6. `markdown notes`
7. `d2l brightspace`

---

## 🦊 3. Mozilla Firefox Add-ons (AMO) Submission Details

* **Gecko Extension ID:** `uopeople-course-exporter@mohamed-yahia.dev`
* **Categories:** `Download Management`, `Productivity`, `Alerts & Updates`
* **License:** `GNU General Public License v3.0 (GPL-3.0)`
* **Source Code / Build Submission:**
  - **Does this add-on use code generators/minifiers?** Select **"No"**.
  - All source files are plain, readable ES6 JavaScript. The package is assembled by running the included `build_dist.ps1` PowerShell script.

---

## 🎨 4. Graphic Asset Specifications & Dimensions

| Asset | Dimensions | Format | Store Requirement |
| :--- | :---: | :---: | :--- |
| **Store Icon** | `128 x 128 px` | 24-bit PNG | Chrome Web Store / Firefox AMO |
| **Edge Extension Logo** | `300 x 300 px` | 24-bit PNG | Microsoft Edge Partner Center |
| **Small Promo Tile** | `440 x 280 px` | 24-bit PNG (No alpha) | Chrome & Edge Store Listings |
| **Marquee Promo Tile** | `1400 x 560 px` | 24-bit PNG (No alpha) | Chrome & Edge Featured Promotions |
| **Screenshots (1-5)** | `1280 x 800 px` or `640 x 400 px` | 24-bit PNG (No alpha) | All Extension Stores |

> [!TIP]
> Use the Python helper in `screenshots/process_cws_screenshot.py` to auto-crop, scale, and format high-resolution promotional screenshots to exact store dimensions.
