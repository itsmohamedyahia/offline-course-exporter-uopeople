/**
 * HTML Builder Module
 * Generates an interactive, beautiful offline HTML website file for the course.
 */
const HTMLBuilder = {
  buildOfflineSite(courseData) {
    const { courseInfo, units, exportedAt, exportScope = 'full' } = courseData;
    const isShareable = exportScope === 'shareable';

    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const unitsJson = JSON.stringify(units).replace(/</g, '\\u003c');

    const cleanContentHtmlJS = `
    function cleanContentHtml(html, title = '') {
      if (!html) return '';
      let clean = html;

      // 1. Remove duplicate logo footers and copyright footers
      clean = clean.replace(/<footer[^>]* class="mceNonEditable"[^>]*>[\\s\\S]*?<\\/footer>/gi, '');
      clean = clean.replace(/<p>\\s*<img[^>]*LogoMinimal_Purple\\.png[^>]*>\\s*<\\/p>/gi, '');
      clean = clean.replace(/<img[^>]*LogoMinimal_Purple\\.png[^>]*>/gi, '');

      // 2. Remove duplicate hero headers and banners
      clean = clean.replace(/<div[^>]*class="[^"]*courseware-headers-[^"]*"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/div>/gi, '');
      
      // Remove duplicate title headers if they match the topic title
      if (title) {
        const escapedTitle = title.replace(/[-\\/\\\\^$*+?.()|[\\\]{}]/g, '\\\\$&');
        const hRegex = new RegExp('<(h1|h2|h3)[^>]*>\\\\s*(?:<span[^>]*>\\\\s*)*' + escapedTitle + '\\\\s*(?:<\\\\/span>\\\\s*)*<\\\\/\\\\1>', 'i');
        clean = clean.replace(hRegex, '');
      }

      // 3. Remove LockDown Browser scaffolding & forms (keep inside content)
      clean = clean.replace(/<iframe id="LockDownBrowserLaunchFrame"[\\s\\S]*?<\\/iframe>/gi, '');
      clean = clean.replace(/<input[^>]*type="hidden"[^>]*>/gi, '');
      clean = clean.replace(/<button[^>]*id="z_a"[^>]*>[\\s\\S]*?<\\/button>/gi, '');
      clean = clean.replace(/<d2l-floating-buttons[\\s\\S]*?<\\/d2l-floating-buttons>/gi, '');
      clean = clean.replace(/<form[^>]*id="d2l_form"[^>]*>/gi, '');
      clean = clean.replace(/<\\/form>/gi, '');
      
      // 4. Strip inline font-sizes style="font-size: ..."
      clean = clean.replace(/style="[^"]*font-size:\\s*[^";]+;?[^"]*"/gi, (match) => {
        let style = match.replace(/font-size:\\s*[^";]+;?/gi, '');
        if (style === 'style=""') return '';
        return style;
      });

      // Clean up empty paragraphs/spans left over
      clean = clean.replace(/<p>\\s*<\\/p>/gi, '');
      clean = clean.replace(/<span[^>]*>\\s*<\\/span>/gi, '');

      return clean;
    }
    `;

    const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(courseInfo.name)} - ${isShareable ? 'Study Guide & Reading List' : 'Offline Course Material'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
  <style>
    :root[data-theme="dark"] {
      --bg-body: #0b0f19;
      --bg-sticky-bar: rgba(11, 15, 25, 0.88);
      --bg-sidebar: #111827;
      --bg-card: #1f2937;
      --bg-card-hover: #374151;
      --border-color: rgba(255, 255, 255, 0.1);
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --accent: #3b82f6;
      --accent-soft: rgba(59, 130, 246, 0.15);
      --badge-reading: #8b5cf6;
      --badge-discussion: #f59e0b;
      --badge-assignment: #10b981;
      --badge-quiz: #ef4444;
      --badge-attachment: #6366f1;
    }

    :root[data-theme="light"] {
      --bg-body: #f8fafc;
      --bg-sticky-bar: rgba(248, 250, 252, 0.88);
      --bg-sidebar: #ffffff;
      --bg-card: #ffffff;
      --bg-card-hover: #f1f5f9;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.1);
      --badge-reading: #7c3aed;
      --badge-discussion: #d97706;
      --badge-assignment: #059669;
      --badge-quiz: #dc2626;
      --badge-attachment: #4f46e5;
    }

    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      scrollbar-width: thin;
      scrollbar-color: var(--accent) var(--bg-body);
    }

    /* Custom Scrollbars */
    ::-webkit-scrollbar {
      width: 7px;
      height: 7px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-body);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.25);
      border-radius: 8px;
      border: 2px solid transparent;
      background-clip: padding-box;
      transition: background 0.2s ease;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent);
    }

    html, body {
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg-body);
      color: var(--text-main);
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      line-height: 1.6;
    }

    .sidebar {
      width: 320px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .course-badge {
      display: inline-block;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .course-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
    }
    .search-box {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .search-box input {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-main);
      font-size: 13px;
      outline: none;
    }
    .unit-nav {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .unit-nav-wrapper {
      display: flex;
      flex-direction: column;
    }
    .unit-nav-item {
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .unit-nav-item:hover {
      background-color: var(--bg-card-hover);
      color: var(--text-main);
    }
    .unit-nav-item.active {
      background-color: var(--accent-soft);
      color: var(--accent);
      font-weight: 600;
    }

    .unit-subnav-list {
      margin: 4px 0 6px 14px;
      padding-left: 12px;
      border-left: 2px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: fadeIn 0.2s ease;
    }
    .unit-subnav-item {
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: all 0.15s ease;
      text-decoration: none;
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }
    .unit-subnav-item:hover {
      background-color: var(--bg-card-hover);
      color: var(--text-main);
    }
    .unit-subnav-item.active {
      color: var(--accent);
      font-weight: 600;
      background-color: var(--accent-soft);
    }
    .subnav-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--text-muted);
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .unit-subnav-item.active .subnav-dot {
      background: var(--accent);
      transform: scale(1.3);
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .sidebar-footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sidebar-footer-links {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .sidebar-footer-links a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
    }
    .sidebar-footer-links a:hover {
      text-decoration: underline;
    }
    .theme-toggle {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11.5px;
    }

    .exported-page-footer {
      margin-top: 40px;
      padding: 22px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-card);
      border-radius: 12px;
      line-height: 1.5;
    }
    .exported-page-footer a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    .exported-page-footer a:hover {
      text-decoration: underline;
    }
    .exported-page-footer .footer-brand-line strong {
      color: var(--text-main);
    }
    .exported-page-footer .footer-notice-line {
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px 40px;
      display: flex;
      flex-direction: column;
      gap: 28px;
      scroll-behavior: smooth;
    }

    .unit-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 16px;
    }
    .unit-header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .unit-description {
      color: var(--text-muted);
      font-size: 14px;
    }

    .peer-safe-banner {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: var(--text-main);
      box-sizing: border-box;
      line-height: 1.5;
    }

    /* Sticky Unit Index / Section Jump Bar */
    .unit-index-sticky-bar {
      position: sticky;
      top: -32px;
      margin: 0 -40px;
      padding: 12px 40px;
      background: var(--bg-sticky-bar);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      border-top: 1px solid var(--border-color);
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08);
    }
    .unit-index-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
      white-space: nowrap;
      flex-shrink: 0;
      user-select: none;
    }
    .unit-index-pills {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 2px;
      scrollbar-width: none;
      flex: 1;
    }
    .unit-index-pills::-webkit-scrollbar {
      display: none;
    }
    .unit-index-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      color: var(--text-muted);
      font-size: 12.5px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      font-family: inherit;
      outline: none;
    }
    .unit-index-pill:hover {
      background: var(--bg-card-hover);
      color: var(--text-main);
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    .unit-index-pill.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
      box-shadow: 0 0 0 1px var(--accent);
    }
    .unit-index-pill .pill-icon {
      font-size: 12px;
      line-height: 1;
    }
    .unit-index-pill .pill-badge {
      background: var(--bg-card-hover);
      color: var(--text-muted);
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .unit-index-pill.active .pill-badge {
      background: var(--accent);
      color: #ffffff;
    }

    .section-card {
      scroll-margin-top: 75px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }
    .section-card-header h2 {
      font-size: 16px;
      font-weight: 600;
    }
    .tag {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fff;
      text-transform: uppercase;
    }
    .tag-overview { background-color: #3b82f6; }
    .tag-reading { background-color: var(--badge-reading); }
    .tag-discussion { background-color: var(--badge-discussion); }
    .tag-assignment { background-color: var(--badge-assignment); }
    .tag-quiz { background-color: var(--badge-quiz); }
    .tag-attachment { background-color: var(--badge-attachment); }

    .topic-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .topic-item {
      padding: 16px;
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }
    .topic-item h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .topic-body {
      font-size: 14px;
      color: var(--text-main);
      line-height: 1.6;
      margin-bottom: 10px;
    }
    .topic-body a {
      color: var(--accent);
      text-decoration: underline;
    }
    .topic-body p {
      margin-bottom: 16px;
    }
    .topic-body h1, .topic-body h2, .topic-body h3, .topic-body h4 {
      margin-top: 24px;
      margin-bottom: 12px;
      font-weight: 600;
      color: var(--text-main);
    }
    .topic-body h1 { font-size: 1.4em; }
    .topic-body h2 { font-size: 1.25em; }
    .topic-body h3 { font-size: 1.1em; }
    .topic-body h4 { font-size: 1.0em; }
    .topic-body ul, .topic-body ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }
    .topic-body li {
      margin-bottom: 8px;
    }
    .topic-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .topic-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13.5px;
    }
    .topic-body th, .topic-body td {
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      text-align: left;
    }
    .topic-body th {
      background-color: var(--bg-card-hover);
      font-weight: 600;
    }
    .topic-body blockquote {
      border-left: 4px solid var(--accent);
      padding: 8px 16px;
      margin: 16px 0;
      background-color: var(--bg-card-hover);
      color: var(--text-muted);
      border-radius: 0 8px 8px 0;
    }
    .topic-body pre {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 14px 16px;
      overflow-x: auto;
      margin: 16px 0;
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 13px;
      line-height: 1.5;
      color: #e2e8f0;
    }
    .topic-body code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 12.5px;
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--accent-light, #818cf8);
    }
    .topic-body pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      color: inherit;
    }
    .video-container.youtube-card {
      margin: 20px 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      max-width: 640px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    }
    .video-container.youtube-card:hover {
      border-color: rgba(239, 68, 68, 0.5);
      transform: translateY(-2px);
      box-shadow: 0 8px 16px -2px rgba(0, 0, 0, 0.2);
    }
    .youtube-card-link {
      display: block;
      text-decoration: none !important;
      color: inherit;
    }
    .youtube-thumb-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .youtube-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 0.2s, transform 0.3s;
      margin: 0 !important;
      border-radius: 0 !important;
    }
    .youtube-card-link:hover .youtube-thumb-img {
      opacity: 0.9;
      transform: scale(1.03);
    }
    .youtube-play-btn {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
      transition: transform 0.2s, filter 0.2s;
      pointer-events: none;
    }
    .youtube-card-link:hover .youtube-play-btn {
      transform: translate(-50%, -50%) scale(1.12);
      filter: drop-shadow(0 6px 14px rgba(255, 0, 0, 0.6));
    }
    .youtube-card-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-card);
      border-top: 1px solid var(--border-color);
      gap: 12px;
    }
    .youtube-card-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .youtube-card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
    }
    .youtube-card-sub {
      font-size: 12px;
      color: var(--text-muted);
    }
    .watch-on-youtube-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: #ff0000;
      color: #ffffff !important;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none !important;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
      transition: background-color 0.2s, transform 0.1s;
    }
    .watch-on-youtube-btn:hover {
      background-color: #cc0000;
      transform: scale(1.02);
    }
    .watch-on-youtube-btn:active {
      transform: scale(0.98);
    }

    .attachment-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .attachment-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-card-hover);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 8px 14px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .attachment-btn:hover {
      background: var(--accent-soft);
      border-color: var(--accent);
    }

    .quiz-notice {
      background: rgba(239, 68, 68, 0.05);
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 14px 18px;
      border-radius: 8px;
      color: var(--text-main);
      font-size: 13px;
    }

    .quiz-details-accordion {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .quiz-details-accordion[open] {
      border-color: var(--accent) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .quiz-summary {
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      outline: none;
      list-style: none;
    }

    .quiz-summary::-webkit-details-marker {
      display: none;
    }

    .view-questions-badge {
      background: var(--bg-card-hover);
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }

    .quiz-details-accordion[open] .view-questions-badge {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }

    .offline-quiz-question {
      margin-bottom: 24px;
      padding: 20px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: var(--bg-card);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .offline-quiz-question input[type="radio"],
    .offline-quiz-question input[type="checkbox"] {
      cursor: not-allowed !important;
      accent-color: var(--accent) !important;
      opacity: 0.85;
      width: 14px;
      height: 14px;
      vertical-align: middle;
      margin-right: 6px;
    }

    .offline-quiz-question label {
      cursor: not-allowed !important;
      vertical-align: middle;
    }

    @media print {
      body { height: auto; overflow: visible; background: #fff; color: #000; }
      .sidebar { display: none; }
      .main-content { padding: 0; overflow: visible; }
      .section-card { border: 1px solid #ccc; page-break-inside: avoid; }
      .unit-index-sticky-bar, .floating-back-to-top { display: none !important; }
    }

    .floating-back-to-top {
      position: fixed;
      bottom: 24px;
      right: 28px;
      z-index: 90;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }
    .floating-back-to-top.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .floating-back-to-top:hover {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="course-badge" style="${isShareable ? 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);' : ''}">
        ${isShareable ? '👥 Study Guide (Peer-Safe)' : 'UoPeople Offline'}
      </span>
      <h1 class="course-title">${escapeHtml(courseInfo.name)}</h1>
    </div>
    <div class="search-box">
      <input type="text" id="search-input" placeholder="Search topics & units...">
    </div>
    <nav class="unit-nav" id="unit-nav">
      <!-- Generated Unit Nav Items -->
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-footer-row">
        <span>Exported: ${escapeHtml(exportedAt)}</span>
        <button class="theme-toggle" id="theme-toggle">☀️ / 🌙</button>
      </div>
      <div class="sidebar-footer-links">
        <a href="https://github.com/itsmohamedyahia/offline-course-exporter-uopeople" target="_blank" rel="noopener noreferrer" title="Star on GitHub">⭐ Star</a> • 
        <a href="https://ko-fi.com/myahiakhidr" target="_blank" rel="noopener noreferrer" title="Support Developer">☕ Coffee</a> • 
        <a href="https://www.linkedin.com/in/myahiakhidr/" target="_blank" rel="noopener noreferrer" title="LinkedIn">💼 Author</a>
      </div>
    </div>
  </aside>

  <main class="main-content" id="main-content">
    <!-- Active Unit Content Rendered Here -->
  </main>

  <button class="floating-back-to-top" id="back-to-top-btn" title="Back to top" aria-label="Back to top">↑</button>

  <script>
    const units = ${unitsJson};
    const isShareable = ${isShareable};
    let activeUnitIndex = 0;
    let currentScrollSpyObserver = null;

    ${cleanContentHtmlJS}

    function getUnitSections(unit) {
      if (!unit) return { sections: [], generalTopics: [], conclusionTopics: [] };

      // Collect IDs of topics assigned to specialized sections to prevent duplicates in Overview
      const categorizedIds = new Set();
      (unit.readings || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
      if (!isShareable) {
        (unit.discussions || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
        (unit.assignments || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
        (unit.quizzes || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
      }

      // Extract Conclusion topics
      const conclusionTopics = (unit.topics || []).filter(t => {
        const title = t.title.toLowerCase();
        return title.includes('conclusion');
      });
      conclusionTopics.forEach(t => { if (t.id) categorizedIds.add(t.id); });

      // Filter general topics (Overview, Syllabus, Welcome, etc.) excluding any specialized topics
      const generalTopics = (unit.topics || []).filter(t => {
        if (t.id && categorizedIds.has(t.id)) return false;
        const title = t.title.toLowerCase();
        return !title.includes('reading') &&
               !title.includes('textbook') &&
               !title.includes('discussion') &&
               !title.includes('forum') &&
               !title.includes('assignment') &&
               !title.includes('learning journal') &&
               !title.includes('quiz') &&
               !title.includes('exam') &&
               !title.includes('test') &&
               !title.includes('conclusion');
      });

      const sections = [];
      if (generalTopics.length > 0) {
        sections.push({ id: 'sec-overview', label: 'Overview', icon: '📋' });
      }
      if (unit.readings && unit.readings.length > 0) {
        sections.push({ id: 'sec-readings', label: 'Readings', icon: '📖', count: unit.readings.length });
      }
      if (!isShareable) {
        if (unit.discussions && unit.discussions.length > 0) {
          sections.push({ id: 'sec-discussions', label: 'Discussion', icon: '💬' });
        }
        if (unit.assignments && unit.assignments.length > 0) {
          sections.push({ id: 'sec-assignments', label: 'Assignment', icon: '📝' });
        }

        const allQuizzes = unit.quizzes || [];
        const knowledgeChecks = allQuizzes.filter(q => q.title.toLowerCase().includes('knowledge check'));
        const selfQuizzes = allQuizzes.filter(q => {
          const lower = q.title.toLowerCase();
          return (lower.includes('self-quiz') || lower.includes('self quiz')) && !lower.includes('knowledge check');
        });
        const assessmentQuizzes = allQuizzes.filter(q => {
          const lower = q.title.toLowerCase();
          return !lower.includes('knowledge check') && !lower.includes('self-quiz') && !lower.includes('self quiz');
        });

        if (knowledgeChecks.length > 0) {
          sections.push({ id: 'sec-knowledge-check', label: 'Knowledge Check', icon: '💡' });
        }
        if (selfQuizzes.length > 0) {
          sections.push({ id: 'sec-self-quiz', label: 'Self-Quiz', icon: '❓' });
        }
        if (assessmentQuizzes.length > 0) {
          sections.push({ id: 'sec-assessments', label: 'Assessment', icon: '📊' });
        }
      }
      if (conclusionTopics.length > 0) {
        sections.push({ id: 'sec-conclusion', label: 'Conclusion', icon: '🏁' });
      }
      if (unit.attachments && unit.attachments.length > 0) {
        sections.push({ id: 'sec-attachments', label: 'Attachments', icon: '📎', count: unit.attachments.length });
      }

      return { sections, generalTopics, conclusionTopics };
    }

    function renderNav(filteredUnits = units) {
      const navContainer = document.getElementById('unit-nav');
      navContainer.innerHTML = '';
      filteredUnits.forEach((unit) => {
        const isCurrentActive = units.indexOf(unit) === activeUnitIndex;
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'unit-nav-wrapper';

        const item = document.createElement('div');
        item.className = 'unit-nav-item' + (isCurrentActive ? ' active' : '');
        item.innerHTML = \`
          <span>\${escapeHtml(unit.title)}</span>
        \`;
        item.onclick = () => {
          activeUnitIndex = units.indexOf(unit);
          renderNav(filteredUnits);
          renderMain();
        };
        itemWrapper.appendChild(item);

        if (isCurrentActive) {
          const { sections } = getUnitSections(unit);
          if (sections.length > 0) {
            const subnav = document.createElement('div');
            subnav.className = 'unit-subnav-list';
            sections.forEach((sec) => {
              const subItem = document.createElement('button');
              subItem.type = 'button';
              subItem.className = 'unit-subnav-item';
              subItem.dataset.secId = sec.id;
              subItem.innerHTML = \`
                <span style="display: inline-flex; align-items: center; gap: 6px;">
                  <span class="subnav-dot"></span>
                  <span>\${escapeHtml(sec.label)}</span>
                </span>
                \${sec.count ? \`<span style="font-size: 10.5px; opacity: 0.7;">(\${sec.count})</span>\` : ''}
              \`;
              subItem.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollToSection(sec.id);
              };
              subnav.appendChild(subItem);
            });
            itemWrapper.appendChild(subnav);
          }
        }

        navContainer.appendChild(itemWrapper);
      });
    }

    function scrollToSection(id) {
      const main = document.getElementById('main-content');
      const el = document.getElementById(id);
      if (!main || !el) return;

      const mainRect = main.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const indexBar = document.getElementById('unit-index-bar');
      const offset = indexBar ? indexBar.offsetHeight + 16 : 24;

      const targetScrollTop = main.scrollTop + (elRect.top - mainRect.top) - offset;

      main.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });

      setActiveSection(id);
    }

    function setActiveSection(id) {
      if (!id) return;
      const pillsContainer = document.querySelector('.unit-index-pills');

      document.querySelectorAll('.unit-index-pill').forEach(pill => {
        if (pill.dataset.secId === id) {
          pill.classList.add('active');
          if (pillsContainer) {
            const pillLeft = pill.offsetLeft;
            const pillRight = pillLeft + pill.offsetWidth;
            const containerLeft = pillsContainer.scrollLeft;
            const containerRight = containerLeft + pillsContainer.clientWidth;

            if (pillLeft < containerLeft) {
              pillsContainer.scrollTo({ left: Math.max(0, pillLeft - 12), behavior: 'smooth' });
            } else if (pillRight > containerRight) {
              pillsContainer.scrollTo({ left: pillRight - pillsContainer.clientWidth + 12, behavior: 'smooth' });
            }
          }
        } else {
          pill.classList.remove('active');
        }
      });

      document.querySelectorAll('.unit-subnav-item').forEach(item => {
        if (item.dataset.secId === id) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    function setupScrollSpy() {
      if (currentScrollSpyObserver) {
        currentScrollSpyObserver.disconnect();
        currentScrollSpyObserver = null;
      }

      const main = document.getElementById('main-content');
      const sections = main.querySelectorAll('.section-card');
      if (!sections || sections.length === 0) return;

      if (sections[0] && sections[0].id) {
        setActiveSection(sections[0].id);
      }

      if ('IntersectionObserver' in window) {
        currentScrollSpyObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setActiveSection(entry.target.id);
            }
          });
        }, {
          root: main,
          rootMargin: '-10% 0px -65% 0px',
          threshold: 0
        });

        sections.forEach(sec => {
          if (sec.id) currentScrollSpyObserver.observe(sec);
        });
      }
    }

    function renderMain() {
      const main = document.getElementById('main-content');
      const unit = units[activeUnitIndex];
      if (!unit) {
        main.innerHTML = '<h2>No unit selected</h2>';
        return;
      }

      const { sections, generalTopics, conclusionTopics } = getUnitSections(unit);

      let html = \`
        <header class="unit-header" id="sec-header">
          <h1>\${escapeHtml(unit.title)}</h1>
          \${unit.description ? \`<div class="unit-description">\${unit.description}</div>\` : ''}
        </header>
      \`;

      if (isShareable) {
        html += \`
          <div class="peer-safe-banner">
            👥 <strong>Peer-Safe Study Guide:</strong> Contains syllabus overview and reading assignments for course preparation. Graded assignment prompts and quizzes are excluded in compliance with academic policies.
          </div>
        \`;
      }

      // Sticky Section Index Bar
      if (sections.length > 1) {
        html += \`
          <nav class="unit-index-sticky-bar" id="unit-index-bar">
            <div class="unit-index-title">
              <span>📑 Index:</span>
            </div>
            <div class="unit-index-pills">
              \${sections.map((s, idx) => \`
                <button type="button" class="unit-index-pill\${idx === 0 ? ' active' : ''}" data-sec-id="\${s.id}" onclick="scrollToSection('\${s.id}');">
                  <span class="pill-icon">\${s.icon}</span>
                  <span>\${escapeHtml(s.label)}</span>
                  \${s.count ? \`<span class="pill-badge">\${s.count}</span>\` : ''}
                </button>
              \`).join('')}
            </div>
          </nav>
        \`;
      }

      // Overview / General Section
      if (generalTopics.length > 0) {
        html += \`
          <section class="section-card" id="sec-overview">
            <div class="section-card-header">
              <span class="tag tag-overview">Overview</span>
              <h2>Course &amp; Unit Information</h2>
            </div>
            <div class="topic-list">
              \${generalTopics.map(t => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(t.title)}</h3>
                  \${t.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(t.contentHtml, t.title)}</div>\` : ''}
                  \${t.url ? \`<p><a href="\${t.url}" target="_blank" rel="noopener">Open Live Brightspace Topic ↗</a></p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Reading Assignments Section
      if (unit.readings && unit.readings.length > 0) {
        html += \`
          <section class="section-card" id="sec-readings">
            <div class="section-card-header">
              <span class="tag tag-reading">Reading</span>
              <h2>Reading Assignments</h2>
            </div>
            \${isShareable ? \`
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--text-main); margin-bottom: 8px;">
                💡 <strong>Accessing Textbooks:</strong> For proprietary or LIRN-hosted books, use your official student login to search the UoPeople Library portal with the citations provided below. Open Educational Resources (OER) and video resources can be accessed directly online.
              </div>
            \` : ''}
            <div class="topic-list">
              \${unit.readings.map(r => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(r.title)}</h3>
                  \${r.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(r.contentHtml, r.title)}</div>\` : ''}
                  \${r.url ? \`<p><a href="\${r.url}" target="_blank" rel="noopener">Open Live Brightspace Resource ↗</a></p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Discussion & Assignments & Quizzes ONLY rendered in Full Archive mode
      if (!isShareable) {
        // Discussion Forum Section
        if (unit.discussions && unit.discussions.length > 0) {
          html += \`
            <section class="section-card" id="sec-discussions">
              <div class="section-card-header">
                <span class="tag tag-discussion">Discussion</span>
                <h2>Discussion Forum Prompt</h2>
              </div>
              <div class="topic-list">
                \${unit.discussions.map(d => \`
                  <div class="topic-item">
                    <h3>\${escapeHtml(d.title)}</h3>
                    \${d.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(d.contentHtml, d.title)}</div>\` : ''}
                    \${d.url ? \`<p><a href="\${d.url}" target="_blank" rel="noopener">Open Discussion Thread on Brightspace ↗</a></p>\` : ''}
                  </div>
                \`).join('')}
              </div>
            </section>
          \`;
        }

        // Assignment Activity Section
        if (unit.assignments && unit.assignments.length > 0) {
          html += \`
            <section class="section-card" id="sec-assignments">
              <div class="section-card-header">
                <span class="tag tag-assignment">Assignment</span>
                <h2>Assignment Activity</h2>
              </div>
              <div class="topic-list">
                \${unit.assignments.map(a => \`
                  <div class="topic-item">
                    <h3>\${escapeHtml(a.title)}</h3>
                    \${a.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(a.contentHtml, a.title)}</div>\` : ''}
                    \${a.url ? \`<p><a href="\${a.url}" target="_blank" rel="noopener">Open Assignment Submission on Brightspace ↗</a></p>\` : ''}
                  </div>
                \`).join('')}
              </div>
            </section>
          \`;
        }

        // Quizzes Sub-sections segmentations
        const allQuizzes = unit.quizzes || [];
        const knowledgeChecks = allQuizzes.filter(q => q.title.toLowerCase().includes('knowledge check'));
        const selfQuizzes = allQuizzes.filter(q => {
          const lower = q.title.toLowerCase();
          return (lower.includes('self-quiz') || lower.includes('self quiz')) && !lower.includes('knowledge check');
        });
        const assessmentQuizzes = allQuizzes.filter(q => {
          const lower = q.title.toLowerCase();
          return !lower.includes('knowledge check') && !lower.includes('self-quiz') && !lower.includes('self quiz');
        });

        // Knowledge Check Section
        if (knowledgeChecks.length > 0) {
          html += \`
            <section class="section-card" id="sec-knowledge-check">
              <div class="section-card-header">
                <span class="tag tag-quiz" style="background-color: #3b82f6;">Knowledge Check</span>
                <h2>Knowledge Check</h2>
              </div>
              <div class="quiz-group">
                \${knowledgeChecks.map(q => \`
                  <div class="quiz-container-item" style="margin-top: 12px;">
                    <details class="quiz-details-accordion">
                      <summary class="quiz-summary">
                        <span style="display: inline-flex; align-items: center; gap: 8px; color: var(--text-main);">
                          ❓ <strong>\${escapeHtml(q.title)}</strong>
                        </span>
                        <span class="view-questions-badge">Show Questions &amp; Answers</span>
                      </summary>
                      <div class="quiz-content-wrapper" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        \${q.contentHtml || \`
                          <div class="quiz-notice">
                            <strong>Notice:</strong> Quiz questions were not extracted. No attempt details available offline.
                          </div>
                        \`}
                      </div>
                    </details>
                  </div>
                \`).join('')}
              </div>
            </section>
          \`;
        }

        // Self-Quiz Section
        if (selfQuizzes.length > 0) {
          html += \`
            <section class="section-card" id="sec-self-quiz">
              <div class="section-card-header">
                <span class="tag tag-quiz" style="background-color: #10b981;">Self-Quiz</span>
                <h2>Self-Quiz</h2>
              </div>
              <div class="quiz-group">
                \${selfQuizzes.map(q => \`
                  <div class="quiz-container-item" style="margin-top: 12px;">
                    <details class="quiz-details-accordion">
                      <summary class="quiz-summary">
                        <span style="display: inline-flex; align-items: center; gap: 8px; color: var(--text-main);">
                          ❓ <strong>\${escapeHtml(q.title)}</strong>
                        </span>
                        <span class="view-questions-badge">Show Questions &amp; Answers</span>
                      </summary>
                      <div class="quiz-content-wrapper" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        \${q.contentHtml || \`
                          <div class="quiz-notice">
                            <strong>Notice:</strong> Quiz questions were not extracted. No attempt details available offline.
                          </div>
                        \`}
                      </div>
                    </details>
                  </div>
                \`).join('')}
              </div>
            </section>
          \`;
        }

        // Assessment Section
        if (assessmentQuizzes.length > 0) {
          html += \`
            <section class="section-card" id="sec-assessments">
              <div class="section-card-header">
                <span class="tag tag-quiz">Assessment</span>
                <h2>Assessment Section</h2>
              </div>
              <div class="quiz-group">
                \${assessmentQuizzes.map(q => \`
                  <div class="quiz-container-item" style="margin-top: 12px;">
                    <details class="quiz-details-accordion">
                      <summary class="quiz-summary">
                        <span style="display: inline-flex; align-items: center; gap: 8px; color: var(--text-main);">
                          ❓ <strong>\${escapeHtml(q.title)}</strong>
                        </span>
                        <span class="view-questions-badge">Show Questions &amp; Answers</span>
                      </summary>
                      <div class="quiz-content-wrapper" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        \${q.contentHtml || \`
                          <div class="quiz-notice">
                            <strong>Notice:</strong> Quiz questions were not extracted. No attempt details available offline.
                          </div>
                        \`}
                      </div>
                    </details>
                  </div>
                \`).join('')}
              </div>
            </section>
          \`;
        }
      }

      // Conclusion Section
      if (conclusionTopics.length > 0) {
        html += \`
          <section class="section-card" id="sec-conclusion">
            <div class="section-card-header">
              <span class="tag tag-overview" style="background-color: #64748b;">Conclusion</span>
              <h2>Conclusion</h2>
            </div>
            <div class="topic-list">
              \${conclusionTopics.map(t => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(t.title)}</h3>
                  \${t.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(t.contentHtml, t.title)}</div>\` : ''}
                  \${t.url ? \`<p><a href="\${t.url}" target="_blank" rel="noopener">Open Live Brightspace Topic ↗</a></p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Attachments & Downloadable Files
      if (unit.attachments && unit.attachments.length > 0) {
        html += \`
          <section class="section-card" id="sec-attachments">
            <div class="section-card-header">
              <h2>📎 Attachments &amp; Files</h2>
            </div>
            <div class="attachment-list">
              \${unit.attachments.map(att => \`
                <a class="attachment-btn" href="assets/\${att.localFileName || (att.title.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.' + (att.ext || 'pdf'))}" target="_blank">
                  📄 \${escapeHtml(att.title)}
                </a>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Appended Community & Developer Footer
      html += \`
        <footer class="exported-page-footer">
          <div class="footer-brand-line">
            Built with ❤️ by <strong>Mohamed Yahia</strong> • 
            <a href="https://github.com/itsmohamedyahia" target="_blank" rel="noopener noreferrer">GitHub</a> • 
            <a href="https://www.linkedin.com/in/myahiakhidr/" target="_blank" rel="noopener noreferrer">LinkedIn</a> • 
            <a href="https://github.com/itsmohamedyahia/offline-course-exporter-uopeople" target="_blank" rel="noopener noreferrer">⭐ Star on GitHub</a> • 
            <a href="https://ko-fi.com/myahiakhidr" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
          </div>
          <div class="footer-notice-line">
            Enjoying this tool? Leave a ⭐ on <a href="https://github.com/itsmohamedyahia/offline-course-exporter-uopeople" target="_blank" rel="noopener noreferrer">GitHub</a> &amp; a 5-star review on the Web Store!
          </div>
        </footer>
      \`;

      main.innerHTML = html;
      main.scrollTop = 0;
      setupScrollSpy();

      // Render math formulas if KaTeX is loaded
      if (window.renderMathInElement) {
        try {
          renderMathInElement(main, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false }
            ],
            throwOnError: false
          });
        } catch (e) {
          console.warn('Math rendering error:', e);
        }
      }

      // Add event listeners for quiz toggle badges
      main.querySelectorAll('.quiz-details-accordion').forEach(details => {
        details.addEventListener('toggle', () => {
          const badge = details.querySelector('.view-questions-badge');
          if (badge) {
            badge.textContent = details.open ? 'Hide Questions & Answers' : 'Show Questions & Answers';
          }
        });
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    document.getElementById('search-input').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderNav(units);
        return;
      }
      const filtered = units.filter(u => 
        u.title.toLowerCase().includes(q) || 
        (u.topics && u.topics.some(t => t.title.toLowerCase().includes(q)))
      );
      renderNav(filtered);
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
    });

    // Back to top floating button scroll listener
    const mainEl = document.getElementById('main-content');
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (mainEl && backToTopBtn) {
      mainEl.addEventListener('scroll', () => {
        if (mainEl.scrollTop > 250) {
          backToTopBtn.classList.add('visible');
        } else {
          backToTopBtn.classList.remove('visible');
        }
      });

      backToTopBtn.addEventListener('click', () => {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    renderNav();
    renderMain();
  </script>
</body>
</html>`;

    return htmlContent;
  }
};
