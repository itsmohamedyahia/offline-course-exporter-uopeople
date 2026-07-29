/**
 * HTML Builder Module
 * Generates an interactive, beautiful offline HTML website file for the course.
 */
const HTMLBuilder = {
  buildOfflineSite(courseData) {
    const { courseInfo, units, exportedAt } = courseData;

    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const unitsJson = JSON.stringify(units).replace(/</g, '\\u003c');

    const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(courseInfo.name)} - Offline Course Material</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root[data-theme="dark"] {
      --bg-body: #0b0f19;
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
    }

    :root[data-theme="light"] {
      --bg-body: #f8fafc;
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
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg-body);
      color: var(--text-main);
      display: flex;
      height: 100vh;
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

    .sidebar-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
    }
    .theme-toggle {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px 40px;
      display: flex;
      flex-direction: column;
      gap: 28px;
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

    .section-card {
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
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 14px 18px;
      border-radius: 8px;
      color: var(--text-main);
      font-size: 13px;
    }

    @media print {
      body { height: auto; overflow: visible; background: #fff; color: #000; }
      .sidebar { display: none; }
      .main-content { padding: 0; overflow: visible; }
      .section-card { border: 1px solid #ccc; page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="course-badge">UoPeople Offline</span>
      <h1 class="course-title">${escapeHtml(courseInfo.name)}</h1>
    </div>
    <div class="search-box">
      <input type="text" id="search-input" placeholder="Search topics & units...">
    </div>
    <nav class="unit-nav" id="unit-nav">
      <!-- Generated Unit Nav Items -->
    </nav>
    <div class="sidebar-footer">
      <span>Exported: ${escapeHtml(exportedAt)}</span>
      <button class="theme-toggle" id="theme-toggle">☀️ / 🌙</button>
    </div>
  </aside>

  <main class="main-content" id="main-content">
    <!-- Active Unit Content Rendered Here -->
  </main>

  <script>
    const units = ${unitsJson};
    let activeUnitIndex = 0;

    function renderNav(filteredUnits = units) {
      const navContainer = document.getElementById('unit-nav');
      navContainer.innerHTML = '';
      filteredUnits.forEach((unit) => {
        const item = document.createElement('div');
        item.className = 'unit-nav-item' + (units.indexOf(unit) === activeUnitIndex ? ' active' : '');
        item.innerHTML = \`
          <span>\${escapeHtml(unit.title)}</span>
          <small>\${unit.topics ? unit.topics.length : 0} items</small>
        \`;
        item.onclick = () => {
          activeUnitIndex = units.indexOf(unit);
          renderNav(filteredUnits);
          renderMain();
        };
        navContainer.appendChild(item);
      });
    }

    function renderMain() {
      const main = document.getElementById('main-content');
      const unit = units[activeUnitIndex];
      if (!unit) {
        main.innerHTML = '<h2>No unit selected</h2>';
        return;
      }

      let html = \`
        <header class="unit-header">
          <h1>\${escapeHtml(unit.title)}</h1>
          \${unit.description ? \`<div class="unit-description">\${unit.description}</div>\` : ''}
        </header>
      \`;

      // Filter general topics (Overview, Syllabus, Welcome, Conclusions, etc.)
      const generalTopics = (unit.topics || []).filter(t => {
        const title = t.title.toLowerCase();
        return !title.includes('reading assignment') &&
               !title.includes('discussion') &&
               !title.includes('written assignment') &&
               !title.includes('learning journal') &&
               !title.includes('quiz') &&
               !title.includes('exam');
      });

      // Overview / General Section
      if (generalTopics.length > 0) {
        html += \`
          <section class="section-card">
            <div class="section-card-header">
              <span class="tag tag-overview">Overview</span>
              <h2>Course & Unit Information</h2>
            </div>
            <div class="topic-list">
              \${generalTopics.map(t => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(t.title)}</h3>
                  \${t.contentHtml ? \`<div class="topic-body">\${t.contentHtml}</div>\` : ''}
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
          <section class="section-card">
            <div class="section-card-header">
              <span class="tag tag-reading">Reading</span>
              <h2>Reading Assignments</h2>
            </div>
            <div class="topic-list">
              \${unit.readings.map(r => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(r.title)}</h3>
                  \${r.contentHtml ? \`<div class="topic-body">\${r.contentHtml}</div>\` : ''}
                  \${r.url ? \`<p><a href="\${r.url}" target="_blank" rel="noopener">Open Live Brightspace Resource ↗</a></p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Discussion Forum Section
      if (unit.discussions && unit.discussions.length > 0) {
        html += \`
          <section class="section-card">
            <div class="section-card-header">
              <span class="tag tag-discussion">Discussion</span>
              <h2>Discussion Forum Prompt</h2>
            </div>
            <div class="topic-list">
              \${unit.discussions.map(d => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(d.title)}</h3>
                  \${d.contentHtml ? \`<div class="topic-body">\${d.contentHtml}</div>\` : ''}
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
          <section class="section-card">
            <div class="section-card-header">
              <span class="tag tag-assignment">Assignment</span>
              <h2>Assignment Activity & Learning Journal</h2>
            </div>
            <div class="topic-list">
              \${unit.assignments.map(a => \`
                <div class="topic-item">
                  <h3>\${escapeHtml(a.title)}</h3>
                  \${a.contentHtml ? \`<div class="topic-body">\${a.contentHtml}</div>\` : ''}
                  \${a.url ? \`<p><a href="\${a.url}" target="_blank" rel="noopener">Open Assignment Submission on Brightspace ↗</a></p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </section>
        \`;
      }

      // Graded Quizzes Section (Mentions only)
      if (unit.quizzes && unit.quizzes.length > 0) {
        html += \`
          <section class="section-card">
            <div class="section-card-header">
              <span class="tag tag-quiz">Quiz</span>
              <h2>Graded Quiz / Assessment</h2>
            </div>
            <div class="quiz-notice">
              <strong>Notice:</strong> This unit contains the following assessment item(s):
              <ul style="margin-top: 8px; padding-left: 20px;">
                \${unit.quizzes.map(q => \`<li><strong>\${escapeHtml(q.title)}</strong></li>\`).join('')}
              </ul>
              <p style="margin-top: 8px; color: var(--text-muted); font-size: 12px;">Quiz questions are not stored offline to comply with assessment security guidelines.</p>
            </div>
          </section>
        \`;
      }

      // Attachments & Downloadable Files
      if (unit.attachments && unit.attachments.length > 0) {
        html += \`
          <section class="section-card">
            <div class="section-card-header">
              <h2>📎 Attachments & Files</h2>
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

      main.innerHTML = html;
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

    renderNav();
    renderMain();
  </script>
</body>
</html>`;

    return htmlContent;
  }
};
