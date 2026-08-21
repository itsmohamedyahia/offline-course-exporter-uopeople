document.addEventListener('DOMContentLoaded', async () => {
  const courseCard = document.getElementById('course-card');
  const statusBadge = document.getElementById('status-badge');
  const courseTitle = document.getElementById('course-title');
  const courseMeta = document.getElementById('course-meta');
  const btnExport = document.getElementById('btn-export');
  const btnExportMarkdown = document.getElementById('btn-export-markdown');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressDetail = document.getElementById('progress-detail');
  const resultMessage = document.getElementById('result-message');
  const optDownloadAssets = document.getElementById('opt-download-assets');
  const copyrightWarningBox = document.getElementById('copyright-warning-box');
  const scopeRadios = document.querySelectorAll('input[name="export-scope"]');

  let activeOrgUnitId = null;

  function updateWarningHighlight() {
    const isShareable = getSelectedScope() === 'shareable';
    if (copyrightWarningBox) {
      if (isShareable) {
        copyrightWarningBox.classList.add('highlight');
      } else {
        copyrightWarningBox.classList.remove('highlight');
      }
    }
  }

  // Restore stored preferences
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['optDownloadAssets', 'exportScope'], (res) => {
      if (res.optDownloadAssets !== undefined) {
        optDownloadAssets.checked = res.optDownloadAssets;
      }
      if (res.exportScope) {
        const targetRadio = document.querySelector(`input[name="export-scope"][value="${res.exportScope}"]`);
        if (targetRadio) targetRadio.checked = true;
      }
      updateWarningHighlight();
    });
  }

  // Save preferences on change
  optDownloadAssets.addEventListener('change', () => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ optDownloadAssets: optDownloadAssets.checked });
    }
  });

  scopeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateWarningHighlight();
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

  // Listen for live progress events from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'EXPORT_PROGRESS') {
      updateProgress(msg.percent, msg.status);
    }
  });

  function handleCourseStatusResponse(response) {
    if (!response || !response.detected) {
      statusBadge.textContent = 'No Course ID';
      statusBadge.className = 'status-indicator searching';
      courseTitle.textContent = 'Brightspace Page Loaded';
      courseMeta.textContent = 'Navigate into a specific course (e.g. Course Home or Unit Lesson page).';
      return;
    }

    activeOrgUnitId = response.orgUnitId;
    statusBadge.textContent = 'Course Detected';
    statusBadge.className = 'status-indicator active';
    courseTitle.textContent = cleanCourseName(response.courseInfo && response.courseInfo.name) || (response.courseInfo && response.courseInfo.name) || `Course ${response.orgUnitId}`;
    courseMeta.textContent = `Course OrgUnit ID: ${response.orgUnitId}`;
    btnExport.disabled = false;
    btnExportMarkdown.disabled = false;
  }

  // Ping content script with auto-injection fallback for already-open tabs
  function checkCourseStatus() {
    chrome.tabs.sendMessage(tab.id, { action: 'GET_COURSE_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be injected yet on this tab; auto-inject using scripting API
        if (chrome.scripting && tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['zip_builder.js', 'd2l_api.js', 'html_builder.js', 'markdown_builder.js', 'content.js']
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

  // Handle Export button click
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
        btnExport.disabled = false;
        btnExportMarkdown.disabled = false;
        return;
      }

      updateProgress(100, `Done! Extracted ${response.unitsCount} units (${exportScope === 'shareable' ? 'Peer-Safe' : 'Full'}).`);
      setTimeout(() => {
        progressSection.classList.add('hidden');
        resultMessage.classList.remove('hidden');
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
