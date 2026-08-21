# Privacy Policy

**Effective Date:** August 21, 2026  
**Last Updated:** August 21, 2026  
**Extension Name:** Offline Course Exporter for UoPeople  

---

## 1. Overview & Commitment

**Offline Course Exporter for UoPeople** ("the Extension") is an unofficial, open-source browser extension designed solely to help enrolled students export course materials from the University of the People D2L Brightspace Learning Management System (`learn.uopeople.edu`) for personal offline study.

We believe that your educational data, login credentials, and course access belong entirely to you. **The Extension does not collect, track, transmit, monetize, or share any personal information, browsing history, or user data of any kind.**

---

## 2. Information We Do NOT Collect

- ❌ **No Personal Identifiers:** We do not collect names, email addresses, student IDs, phone numbers, or IP addresses.
- ❌ **No Credentials or Passwords:** The Extension never accesses or stores your passwords, login credentials, or authentication tokens.
- ❌ **No External Transmission / Telemetry:** The Extension contains zero remote tracking scripts, zero Google Analytics, zero telemetry SDKs, and zero calls to third-party servers. All data processing occurs 100% locally in your browser sandbox.
- ❌ **No Cloud Storage:** No course content or user preferences are uploaded to external databases or cloud servers.

---

## 3. How the Extension Uses Data Locally

When you click **Export Course Website** or **Export Markdown Folders**, the Extension performs the following operations entirely on your local machine:

1. **Course Data Extraction:** Reads course content (such as unit overviews, reading assignments, discussion prompts, and attachments) from the active Brightspace tab using your existing, authenticated browser session cookies.
2. **Local Transformation:** Converts the retrieved data into a client-side HTML website or Markdown document structure directly in browser memory.
3. **Local File Download:** Triggers the native browser download manager to save the generated file (`index.html` or `.zip`) directly into your local machine's `Downloads/` directory.

---

## 4. Browser Permissions & Justification

In compliance with Google Chrome Web Store and Microsoft Edge Add-ons developer policies, the Extension requests only the minimum necessary permissions required to deliver its core functionality:

| Permission | Justification / Technical Purpose |
| :--- | :--- |
| `activeTab` | Detects whether the active tab is an active UoPeople Brightspace course page upon user interaction. |
| `scripting` | Executes the content extraction scripts in the context of the active course tab when you click export. |
| `downloads` | Saves the generated offline HTML package or Markdown ZIP archive and associated asset PDFs directly to your computer's `Downloads` folder. |
| `storage` | Stores your local export preferences (such as the "Download Attachments & PDFs" toggle) in your browser's local storage. |
| `host_permissions` (`https://learn.uopeople.edu/*`) | Restricts script injection and network requests strictly to the official UoPeople Brightspace domain. No other websites are accessible. |

---

## 5. Security & Session Handling

- The Extension operates strictly within the context of your active browser session.
- It adheres to Chrome's Manifest V3 security model, strictly forbidding remote script execution (`eval` or dynamically loaded external JavaScript).

---

## 6. Open Source Verification

Because this extension is 100% open source under the **GNU General Public License v3.0 (GPL-3.0)**, anyone can independently audit the source code to verify this privacy policy:
- **Source Code Repository:** [https://github.com/USERNAME/uopeople-brightspace-course-export](https://github.com/)

---

## 7. Changes to This Privacy Policy

If any changes are made to this policy in future versions, the updated policy will be posted directly to the source code repository along with release notes describing the change.

---

## 8. Contact & Questions

If you have questions regarding this Privacy Policy or the security of the extension, please open an issue on the official GitHub repository.
