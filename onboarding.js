/**
 * First-Time Onboarding Logic for Offline Course Exporter
 * Sets user preference for automatic course page completion and term start downloads
 */

document.addEventListener('DOMContentLoaded', () => {
  const questionView = document.getElementById('question-view');
  const confirmedView = document.getElementById('confirmed-view');
  const confirmedSummary = document.getElementById('confirmed-summary');
  const btnChoiceYes = document.getElementById('btn-choice-yes');
  const btnChoiceNo = document.getElementById('btn-choice-no');
  const btnCloseOnboarding = document.getElementById('btn-close-onboarding');
  const onboardingActiveFolder = document.getElementById('onboarding-active-folder');
  const btnBrowseFolder = document.getElementById('btn-onboarding-browse-folder');
  const btnClearFolder = document.getElementById('btn-onboarding-clear-folder');
  const onboardingAutoDownload = document.getElementById('onboarding-auto-download');

  // Load any previously saved settings (no hardcoded default pre-filled)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['activeCoursesFolder', 'autoDownloadCourses'], (res) => {
      if (res?.activeCoursesFolder && onboardingActiveFolder) {
        onboardingActiveFolder.value = res.activeCoursesFolder;
      } else if (onboardingActiveFolder) {
        fetch('http://127.0.0.1:4048/get-folder')
          .then(r => r.json())
          .then(d => {
            if (d && d.folder) {
              onboardingActiveFolder.value = d.folder;
              chrome.storage.local.set({ activeCoursesFolder: d.folder });
            }
          })
          .catch(() => {});
      }
      if (typeof res?.autoDownloadCourses === 'boolean' && onboardingAutoDownload) {
        onboardingAutoDownload.checked = res.autoDownloadCourses;
      }
    });
  }

  // Native folder picker via helper daemon on port 4048
  if (btnBrowseFolder) {
    btnBrowseFolder.addEventListener('click', async () => {
      btnBrowseFolder.disabled = true;
      btnBrowseFolder.textContent = 'Selecting...';
      try {
        const resp = await fetch('http://127.0.0.1:4048/select-folder', { method: 'POST' });
        if (resp.ok) {
          const data = await resp.json();
          if (data.folder) {
            if (onboardingActiveFolder) onboardingActiveFolder.value = data.folder;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ activeCoursesFolder: data.folder });
            }
          }
        }
      } catch (e) {
        alert('Could not connect to helper daemon on port 4048. Please paste the folder path directly or launch scripts/course_exporter_daemon.py.');
      } finally {
        btnBrowseFolder.disabled = false;
        btnBrowseFolder.textContent = 'Browse...';
      }
    });
  }

  if (btnClearFolder && onboardingActiveFolder) {
    btnClearFolder.addEventListener('click', () => {
      onboardingActiveFolder.value = '';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ activeCoursesFolder: '' });
      }
    });
  }

  function getSelectedActiveFolder() {
    return onboardingActiveFolder ? (onboardingActiveFolder.value || '').trim() : '';
  }

  function savePreference(autoMark) {
    const activeFolder = getSelectedActiveFolder();
    const autoDownload = onboardingAutoDownload ? onboardingAutoDownload.checked : true;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        autoMarkCompleted: autoMark,
        autoDownloadCourses: autoDownload,
        activeCoursesFolder: activeFolder,
        exportFormat: 'combined',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString()
      }, () => {
        displayConfirmation(autoMark, activeFolder, autoDownload);
      });
    } else {
      displayConfirmation(autoMark, activeFolder, autoDownload);
    }

    if (activeFolder) {
      fetch('http://127.0.0.1:4048/process-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeCoursesFolder: activeFolder, fileName: '', courseName: '' })
      }).catch(() => {});
    }
  }

  function displayConfirmation(autoMark, activeFolder, autoDownload) {
    if (questionView) questionView.classList.add('hidden');
    if (confirmedView) confirmedView.classList.remove('hidden');

    if (confirmedSummary) {
      let html = '';
      if (autoMark) {
        html += '<strong>Auto-Marking is Enabled.</strong> When you open <a href="https://learn.uopeople.edu" target="_blank" style="color: var(--accent-rose-light); text-decoration: underline;">learn.uopeople.edu</a> on term start, course topics will be marked complete.<br><br>';
      } else {
        html += '<strong>Manual Mode is Selected.</strong> Course pages will not be auto-marked.<br><br>';
      }

      if (autoDownload) {
        html += '<strong>Term Start Auto-Download is Enabled.</strong> Complete offline study packages (combined HTML + Markdown notes) will be downloaded on day one.<br><br>';
      } else {
        html += '<strong>Auto-Download is Disabled.</strong> Course packages can be downloaded on-demand from the extension popup.<br><br>';
      }

      const folderDisplay = activeFolder || '<em>Not configured (will ask or use default Downloads)</em>';
      html += `<strong>Active Courses Directory:</strong> <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px;">${folderDisplay}</code>`;
      confirmedSummary.innerHTML = html;
    }
  }

  if (btnChoiceYes) {
    btnChoiceYes.addEventListener('click', () => {
      savePreference(true);
    });
  }

  if (btnChoiceNo) {
    btnChoiceNo.addEventListener('click', () => {
      savePreference(false);
    });
  }

  if (btnCloseOnboarding) {
    btnCloseOnboarding.addEventListener('click', () => {
      try {
        window.close();
      } catch (e) {
        window.location.href = 'options.html';
      }
    });
  }
});
