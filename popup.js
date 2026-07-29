document.addEventListener('DOMContentLoaded', async () => {
  const courseCard = document.getElementById('course-card');
  const statusBadge = document.getElementById('status-badge');
  const courseTitle = document.getElementById('course-title');
  const courseMeta = document.getElementById('course-meta');
  const btnExport = document.getElementById('btn-export');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressDetail = document.getElementById('progress-detail');
  const resultMessage = document.getElementById('result-message');
  const optDownloadAssets = document.getElementById('opt-download-assets');

  let activeOrgUnitId = null;

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('learn.uopeople.edu')) {
    statusBadge.textContent = 'Not Active';
    statusBadge.className = 'status-indicator error';
    courseTitle.textContent = 'Not on UoPeople Brightspace';
    courseMeta.textContent = 'Open any page inside https://learn.uopeople.edu to export course info.';
    return;
  }

  // Ping content script
  chrome.tabs.sendMessage(tab.id, { action: 'GET_COURSE_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.detected) {
      statusBadge.textContent = 'No Course ID';
      statusBadge.className = 'status-indicator searching';
      courseTitle.textContent = 'Brightspace Page Loaded';
      courseMeta.textContent = 'Navigate into a specific course (e.g. Course Home or Unit Lesson page).';
      return;
    }

    activeOrgUnitId = response.orgUnitId;
    statusBadge.textContent = 'Course Detected';
    statusBadge.className = 'status-indicator active';
    courseTitle.textContent = response.courseInfo.name;
    courseMeta.textContent = `Course OrgUnit ID: ${response.orgUnitId}`;
    btnExport.disabled = false;
  });

  // Handle Export button click
  btnExport.addEventListener('click', () => {
    if (!activeOrgUnitId) return;

    btnExport.disabled = true;
    progressSection.classList.remove('hidden');
    resultMessage.classList.add('hidden');

    updateProgress(20, 'Querying Brightspace Valence API...');

    chrome.tabs.sendMessage(tab.id, {
      action: 'START_EXPORT',
      orgUnitId: activeOrgUnitId,
      downloadAssets: optDownloadAssets.checked
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        const err = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Export failed.';
        updateProgress(0, `Error: ${err}`);
        btnExport.disabled = false;
        return;
      }

      updateProgress(100, `Done! Extracted ${response.unitsCount} units.`);
      setTimeout(() => {
        progressSection.classList.add('hidden');
        resultMessage.classList.remove('hidden');
        btnExport.disabled = false;
      }, 1000);
    });
  });

  function updateProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressDetail.textContent = text;
  }
});
