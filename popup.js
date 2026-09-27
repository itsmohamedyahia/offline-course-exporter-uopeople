/**
 * Offline Course Exporter for UoPeople - Popup Orchestrator
 * Dual-Mode State Controller: Single Course & Multi-Course Batch Export
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanCourseName(name) {
  if (!name || typeof name !== 'string') return '';
  let str = name.trim();
  str = str.replace(/\s*-\s*(?:Brightspace|University of the People|UoPeople|D2L).*$/i, '').trim();
  const courseCodeMatch = str.match(/(?:^|.*?\s+-\s+)([A-Z]{2,6}\s*\d{3,5}(?:-\d+)?\s+.*)$/i);
  if (courseCodeMatch && courseCodeMatch[1]) {
    str = courseCodeMatch[1].trim();
  } else {
    const pagePrefixRegex = /^(?:Homepage|Course Home(?:page)?|Home|Table of Contents|TOC|Content(?:s)?|Announcements?|Discussions?|Discussion Forum(?: [^-]+)?|Assignments?|Assignment Activity(?: [^-]+)?|Written Assignment(?: [^-]+)?|Learning Guide(?: [^-]+)?|Reading Assignment(?: [^-]+)?|Self-Quiz(?: [^-]+)?|Graded Quiz(?: [^-]+)?|Review Quiz(?: [^-]+)?|Final Exam(?: [^-]+)?|Quizzes|Grades?|Classlist|Lessons?|Course Overview|Overview|Unit\s+\d+(?: [^-]+)?)\s*-\s*/i;
    while (pagePrefixRegex.test(str)) {
      str = str.replace(pagePrefixRegex, '').trim();
    }
  }
  return str.trim();
}

/**
 * Initializes popup UI controller with dual-mode orchestration.
 * @param {Document} rootDoc - Target document
 * @param {object} chromeApi - Chrome extension runtime API
 */
