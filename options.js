document.addEventListener('DOMContentLoaded', async () => {
  // 1. Populate manifest version
  const versionTag = document.getElementById('version-tag');
  if (versionTag && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionTag.textContent = `v${manifest.version.replace(/\.0$/, '')}`;
      }
    } catch (e) {}
  }

  // 2. DOM Elements
  const optAutoMark = document.getElementById('opt-auto-mark');
  const autoMarkBadge = document.getElementById('auto-mark-status-badge');
  const optDownloadAssets = document.getElementById('opt-download-assets');
  const optExportScope = document.getElementById('opt-export-scope');
  const optExportFormat = document.getElementById('opt-export-format');
  const optActiveCoursesFolder = document.getElementById('opt-active-courses-folder');
  const btnResetActiveCoursesFolder = document.getElementById('btn-reset-active-courses-folder');

  const DEFAULT_ACTIVE_FOLDER = 'S:\\01_ACADEMIC_STUDY\\UoPeople as Student\\01_ACTIVE_COURSES';

  const activeTabDesc = document.getElementById('active-tab-desc');
  const btnRefreshActiveTab = document.getElementById('btn-refresh-active-tab');
  const activeCourseOu = document.getElementById('active-course-ou');
  const activeCourseStatus = document.getElementById('active-course-status');
  const activeCourseName = document.getElementById('active-course-name');
  const activeCourseHint = document.getElementById('active-course-hint');
  const btnMarkActiveCourse = document.getElementById('btn-mark-active-course');
  const btnMarkActiveText = document.getElementById('btn-mark-active-text');

  const activeProgressWrap = document.getElementById('active-progress-wrap');
  const activeProgressText = document.getElementById('active-progress-text');
  const activeProgressPct = document.getElementById('active-progress-pct');
  const activeProgressFill = document.getElementById('active-progress-fill');

  const markedCoursesCount = document.getElementById('marked-courses-count');
  const btnClearMarkedCourses = document.getElementById('btn-clear-marked-courses');
  const markedCoursesTable = document.getElementById('marked-courses-table');
  const markedCoursesTbody = document.getElementById('marked-courses-tbody');
  const markedEmptyState = document.getElementById('marked-empty-state');

  const settingsToast = document.getElementById('settings-toast');
  const settingsToastMsg = document.getElementById('settings-toast-msg');

  let activeTabId = null;
  let activeCourseInfo = null;
  let toastTimer = null;

  function showToast(message, isSuccess = true) {
    if (!settingsToast || !settingsToastMsg) return;
    if (toastTimer) clearTimeout(toastTimer);

    settingsToastMsg.textContent = message;
    const icon = settingsToast.querySelector('.toast-icon');
    if (icon) {
      icon.textContent = isSuccess ? '✓' : '⚠️';
      icon.style.color = isSuccess ? '#34d399' : '#fbbf24';
    }

    settingsToast.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      settingsToast.classList.add('hidden');
    }, 3200);
  }

  function updateAutoMarkBadge(enabled) {
    if (!autoMarkBadge) return;
    if (enabled) {
      autoMarkBadge.textContent = 'Active (Enabled)';
      autoMarkBadge.className = 'badge badge-active';
    } else {
      autoMarkBadge.textContent = 'Off by default';
      autoMarkBadge.className = 'badge badge-neutral';
    }
  }

  // 3. Load stored preferences
  function loadStoredSettings() {
    if (!chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(['autoMarkCompleted', 'optDownloadAssets', 'exportScope', 'exportFormat', 'activeCoursesFolder', 'markedCourses'], (res) => {
      // Auto-Mark
      const isAutoMark = !!res.autoMarkCompleted;
      optAutoMark.checked = isAutoMark;
      updateAutoMarkBadge(isAutoMark);

      // Download assets
      if (res.optDownloadAssets !== undefined) {
        optDownloadAssets.checked = !!res.optDownloadAssets;
      }

      // Export scope
      if (res.exportScope && optExportScope) {
        optExportScope.value = res.exportScope;
      }

      // Export format
      if (optExportFormat) {
        optExportFormat.value = res.exportFormat || 'combined';
      }

      // Active courses folder
      if (optActiveCoursesFolder) {
        optActiveCoursesFolder.value = res.activeCoursesFolder || DEFAULT_ACTIVE_FOLDER;
      }

      // Marked courses
      renderMarkedCoursesTable(res.markedCourses || {});
    });
  }

  loadStoredSettings();

  // 4. Bind preference changes
  optAutoMark.addEventListener('change', () => {
    const enabled = optAutoMark.checked;
    updateAutoMarkBadge(enabled);
    chrome.storage.local.set({ autoMarkCompleted: enabled }, () => {
      showToast(enabled ? 'Auto-Marking enabled. Future course visits will be completed automatically.' : 'Auto-Marking turned off.');
    });
  });

  optDownloadAssets.addEventListener('change', () => {
    chrome.storage.local.set({ optDownloadAssets: optDownloadAssets.checked }, () => {
      showToast('Attachment download preference updated.');
    });
  });

  optExportScope.addEventListener('change', () => {
    chrome.storage.local.set({ exportScope: optExportScope.value }, () => {
      showToast('Default export mode updated.');
    });
  });

  if (optExportFormat) {
    optExportFormat.addEventListener('change', () => {
      chrome.storage.local.set({ exportFormat: optExportFormat.value }, () => {
        showToast('Default export format updated.');
      });
    });
  }

  if (optActiveCoursesFolder) {
    optActiveCoursesFolder.addEventListener('change', () => {
      const val = (optActiveCoursesFolder.value || '').trim() || DEFAULT_ACTIVE_FOLDER;
      optActiveCoursesFolder.value = val;
      chrome.storage.local.set({ activeCoursesFolder: val }, () => {
        showToast('Active courses directory updated.');
      });
    });
  }

  if (btnResetActiveCoursesFolder) {
    btnResetActiveCoursesFolder.addEventListener('click', () => {
      if (optActiveCoursesFolder) {
        optActiveCoursesFolder.value = DEFAULT_ACTIVE_FOLDER;
        chrome.storage.local.set({ activeCoursesFolder: DEFAULT_ACTIVE_FOLDER }, () => {
          showToast('Reset to default active courses directory.');
        });
      }
    });
  }

  // 5. Render Marked Courses History Table
  function renderMarkedCoursesTable(markedCoursesMap) {
    const entries = Object.values(markedCoursesMap || {});
    const count = entries.length;

    markedCoursesCount.textContent = count;

    if (count === 0) {
      markedCoursesTable.classList.add('hidden');
      markedEmptyState.classList.remove('hidden');
      btnClearMarkedCourses.disabled = true;
      markedCoursesTbody.innerHTML = '';
      return;
    }

    markedCoursesTable.classList.remove('hidden');
    markedEmptyState.classList.add('hidden');
    btnClearMarkedCourses.disabled = false;

    // Sort by markedAt descending (most recent first)
    entries.sort((a, b) => new Date(b.markedAt || 0) - new Date(a.markedAt || 0));

    markedCoursesTbody.innerHTML = '';
    entries.forEach(course => {
      const tr = document.createElement('tr');

      const dateStr = course.markedAt
        ? new Date(course.markedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Unknown';

      const itemsCount = course.topicsCount !== undefined
        ? `${course.completedCount || course.topicsCount} / ${course.topicsCount}`
        : 'All';

      tr.innerHTML = `
        <td>
          <strong style="color: var(--text-main);">${escapeHtml(course.courseName || `Course ${course.orgUnitId}`)}</strong>
        </td>
        <td>
          <code style="font-family: 'JetBrains Mono', monospace; color: var(--accent-rose-light); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${escapeHtml(String(course.orgUnitId))}</code>
        </td>
        <td style="color: var(--text-secondary);">${escapeHtml(dateStr)}</td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 4px; background: var(--success-bg); color: #34d399; border: 1px solid var(--success-border); padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px;">
            ✓ ${itemsCount} items
          </span>
        </td>
        <td class="text-right">
          <button class="btn btn-sm btn-secondary btn-unflag" data-ou="${escapeHtml(String(course.orgUnitId))}" title="Remove flag so this course can be completed again">
            Unflag / Reset
          </button>
        </td>
      `;

      markedCoursesTbody.appendChild(tr);
    });

    // Attach unflag click events
    markedCoursesTbody.querySelectorAll('.btn-unflag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ou = e.currentTarget.getAttribute('data-ou') || e.target.getAttribute('data-ou');
        if (ou) {
          unflagCourse(ou);
        }
      });
    });
  }

  function unflagCourse(orgUnitId) {
    chrome.storage.local.get(['markedCourses'], (res) => {
      const marked = res.markedCourses || {};
      const key = String(orgUnitId);
      if (marked[key] || marked[orgUnitId]) {
        const courseName = (marked[key] && marked[key].courseName) || (marked[orgUnitId] && marked[orgUnitId].courseName) || `Course ${orgUnitId}`;
        delete marked[key];
        delete marked[orgUnitId];
        chrome.storage.local.set({ markedCourses: marked }, () => {
          renderMarkedCoursesTable(marked);
          showToast(`Course "${courseName}" unflagged. It will be re-marked on next visit.`);
          checkActiveBrightspaceTab();
        });
      }
    });
  }

  // 6. Clear All Marked Courses
  btnClearMarkedCourses.addEventListener('click', () => {
    const confirmClear = confirm('Are you sure you want to clear all marked courses from history? All courses will be eligible for re-completion.');
    if (!confirmClear) return;

    chrome.storage.local.set({ markedCourses: {} }, () => {
      renderMarkedCoursesTable({});
      showToast('All marked courses cleared from history.');
      checkActiveBrightspaceTab();
    });
  });

  // 7. Active Brightspace Tab Scanning & Manual Mark
  async function checkActiveBrightspaceTab() {
    activeTabDesc.textContent = 'Scanning open tabs for learn.uopeople.edu...';

    // Helper: score a tab based on likelihood of being an active course page
    const isCourseUrl = (url) => {
      if (!url) return false;
      return /\/d2l\/(?:home\/\d+|le\/(?:lessons|content)\/\d+)/i.test(url) || (/[?&]ou=\d+/i.test(url) && !url.includes('ou=6606'));
    };

    let allTabs = [];
    try {
      allTabs = await chrome.tabs.query({});
    } catch (e) {
      allTabs = await chrome.tabs.query({ currentWindow: true });
    }

    const uopTabs = (allTabs || []).filter(t => t.url && t.url.includes('learn.uopeople.edu'));
    let targetTab = uopTabs.find(t => isCourseUrl(t.url) && t.active) ||
                    uopTabs.find(t => isCourseUrl(t.url)) ||
                    uopTabs.find(t => t.active) ||
                    uopTabs[0];

    if (!targetTab || !targetTab.id) {
      activeTabDesc.textContent = 'No Brightspace tab currently open.';
      activeCourseOu.textContent = 'No Tab';
      activeCourseStatus.textContent = 'Not Open';
      activeCourseStatus.className = 'status-chip chip-neutral';
      activeCourseName.textContent = 'No Brightspace tab detected';
      activeCourseHint.textContent = 'Open any course on https://learn.uopeople.edu to perform quick actions.';
      btnMarkActiveCourse.disabled = true;
      activeTabId = null;
      activeCourseInfo = null;
      return;
    }

    activeTabId = targetTab.id;
    activeTabDesc.textContent = `Found Brightspace tab: ${targetTab.title || targetTab.url}`;

    // Query course status from content script
    queryTabCourseStatus(targetTab.id);
  }

  function queryTabCourseStatus(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'GET_COURSE_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might need to be injected
        if (chrome.scripting) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['zip_builder.js', 'd2l_api.js', 'vendor_assets.js', 'html_builder.js', 'markdown_builder.js', 'content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { action: 'GET_COURSE_STATUS' }, (retryRes) => {
                handleActiveTabStatus(retryRes);
              });
            }, 150);
          }).catch(() => {
            handleActiveTabStatus(null);
          });
          return;
        }
        handleActiveTabStatus(null);
        return;
      }
      handleActiveTabStatus(response);
    });
  }

  function handleActiveTabStatus(res) {
    if (!res || !res.detected) {
      activeCourseOu.textContent = 'Brightspace';
      activeCourseStatus.textContent = 'Dashboard / Home';
      activeCourseStatus.className = 'status-chip chip-warning';
      activeCourseName.textContent = 'Not inside a specific course';
      activeCourseHint.textContent = 'Navigate inside any course unit or lesson page in Brightspace.';
      btnMarkActiveCourse.disabled = true;
      activeCourseInfo = null;
      return;
    }

    activeCourseInfo = res;
    const cleanName = (res.courseInfo && res.courseInfo.name) || `Course ${res.orgUnitId}`;
    activeCourseOu.textContent = `OU: ${res.orgUnitId}`;
    activeCourseName.textContent = cleanName;
    btnMarkActiveCourse.disabled = false;

    if (res.isMarked) {
      activeCourseStatus.textContent = '✓ Marked Completed';
      activeCourseStatus.className = 'status-chip chip-success';
      activeCourseHint.textContent = res.markedInfo
        ? `Completed on ${new Date(res.markedInfo.markedAt).toLocaleDateString()} (${res.markedInfo.topicsCount || 0} topics).`
        : 'Flagged as completed in local storage.';
      btnMarkActiveText.textContent = 'Re-Mark This Course Completed';
    } else {
      activeCourseStatus.textContent = 'Not Marked Yet';
      activeCourseStatus.className = 'status-chip chip-warning';
      activeCourseHint.textContent = 'Course is ready to be marked as completed.';
      btnMarkActiveText.textContent = 'Mark Current Course Completed Now';
    }
  }

  btnRefreshActiveTab.addEventListener('click', checkActiveBrightspaceTab);
  checkActiveBrightspaceTab();

  // 8. Manual Mark Course Button
  btnMarkActiveCourse.addEventListener('click', () => {
    if (!activeTabId || !activeCourseInfo || !activeCourseInfo.orgUnitId) return;

    btnMarkActiveCourse.disabled = true;
    activeProgressWrap.classList.remove('hidden');
    updateActiveProgress(5, 'Fetching course Table of Contents...');

    chrome.tabs.sendMessage(activeTabId, {
      action: 'MARK_COURSE_COMPLETED',
      orgUnitId: activeCourseInfo.orgUnitId,
      showToast: true
    }, (response) => {
      btnMarkActiveCourse.disabled = false;

      if (chrome.runtime.lastError || !response || !response.success) {
        const err = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Failed to complete course.';
        updateActiveProgress(0, `Error: ${err}`);
        showToast(`Failed: ${err}`, false);
        return;
      }

      const res = response.result || {};
      if (res.inProgress) {
        updateActiveProgress(50, 'Course topic completion is currently running in background...');
        showToast('Topic completion is actively running in this tab.', false);
        return;
      }

      updateActiveProgress(100, `Done! Marked ${res.completed || 0} of ${res.total || 0} topics.`);
      showToast(`Course "${activeCourseName.textContent}" successfully marked as completed!`);

      // Refresh marked courses list and tab status
      loadStoredSettings();
      setTimeout(() => {
        checkActiveBrightspaceTab();
        activeProgressWrap.classList.add('hidden');
      }, 2500);
    });
  });

  function updateActiveProgress(percent, text) {
    if (activeProgressFill) activeProgressFill.style.width = `${percent}%`;
    if (activeProgressPct) activeProgressPct.textContent = `${percent}%`;
    if (activeProgressText && text) activeProgressText.textContent = text;
  }

  // 9. Listen for live runtime progress & storage updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'BATCH_MARK_PROGRESS') {
      activeProgressWrap.classList.remove('hidden');
      updateActiveProgress(msg.percent, msg.status);
    }
    if (msg.action === 'BATCH_COURSES_COMPLETED') {
      const count = msg.completedCourses || msg.totalCourses;
      updateActiveProgress(100, `Done! Completed ${count} course${count > 1 ? 's' : ''} (${msg.totalTopics || 0} topics).`);
      showToast(`All attending courses completed! (${count} courses marked)`);
      loadStoredSettings();
      checkActiveBrightspaceTab();
      setTimeout(() => {
        if (activeProgressWrap) activeProgressWrap.classList.add('hidden');
      }, 3500);
    }
    if (msg.action === 'COURSE_MARK_PROGRESS') {
      if (!activeCourseInfo || String(msg.orgUnitId) === String(activeCourseInfo.orgUnitId)) {
        activeProgressWrap.classList.remove('hidden');
        updateActiveProgress(msg.percent, msg.status);
      }
    }
    if (msg.action === 'COURSE_MARKED_COMPLETED') {
      const res = msg.result || {};
      const count = res.verified !== undefined ? res.verified : (res.visited || 0);
      updateActiveProgress(100, `Done! Verified ${count} of ${res.total || 0} topics.`);
      showToast(`Course completed! (${count} verified in Brightspace)`);
      loadStoredSettings();
      checkActiveBrightspaceTab();
      setTimeout(() => {
        if (activeProgressWrap) activeProgressWrap.classList.add('hidden');
      }, 3500);
    }
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.markedCourses) {
          renderMarkedCoursesTable(changes.markedCourses.newValue || {});
        }
        if (changes.autoMarkCompleted !== undefined) {
          const val = !!changes.autoMarkCompleted.newValue;
          optAutoMark.checked = val;
          updateAutoMarkBadge(val);
        }
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
