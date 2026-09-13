document.addEventListener('DOMContentLoaded', async () => {
  const versionTag = document.getElementById('version-tag') || document.querySelector('.version-tag');
  if (versionTag && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionTag.textContent = `v${manifest.version.replace(/\.0$/, '')}`;
      }
    } catch (e) {
      console.warn('Could not retrieve manifest version:', e);
    }
  }

  const courseCard = document.getElementById('course-card');
  const statusBadge = document.getElementById('status-badge');
  const courseCompletedBadge = document.getElementById('course-completed-badge');
  const courseTitle = document.getElementById('course-title');
  const courseMeta = document.getElementById('course-meta');
  const btnExportCombined = document.getElementById('btn-export-combined');
  const btnExport = document.getElementById('btn-export');
  const btnExportMarkdown = document.getElementById('btn-export-markdown');
  const btnMarkCompleted = document.getElementById('btn-mark-completed');
  const btnMarkCompletedText = document.getElementById('btn-mark-completed-text');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const footerSettingsLink = document.getElementById('footer-settings-link');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressDetail = document.getElementById('progress-detail');
  const resultMessage = document.getElementById('result-message');
  const optDownloadAssets = document.getElementById('opt-download-assets');
  const optAutoMark = document.getElementById('opt-auto-mark');
  const modeNoticeBox = document.getElementById('mode-notice-box');
  const noticeIcon = document.getElementById('notice-icon');
  const noticeText = document.getElementById('notice-text');
  const scopeRadios = document.querySelectorAll('input[name="export-scope"]');

  let activeOrgUnitId = null;

  function openSettingsPage() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  }

  if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsPage);
  if (footerSettingsLink) footerSettingsLink.addEventListener('click', (e) => { e.preventDefault(); openSettingsPage(); });

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

  // Restore stored preferences
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['optDownloadAssets', 'exportScope', 'autoMarkCompleted'], (res) => {
      if (res.optDownloadAssets !== undefined) {
        optDownloadAssets.checked = res.optDownloadAssets;
      }
      if (res.autoMarkCompleted !== undefined && optAutoMark) {
        optAutoMark.checked = res.autoMarkCompleted;
      }
      if (res.exportScope) {
        const targetRadio = document.querySelector(`input[name="export-scope"][value="${res.exportScope}"]`);
        if (targetRadio) targetRadio.checked = true;
      }
      updateModeNotice();
    });
  }

  // Save preferences on change
  optDownloadAssets.addEventListener('change', () => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ optDownloadAssets: optDownloadAssets.checked });
    }
  });

  if (optAutoMark) {
    optAutoMark.addEventListener('change', () => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ autoMarkCompleted: optAutoMark.checked });
      }
    });
  }

  scopeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateModeNotice();
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ exportScope: radio.value });
      }
    });
  });

  function getSelectedScope() {
    const checked = document.querySelector('input[name="export-scope"]:checked');
    return checked ? checked.value : 'full';
  }

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('learn.uopeople.edu')) {
    statusBadge.textContent = 'Not Active';
    statusBadge.className = 'status-indicator error';
    courseTitle.textContent = 'Not on UoPeople Brightspace';
    courseMeta.textContent = 'Open any page inside https://learn.uopeople.edu to export course info.';
    return;
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

  // Listen for live progress events from content script and background runner
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'EXPORT_PROGRESS') {
      updateProgress(msg.percent, msg.status);
    }
    if (msg.action === 'BATCH_MARK_PROGRESS') {
      progressSection.classList.remove('hidden');
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
      progressSection.classList.remove('hidden');
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
  });

  function handleCourseStatusResponse(response) {
    if (!response || !response.detected) {
      statusBadge.textContent = 'No Course ID';
      statusBadge.className = 'status-indicator searching';
      if (courseCompletedBadge) courseCompletedBadge.classList.add('hidden');
      courseTitle.textContent = 'Brightspace Page Loaded';
      courseMeta.textContent = 'Navigate into a specific course (e.g. Course Home or Unit Lesson page).';
      return;
    }

    activeOrgUnitId = response.orgUnitId;
    statusBadge.textContent = 'Course Detected';
    statusBadge.className = 'status-indicator active';
    courseTitle.textContent = cleanCourseName(response.courseInfo && response.courseInfo.name) || (response.courseInfo && response.courseInfo.name) || `Course ${response.orgUnitId}`;
    courseMeta.textContent = `Course OrgUnit ID: ${response.orgUnitId}`;
    if (btnExportCombined) btnExportCombined.disabled = false;
    btnExport.disabled = false;
    btnExportMarkdown.disabled = false;
    if (btnMarkCompleted) btnMarkCompleted.disabled = false;

    if (response.isMarked) {
      if (courseCompletedBadge) {
        courseCompletedBadge.classList.remove('hidden');
        courseCompletedBadge.textContent = '✓ Completed';
        courseCompletedBadge.title = response.markedInfo ? `Marked on ${new Date(response.markedInfo.markedAt).toLocaleDateString()}` : 'Course completed';
      }
      if (btnMarkCompletedText) btnMarkCompletedText.textContent = 'Re-Mark Topics Completed';
    } else {
      if (courseCompletedBadge) courseCompletedBadge.classList.add('hidden');
      if (btnMarkCompletedText) btnMarkCompletedText.textContent = 'Mark All Topics Completed';
    }
  }

  // Ping content script with auto-injection fallback for already-open tabs
  function checkCourseStatus() {
    chrome.tabs.sendMessage(tab.id, { action: 'GET_COURSE_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be injected yet on this tab; auto-inject using scripting API
        if (chrome.scripting && tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['zip_builder.js', 'd2l_api.js', 'vendor_assets.js', 'html_builder.js', 'markdown_builder.js', 'content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'GET_COURSE_STATUS' }, (retryResponse) => {
                if (chrome.runtime.lastError || !retryResponse) {
                  handleCourseStatusResponse(null);
                } else {
                  handleCourseStatusResponse(retryResponse);
                }
              });
            }, 100);
          }).catch((err) => {
            console.warn('Auto-injection failed:', err);
            handleCourseStatusResponse(null);
          });
          return;
        }
        handleCourseStatusResponse(null);
        return;
      }
      handleCourseStatusResponse(response);
    });
  }

  checkCourseStatus();

  // Handle Mark Completed button click
  if (btnMarkCompleted) {
    btnMarkCompleted.addEventListener('click', () => {
      if (!activeOrgUnitId || !tab || !tab.id) return;

      btnExport.disabled = true;
      btnExportMarkdown.disabled = true;
      btnMarkCompleted.disabled = true;
      progressSection.classList.remove('hidden');
      resultMessage.classList.add('hidden');

      updateProgress(5, 'Fetching course Table of Contents to mark completed...');

      chrome.tabs.sendMessage(tab.id, {
        action: 'MARK_COURSE_COMPLETED',
        orgUnitId: activeOrgUnitId,
        showToast: true
      }, (response) => {
        btnExport.disabled = false;
        btnExportMarkdown.disabled = false;
        btnMarkCompleted.disabled = false;

        if (chrome.runtime.lastError || !response || !response.success) {
          const err = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Failed to mark topics.';
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
          progressSection.classList.add('hidden');
        }, 2500);
      });
    });
  }

  // Handle Combined Export button click (Primary)
  if (btnExportCombined) {
    btnExportCombined.addEventListener('click', () => {
      startExport('combined');
    });
  }

  // Handle HTML Export button click
  btnExport.addEventListener('click', () => {
    startExport('html');
  });

  // Handle Markdown Export button click
  btnExportMarkdown.addEventListener('click', () => {
    startExport('markdown');
  });

  function startExport(exportFormat) {
    if (!activeOrgUnitId) return;

    const exportScope = getSelectedScope();

    if (btnExportCombined) btnExportCombined.disabled = true;
    btnExport.disabled = true;
    btnExportMarkdown.disabled = true;
    progressSection.classList.remove('hidden');
    resultMessage.classList.add('hidden');

    const statusMsg = exportScope === 'shareable'
      ? 'Extracting shareable syllabus & reading guides...'
      : 'Initializing Brightspace Valence API...';

    updateProgress(5, statusMsg);

    chrome.tabs.sendMessage(tab.id, {
      action: 'START_EXPORT',
      orgUnitId: activeOrgUnitId,
      downloadAssets: optDownloadAssets.checked,
      exportFormat: exportFormat,
      exportScope: exportScope
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        const err = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Export failed.';
        updateProgress(0, `Error: ${err}`);
        if (btnExportCombined) btnExportCombined.disabled = false;
        btnExport.disabled = false;
        btnExportMarkdown.disabled = false;
        return;
      }

      updateProgress(100, `Done! Extracted ${response.unitsCount} units (${exportScope === 'shareable' ? 'Peer-Safe' : 'Full'}).`);
      setTimeout(() => {
        progressSection.classList.add('hidden');
        resultMessage.classList.remove('hidden');
        if (btnExportCombined) btnExportCombined.disabled = false;
        btnExport.disabled = false;
        btnExportMarkdown.disabled = false;
      }, 1000);
    });
  }

  function updateProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    if (text) {
      progressDetail.textContent = text;
    }
  }
});
