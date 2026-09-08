/**
 * HTML Builder Module
 * Generates a modern, interactive, high-ergonomics offline HTML web portal for the course.
 */
const HTMLBuilder = {
  buildOfflineSite(courseData) {
    const { courseInfo, units, exportedAt, exportScope = 'full', downloadAssets = true, perUnitAssets = false } = courseData;
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
    const courseInfoJson = JSON.stringify(courseInfo).replace(/</g, '\\u003c');

    const cleanContentHtmlJS = `
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function cleanContentHtml(html, title = '') {
      if (!html) return '';
      let clean = html;

      // 1. Remove duplicate logo footers, copyright footers, and decorative page breaks
      clean = clean.replace(/<footer[^>]* class="mceNonEditable"[^>]*>[\\s\\S]*?<\\/footer>/gi, '');
      clean = clean.replace(/<p>\\s*<img[^>]*(LogoMinimal_Purple|logo_shield|PageBreak_icon)[^>]*>\\s*<\\/p>/gi, '');
      clean = clean.replace(/<img[^>]*(LogoMinimal_Purple|logo_shield|PageBreak_icon)[^>]*>/gi, '');

      // 2. Remove duplicate hero headers and banners
      clean = clean.replace(/<div[^>]*class="[^"]*courseware-headers-[^"]*"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/div>/gi, '');
      
      // Remove duplicate title headers if they match the topic title
      if (title) {
        const escapedTitle = title.replace(/[-\\/\\\\^$*+?.()|[\\\]{}]/g, '\\\\$&');
        const hRegex = new RegExp('<(h1|h2|h3|h4|h5|h6)[^>]*>\\\\s*(?:<span[^>]*>\\\\s*)*' + escapedTitle + '\\\\s*(?:<\\\\/span>\\\\s*)*<\\\\/\\\\1>', 'i');
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

      // 5. Clean up comments, stray markers, and non-breaking spaces
      clean = clean.replace(/<!--[\\s\\S]*?-->/g, '').replace(/-->/g, '').replace(/<!--/g, '');
      clean = clean.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');

      // Clean up empty paragraphs/spans left over
      clean = clean.replace(/<p>\\s*<\\/p>/gi, '');
      clean = clean.replace(/<span[^>]*>\\s*<\\/span>/gi, '');

      return clean;
    }

    function cleanUnitDescription(html, title = '') {
      if (!html) return '';
      let clean = html;
      clean = clean.replace(/<!--[\s\S]*?-->/g, '').replace(/-->/g, '').replace(/<!--/g, '');
      clean = clean.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');

      // Remove duplicate title headers if they match or start with the title (case-insensitive)
      clean = clean.replace(/<h[1-6][^>]*>[\\s\\S]*?<\\/h[1-6]>/gi, (match) => {
        const headerText = match.replace(/<[^>]+>/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (headerText === cleanTitle || (cleanTitle && headerText.includes(cleanTitle)) || (headerText && cleanTitle.includes(headerText))) {
          return '';
        }
        return match;
      });

      // Remove standalone <hr>, empty tags, and extra breaks
      clean = clean.replace(/<hr\\s*\\/?>/gi, '');
      clean = clean.replace(/<(p|div|span)[^>]*>\\s*<\\/\\1>/gi, '');
      clean = clean.trim();

      // Check if remaining text has any real content
      const textContent = clean.replace(/<[^>]+>/g, '').trim();
      if (!textContent) return '';

      return clean;
    }
    `;

    const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(courseInfo.name)} - ${isShareable ? 'Study Guide & Reading List' : 'Offline Course Material'}</title>
  <!-- 100% Offline Embedded KaTeX & Prism.js Syntax Styles -->
  <style>
    ${(typeof VendorAssets !== 'undefined' && VendorAssets.katexCss) ? VendorAssets.katexCss : ''}
    ${(typeof VendorAssets !== 'undefined' && VendorAssets.prismCss) ? VendorAssets.prismCss : ''}
  </style>
  <style>
    :root {
      --font-scale: 1;
    }

    :root[data-theme="dark"] {
      --bg-body: #0b0f19;
      --bg-topbar: rgba(11, 15, 25, 0.92);
      --bg-sticky-bar: rgba(11, 15, 25, 0.88);
      --bg-sidebar: #111827;
      --bg-card: #1f2937;
      --bg-card-hover: #374151;
      --border-color: rgba(255, 255, 255, 0.1);
      --border-color-focus: rgba(59, 130, 246, 0.5);
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --accent: #3b82f6;
      --accent-soft: rgba(59, 130, 246, 0.15);
      --accent-glow: rgba(59, 130, 246, 0.35);
      --badge-reading: #8b5cf6;
      --badge-discussion: #f59e0b;
      --badge-assignment: #10b981;
      --badge-quiz: #ef4444;
      --badge-attachment: #6366f1;
      --correct-bg: rgba(16, 185, 129, 0.15);
      --correct-border: #10b981;
      --incorrect-bg: rgba(239, 68, 68, 0.15);
      --incorrect-border: #ef4444;
    }

    :root[data-theme="light"] {
      --bg-body: #f8fafc;
      --bg-topbar: rgba(255, 255, 255, 0.92);
      --bg-sticky-bar: rgba(248, 250, 252, 0.88);
      --bg-sidebar: #ffffff;
      --bg-card: #ffffff;
      --bg-card-hover: #f1f5f9;
      --border-color: #e2e8f0;
      --border-color-focus: rgba(37, 99, 235, 0.5);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.1);
      --accent-glow: rgba(37, 99, 235, 0.3);
      --badge-reading: #7c3aed;
      --badge-discussion: #d97706;
      --badge-assignment: #059669;
      --badge-quiz: #dc2626;
      --badge-attachment: #4f46e5;
      --correct-bg: rgba(16, 185, 129, 0.12);
      --correct-border: #059669;
      --incorrect-bg: rgba(239, 68, 68, 0.12);
      --incorrect-border: #dc2626;
    }

    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      scrollbar-width: thin;
      scrollbar-color: var(--accent) var(--bg-body);
    }

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
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: calc(14px * var(--font-scale));
      background-color: var(--bg-body);
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      line-height: 1.6;
    }

    /* Top Utility Navigation Bar */
    .top-nav-bar {
      height: 52px;
      background: var(--bg-topbar);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 50;
      flex-shrink: 0;
    }
    .top-bar-left, .top-bar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 7px;
      color: var(--text-main);
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .nav-btn:hover {
      background: var(--bg-card-hover);
      border-color: var(--accent);
    }
    .nav-btn.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }
    .search-trigger-btn {
      min-width: 220px;
      justify-content: space-between;
      color: var(--text-muted);
      cursor: pointer;
    }
    .search-shortcut {
      background: var(--bg-body);
      border: 1px solid var(--border-color);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      color: var(--text-muted);
    }

    .font-size-ctrls {
      display: inline-flex;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 7px;
      overflow: hidden;
    }
    .font-ctrl-btn {
      background: transparent;
      border: none;
      color: var(--text-main);
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .font-ctrl-btn:hover {
      background: var(--bg-card-hover);
      color: var(--accent);
    }
    .font-size-indicator {
      font-size: 11px;
      padding: 0 4px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      user-select: none;
    }

    /* Main App Layout */
    .app-workspace {
      display: flex;
      flex: 1;
      height: calc(100vh - 52px);
      width: 100vw;
      overflow: hidden;
      position: relative;
    }

    /* Sidebar */
    .sidebar {
      width: 320px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 30;
    }
    .sidebar.collapsed {
      margin-left: -320px;
    }

    .sidebar-header {
      padding: 18px 20px 14px 20px;
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
      margin-bottom: 8px;
    }
    .course-title {
      font-size: 15.5px;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 12px;
    }

    /* Study Progress Tracker */
    .study-progress-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .study-progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .progress-title {
      color: var(--text-muted);
    }
    .progress-count {
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
    }
    .progress-bar-track {
      height: 6px;
      background: var(--bg-body);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .search-box {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
    }
    .search-box input {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 7px;
      color: var(--text-main);
      font-size: 12.5px;
      outline: none;
      font-family: inherit;
    }
    .search-box input:focus {
      border-color: var(--accent);
    }

    .unit-nav {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .unit-nav-wrapper {
      display: flex;
      flex-direction: column;
    }
    .unit-nav-item {
      padding: 9px 12px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-muted);
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
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
    .unit-nav-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
    }
    .unit-nav-checkbox {
      width: 15px;
      height: 15px;
      border-radius: 4px;
      border: 1.5px solid var(--text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      flex-shrink: 0;
      color: transparent;
      transition: all 0.15s ease;
      cursor: pointer;
      user-select: none;
    }
    .unit-nav-checkbox:hover {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.18);
      color: #10b981;
      transform: scale(1.1);
    }
    .unit-nav-checkbox.completed {
      background: #10b981;
      border-color: #10b981;
      color: #ffffff;
    }
    .unit-chevron {
      font-size: 9px;
      opacity: 0.65;
      padding: 3px 5px;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
      user-select: none;
    }
    .unit-chevron:hover {
      opacity: 1;
      background-color: var(--bg-card-hover);
      color: var(--accent);
    }

    .unit-subnav-list {
      margin: 4px 0 6px 14px;
      padding-left: 10px;
      border-left: 2px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: fadeIn 0.2s ease;
    }
    .unit-subnav-item {
      padding: 5px 8px;
      border-radius: 5px;
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
      gap: 8px;
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

    /* Main Content Area */
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 28px 48px;
      display: flex;
      flex-direction: column;
      gap: 28px;
      scroll-behavior: smooth;
      max-width: 1180px;
      margin: 0 auto;
      width: 100%;
    }

    .unit-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .unit-header-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .unit-header h1 {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.3;
    }
    .unit-meta-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .unit-meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .unit-description {
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.6;
    }

    .peer-safe-banner {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: var(--text-main);
      line-height: 1.5;
    }

    .academic-integrity-banner {
      background: rgba(245, 158, 11, 0.09);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: var(--text-main);
      line-height: 1.5;
    }

    /* Sticky Unit Index / Section Jump Bar */
    .unit-index-sticky-bar {
      position: sticky;
      top: -28px;
      margin: 0 -48px;
      padding: 10px 48px;
      background: var(--bg-sticky-bar);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      border-top: 1px solid var(--border-color);
      z-index: 25;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08);
    }
    .unit-index-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .unit-index-pills {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding: 2px;
      scrollbar-width: none;
      flex: 1;
    }
    .unit-index-pills::-webkit-scrollbar { display: none; }
    .unit-index-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .unit-index-pill:hover {
      background: var(--bg-card-hover);
      color: var(--text-main);
      border-color: var(--accent);
    }
    .unit-index-pill.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }
    .unit-index-pill .pill-badge {
      background: var(--bg-card-hover);
      color: var(--text-muted);
      font-size: 10.5px;
      padding: 1px 6px;
      border-radius: 10px;
      font-weight: 600;
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
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .section-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }
    .section-card-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
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
      padding: 18px;
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .topic-item.highlight-pulse {
      animation: pulseGlow 1.5s ease 2;
    }
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); border-color: var(--accent); }
      50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); border-color: var(--accent); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
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
      margin-bottom: 12px;
    }
    .topic-body a {
      color: var(--accent);
      text-decoration: underline;
    }
    .topic-body p { margin-bottom: 14px; }
    .topic-body h1, .topic-body h2, .topic-body h3, .topic-body h4 {
      margin-top: 20px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .topic-body ul, .topic-body ol {
      margin-bottom: 14px;
      padding-left: 24px;
    }
    .topic-body li { margin-bottom: 6px; }
    .topic-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 14px 0;
    }
    .topic-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 13.5px;
    }
    .topic-body th, .topic-body td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }
    .topic-body th {
      background-color: var(--bg-card-hover);
      font-weight: 600;
    }
    .topic-body blockquote {
      border-left: 4px solid var(--accent);
      padding: 8px 16px;
      margin: 14px 0;
      background-color: var(--bg-card-hover);
      color: var(--text-muted);
      border-radius: 0 8px 8px 0;
    }

    /* Rubric Container & Responsive Matrix Table */
    .rubric-container {
      margin-top: 24px;
      padding: 18px 20px;
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    [data-theme="light"] .rubric-container {
      background: rgba(248, 250, 252, 0.95);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    .rubric-header {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .rubric-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    [data-theme="light"] .rubric-badge {
      background: #ede9fe;
      color: #6366f1;
      border-color: #c7d2fe;
    }
    .rubric-title {
      font-size: 15.5px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .rubric-description {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
      line-height: 1.5;
    }
    .rubric-table-wrapper {
      width: 100%;
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      scrollbar-width: thin;
      scrollbar-color: var(--border-color) transparent;
      margin-top: 10px;
    }
    .rubric-table {
      width: 100%;
      min-width: 650px;
      border-collapse: collapse;
      font-size: 13px;
      line-height: 1.5;
      margin: 0 !important;
      background: var(--bg-card);
    }
    .rubric-table th, .rubric-table td {
      border: 1px solid var(--border-color);
      padding: 12px 14px;
      vertical-align: top;
    }
    .rubric-table thead th {
      background: rgba(30, 41, 59, 0.9);
      color: var(--text-main);
      font-weight: 600;
      text-align: left;
    }
    [data-theme="light"] .rubric-table thead th {
      background: #f1f5f9;
      color: #1e293b;
    }
    .rubric-col-criterion {
      width: 22%;
      min-width: 140px;
    }
    .rubric-col-level {
      text-align: center !important;
      min-width: 130px;
    }
    .rubric-level-name {
      font-weight: 700;
      font-size: 13px;
      color: var(--text-main);
    }
    .rubric-level-points {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--accent);
      margin-top: 2px;
    }
    .rubric-cell-criterion {
      background: rgba(15, 23, 42, 0.25);
    }
    [data-theme="light"] .rubric-cell-criterion {
      background: #f8fafc;
    }
    .rubric-crit-name {
      font-weight: 700;
      color: var(--text-main);
      font-size: 13px;
      margin-bottom: 4px;
    }
    .rubric-crit-outof {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.06);
      padding: 2px 6px;
      border-radius: 4px;
    }
    [data-theme="light"] .rubric-crit-outof {
      background: #e2e8f0;
      color: #475569;
    }
    .rubric-crit-weight {
      font-size: 11px;
      color: var(--accent);
      margin-top: 2px;
    }
    .rubric-cell-level {
      transition: background-color 0.15s ease;
    }
    .rubric-cell-level:hover {
      background-color: rgba(99, 102, 241, 0.05);
    }
    .rubric-cell-points {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 6px;
      background: rgba(99, 102, 241, 0.1);
      padding: 1px 5px;
      border-radius: 3px;
    }
    .rubric-cell-desc {
      color: var(--text-main);
      font-size: 12.5px;
    }
    .rubric-cell-desc p {
      margin: 0 0 6px 0;
    }
    .rubric-cell-desc p:last-child {
      margin-bottom: 0;
    }

    .topic-body pre {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 14px 16px;
      overflow-x: auto;
      margin: 14px 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .topic-body code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--accent);
    }
    .topic-body pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }

    .topic-actions-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--border-color);
    }
    .topic-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .topic-action-btn:hover {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Video Player Cards */
    .video-container.youtube-card {
      margin: 18px 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      max-width: 600px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      transition: border-color 0.2s, transform 0.2s;
    }
    .video-container.youtube-card:hover {
      border-color: rgba(239, 68, 68, 0.5);
      transform: translateY(-2px);
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
      pointer-events: none;
    }
    .youtube-card-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
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
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
    }
    .youtube-card-sub {
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .watch-on-youtube-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background-color: #ff0000;
      color: #ffffff !important;
      padding: 6px 12px;
      border-radius: 5px;
      text-decoration: none !important;
      font-weight: 600;
      font-size: 12px;
      white-space: nowrap;
    }

    /* Attachments */
    .attachment-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .attachment-item-card {
      display: inline-flex;
      align-items: center;
      background: var(--bg-card-hover);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.15s ease;
    }
    .attachment-item-card:hover {
      border-color: var(--accent);
    }
    .attachment-item-card .attachment-btn {
      border: none;
      background: transparent;
      padding: 8px 12px;
      cursor: pointer;
    }
    .attachment-open-tab-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 10px;
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-decoration: none;
      border-left: 1px solid var(--border-color);
    }
    .attachment-open-tab-btn:hover {
      background: var(--accent);
      color: #ffffff;
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
    }
    .attachment-btn:hover {
      background: var(--accent-soft);
      border-color: var(--accent);
    }

    /* Interactive Quizzes & Active Recall Mode */
    .quiz-mode-switch {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 4px;
    }
    .quiz-mode-btn {
      padding: 4px 10px;
      border-radius: 5px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .quiz-mode-btn.active {
      background: var(--accent-soft);
      color: var(--accent);
    }

    .quiz-empty-guide-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: var(--bg-card-hover);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-top: 10px;
    }
    .quiz-guide-icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    .quiz-guide-content h4 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .quiz-guide-content p {
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .quiz-direct-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--accent-soft);
      color: var(--accent);
      border: 1px solid var(--border-color);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }
    .quiz-direct-btn:hover {
      background: var(--accent);
      color: #ffffff;
    }

    .quiz-details-accordion {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
      transition: border-color 0.2s;
    }
    .quiz-details-accordion[open] {
      border-color: var(--accent) !important;
    }
    .quiz-summary {
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      list-style: none;
    }
    .quiz-summary::-webkit-details-marker { display: none; }
    .view-questions-badge {
      background: var(--bg-card-hover);
      border: 1px solid var(--border-color);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .offline-quiz-question {
      margin-bottom: 20px;
      padding: 18px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: var(--bg-card);
      transition: border-color 0.2s;
    }
    .offline-quiz-question input[type="radio"],
    .offline-quiz-question input[type="checkbox"] {
      cursor: pointer;
      accent-color: var(--accent);
      width: 15px;
      height: 15px;
      vertical-align: middle;
      margin-right: 8px;
    }
    .offline-quiz-question label {
      cursor: pointer;
      vertical-align: middle;
    }

    /* Question Action Verification Bar */
    .quiz-question-check-bar {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .check-answer-btn {
      padding: 5px 12px;
      background: var(--accent);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .answer-feedback-tag {
      font-size: 12px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      display: none;
    }
    .answer-feedback-tag.correct {
      display: inline-block;
      background: var(--correct-bg);
      color: #10b981;
      border: 1px solid var(--correct-border);
    }
    .answer-feedback-tag.incorrect {
      display: inline-block;
      background: var(--incorrect-bg);
      color: #ef4444;
      border: 1px solid var(--incorrect-border);
    }

    /* Bottom Linear Navigation */
    .unit-bottom-nav {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .unit-completion-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }
    .unit-complete-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-card-hover);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-main);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .unit-complete-toggle-btn:hover {
      border-color: #10b981;
      color: #10b981;
    }
    .unit-complete-toggle-btn.completed {
      background: #10b981;
      border-color: #10b981;
      color: #ffffff;
    }

    .unit-prev-next-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .unit-nav-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px 20px;
      text-decoration: none;
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      text-align: left;
    }
    .unit-nav-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .unit-nav-card.next {
      text-align: right;
      grid-column: 2;
    }
    .unit-nav-card-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .unit-nav-card-title {
      font-size: 14.5px;
      font-weight: 600;
      line-height: 1.35;
    }

    /* Document Preview Modal */
    .doc-modal-backdrop, .search-modal-backdrop, .shortcuts-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .doc-modal-backdrop.open, .search-modal-backdrop.open, .shortcuts-modal-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }
    .doc-modal-window {
      width: 92vw;
      height: 92vh;
      max-width: 1300px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .doc-modal-header {
      padding: 12px 18px;
      background: var(--bg-sidebar);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .doc-modal-title {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .doc-modal-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--accent-soft);
      color: var(--accent);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }
    .doc-modal-close, .search-modal-close, .shortcuts-modal-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .doc-modal-close:hover, .search-modal-close:hover, .shortcuts-modal-close:hover {
      color: #ef4444;
    }
    .doc-modal-body {
      flex: 1;
      width: 100%;
      height: 100%;
      background: #525659;
    }
    .doc-modal-frame {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Live Search Modal */
    .search-modal-window {
      width: 90vw;
      max-width: 680px;
      max-height: 80vh;
      background: var(--bg-sidebar);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .search-modal-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .search-modal-header input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-main);
      font-size: 16px;
      outline: none;
      font-family: inherit;
    }
    .search-modal-results {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 55vh;
    }
    .search-result-item {
      padding: 12px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .search-result-item:hover, .search-result-item.selected {
      border-color: var(--accent);
      background: var(--bg-card-hover);
    }
    .search-res-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .search-res-unit {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
    }
    .search-res-tag {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-body);
      color: var(--text-muted);
      font-weight: 600;
    }
    .search-res-title {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-main);
    }
    .search-res-snippet {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .search-highlight {
      background: rgba(245, 158, 11, 0.35);
      color: #ffffff;
      padding: 1px 3px;
      border-radius: 3px;
      font-weight: 600;
    }
    .search-modal-footer {
      padding: 10px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 11.5px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }

    /* Shortcuts Help Modal */
    .shortcuts-modal-window {
      width: 90vw;
      max-width: 520px;
      background: var(--bg-sidebar);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
    }
    .shortcuts-modal-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .shortcuts-modal-body {
      padding: 16px 20px;
    }
    .shortcuts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .shortcuts-table td {
      padding: 8px 6px;
      border-bottom: 1px solid var(--border-color);
    }
    .shortcuts-table kbd {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 2px 7px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-main);
    }

    /* Toast Notification */
    .toast-notification {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #10b981;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.5);
      z-index: 2000;
      opacity: 0;
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toast-notification.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .exported-page-footer {
      margin-top: 40px;
      padding: 20px;
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

    /* Code Blocks & Offline Syntax Highlighting (for CS & Technical Courses) */
    .code-block-wrapper {
      margin: 18px 0;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      overflow: hidden;
      background: #1d1f21;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid var(--border-color);
    }
    .code-lang-badge {
      font-size: 11px;
      font-weight: 700;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      color: var(--accent);
      letter-spacing: 0.5px;
    }
    .code-copy-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .code-copy-btn:hover {
      background: var(--accent-soft);
      color: var(--accent);
      border-color: var(--accent);
    }
    .code-block-wrapper pre {
      margin: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      padding: 14px 16px !important;
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
      transition: all 0.2s ease;
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
    }

    @media (max-width: 860px) {
      .sidebar { position: absolute; left: 0; top: 0; bottom: 0; }
      .sidebar.collapsed { margin-left: -320px; }
      .main-content { padding: 20px; }
      .unit-index-sticky-bar { margin: 0 -20px; padding: 10px 20px; }
      .unit-prev-next-grid { grid-template-columns: 1fr; }
      .unit-nav-card.next { grid-column: 1; }
    }

    @media print {
      .top-nav-bar, .sidebar, .unit-index-sticky-bar, .floating-back-to-top, .unit-bottom-nav, .topic-actions-row { display: none !important; }
      body, .main-content { height: auto; overflow: visible; background: #fff; color: #000; padding: 0; }
      .section-card { border: 1px solid #ccc; page-break-inside: avoid; }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

  <!-- Top Utility Bar -->
  <header class="top-nav-bar">
    <div class="top-bar-left">
      <button class="nav-btn" id="toggle-sidebar-btn" title="Toggle Sidebar / Focus Mode (F)">
        <span class="btn-icon">🔲</span>
        <span class="btn-label" id="focus-btn-label">Focus Mode</span>
      </button>
      <button class="nav-btn search-trigger-btn" id="open-search-btn" title="Search course content (Ctrl+K or /)">
        <span style="display: flex; align-items: center; gap: 6px;">
          <span>🔍</span>
          <span class="search-placeholder">Quick Search...</span>
        </span>
        <span class="search-shortcut">/</span>
      </button>
    </div>
    <div class="top-bar-right">
      <div class="font-size-ctrls" title="Adjust text size">
        <button class="font-ctrl-btn" id="font-decrease-btn" title="Decrease font size (-)">A-</button>
        <span class="font-size-indicator" id="font-size-label">100%</span>
        <button class="font-ctrl-btn" id="font-increase-btn" title="Increase font size (+)">A+</button>
      </div>
      <button class="nav-btn" id="shortcuts-help-btn" title="Keyboard Shortcuts (?)">
        <span>⌨️</span>
      </button>
      <button class="nav-btn theme-toggle-btn" id="theme-toggle" title="Toggle Dark/Light Mode (T)">
        <span id="theme-icon">☀️ / 🌙</span>
      </button>
    </div>
  </header>

  <div class="app-workspace">
    <!-- Sidebar -->
    <aside class="sidebar" id="app-sidebar">
      <div class="sidebar-header">
        <span class="course-badge" style="${isShareable ? 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);' : ''}">
          ${isShareable ? '👥 Study Guide (Peer-Safe)' : 'UoPeople Offline'}
        </span>
        <h1 class="course-title">${escapeHtml(courseInfo.name)}</h1>

        <!-- Study Progress Tracker -->
        <div class="study-progress-card">
          <div class="study-progress-header">
            <span class="progress-title">Study Progress</span>
            <span class="progress-count" id="study-progress-count">0 / ${units.length}</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="study-progress-fill" style="width: 0%;"></div>
          </div>
        </div>
      </div>

      <div class="search-box">
        <input type="text" id="search-input" placeholder="Filter units...">
      </div>

      <nav class="unit-nav" id="unit-nav">
        <!-- Generated Unit Nav Items -->
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-footer-row">
          <span>Exported: ${escapeHtml(exportedAt)}</span>
        </div>
        <div class="sidebar-footer-links">
          <a href="https://github.com/itsmohamedyahia/offline-course-exporter-uopeople" target="_blank" rel="noopener noreferrer">⭐ Star on GitHub</a> • 
          <a href="https://ko-fi.com/myahiakhidr" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content" id="main-content">
      <!-- Active Unit Content Rendered Here -->
    </main>
  </div>

  <button class="floating-back-to-top" id="back-to-top-btn" title="Back to top" aria-label="Back to top">↑</button>

  <!-- PDF & Document Reader Modal -->
  <div class="doc-modal-backdrop" id="doc-modal" aria-hidden="true">
    <div class="doc-modal-window">
      <div class="doc-modal-header">
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
          <span>📄</span>
          <span class="doc-modal-title" id="doc-modal-filename">Document Viewer</span>
        </div>
        <div class="doc-modal-actions">
          <a id="doc-modal-open-tab" href="#" target="_blank" rel="noopener noreferrer" class="doc-modal-btn">↗ Open in New Tab</a>
          <a id="doc-modal-download" href="#" download class="doc-modal-btn">⬇ Save File</a>
          <button class="doc-modal-close" id="doc-modal-close-btn" title="Close viewer (ESC)">✕</button>
        </div>
      </div>
      <div class="doc-modal-body">
        <iframe id="doc-modal-iframe" src="" class="doc-modal-frame"></iframe>
      </div>
    </div>
  </div>

  <!-- Full-Text Search Modal -->
  <div class="search-modal-backdrop" id="search-modal" aria-hidden="true">
    <div class="search-modal-window">
      <div class="search-modal-header">
        <span style="font-size: 18px;">🔍</span>
        <input type="text" id="modal-search-input" placeholder="Search topics, readings, assignments..." autocomplete="off">
        <button class="search-modal-close" id="search-modal-close-btn" title="Close (ESC)">✕</button>
      </div>
      <div class="search-modal-results" id="modal-search-results">
        <div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">
          Type anything to search across all course units, readings, and topics.
        </div>
      </div>
      <div class="search-modal-footer">
        <span>Use <strong>↑</strong> <strong>↓</strong> to navigate, <strong>Enter</strong> to select</span>
        <span><kbd style="font-size: 10px; padding: 2px 4px; border: 1px solid var(--border-color); border-radius: 3px;">ESC</kbd> to close</span>
      </div>
    </div>
  </div>

  <!-- Keyboard Shortcuts Modal -->
  <div class="shortcuts-modal-backdrop" id="shortcuts-modal" aria-hidden="true">
    <div class="shortcuts-modal-window">
      <div class="shortcuts-modal-header">
        <h2 style="font-size: 15px; font-weight: 700;">⌨️ Keyboard Shortcuts</h2>
        <button class="shortcuts-modal-close" id="shortcuts-modal-close-btn">✕</button>
      </div>
      <div class="shortcuts-modal-body">
        <table class="shortcuts-table">
          <tr><td><kbd>[</kbd> or <kbd>p</kbd></td><td>Previous Unit</td></tr>
          <tr><td><kbd>]</kbd> or <kbd>n</kbd></td><td>Next Unit</td></tr>
          <tr><td><kbd>/</kbd> or <kbd>Ctrl+K</kbd></td><td>Open Full Course Search</td></tr>
          <tr><td><kbd>f</kbd></td><td>Toggle Focus / Zen Mode</td></tr>
          <tr><td><kbd>t</kbd></td><td>Toggle Dark / Light Theme</td></tr>
          <tr><td><kbd>+</kbd> / <kbd>-</kbd></td><td>Increase / Decrease Text Size</td></tr>
          <tr><td><kbd>0</kbd></td><td>Reset Text Size</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Close Search / PDF Preview</td></tr>
          <tr><td><kbd>?</kbd></td><td>Toggle Shortcuts Help</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast-notification" id="app-toast"></div>

  <!-- Embedded 100% Offline KaTeX Math & Prism.js Syntax Engines -->
  <script>
    ${(typeof VendorAssets !== 'undefined' && VendorAssets.katexJs) ? VendorAssets.katexJs : ''}
  </script>
  <script>
    ${(typeof VendorAssets !== 'undefined' && VendorAssets.katexAutoJs) ? VendorAssets.katexAutoJs : ''}
  </script>
  <script>
    ${(typeof VendorAssets !== 'undefined' && VendorAssets.prismJs) ? VendorAssets.prismJs : ''}
  </script>
  <script>
    const units = ${unitsJson};
    const courseInfo = ${courseInfoJson};
    const isShareable = ${isShareable};
    const downloadAssets = ${Boolean(downloadAssets)};
    const perUnitAssets = ${Boolean(perUnitAssets)};
    const courseStorageKey = 'uop_progress_' + (courseInfo.id || 'default');

    function getUnitFolderName(unit, index) {
      if (!unit) return 'Unit';
      const cleanTitle = (unit.title || 'Unit')
        .replace(/[\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]/g, ' ')
        .replace(/[\\\\/:*?"<>|]/g, '_')
        .trim()
        .replace(/_+/g, '_')
        .replace(/\\s+/g, ' ')
        .replace(/^_+|_+$/g, '');
      return \`\${String(index + 1).padStart(2, '0')}_\${cleanTitle || 'Unit'}\`;
    }

    let activeUnitIndex = 0;
    let expandedUnits = new Set([0]);
    let currentScrollSpyObserver = null;
    let completedUnits = new Set();
    let currentFontScale = 1.0;
    let quizPracticeModes = {}; // unitIndex -> boolean

    ${cleanContentHtmlJS}

    // Load saved preferences from localStorage
    function loadSavedState() {
      try {
        const savedProgress = localStorage.getItem(courseStorageKey);
        if (savedProgress) {
          completedUnits = new Set(JSON.parse(savedProgress));
        }
        const savedScale = localStorage.getItem('uop_font_scale');
        if (savedScale) {
          currentFontScale = parseFloat(savedScale) || 1.0;
          applyFontScale(currentFontScale);
        }
        const savedFocus = localStorage.getItem('uop_focus_mode');
        if (savedFocus === 'true') {
          const sidebar = document.getElementById('app-sidebar');
          if (sidebar) sidebar.classList.add('collapsed');
          const btn = document.getElementById('toggle-sidebar-btn');
          if (btn) btn.classList.add('active');
        }
        const savedTheme = localStorage.getItem('uop_theme');
        if (savedTheme) {
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
      } catch (e) {
        console.warn('Could not load localStorage preferences', e);
      }
    }

    function saveProgress() {
      try {
        localStorage.setItem(courseStorageKey, JSON.stringify(Array.from(completedUnits)));
      } catch (e) {}
    }

    function updateProgressUI() {
      const countEl = document.getElementById('study-progress-count');
      const fillEl = document.getElementById('study-progress-fill');
      const total = units.length || 1;
      const count = completedUnits.size;
      const pct = Math.round((count / total) * 100);

      if (countEl) countEl.textContent = count + ' / ' + total + ' (' + pct + '%)';
      if (fillEl) fillEl.style.width = pct + '%';
    }

    function toggleUnitComplete(unitIdx) {
      if (completedUnits.has(unitIdx)) {
        completedUnits.delete(unitIdx);
        showToast('Unit marked as incomplete');
      } else {
        completedUnits.add(unitIdx);
        showToast('🎉 Unit marked as completed!');
      }
      saveProgress();
      updateProgressUI();
      renderNav();
      renderMain();
    }

    function showToast(message) {
      const toast = document.getElementById('app-toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2400);
    }

    function applyFontScale(scale) {
      currentFontScale = Math.min(1.3, Math.max(0.8, scale));
      document.documentElement.style.setProperty('--font-scale', currentFontScale);
      const label = document.getElementById('font-size-label');
      if (label) label.textContent = Math.round(currentFontScale * 100) + '%';
      try {
        localStorage.setItem('uop_font_scale', currentFontScale.toString());
      } catch (e) {}
    }

    function copyApaCitation(title, contentHtml, url) {
      let citation = '';
      const text = (contentHtml || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
      
      // Check if text already has an APA formatted string e.g. "Author, A. (Year). Title..."
      const apaMatch = text.match(/([A-Z][a-zA-Z\\s,-]+?\\(\\d{4}\\)\\.\\s*[^.]+\\..*)/);
      if (apaMatch && apaMatch[1]) {
        citation = apaMatch[1].trim();
      } else {
        citation = title + '. (n.d.). University of the People Brightspace Course Material. ' + (url || '');
      }

      navigator.clipboard.writeText(citation).then(() => {
        showToast('📋 APA Citation copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy citation');
      });
    }

    function getUnitSections(unit) {
      if (!unit) return { sections: [], generalTopics: [], conclusionTopics: [] };

      const categorizedIds = new Set();
      (unit.readings || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
      if (!isShareable) {
        (unit.discussions || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
        (unit.assignments || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
        (unit.quizzes || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
      }

      const conclusionTopics = (unit.topics || []).filter(t => {
        const title = t.title.toLowerCase();
        return title.includes('conclusion');
      });
      conclusionTopics.forEach(t => { if (t.id) categorizedIds.add(t.id); });

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
        sections.push({ 
          id: 'sec-attachments', 
          label: downloadAssets ? 'Attachments' : 'Online Resources', 
          icon: downloadAssets ? '📎' : '🌐', 
          count: unit.attachments.length 
        });
      }

      return { sections, generalTopics, conclusionTopics };
    }

    function renderNav(filteredUnits = units) {
      const navContainer = document.getElementById('unit-nav');
      navContainer.innerHTML = '';
      filteredUnits.forEach((unit) => {
        const unitIdx = units.indexOf(unit);
        const isCurrentActive = unitIdx === activeUnitIndex;
        const isCompleted = completedUnits.has(unitIdx);
        const isExpanded = expandedUnits.has(unitIdx);
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'unit-nav-wrapper';

        const { sections } = getUnitSections(unit);
        const hasSections = sections.length > 0;

        const item = document.createElement('div');
        item.className = 'unit-nav-item' + (isCurrentActive ? ' active' : '');
        item.innerHTML = \`
          <div class="unit-nav-title-group">
            <span class="unit-nav-checkbox\${isCompleted ? ' completed' : ''}" role="button" tabindex="0" title="\${isCompleted ? 'Mark as incomplete' : 'Mark as complete'}">✓</span>
            <span>\${escapeHtml(unit.title)}</span>
          </div>
          \${hasSections ? '<span class="unit-chevron" title="' + (isExpanded ? 'Collapse sections' : 'Expand sections') + '" style="transform: ' + (isExpanded ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span>' : ''}
        \`;

        const checkbox = item.querySelector('.unit-nav-checkbox');
        if (checkbox) {
          const handleCheck = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleUnitComplete(unitIdx);
          };
          checkbox.onclick = handleCheck;
          checkbox.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleCheck(e);
            }
          };
        }

        const chevron = item.querySelector('.unit-chevron');
        if (chevron) {
          chevron.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (expandedUnits.has(unitIdx)) {
              expandedUnits.delete(unitIdx);
            } else {
              expandedUnits.add(unitIdx);
            }
            renderNav(filteredUnits);
          };
        }

        item.onclick = (e) => {
          if (activeUnitIndex === unitIdx) {
            if (expandedUnits.has(unitIdx)) {
              expandedUnits.delete(unitIdx);
            } else {
              expandedUnits.add(unitIdx);
            }
            renderNav(filteredUnits);
          } else {
            activeUnitIndex = unitIdx;
            expandedUnits.add(unitIdx);
            renderNav(filteredUnits);
            renderMain();
          }
        };
        itemWrapper.appendChild(item);

        if (isExpanded && hasSections) {
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
              \${sec.count ? '<span style="font-size: 10.5px; opacity: 0.7;">(' + sec.count + ')</span>' : ''}
            \`;
            subItem.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (activeUnitIndex !== unitIdx) {
                activeUnitIndex = unitIdx;
                expandedUnits.add(unitIdx);
                renderMain();
                renderNav(filteredUnits);
              }
              scrollToSection(sec.id);
            };
            subnav.appendChild(subItem);
          });
          itemWrapper.appendChild(subnav);
        }

        navContainer.appendChild(itemWrapper);
      });
      updateProgressUI();
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

    function goToUnit(idx) {
      if (idx < 0 || idx >= units.length) return;
      activeUnitIndex = idx;
      expandedUnits.add(idx);
      renderNav();
      renderMain();
      const main = document.getElementById('main-content');
      if (main) main.scrollTop = 0;
    }

    function renderMain() {
      const main = document.getElementById('main-content');
      const unit = units[activeUnitIndex];
      if (!unit) {
        main.innerHTML = \`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; color: var(--text-muted); gap: 14px; padding: 40px 20px;">
            <div style="font-size: 42px; opacity: 0.8;">📖</div>
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text-main); margin: 0;">No Unit Selected</h2>
            <p style="font-size: 13.5px; max-width: 420px; margin: 0; line-height: 1.5;">Click any unit in the sidebar to expand its contents, readings, and study materials.</p>
          </div>
        \`;
        return;
      }

      const { sections, generalTopics, conclusionTopics } = getUnitSections(unit);
      const cleanDesc = cleanUnitDescription(unit.description, unit.title);
      const isCompleted = completedUnits.has(activeUnitIndex);

      let html = \`
        <header class="unit-header" id="sec-header">
          <div class="unit-header-top-row">
            <div>
              \${isCompleted ? '<div class="unit-meta-badges" style="margin-bottom: 8px;"><span class="unit-meta-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.4);">✓ Completed</span></div>' : ''}
              <h1>\${escapeHtml(unit.title)}</h1>
            </div>
            <button type="button" class="unit-complete-toggle-btn\${isCompleted ? ' completed' : ''}" onclick="toggleUnitComplete(\${activeUnitIndex})">
              \${isCompleted ? '✓ Completed' : 'Mark as Complete'}
            </button>
          </div>
          \${cleanDesc ? \`<div class="unit-description">\${cleanDesc}</div>\` : ''}
        </header>
      \`;

      if (isShareable) {
        html += \`
          <div class="peer-safe-banner">
            👥 <strong>Peer-Safe Study Guide:</strong> Contains syllabus overview and reading assignments for course preparation. Graded assignment prompts, rubrics, and quizzes are excluded in compliance with academic integrity policies.
          </div>
        \`;
      } else {
        html += \`
          <div class="academic-integrity-banner">
            🔒 <strong>Personal Use Only — Academic Integrity Notice:</strong> This full course archive contains quizzes, discussion prompts, and graded assignments intended solely for personal offline study and revision by an enrolled student. Sharing or distributing this archive with peers violates the University of the People Code of Academic Integrity.
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
              <div class="section-card-title-group">
                <span class="tag tag-overview">Overview</span>
                <h2>Course &amp; Unit Information</h2>
              </div>
            </div>
            <div class="topic-list">
              \${generalTopics.map(t => \`
                <div class="topic-item" id="topic-\${t.id || escapeHtml(t.title)}">
                  <h3>\${escapeHtml(t.title)}</h3>
                  \${t.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(t.contentHtml, t.title)}</div>\` : ''}
                  <div class="topic-actions-row">
                    \${t.url ? \`<a href="\${t.url}" target="_blank" rel="noopener" class="topic-action-btn">Open Topic on Brightspace ↗</a>\` : ''}
                    <button type="button" class="topic-action-btn" onclick="copyTopicLink('topic-\${t.id || escapeHtml(t.title)}')">🔗 Copy Link</button>
                  </div>
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
              <div class="section-card-title-group">
                <span class="tag tag-reading">Reading</span>
                <h2>Reading Assignments</h2>
              </div>
            </div>
            \${isShareable ? \`
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--text-main); margin-bottom: 8px;">
                💡 <strong>Accessing Textbooks:</strong> For proprietary or LIRN-hosted books, use your official student login to search the UoPeople Library portal with the citations provided below. Open Educational Resources (OER) and video resources can be accessed directly online.
              </div>
            \` : ''}
            <div class="topic-list">
              \${unit.readings.map(r => \`
                <div class="topic-item" id="reading-\${r.id || escapeHtml(r.title)}">
                  <h3>\${escapeHtml(r.title)}</h3>
                  \${r.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(r.contentHtml, r.title)}</div>\` : ''}
                  <div class="topic-actions-row">
                    \${r.url ? \`<a href="\${r.url}" target="_blank" rel="noopener" class="topic-action-btn">Open Live Brightspace Resource ↗</a>\` : ''}
                    <button type="button" class="topic-action-btn" onclick='copyApaCitation(\${JSON.stringify(r.title)}, \${JSON.stringify(r.contentHtml || "")}, \${JSON.stringify(r.url || "")})'>
                      📋 Copy APA Citation
                    </button>
                  </div>
                </div>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Full Archive specific sections (Discussions, Assignments, Quizzes)
      if (!isShareable) {
        // Discussion Forum Section
        if (unit.discussions && unit.discussions.length > 0) {
          html += \`
            <section class="section-card" id="sec-discussions">
              <div class="section-card-header">
                <div class="section-card-title-group">
                  <span class="tag tag-discussion">Discussion</span>
                  <h2>Discussion Forum Prompt</h2>
                </div>
              </div>
              <div class="topic-list">
                \${unit.discussions.map(d => \`
                  <div class="topic-item" id="discussion-\${d.id || escapeHtml(d.title)}">
                    <h3>\${escapeHtml(d.title)}</h3>
                    \${d.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(d.contentHtml, d.title)}</div>\` : ''}
                    <div class="topic-actions-row">
                      \${d.url ? \`<a href="\${d.url}" target="_blank" rel="noopener" class="topic-action-btn">Open Discussion Thread on Brightspace ↗</a>\` : ''}
                    </div>
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
                <div class="section-card-title-group">
                  <span class="tag tag-assignment">Assignment</span>
                  <h2>Assignment Activity</h2>
                </div>
              </div>
              <div class="topic-list">
                \${unit.assignments.map(a => \`
                  <div class="topic-item" id="assignment-\${a.id || escapeHtml(a.title)}">
                    <h3>\${escapeHtml(a.title)}</h3>
                    \${a.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(a.contentHtml, a.title)}</div>\` : ''}
                    <div class="topic-actions-row">
                      \${a.url ? \`<a href="\${a.url}" target="_blank" rel="noopener" class="topic-action-btn">Open Assignment Submission on Brightspace ↗</a>\` : ''}
                    </div>
                  </div>
                \`).join('')}
              </div>
            </section>
          \`;
        }

        // Quizzes Sub-sections
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

        // Knowledge Checks
        if (knowledgeChecks.length > 0) {
          html += \`
            <section class="section-card" id="sec-knowledge-check">
              <div class="section-card-header">
                <div class="section-card-title-group">
                  <span class="tag tag-quiz" style="background-color: #3b82f6;">Knowledge Check</span>
                  <h2>Knowledge Check</h2>
                </div>
              </div>
              <div class="quiz-group">
                \${knowledgeChecks.map(q => renderQuizItem(q)).join('')}
              </div>
            </section>
          \`;
        }

        // Self-Quiz
        if (selfQuizzes.length > 0) {
          html += \`
            <section class="section-card" id="sec-self-quiz">
              <div class="section-card-header">
                <div class="section-card-title-group">
                  <span class="tag tag-quiz" style="background-color: #10b981;">Self-Quiz</span>
                  <h2>Self-Quiz</h2>
                </div>
              </div>
              <div class="quiz-group">
                \${selfQuizzes.map(q => renderQuizItem(q)).join('')}
              </div>
            </section>
          \`;
        }

        // Assessments
        if (assessmentQuizzes.length > 0) {
          html += \`
            <section class="section-card" id="sec-assessments">
              <div class="section-card-header">
                <div class="section-card-title-group">
                  <span class="tag tag-quiz">Assessment</span>
                  <h2>Assessment Section</h2>
                </div>
              </div>
              <div class="quiz-group">
                \${assessmentQuizzes.map(q => renderQuizItem(q)).join('')}
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
              <div class="section-card-title-group">
                <span class="tag tag-overview" style="background-color: #64748b;">Conclusion</span>
                <h2>Conclusion</h2>
              </div>
            </div>
            <div class="topic-list">
              \${conclusionTopics.map(t => \`
                <div class="topic-item" id="conclusion-\${t.id || escapeHtml(t.title)}">
                  <h3>\${escapeHtml(t.title)}</h3>
                  \${t.contentHtml ? \`<div class="topic-body">\${cleanContentHtml(t.contentHtml, t.title)}</div>\` : ''}
                  <div class="topic-actions-row">
                    \${t.url ? \`<a href="\${t.url}" target="_blank" rel="noopener" class="topic-action-btn">Open Topic on Brightspace ↗</a>\` : ''}
                  </div>
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
              <div class="section-card-title-group">
                <span class="tag tag-attachment">Files</span>
                <h2>\${downloadAssets ? '📎 Attachments &amp; Files' : '🌐 Online Attachments &amp; Resources'}</h2>
              </div>
            </div>
            \${!downloadAssets ? \`
              <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                <em>Note: Offline file downloading was disabled during export. The links below direct to the live online Brightspace course resources.</em>
              </p>
            \` : ''}
            <div class="attachment-list">
              \${unit.attachments.map(att => {
                const isLocal = downloadAssets;
                const cleanFile = att.localFileName || (att.title.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.' + (att.ext || 'pdf'));
                const unitFolderPrefix = (perUnitAssets && typeof getUnitFolderName === 'function') ? (getUnitFolderName(unit, activeUnitIndex) + '/') : '';
                const localHref = unitFolderPrefix + 'assets/' + cleanFile;
                const href = isLocal ? localHref : (att.url || '#');
                const isPdf = (att.ext || '').toLowerCase() === 'pdf' || cleanFile.toLowerCase().endsWith('.pdf');

                if (isLocal && isPdf) {
                  return \`
                    <div class="attachment-item-card">
                      <button type="button" class="attachment-btn preview-doc-btn" data-url="\${escapeHtml(localHref)}" data-title="\${escapeHtml(att.title)}" title="Preview document in portal">
                        📄 \${escapeHtml(att.title)}
                      </button>
                      <a class="attachment-open-tab-btn" href="\${escapeHtml(localHref)}" target="_blank" rel="noopener noreferrer" title="Open in separate tab">
                        ↗
                      </a>
                    </div>
                  \`;
                }

                return \`
                  <a class="attachment-btn\${!isLocal ? ' external-link' : ''}" href="\${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
                    \${isLocal ? '📄 ' + escapeHtml(att.title) : '🌐 📄 ' + escapeHtml(att.title) + ' ↗'}
                  </a>
                \`;
              }).join('')}
            </div>
          </section>
        \`;
      }

      // Bottom Unit Navigation (Prev / Next Unit)
      const prevUnit = activeUnitIndex > 0 ? units[activeUnitIndex - 1] : null;
      const nextUnit = activeUnitIndex < units.length - 1 ? units[activeUnitIndex + 1] : null;

      html += \`
        <div class="unit-bottom-nav">
          <div class="unit-completion-card">
            <div>
              <div style="font-weight: 600; font-size: 14px;">Ready to wrap up this unit?</div>
              <div style="font-size: 12px; color: var(--text-muted);">Track your weekly study progress.</div>
            </div>
            <button type="button" class="unit-complete-toggle-btn\${isCompleted ? ' completed' : ''}" onclick="toggleUnitComplete(\${activeUnitIndex})">
              \${isCompleted ? '✓ Unit Completed' : 'Mark Unit as Completed'}
            </button>
          </div>
          <div class="unit-prev-next-grid">
            \${prevUnit ? \`
              <button type="button" class="unit-nav-card prev" onclick="goToUnit(\${activeUnitIndex - 1})">
                <span class="unit-nav-card-label">← Previous Unit</span>
                <span class="unit-nav-card-title">\${escapeHtml(prevUnit.title)}</span>
              </button>
            \` : '<div></div>'}
            \${nextUnit ? \`
              <button type="button" class="unit-nav-card next" onclick="goToUnit(\${activeUnitIndex + 1})">
                <span class="unit-nav-card-label">Next Unit →</span>
                <span class="unit-nav-card-title">\${escapeHtml(nextUnit.title)}</span>
              </button>
            \` : '<div></div>'}
          </div>
        </div>
      \`;

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
        } catch (e) {}
      }

      // Enhance code blocks with syntax highlighting and 1-click copy
      enhanceCodeBlocks(main);

      // Add event listeners for quiz toggle badges
      main.querySelectorAll('.quiz-details-accordion').forEach(details => {
        details.addEventListener('toggle', () => {
          const badge = details.querySelector('.view-questions-badge');
          if (badge) {
            badge.textContent = details.open ? 'Hide Questions & Answers' : 'Show Questions & Answers';
          }
        });
      });

      // Add click listeners to document preview buttons
      main.querySelectorAll('.preview-doc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const url = btn.getAttribute('data-url');
          const title = btn.getAttribute('data-title');
          openDocModal(url, title);
        });
      });

      // Add click listeners to inline assets/*.pdf links to open preview modal
      main.querySelectorAll('a[href*="/assets/"], a[href^="assets/"]').forEach(link => {
        const href = link.getAttribute('href') || '';
        if (href.toLowerCase().endsWith('.pdf')) {
          link.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) return;
            e.preventDefault();
            const text = link.innerText ? link.innerText.trim() : href.split('/').pop();
            openDocModal(href, text);
          });
        }
      });
    }

    function renderQuizItem(q) {
      const hasContent = q.contentHtml && q.contentHtml.includes('offline-quiz-question');
      
      if (!hasContent) {
        return \`
          <div class="quiz-empty-guide-card">
            <div class="quiz-guide-icon">📝</div>
            <div class="quiz-guide-content">
              <h4>\${escapeHtml(q.title)}</h4>
              <p>Questions and answers have not been downloaded because this quiz was not attempted prior to export. Take your first attempt on Brightspace, then re-export this course to unlock offline self-testing &amp; explanations!</p>
              \${q.url ? \`<a href="\${q.url}" target="_blank" rel="noopener" class="quiz-direct-btn">Take Quiz on Brightspace ↗</a>\` : ''}
            </div>
          </div>
        \`;
      }

      return \`
        <div class="quiz-container-item" style="margin-top: 12px;">
          <details class="quiz-details-accordion" open>
            <summary class="quiz-summary">
              <span style="display: inline-flex; align-items: center; gap: 8px; color: var(--text-main);">
                ❓ <strong>\${escapeHtml(q.title)}</strong>
              </span>
              <span class="view-questions-badge">Hide Questions &amp; Answers</span>
            </summary>
            <div class="quiz-content-wrapper" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
              \${q.contentHtml}
            </div>
          </details>
        </div>
      \`;
    }

    function copyTopicLink(elementId) {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-pulse');
        setTimeout(() => el.classList.remove('highlight-pulse'), 3000);
      }
      showToast('🔗 Section focused & highlighted');
    }

    // Modal controls
    function openDocModal(fileUrl, title) {
      const modal = document.getElementById('doc-modal');
      const iframe = document.getElementById('doc-modal-iframe');
      const titleEl = document.getElementById('doc-modal-filename');
      const openTabBtn = document.getElementById('doc-modal-open-tab');
      const downloadBtn = document.getElementById('doc-modal-download');
      if (!modal || !iframe) return;

      if (titleEl) titleEl.textContent = title || fileUrl.split('/').pop();
      iframe.src = fileUrl;
      if (openTabBtn) openTabBtn.href = fileUrl;
      if (downloadBtn) downloadBtn.href = fileUrl;

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeDocModal() {
      const modal = document.getElementById('doc-modal');
      const iframe = document.getElementById('doc-modal-iframe');
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      if (iframe) iframe.src = '';
    }

    // Full-Text Search Engine
    let searchIndex = [];
    function buildSearchIndex() {
      searchIndex = [];
      units.forEach((unit, uIdx) => {
        // Index unit overview
        if (unit.description) {
          searchIndex.push({
            unitIndex: uIdx,
            unitTitle: unit.title,
            sectionId: 'sec-header',
            tag: 'Unit Overview',
            title: unit.title,
            text: unit.description.replace(/<[^>]+>/g, ' ')
          });
        }
        // Index general topics
        (unit.topics || []).forEach(t => {
          searchIndex.push({
            unitIndex: uIdx,
            unitTitle: unit.title,
            sectionId: 'sec-overview',
            topicId: 'topic-' + (t.id || t.title),
            tag: 'Topic',
            title: t.title,
            text: (t.contentHtml || '').replace(/<[^>]+>/g, ' ')
          });
        });
        // Index readings
        (unit.readings || []).forEach(r => {
          searchIndex.push({
            unitIndex: uIdx,
            unitTitle: unit.title,
            sectionId: 'sec-readings',
            topicId: 'reading-' + (r.id || r.title),
            tag: 'Reading',
            title: r.title,
            text: (r.contentHtml || '').replace(/<[^>]+>/g, ' ')
          });
        });
        // Index discussions
        (unit.discussions || []).forEach(d => {
          searchIndex.push({
            unitIndex: uIdx,
            unitTitle: unit.title,
            sectionId: 'sec-discussions',
            topicId: 'discussion-' + (d.id || d.title),
            tag: 'Discussion',
            title: d.title,
            text: (d.contentHtml || '').replace(/<[^>]+>/g, ' ')
          });
        });
        // Index assignments
        (unit.assignments || []).forEach(a => {
          searchIndex.push({
            unitIndex: uIdx,
            unitTitle: unit.title,
            sectionId: 'sec-assignments',
            topicId: 'assignment-' + (a.id || a.title),
            tag: 'Assignment',
            title: a.title,
            text: (a.contentHtml || '').replace(/<[^>]+>/g, ' ')
          });
        });
      });
    }

    function openSearchModal() {
      const modal = document.getElementById('search-modal');
      const input = document.getElementById('modal-search-input');
      if (!modal || !input) return;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      input.value = '';
      input.focus();
      renderSearchResults('');
    }

    function closeSearchModal() {
      const modal = document.getElementById('search-modal');
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    function renderSearchResults(query) {
      const container = document.getElementById('modal-search-results');
      if (!container) return;

      const q = query.trim().toLowerCase();
      if (!q) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">Type anything to search across all course units, readings, and topics.</div>';
        return;
      }

      const words = q.split(/\\s+/);
      const matches = [];

      searchIndex.forEach(item => {
        const full = (item.title + ' ' + item.text).toLowerCase();
        const matchesAll = words.every(w => full.includes(w));
        if (matchesAll) {
          // Find snippet around first matching word
          let snippet = '';
          const idx = full.indexOf(words[0]);
          if (idx !== -1) {
            const start = Math.max(0, idx - 50);
            const end = Math.min(item.text.length, idx + 100);
            snippet = (start > 0 ? '...' : '') + item.text.substring(start, end).trim() + (end < item.text.length ? '...' : '');
          }
          matches.push({ item, snippet });
        }
      });

      if (matches.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">No results found for "' + escapeHtml(query) + '"</div>';
        return;
      }

      container.innerHTML = matches.slice(0, 30).map((m, idx) => {
        // Highlight query keywords in title & snippet
        let highlightedTitle = escapeHtml(m.item.title);
        let highlightedSnippet = escapeHtml(m.snippet);
        words.forEach(w => {
          if (w.length > 1) {
            const regex = new RegExp('(' + w.replace(/[-\\/\\\\^$*+?.()|[\\\]{}]/g, '\\\\$&') + ')', 'gi');
            highlightedTitle = highlightedTitle.replace(regex, '<span class="search-highlight">$1</span>');
            highlightedSnippet = highlightedSnippet.replace(regex, '<span class="search-highlight">$1</span>');
          }
        });

        return \`
          <div class="search-result-item" onclick="jumpToSearchResult(\${m.item.unitIndex}, '\${m.item.sectionId || ''}', '\${m.item.topicId || ''}')">
            <div class="search-res-top">
              <span class="search-res-unit">\${escapeHtml(m.item.unitTitle)}</span>
              <span class="search-res-tag">\${escapeHtml(m.item.tag)}</span>
            </div>
            <div class="search-res-title">\${highlightedTitle}</div>
            \${highlightedSnippet ? \`<div class="search-res-snippet">\${highlightedSnippet}</div>\` : ''}
          </div>
        \`;
      }).join('');
    }

    function jumpToSearchResult(unitIdx, sectionId, topicId) {
      closeSearchModal();
      goToUnit(unitIdx);
      setTimeout(() => {
        if (topicId) {
          copyTopicLink(topicId);
        } else if (sectionId) {
          scrollToSection(sectionId);
        }
      }, 150);
    }

    function openShortcutsModal() {
      const modal = document.getElementById('shortcuts-modal');
      if (modal) modal.classList.add('open');
    }
    function closeShortcutsModal() {
      const modal = document.getElementById('shortcuts-modal');
      if (modal) modal.classList.remove('open');
    }


    function enhanceCodeBlocks(container) {
      if (!container) return;
      container.querySelectorAll('pre').forEach(pre => {
        if (pre.closest('.code-block-wrapper')) return;

        let code = pre.querySelector('code');
        if (!code) {
          const rawText = pre.innerText || pre.textContent || '';
          pre.innerHTML = '';
          code = document.createElement('code');
          code.textContent = rawText;
          pre.appendChild(code);
        }

        let lang = '';
        const fullClass = (pre.className + ' ' + code.className).toLowerCase();
        const match = fullClass.match(/language-(\\w+)|lang-(\\w+)|brush:\\s*(\\w+)/i);
        if (match) {
          lang = match[1] || match[2] || match[3];
        } else {
          const txt = code.textContent.trim();
          if (/^\\s*(def |import |from |class |print\\(|if __name__)/m.test(txt)) lang = 'python';
          else if (/^\\s*(public class|System\\.out\\.println|import java\\.)/m.test(txt)) lang = 'java';
          else if (/^\\s*(#include <|int main\\(|std::cout|namespace )/m.test(txt)) lang = 'cpp';
          else if (/^\\s*(SELECT |INSERT INTO|UPDATE |DELETE FROM|CREATE TABLE|ALTER TABLE)/im.test(txt)) lang = 'sql';
          else if (/^\\s*(<!DOCTYPE|<html|<div|<script|<style)/im.test(txt)) lang = 'markup';
          else if (/^\\s*(\\$|#!\\/bin\\/bash|npm |pip |git |sudo |cd |ls -)/m.test(txt)) lang = 'bash';
          else if (/^\\s*(function |const |let |var |console\\.log)/m.test(txt)) lang = 'javascript';
          else lang = 'clike';
        }

        if (lang) {
          code.className = 'language-' + lang;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const badge = document.createElement('span');
        badge.className = 'code-lang-badge';
        badge.textContent = (lang || 'code').toUpperCase();

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-copy-btn';
        copyBtn.textContent = '📋 Copy Code';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(code.textContent).then(() => {
            showToast('📋 Code copied to clipboard!');
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => copyBtn.textContent = '📋 Copy Code', 2000);
          });
        };

        header.appendChild(badge);
        header.appendChild(copyBtn);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);

        if (window.Prism) {
          try { Prism.highlightElement(code); } catch (e) {}
        }
      });
    }

    // Initialize Event Listeners
    window.addEventListener('DOMContentLoaded', () => {
      loadSavedState();
      buildSearchIndex();
      renderNav();
      renderMain();

      // Sidebar collapse / Focus mode
      const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
      const focusBtnLabel = document.getElementById('focus-btn-label');
      const sidebar = document.getElementById('app-sidebar');

      if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
          sidebar.classList.toggle('collapsed');
          const isCollapsed = sidebar.classList.contains('collapsed');
          toggleSidebarBtn.classList.toggle('active', isCollapsed);
          if (focusBtnLabel) focusBtnLabel.textContent = isCollapsed ? 'Sidebar' : 'Focus Mode';
          try {
            localStorage.setItem('uop_focus_mode', isCollapsed.toString());
          } catch (e) {}
        });
      }

      // Font size buttons
      document.getElementById('font-decrease-btn').addEventListener('click', () => applyFontScale(currentFontScale - 0.08));
      document.getElementById('font-increase-btn').addEventListener('click', () => applyFontScale(currentFontScale + 0.08));

      // Theme toggle
      document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('uop_theme', next); } catch (e) {}
      });

      // Search triggers
      document.getElementById('open-search-btn').addEventListener('click', openSearchModal);
      document.getElementById('modal-search-input').addEventListener('input', (e) => renderSearchResults(e.target.value));
      document.getElementById('search-modal-close-btn').addEventListener('click', closeSearchModal);
      document.getElementById('search-modal').addEventListener('click', (e) => {
        if (e.target && e.target.id === 'search-modal') closeSearchModal();
      });

      // Shortcuts help
      document.getElementById('shortcuts-help-btn').addEventListener('click', openShortcutsModal);
      document.getElementById('shortcuts-modal-close-btn').addEventListener('click', closeShortcutsModal);
      document.getElementById('shortcuts-modal').addEventListener('click', (e) => {
        if (e.target && e.target.id === 'shortcuts-modal') closeShortcutsModal();
      });

      // Document modal
      document.getElementById('doc-modal-close-btn').addEventListener('click', closeDocModal);
      document.getElementById('doc-modal').addEventListener('click', (e) => {
        if (e.target && e.target.id === 'doc-modal') closeDocModal();
      });

      // Filter sidebar units
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

      // Floating Back-to-Top Button
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

      // Global Keyboard Shortcuts
      window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea') {
          if (e.key === 'Escape') {
            closeSearchModal();
            closeDocModal();
            closeShortcutsModal();
          }
          return;
        }

        if (e.key === 'Escape') {
          closeSearchModal();
          closeDocModal();
          closeShortcutsModal();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          openSearchModal();
        } else if (e.key === '/') {
          e.preventDefault();
          openSearchModal();
        } else if (e.key === '[' || e.key === 'p') {
          if (activeUnitIndex > 0) goToUnit(activeUnitIndex - 1);
        } else if (e.key === ']' || e.key === 'n') {
          if (activeUnitIndex < units.length - 1) goToUnit(activeUnitIndex + 1);
        } else if (e.key === 'f') {
          document.getElementById('toggle-sidebar-btn').click();
        } else if (e.key === 't') {
          document.getElementById('theme-toggle').click();
        } else if (e.key === '+' || e.key === '=') {
          applyFontScale(currentFontScale + 0.08);
        } else if (e.key === '-') {
          applyFontScale(currentFontScale - 0.08);
        } else if (e.key === '0') {
          applyFontScale(1.0);
        } else if (e.key === '?') {
          openShortcutsModal();
        }
      });
    });
  </script>
</body>
</html>`;

    return htmlContent;
  }
};