async function initPopup(rootDoc, chromeApi) {
  const doc = rootDoc || (typeof document !== 'undefined' ? document : null);
  const chromeRuntime = chromeApi || (typeof chrome !== 'undefined' ? chrome : null);

  if (!doc) {
    throw new Error('No DOM document available to initialize popup.');
  }

  // Dual-mode state
  let currentTargetMode = 'single'; // 'single' | 'batch'
  let discoveredCourses = [];
  const selectedCourseIds = new Set();
  let activeOrgUnitId = null;
  let isSingleCourseDetected = false;
  let isExporting = false;
  let tab = null;

  // DOM element references
  const versionTag = doc.getElementById('version-tag') || doc.querySelector('.version-tag');
  const targetSwitcher = doc.getElementById('target-switcher');
  const btnTargetSingle = doc.getElementById('btn-target-single');
  const btnTargetSingleLabel = doc.getElementById('btn-target-single-label');
  const btnTargetBatch = doc.getElementById('btn-target-batch');
  const btnTargetBatchLabel = doc.getElementById('btn-target-batch-label');

  const courseCard = doc.getElementById('course-card');
  const statusBadge = doc.getElementById('status-badge');
  const courseCompletedBadge = doc.getElementById('course-completed-badge');
  const courseTitle = doc.getElementById('course-title');
  const courseMeta = doc.getElementById('course-meta');

  const batchCoursesContainer = doc.getElementById('batch-courses-container');
  const batchCoursesList = doc.getElementById('batch-courses-list');
  const batchSelectAllBtn = doc.getElementById('batch-select-all-btn');
  const batchCourseCount = doc.getElementById('batch-course-count');
  const batchSearchInput = doc.getElementById('batch-search-input');

  const btnExportCombined = doc.getElementById('btn-export-combined');
  const btnExportCombinedLabel = doc.getElementById('btn-export-combined-label');
  const btnExport = doc.getElementById('btn-export');
  const btnExportLabel = doc.getElementById('btn-export-label');
  const btnExportMarkdown = doc.getElementById('btn-export-markdown');
  const btnExportMarkdownLabel = doc.getElementById('btn-export-markdown-label');
  const btnMarkCompleted = doc.getElementById('btn-mark-completed');
  const btnMarkCompletedText = doc.getElementById('btn-mark-completed-text');

  const btnOpenSettings = doc.getElementById('btn-open-settings');
  const footerSettingsLink = doc.getElementById('footer-settings-link');

  const progressSection = doc.getElementById('progress-section');
  const progressFill = doc.getElementById('progress-fill');
  const progressPercent = doc.getElementById('progress-percent');
  const progressDetail = doc.getElementById('progress-detail');
  const resultMessage = doc.getElementById('result-message');

  const optDownloadAssets = doc.getElementById('opt-download-assets');
  const optAutoMark = doc.getElementById('opt-auto-mark');
  const modeNoticeBox = doc.getElementById('mode-notice-box');
  const noticeIcon = doc.getElementById('notice-icon');
  const noticeText = doc.getElementById('notice-text');
  const scopeRadios = doc.querySelectorAll('input[name="export-scope"]');

  // Display extension version from manifest
  if (versionTag && chromeRuntime && chromeRuntime.runtime && chromeRuntime.runtime.getManifest) {
    try {
      const manifest = chromeRuntime.runtime.getManifest();
      if (manifest && manifest.version) {
        versionTag.textContent = `v${manifest.version.replace(/\.0$/, '')}`;
      }
    } catch (e) {
      console.warn('Could not retrieve manifest version:', e);
    }
  }

  function openSettingsPage() {
    if (chromeRuntime && chromeRuntime.runtime) {
      if (chromeRuntime.runtime.openOptionsPage) {
        chromeRuntime.runtime.openOptionsPage();
      } else {
        window.open(chromeRuntime.runtime.getURL('options.html'));
      }
    }
  }

  if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsPage);
  if (footerSettingsLink) footerSettingsLink.addEventListener('click', (e) => { e.preventDefault(); openSettingsPage(); });

  function getSelectedScope() {
    const checked = doc.querySelector('input[name="export-scope"]:checked');
    return checked ? checked.value : 'full';
  }

  function updateModeNotice() {
    const isShareable = getSelectedScope() === 'shareable';
    if (!modeNoticeBox || !noticeIcon || !noticeText) return;

    if (isShareable) {
      modeNoticeBox.className = 'notice-box shareable-mode';
      noticeIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      `;
      noticeText.innerHTML = '<strong>Peer-Safe Guide:</strong> Quizzes &amp; assignments are stripped. Safe to share for study prep. Uncheck attachments if non-OER.';
    } else {
      modeNoticeBox.className = 'notice-box';
      noticeIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      `;
      noticeText.innerHTML = '<strong>Personal Study Only:</strong> Includes quizzes &amp; assignments. Sharing with peers violates the Academic Integrity Policy.';
    }
  }

  // Restore stored user preferences
  if (chromeRuntime && chromeRuntime.storage && chromeRuntime.storage.local) {
    chromeRuntime.storage.local.get(['optDownloadAssets', 'exportScope', 'autoMarkCompleted'], (res) => {
      if (res && res.optDownloadAssets !== undefined && optDownloadAssets) {
        optDownloadAssets.checked = res.optDownloadAssets;
      }
      if (res && res.autoMarkCompleted !== undefined && optAutoMark) {
        optAutoMark.checked = res.autoMarkCompleted;
      }
      if (res && res.exportScope) {
        const targetRadio = doc.querySelector(`input[name="export-scope"][value="${res.exportScope}"]`);
        if (targetRadio) targetRadio.checked = true;
      }
      updateModeNotice();
    });
  }

  // Save preferences on change
  if (optDownloadAssets) {
    optDownloadAssets.addEventListener('change', () => {
      if (chromeRuntime && chromeRuntime.storage && chromeRuntime.storage.local) {
        chromeRuntime.storage.local.set({ optDownloadAssets: optDownloadAssets.checked });
      }
    });
  }

  if (optAutoMark) {
    optAutoMark.addEventListener('change', () => {
      if (chromeRuntime && chromeRuntime.storage && chromeRuntime.storage.local) {
        chromeRuntime.storage.local.set({ autoMarkCompleted: optAutoMark.checked });
      }
    });
  }

  scopeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateModeNotice();
      if (chromeRuntime && chromeRuntime.storage && chromeRuntime.storage.local) {
        chromeRuntime.storage.local.set({ exportScope: radio.value });
      }
    });
  });

  // Progress update helper
  function updateProgress(percent, text) {
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressDetail && text) {
      progressDetail.textContent = text;
    }
  }

  // Export buttons state helpers
  function updateSingleExportButtonStates() {
    if (isExporting) return;
    const canExport = !!activeOrgUnitId;
    if (btnExportCombined) btnExportCombined.disabled = !canExport;
    if (btnExport) btnExport.disabled = !canExport;
    if (btnExportMarkdown) btnExportMarkdown.disabled = !canExport;
    if (btnMarkCompleted) btnMarkCompleted.disabled = !canExport;
  }

  function updateBatchExportButtonStates() {
    if (isExporting) return;
    const canExport = selectedCourseIds.size > 0;
    if (btnExportCombined) btnExportCombined.disabled = !canExport;
    if (btnExport) btnExport.disabled = !canExport;
    if (btnExportMarkdown) btnExportMarkdown.disabled = !canExport;
    if (btnMarkCompleted) btnMarkCompleted.disabled = true;
  }

  function disableExportButtons() {
    if (btnExportCombined) btnExportCombined.disabled = true;
    if (btnExport) btnExport.disabled = true;
    if (btnExportMarkdown) btnExportMarkdown.disabled = true;
    if (btnMarkCompleted) btnMarkCompleted.disabled = true;
  }

  function enableExportButtons() {
    if (isExporting) return;
    if (currentTargetMode === 'single') {
      updateSingleExportButtonStates();
    } else {
      updateBatchExportButtonStates();
    }
  }

  // Switch between 'single' (This Course) and 'batch' (All Courses) modes
  function switchTargetMode(mode) {
    if (isExporting) return;
    currentTargetMode = mode;

    if (mode === 'single') {
      if (btnTargetSingle) btnTargetSingle.classList.add('active');
      if (btnTargetBatch) btnTargetBatch.classList.remove('active');
      if (courseCard) courseCard.classList.remove('hidden');
      if (batchCoursesContainer) batchCoursesContainer.classList.add('hidden');
      if (btnMarkCompleted) btnMarkCompleted.classList.remove('hidden');

      if (btnExportCombinedLabel) btnExportCombinedLabel.textContent = 'Export Full Package (HTML + MD)';
      if (btnExportLabel) btnExportLabel.textContent = 'Export HTML Website (.zip)';
      if (btnExportMarkdownLabel) btnExportMarkdownLabel.textContent = 'Export Markdown Notes (.zip)';

      updateSingleExportButtonStates();
    } else {
      if (btnTargetBatch) btnTargetBatch.classList.add('active');
      if (btnTargetSingle) btnTargetSingle.classList.remove('active');
      if (courseCard) courseCard.classList.add('hidden');
      if (batchCoursesContainer) batchCoursesContainer.classList.remove('hidden');
      if (btnMarkCompleted) btnMarkCompleted.classList.add('hidden');

      if (btnExportCombinedLabel) btnExportCombinedLabel.textContent = 'Export All Courses (HTML + MD)';
      if (btnExportLabel) btnExportLabel.textContent = 'Export All Courses (HTML)';
      if (btnExportMarkdownLabel) btnExportMarkdownLabel.textContent = 'Export All Courses (Markdown)';

      updateBatchExportButtonStates();
    }
  }

  if (btnTargetSingle) {
    btnTargetSingle.addEventListener('click', () => {
      if (isExporting || btnTargetSingle.disabled) return;
      switchTargetMode('single');
    });
  }

  if (btnTargetBatch) {
    btnTargetBatch.addEventListener('click', () => {
      if (isExporting || btnTargetBatch.disabled) return;
      switchTargetMode('batch');
    });
  }

  // Select All button text update
  function updateSelectAllButtonText() {
    if (!batchSelectAllBtn) return;
    if (discoveredCourses.length > 0 && selectedCourseIds.size === discoveredCourses.length) {
      batchSelectAllBtn.textContent = 'Deselect All';
    } else {
      batchSelectAllBtn.textContent = 'Select All';
    }
  }

  // Render course checklist in batch mode
  function renderBatchLoadingState() {
    if (!batchCoursesList) return;
    batchCoursesList.innerHTML = `
      <div class="batch-loading-state" id="batch-loading-state">
        <span class="batch-spinner"></span>
        <span>Detecting enrolled courses...</span>
      </div>
    `;
  }

  function renderBatchEmptyState(message) {
    if (!batchCoursesList) return;
    batchCoursesList.innerHTML = `
      <div class="batch-empty-state">
        <span>${escapeHtml(message || 'No enrolled courses found.')}</span>
      </div>
    `;
  }

  function renderBatchCoursesList(filterQuery = '') {
    if (!batchCoursesList) return;

    const query = (filterQuery || '').trim().toLowerCase();
    const visibleCourses = query
      ? discoveredCourses.filter(c => {
          const name = (c.name || '').toLowerCase();
          const code = (c.code || '').toLowerCase();
          return name.includes(query) || code.includes(query);
        })
      : discoveredCourses;

    if (visibleCourses.length === 0) {
      if (discoveredCourses.length === 0) {
        renderBatchEmptyState('No enrolled courses found.');
      } else {
        renderBatchEmptyState(`No courses matching "${filterQuery}"`);
      }
      updateSelectAllButtonText();
      return;
    }

    batchCoursesList.innerHTML = '';

    visibleCourses.forEach(course => {
      const ouId = String(course.id || course.orgUnitId);
      const isSelected = selectedCourseIds.has(ouId);
      const cleanName = cleanCourseName(course.name) || course.name || `Course ${ouId}`;
      const code = course.code || course.courseCode || '';

      const label = doc.createElement('label');
      label.className = `batch-course-item${isSelected ? ' selected' : ''}`;
      label.setAttribute('data-ou', ouId);

      const checkbox = doc.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'batch-course-checkbox';
      checkbox.setAttribute('data-ou', ouId);
      checkbox.checked = isSelected;

      checkbox.addEventListener('change', (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (isExporting) {
          checkbox.checked = !checkbox.checked;
          return;
        }
        if (checkbox.checked) {
          selectedCourseIds.add(ouId);
          label.classList.add('selected');
        } else {
          selectedCourseIds.delete(ouId);
          label.classList.remove('selected');
        }
        updateSelectAllButtonText();
        updateBatchExportButtonStates();
      });

      const info = doc.createElement('div');
      info.className = 'batch-course-info';

      if (code) {
        const codeSpan = doc.createElement('span');
        codeSpan.className = 'batch-course-code';
        codeSpan.textContent = code;
        info.appendChild(codeSpan);
      }

      const nameSpan = doc.createElement('span');
      nameSpan.className = 'batch-course-name';
      nameSpan.title = course.name || cleanName;
      nameSpan.textContent = cleanName;
      info.appendChild(nameSpan);

      label.appendChild(checkbox);
      label.appendChild(info);

      batchCoursesList.appendChild(label);
    });

    updateSelectAllButtonText();
  }

  // Toggle Select All / Deselect All
  if (batchSelectAllBtn) {
    batchSelectAllBtn.addEventListener('click', () => {
      if (isExporting || discoveredCourses.length === 0) return;
      if (selectedCourseIds.size === discoveredCourses.length) {
        selectedCourseIds.clear();
      } else {
        discoveredCourses.forEach(c => {
          selectedCourseIds.add(String(c.id || c.orgUnitId));
        });
      }
      const filterQuery = batchSearchInput ? batchSearchInput.value : '';
      renderBatchCoursesList(filterQuery);
      updateBatchExportButtonStates();
    });
  }

  // Search filter input listener
  if (batchSearchInput) {
    batchSearchInput.addEventListener('input', () => {
      renderBatchCoursesList(batchSearchInput.value);
    });
  }

  // Course status response handler (Single course)
  function handleCourseStatusResponse(response) {
    if (isExporting) return;

    if (!response || !response.detected) {
      isSingleCourseDetected = false;
      activeOrgUnitId = null;
      if (statusBadge) {
        statusBadge.textContent = 'No Course ID';
        statusBadge.className = 'status-indicator searching';
      }
      if (courseCompletedBadge) courseCompletedBadge.classList.add('hidden');
      if (courseTitle) courseTitle.textContent = 'Brightspace Portal Loaded';
      if (courseMeta) courseMeta.textContent = 'Not currently inside a specific course.';

      if (btnTargetSingle) {
        btnTargetSingle.disabled = true;
        btnTargetSingle.title = 'Not on a specific course page';
      }

      // Automatically switch to All Courses mode
      switchTargetMode('batch');
      return;
    }

    isSingleCourseDetected = true;
    activeOrgUnitId = response.orgUnitId;

    if (btnTargetSingle) {
      btnTargetSingle.disabled = false;
      btnTargetSingle.title = 'Export currently opened course';
    }

    if (statusBadge) {
      statusBadge.textContent = 'Course Detected';
      statusBadge.className = 'status-indicator active';
    }

    const cleanName = cleanCourseName(response.courseInfo && response.courseInfo.name) ||
      (response.courseInfo && response.courseInfo.name) ||
      `Course ${response.orgUnitId}`;

    if (courseTitle) courseTitle.textContent = cleanName;
    if (courseMeta) courseMeta.textContent = `Course OrgUnit ID: ${response.orgUnitId}`;

    if (response.isMarked) {
      if (courseCompletedBadge) {
        courseCompletedBadge.classList.remove('hidden');
        courseCompletedBadge.textContent = '✓ Completed';
        courseCompletedBadge.title = response.markedInfo
          ? `Marked on ${new Date(response.markedInfo.markedAt).toLocaleDateString()}`
          : 'Course completed';
      }
      if (btnMarkCompletedText) btnMarkCompletedText.textContent = 'Re-Mark Topics Completed';
    } else {
      if (courseCompletedBadge) courseCompletedBadge.classList.add('hidden');
      if (btnMarkCompletedText) btnMarkCompletedText.textContent = 'Mark All Topics Completed';
    }

    // Default to This Course mode
    switchTargetMode('single');
  }

  // Enrolled courses response handler (Batch mode)
  function handleEnrolledCoursesResponse(response) {
    if (response && response.success && Array.isArray(response.courses)) {
      discoveredCourses = response.courses;
      selectedCourseIds.clear();
      discoveredCourses.forEach(c => {
        selectedCourseIds.add(String(c.id || c.orgUnitId));
      });

      if (batchCourseCount) batchCourseCount.textContent = String(discoveredCourses.length);
      if (btnTargetBatchLabel) btnTargetBatchLabel.textContent = `All Courses (${discoveredCourses.length})`;
      if (btnTargetBatch && !isExporting) btnTargetBatch.disabled = false;

      renderBatchCoursesList();
      if (currentTargetMode === 'batch' && !isExporting) {
        updateBatchExportButtonStates();
      }
    } else {
      discoveredCourses = [];
      selectedCourseIds.clear();
      if (batchCourseCount) batchCourseCount.textContent = '0';
      if (btnTargetBatchLabel) btnTargetBatchLabel.textContent = 'All Courses (0)';

      const errMsg = (response && response.error) ? `Error: ${response.error}` : 'No enrolled courses found.';
      renderBatchEmptyState(errMsg);
      if (currentTargetMode === 'batch' && !isExporting) {
        updateBatchExportButtonStates();
      }
    }
  }

  // Handle runtime messages for live progress updates
  function handleProgressMessage(msg) {
    if (!msg || !msg.action) return;

    if (msg.action === 'EXPORT_PROGRESS') {
      updateProgress(msg.percent, msg.status);
    }

    if (msg.action === 'BATCH_EXPORT_PROGRESS') {
      if (progressSection) progressSection.classList.remove('hidden');
      const percent = typeof msg.percent === 'number' ? msg.percent : 0;
      const detail = msg.status || (msg.currentCourseName
        ? `[${msg.courseIndex || 1}/${msg.totalCourses || 1}] ${msg.currentCourseName}`
        : 'Exporting courses...');
      updateProgress(percent, detail);
    }

    if (msg.action === 'BATCH_MARK_PROGRESS') {
      if (progressSection) progressSection.classList.remove('hidden');
      updateProgress(msg.percent, msg.status);
    }

    if (msg.action === 'BATCH_COURSES_COMPLETED') {
      const count = msg.completedCourses || msg.totalCourses;
      updateProgress(100, `Done! Completed ${count} course${count > 1 ? 's' : ''} (${msg.totalTopics || 0} topics).`);
      setTimeout(() => {
        if (progressSection) progressSection.classList.add('hidden');
      }, 3500);
    }

    if (msg.action === 'COURSE_MARK_PROGRESS' && activeOrgUnitId && String(msg.orgUnitId) === String(activeOrgUnitId)) {
      if (progressSection) progressSection.classList.remove('hidden');
      updateProgress(msg.percent, msg.status);
    }

    if (msg.action === 'COURSE_MARKED_COMPLETED' && activeOrgUnitId && String(msg.orgUnitId) === String(activeOrgUnitId)) {
      const res = msg.result || {};
      const count = res.verified !== undefined ? res.verified : (res.visited || 0);
      updateProgress(100, `Done! Verified ${count} of ${res.total || 0} topics.`);
      if (courseCompletedBadge) {
        courseCompletedBadge.classList.remove('hidden');
        courseCompletedBadge.textContent = '✓ Completed';
      }
      if (btnMarkCompletedText) btnMarkCompletedText.textContent = 'Re-Mark Topics Completed';
      setTimeout(() => {
        if (progressSection) progressSection.classList.add('hidden');
      }, 3500);
    }
  }

  if (chromeRuntime && chromeRuntime.runtime && chromeRuntime.runtime.onMessage) {
    chromeRuntime.runtime.onMessage.addListener(handleProgressMessage);
  }

  // Single Course Export
  function startExport(exportFormat) {
    if (isExporting || !activeOrgUnitId || !tab || !tab.id) return;

    isExporting = true;
    const exportScope = getSelectedScope();
    disableExportButtons();
    if (btnTargetSingle) btnTargetSingle.disabled = true;
    if (btnTargetBatch) btnTargetBatch.disabled = true;
    if (progressSection) progressSection.classList.remove('hidden');
    if (resultMessage) resultMessage.classList.add('hidden');

    const statusMsg = exportScope === 'shareable'
      ? 'Extracting shareable syllabus & reading guides...'
      : 'Initializing Brightspace Valence API...';

    updateProgress(5, statusMsg);

    chromeRuntime.tabs.sendMessage(tab.id, {
      action: 'START_EXPORT',
      orgUnitId: activeOrgUnitId,
      downloadAssets: optDownloadAssets ? optDownloadAssets.checked : true,
      exportFormat: exportFormat,
      exportScope: exportScope
    }, (response) => {
      const lastError = chromeRuntime.runtime && chromeRuntime.runtime.lastError;
      if (lastError || !response || !response.success) {
        const err = (response && response.error) || (lastError && lastError.message) || 'Export failed.';
        updateProgress(0, `Error: ${err}`);
        isExporting = false;
        if (btnTargetSingle) btnTargetSingle.disabled = !isSingleCourseDetected;
        if (btnTargetBatch) btnTargetBatch.disabled = false;
        enableExportButtons();
        return;
      }

      updateProgress(100, `Done! Extracted ${response.unitsCount} units (${exportScope === 'shareable' ? 'Peer-Safe' : 'Full'}).`);
      setTimeout(() => {
        if (progressSection) progressSection.classList.add('hidden');
        if (resultMessage) resultMessage.classList.remove('hidden');
        isExporting = false;
        if (btnTargetSingle) btnTargetSingle.disabled = !isSingleCourseDetected;
        if (btnTargetBatch) btnTargetBatch.disabled = false;
        enableExportButtons();
      }, 1000);
    });
  }

  // Multi-Course Batch Export
  function startBatchExport(exportFormat) {
    if (isExporting || !tab || !tab.id) return;

    if (selectedCourseIds.size === 0) {
      if (progressSection) progressSection.classList.remove('hidden');
      updateProgress(0, 'Please select at least one course to export.');
      return;
    }

    const coursesToExport = discoveredCourses.filter(c => selectedCourseIds.has(String(c.id || c.orgUnitId)));
    if (coursesToExport.length === 0) {
      if (progressSection) progressSection.classList.remove('hidden');
      updateProgress(0, 'Please select at least one course to export.');
      return;
    }

    isExporting = true;
    const exportScope = getSelectedScope();
    disableExportButtons();
    if (btnTargetSingle) btnTargetSingle.disabled = true;
    if (btnTargetBatch) btnTargetBatch.disabled = true;
    if (progressSection) progressSection.classList.remove('hidden');
    if (resultMessage) resultMessage.classList.add('hidden');

    const initialMsg = exportScope === 'shareable'
      ? `Starting batch export of ${coursesToExport.length} course${coursesToExport.length > 1 ? 's' : ''} (Peer-Safe)...`
      : `Starting batch export of ${coursesToExport.length} course${coursesToExport.length > 1 ? 's' : ''}...`;

    updateProgress(5, initialMsg);

    chromeRuntime.tabs.sendMessage(tab.id, {
      action: 'START_BATCH_EXPORT',
      courses: coursesToExport,
      downloadAssets: optDownloadAssets ? optDownloadAssets.checked : true,
      exportFormat: exportFormat,
      exportScope: exportScope
    }, (response) => {
      const lastError = chromeRuntime.runtime && chromeRuntime.runtime.lastError;
      if (lastError || !response || !response.success) {
        const err = (response && response.error) || (lastError && lastError.message) || 'Batch export failed.';
        updateProgress(0, `Error: ${err}`);
        isExporting = false;
        if (btnTargetSingle) btnTargetSingle.disabled = !isSingleCourseDetected;
        if (btnTargetBatch) btnTargetBatch.disabled = false;
        enableExportButtons();
        return;
      }

      const count = response.exportedCount || coursesToExport.length;
      updateProgress(100, `Done! Exported ${count} course${count > 1 ? 's' : ''} (${exportScope === 'shareable' ? 'Peer-Safe' : 'Full'}).`);
      setTimeout(() => {
        if (progressSection) progressSection.classList.add('hidden');
        if (resultMessage) resultMessage.classList.remove('hidden');
        isExporting = false;
        if (btnTargetSingle) btnTargetSingle.disabled = !isSingleCourseDetected;
        if (btnTargetBatch) btnTargetBatch.disabled = false;
        enableExportButtons();
      }, 1000);
    });
  }

  // Unified export action button click router
  function handleExportClick(exportFormat) {
    if (isExporting) return;
    if (currentTargetMode === 'batch') {
      startBatchExport(exportFormat);
    } else {
      startExport(exportFormat);
    }
  }

  if (btnExportCombined) {
    btnExportCombined.addEventListener('click', () => handleExportClick('combined'));
  }
  if (btnExport) {
    btnExport.addEventListener('click', () => handleExportClick('html'));
  }
  if (btnExportMarkdown) {
    btnExportMarkdown.addEventListener('click', () => handleExportClick('markdown'));
  }

  // Single Course Mark Completed action
  if (btnMarkCompleted) {
    btnMarkCompleted.addEventListener('click', () => {
      if (isExporting || !activeOrgUnitId || !tab || !tab.id) return;

      isExporting = true;
      disableExportButtons();
      if (btnTargetSingle) btnTargetSingle.disabled = true;
      if (btnTargetBatch) btnTargetBatch.disabled = true;
      if (progressSection) progressSection.classList.remove('hidden');
      if (resultMessage) resultMessage.classList.add('hidden');

      updateProgress(5, 'Fetching course Table of Contents to mark completed...');

      chromeRuntime.tabs.sendMessage(tab.id, {
        action: 'MARK_COURSE_COMPLETED',
        orgUnitId: activeOrgUnitId,
        showToast: true
      }, (response) => {
        isExporting = false;
        if (btnTargetSingle) btnTargetSingle.disabled = !isSingleCourseDetected;
        if (btnTargetBatch) btnTargetBatch.disabled = false;
        enableExportButtons();

        const lastError = chromeRuntime.runtime && chromeRuntime.runtime.lastError;
        if (lastError || !response || !response.success) {
          const err = (response && response.error) || (lastError && lastError.message) || 'Failed to mark topics.';
          updateProgress(0, `Error: ${err}`);
          return;
        }

        const res = response.result || {};
        if (res.inProgress) {
          updateProgress(50, 'Course topic completion is actively running in background...');
          return;
        }

        updateProgress(100, `Done! Marked ${res.completed || 0} of ${res.total || 0} topics completed.`);
        if (courseCompletedBadge) courseCompletedBadge.classList.remove('hidden');
        if (btnMarkCompletedText) btnMarkCompletedText.textContent = 'Re-Mark Topics Completed';

        setTimeout(() => {
          if (progressSection) progressSection.classList.add('hidden');
        }, 2500);
      });
    });
  }

  // Parallel Querying for Course Status & Enrolled Courses
  function queryCourseStatusAndEnrolled(isRetry = false) {
    renderBatchLoadingState();

    let retryAttempted = false;

    function handlePossibleInjectionFailure(cb) {
      if (!isRetry && !retryAttempted && chromeRuntime.scripting && tab && tab.id) {
        retryAttempted = true;
        chromeRuntime.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['zip_builder.js', 'd2l_api.js', 'vendor_assets.js', 'html_builder.js', 'markdown_builder.js', 'content.js']
        }).then(() => {
          setTimeout(() => {
            queryCourseStatusAndEnrolled(true);
          }, 120);
        }).catch((err) => {
          console.warn('Auto-injection failed:', err);
          cb();
        });
      } else {
        cb();
      }
    }

    // 1. Query GET_COURSE_STATUS
    chromeRuntime.tabs.sendMessage(tab.id, { action: 'GET_COURSE_STATUS' }, (statusResp) => {
      const lastError = chromeRuntime.runtime && chromeRuntime.runtime.lastError;
      if (lastError || !statusResp) {
        handlePossibleInjectionFailure(() => handleCourseStatusResponse(null));
      } else {
        handleCourseStatusResponse(statusResp);
      }
    });

    // 2. Query GET_ENROLLED_COURSES in parallel
    chromeRuntime.tabs.sendMessage(tab.id, { action: 'GET_ENROLLED_COURSES' }, (enrolledResp) => {
      const lastError = chromeRuntime.runtime && chromeRuntime.runtime.lastError;
      if (lastError || !enrolledResp) {
        handleEnrolledCoursesResponse(null);
      } else {
        handleEnrolledCoursesResponse(enrolledResp);
      }
    });
  }

  // Query Active Tab
  if (chromeRuntime && chromeRuntime.tabs && chromeRuntime.tabs.query) {
    try {
      const tabs = await new Promise(resolve => {
        chromeRuntime.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      if (tabs && tabs.length > 0) {
        tab = tabs[0];
      }
    } catch (e) {
      console.warn('Could not query active tab:', e);
    }
  }

  if (!tab || !tab.url || !tab.url.includes('learn.uopeople.edu')) {
    if (statusBadge) {
      statusBadge.textContent = 'Not Active';
      statusBadge.className = 'status-indicator error';
    }
    if (courseTitle) courseTitle.textContent = 'Not on UoPeople Brightspace';
    if (courseMeta) courseMeta.textContent = 'Open any page inside https://learn.uopeople.edu to export course info.';
    if (btnTargetSingle) btnTargetSingle.disabled = true;
    if (btnTargetBatch) btnTargetBatch.disabled = true;
    disableExportButtons();
    return {
      getState: () => ({ currentTargetMode, discoveredCourses, selectedCourseIds, activeOrgUnitId, isExporting }),
      switchTargetMode,
      cleanCourseName,
      escapeHtml
    };
  }

  queryCourseStatusAndEnrolled();

  return {
    getState: () => ({ currentTargetMode, discoveredCourses, selectedCourseIds, activeOrgUnitId, isSingleCourseDetected, isExporting }),
    switchTargetMode,
    renderBatchCoursesList,
    handleCourseStatusResponse,
    handleEnrolledCoursesResponse,
    handleProgressMessage,
    startBatchExport,
    startExport,
    handleExportClick,
    cleanCourseName,
    escapeHtml
  };
}

// Browser extension entry point
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await initPopup(document, typeof chrome !== 'undefined' ? chrome : null);
    } catch (e) {
      console.error('Popup init failed:', e);
    }
  });
}

// Node.js test environment export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPopup,
    cleanCourseName,
    escapeHtml
  };
}
