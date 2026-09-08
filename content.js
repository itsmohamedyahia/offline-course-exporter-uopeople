/**
 * Content Script injected into Brightspace pages
 */
(function () {
  if (window.__UOP_COURSE_EXPORTER_LOADED__) {
    return;
  }
  window.__UOP_COURSE_EXPORTER_LOADED__ = true;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function detectOrgUnitId() {
    const url = window.location.href;
    const pathname = (window.location.pathname || '').replace(/\/+$/, '').toLowerCase();

    // 1. Immediately exclude root landing portal, home, login, and system preference pages
    if (/^\/d2l\/(?:home$|lp\/(?:homepage|preferences|profile|notifications|accountsettings)|login)/i.test(pathname)) {
      return null;
    }

    // 2. Match standard Brightspace course URL paths with orgUnitId
    let match = url.match(/\/d2l\/home\/(\d+)/i);
    if (match && match[1] !== '6606') return match[1];

    match = url.match(/\/d2l\/le\/lessons\/(\d+)/i);
    if (match && match[1] !== '6606') return match[1];

    match = url.match(/\/d2l\/le\/content\/(\d+)/i);
    if (match && match[1] !== '6606') return match[1];

    // 3. Match ?ou= query parameter (e.g. quizzing, dropbox, discussions, calendar, grades)
    // Exclude the root UoPeople institution orgUnitId (6606)
    match = url.match(/[?&]ou=(\d+)/i);
    if (match && match[1] !== '6606') return match[1];

    // 4. Safe DOM fallback: strictly search inside Brightspace course navigation header
    const navLink = document.querySelector('.d2l-navigation-s-header a.d2l-navigation-s-link[href*="/d2l/home/"], a.d2l-navigation-s-link[href*="/d2l/home/"]');
    if (navLink && navLink.href) {
      const m = navLink.href.match(/\/d2l\/home\/(\d+)/i);
      if (m && m[1] !== '6606') return m[1];
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_COURSE_STATUS') {
      const orgUnitId = detectOrgUnitId();
      if (!orgUnitId) {
        sendResponse({
          detected: false,
          message: 'Not on a recognized UoPeople course page'
        });
        return true;
      }

      Promise.all([
        D2LApi.getCourseInfo(orgUnitId),
        new Promise(resolve => chrome.storage.local.get(['markedCourses', 'autoMarkCompleted'], resolve))
      ]).then(([courseInfo, storageData]) => {
        const markedCourses = (storageData && storageData.markedCourses) || {};
        const isMarked = !!markedCourses[orgUnitId];
        sendResponse({
          detected: true,
          orgUnitId: orgUnitId,
          courseInfo: courseInfo,
          isMarked: isMarked,
          markedInfo: markedCourses[orgUnitId] || null,
          autoMarkCompleted: !!(storageData && storageData.autoMarkCompleted)
        });
      }).catch(err => {
        sendResponse({
          detected: true,
          orgUnitId: orgUnitId,
          courseInfo: { id: orgUnitId, name: `Course ${orgUnitId}` },
          isMarked: false,
          error: err.message
        });
      });

      return true;
    }

    if (request.action === 'MARK_COURSE_COMPLETED') {
      const orgUnitId = request.orgUnitId || detectOrgUnitId();
      if (!orgUnitId) {
        sendResponse({ success: false, error: 'Could not identify course ID.' });
        return true;
      }

      triggerCourseCompletion(orgUnitId, request.showToast !== false)
        .then(result => sendResponse({ success: true, result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'BATCH_MARK_PROGRESS') {
      const title = `[Course ${request.courseIndex}/${request.totalCourses}] ${request.currentCourseName || 'Auto-Marking'}`;
      showCompletionToast(title, request.current || 0, request.total || 100, request.percent, request.status, false);
      return false;
    }

    if (request.action === 'BATCH_COURSES_COMPLETED') {
      isBatchMarkingInProgress = false;
      const count = request.completedCourses || request.totalCourses;
      const summary = `Done! Completed ${count} attending course${count > 1 ? 's' : ''} (${request.totalTopics || 0} topics marked).`;
      showCompletionToast('All Enrolled Courses Completed', count, request.totalCourses, 100, summary, true);
      return false;
    }

    if (request.action === 'COURSE_MARK_PROGRESS') {
      const currentOu = detectOrgUnitId();
      if (currentOu && String(request.orgUnitId) === String(currentOu)) {
        D2LApi.getCourseInfo(currentOu).then(courseInfo => {
          const cleanName = (courseInfo && courseInfo.name) || `Course ${currentOu}`;
          showCompletionToast(cleanName, request.current, request.total, request.percent, request.status, false);
        }).catch(() => {
          showCompletionToast(`Course ${currentOu}`, request.current, request.total, request.percent, request.status, false);
        });
      }
      return false;
    }

    if (request.action === 'COURSE_MARKED_COMPLETED') {
      const currentOu = detectOrgUnitId();
      if (currentOu && String(request.orgUnitId) === String(currentOu)) {
        D2LApi.getCourseInfo(currentOu).then(courseInfo => {
          const cleanName = (courseInfo && courseInfo.name) || `Course ${currentOu}`;
          const res = request.result || {};
          const count = res.verified !== undefined ? res.verified : (res.visited || 0);
          showCompletionToast(cleanName, count, res.total || 0, 100, `Completed! Verified ${count} of ${res.total || 0} items on Brightspace.`, true);
        }).catch(() => {
          showCompletionToast(`Course ${currentOu}`, 0, 0, 100, 'Completed marking course!', true);
        });
      }
      return false;
    }

    if (request.action === 'START_EXPORT') {
      const orgUnitId = request.orgUnitId || detectOrgUnitId();
      const downloadAssets = request.downloadAssets !== false;
      const exportFormat = request.exportFormat || 'html';
      const exportScope = request.exportScope || 'full';

      if (!orgUnitId) {
        sendResponse({ success: false, error: 'Could not identify course ID.' });
        return true;
      }

      runExportPipeline(orgUnitId, downloadAssets, exportFormat, exportScope, sendResponse);
      return true;
    }
  });

  function emitProgress(percent, status) {
    try {
      chrome.runtime.sendMessage({
        action: 'EXPORT_PROGRESS',
        percent: Math.min(Math.max(percent, 0), 100),
        status: status
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }

  async function runExportPipeline(orgUnitId, downloadAssets, exportFormat, exportScope, sendResponse) {
    try {
      console.log(`Starting export pipeline for OrgUnitID: ${orgUnitId} (Format: ${exportFormat}, Scope: ${exportScope})`);
      emitProgress(8, 'Fetching course Table of Contents...');

      const courseInfo = await D2LApi.getCourseInfo(orgUnitId);
      const tocData = await D2LApi.getTOC(orgUnitId);
      if (!tocData) {
        throw new Error('Unable to retrieve course Table of Contents.');
      }

      let dropboxFolders = [];
      let discussionForums = [];
      let rubricsList = [];
      const rubricsMap = {};
      const discussionTopics = [];
      let quizzesList = [];

      // In Shareable mode, we skip fetching assignment rubrics, dropbox folders, and quizzes
      if (exportScope !== 'shareable') {
        emitProgress(16, 'Querying discussions, assignments, rubrics & quizzes...');
        console.log('Fetching course assignment activities, discussions, rubrics and quizzes from D2L API...');
        try {
          const [dropboxes, forums, rubrics, quizzesValence, quizzesLms] = await Promise.all([
            D2LApi.getDropboxFolders(orgUnitId).catch(err => { console.warn('Dropbox folders API failed:', err); return []; }),
            D2LApi.getDiscussionForums(orgUnitId).catch(err => { console.warn('Discussion forums API failed:', err); return []; }),
            D2LApi.getRubricsList(orgUnitId).catch(err => { console.warn('Rubrics list API failed:', err); return []; }),
            D2LApi.getQuizzesList(orgUnitId).catch(err => { console.warn('Quizzes list API failed:', err); return []; }),
            D2LApi.getQuizzesFromLms(orgUnitId).catch(err => { console.warn('Quizzes LMS scraper failed:', err); return []; })
          ]);
          dropboxFolders = dropboxes || [];
          discussionForums = forums || [];
          rubricsList = rubrics || [];
          quizzesList = [...(quizzesValence || []), ...(quizzesLms || [])];

          if (discussionForums.length > 0) {
            await Promise.all(discussionForums.map(async (forum) => {
              try {
                const topics = await D2LApi.getDiscussionTopics(orgUnitId, forum.ForumId);
                if (topics) {
                  topics.forEach(t => {
                    t.ForumId = forum.ForumId;
                    discussionTopics.push(t);
                  });
                }
              } catch (e) {
                console.warn(`Failed to fetch topics for forum ${forum.ForumId}:`, e);
              }
            }));
          }

          // Collect all rubric IDs from rubricsList, dropboxes, and discussion topics
          const allRubricIds = new Set();
          if (Array.isArray(rubricsList)) {
            rubricsList.forEach(r => { if (r && r.RubricId) allRubricIds.add(r.RubricId); });
          }
          if (Array.isArray(dropboxFolders)) {
            dropboxFolders.forEach(f => {
              D2LApi.extractRubricIds(f).forEach(id => allRubricIds.add(id));
            });
          }
          if (Array.isArray(discussionTopics)) {
            discussionTopics.forEach(t => {
              D2LApi.extractRubricIds(t).forEach(id => allRubricIds.add(id));
            });
          }

          if (allRubricIds.size > 0) {
            console.log(`Discovered ${allRubricIds.size} unique rubric IDs to resolve:`, Array.from(allRubricIds));
            await Promise.all(Array.from(allRubricIds).map(async (rid) => {
              try {
                const details = await D2LApi.getRubricDetails(orgUnitId, rid);
                if (details) {
                  rubricsMap[rid] = details;
                }
              } catch (e) {
                console.warn(`Failed to fetch details for rubric ${rid}:`, e);
              }
            }));
          }
        } catch (e) {
          console.warn('Metadata pre-fetching encountered errors:', e);
        }
      }

      emitProgress(25, exportScope === 'shareable' ? 'Extracting unit overviews & reading assignments...' : 'Extracting unit contents & quizzes...');
      const units = await D2LApi.parseModules(
        tocData,
        { dropboxFolders, discussionTopics, rubricsMap, quizzesList, orgUnitId, exportScope, downloadAssets },
        (progress, statusText) => {
          emitProgress(progress, statusText || (exportScope === 'shareable' ? 'Extracting unit overviews & reading assignments...' : 'Extracting unit contents & quizzes...'));
          console.log(`Extraction progress: ${progress}% - ${statusText || ''}`);
        }
      );

      const exportedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const zipFiles = [];

      if (exportFormat === 'markdown') {
        emitProgress(75, 'Generating Markdown documents...');
        const markdownFiles = MarkdownBuilder.buildMarkdownZip(courseInfo, units, exportScope, downloadAssets);
        zipFiles.push(...markdownFiles);

        // Fetch attachment files & embedded PDFs if enabled
        if (downloadAssets) {
          const downloadedCache = new Map(); // url -> Uint8Array
          let totalAttachments = 0;
          units.forEach(u => totalAttachments += (u.attachments ? u.attachments.length : 0));
          let currentAttachmentIdx = 0;

          for (let unitIdx = 0; unitIdx < units.length; unitIdx++) {
            const unit = units[unitIdx];
            const unitFolderName = `${String(unitIdx + 1).padStart(2, '0')}_${MarkdownBuilder.sanitizeFolderName(unit.title)}`;

            if (unit.attachments && unit.attachments.length > 0) {
              for (const att of unit.attachments) {
                if (att.url) {
                  currentAttachmentIdx++;
                  const cleanFileName = att.localFileName || D2LApi.sanitizeFileName(att.title || 'attachment');
                  emitProgress(
                    75 + Math.round((currentAttachmentIdx / Math.max(totalAttachments, 1)) * 15),
                    `Downloading asset (${currentAttachmentIdx}/${totalAttachments}): ${cleanFileName}`
                  );

                  let bytes = downloadedCache.get(att.url);
                  if (!bytes) {
                    try {
                      const result = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(
                          { action: 'FETCH_FILE', url: att.url },
                          (response) => resolve(response)
                        );
                      });

                      if (result && result.success && result.base64) {
                        // Decode base64 back to Uint8Array
                        const binaryStr = atob(result.base64);
                        bytes = new Uint8Array(binaryStr.length);
                        for (let i = 0; i < binaryStr.length; i++) {
                          bytes[i] = binaryStr.charCodeAt(i);
                        }
                        downloadedCache.set(att.url, bytes);
                      } else {
                        console.warn(`Background fetch failed for ${att.url}:`, result?.error);
                      }
                    } catch (e) {
                      console.warn(`Could not download attachment ${att.url}:`, e);
                    }
                  }

                  if (bytes) {
                    zipFiles.push({
                      name: `${unitFolderName}/assets/${cleanFileName}`,
                      content: bytes
                    });
                    console.log(`Packed asset: ${unitFolderName}/assets/${cleanFileName} (${bytes.length} bytes)`);
                  }
                }
              }
            }
          }
        }
      } else {
        emitProgress(75, 'Generating offline interactive website...');
        const htmlContent = HTMLBuilder.buildOfflineSite({
          courseInfo: courseInfo,
          units: units,
          exportedAt: exportedAt,
          exportScope: exportScope,
          downloadAssets: downloadAssets
        });

        zipFiles.push({
          name: 'index.html',
          content: htmlContent
        });

        // Fetch attachment files & embedded PDFs if enabled
        if (downloadAssets) {
          const downloadedUrls = new Set();
          const uniqueAttachments = [];
          for (const unit of units) {
            if (unit.attachments && unit.attachments.length > 0) {
              for (const att of unit.attachments) {
                if (att.url && !downloadedUrls.has(att.url)) {
                  downloadedUrls.add(att.url);
                  uniqueAttachments.push(att);
                }
              }
            }
          }

          let currentAttachmentIdx = 0;
          const totalAttachments = uniqueAttachments.length;

          for (const att of uniqueAttachments) {
            currentAttachmentIdx++;
            const cleanFileName = att.localFileName || D2LApi.sanitizeFileName(att.title || 'attachment');
            emitProgress(
              75 + Math.round((currentAttachmentIdx / Math.max(totalAttachments, 1)) * 15),
              `Downloading asset (${currentAttachmentIdx}/${totalAttachments}): ${cleanFileName}`
            );

            try {
              const result = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                  { action: 'FETCH_FILE', url: att.url },
                  (response) => resolve(response)
                );
              });

              if (result && result.success && result.base64) {
                // Decode base64 back to Uint8Array
                const binaryStr = atob(result.base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }

                zipFiles.push({
                  name: `assets/${cleanFileName}`,
                  content: bytes
                });
                console.log(`Packed asset: assets/${cleanFileName} (${bytes.length} bytes)`);
              } else {
                console.warn(`Background fetch failed for ${att.url}:`, result?.error);
              }
            } catch (e) {
              console.warn(`Could not download attachment ${att.url}:`, e);
            }
          }
        }
      }

      emitProgress(93, 'Compressing package into ZIP archive...');
      const zipBlob = await ZipBuilder.createZip(zipFiles);

      const downloadSuffix = exportFormat === 'markdown'
        ? (exportScope === 'shareable' ? 'StudyGuide_Markdown' : 'Markdown_Offline')
        : (exportScope === 'shareable' ? 'StudyGuide_Offline' : 'Offline');

      emitProgress(98, 'Packaging complete! Sending to downloads...');
      const reader = new FileReader();
      reader.onloadend = function () {
        const dataUrl = reader.result;
        chrome.runtime.sendMessage({
          action: 'TRIGGER_ZIP_DOWNLOAD',
          courseId: courseInfo.id,
          courseName: courseInfo.name,
          zipDataUrl: dataUrl,
          suffix: downloadSuffix
        }, (res) => {
          emitProgress(100, `Done! Extracted ${units.length} units.`);
          sendResponse({ success: true, unitsCount: units.length });
        });
      };
      reader.readAsDataURL(zipBlob);

    } catch (err) {
      console.error('Export Pipeline Error:', err);
      sendResponse({ success: false, error: err.message });
    }
  }

  /* ==========================================================================
     Auto-Complete & Course Topic Marking Engine
     ========================================================================== */
  const markingInProgress = new Set();
  let toastDismissTimer = null;

  function showCompletionToast(courseName, current, total, percent, statusText, isDone = false) {
    let container = document.getElementById('uop-exporter-completion-toast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'uop-exporter-completion-toast';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        width: 330px;
        background: #110d14;
        border: 1px solid rgba(231, 79, 115, 0.35);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(231, 79, 115, 0.15);
        padding: 12px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #fcfbfa;
        font-size: 12px;
        line-height: 1.4;
        box-sizing: border-box;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(container);
    }

    if (toastDismissTimer) {
      clearTimeout(toastDismissTimer);
      toastDismissTimer = null;
    }

    const titleIcon = isDone
      ? `<span style="color: #10b981; font-size: 14px;">✅</span>`
      : `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e74f73; box-shadow: 0 0 8px #e74f73; animation: uopPulse 1.5s infinite;"></span>`;

    const progressColor = isDone
      ? 'linear-gradient(90deg, #10b981, #34d399)'
      : 'linear-gradient(90deg, #8b3c64, #e74f73)';

    container.innerHTML = `
      <style>
        @keyframes uopPulse {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
      </style>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: ${isDone ? '#34d399' : '#fbaec0'};">
          ${titleIcon}
          <span>Course Exporter</span>
        </div>
        <button id="uop-toast-close" style="background: none; border: none; color: #72647a; font-size: 16px; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 4px;">&times;</button>
      </div>
      <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px; color: #fcfbfa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(courseName)}">
        ${escapeHtml(courseName)}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #a99db0; margin-bottom: 5px;">
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${escapeHtml(statusText)}</span>
        <span style="font-weight: 600; font-family: monospace; color: ${isDone ? '#34d399' : '#fbaec0'};">${percent}%</span>
      </div>
      <div style="height: 5px; background: rgba(255, 255, 255, 0.08); border-radius: 4px; overflow: hidden;">
        <div style="height: 100%; width: ${percent}%; background: ${progressColor}; border-radius: 4px; transition: width 0.2s ease;"></div>
      </div>
    `;

    const closeBtn = container.querySelector('#uop-toast-close');
    if (closeBtn) {
      closeBtn.onclick = () => hideCompletionToast(true);
    }

    if (isDone) {
      toastDismissTimer = setTimeout(() => hideCompletionToast(), 4000);
    }
  }

  function hideCompletionToast(immediate = false) {
    const container = document.getElementById('uop-exporter-completion-toast');
    if (!container) return;
    if (immediate) {
      container.remove();
      return;
    }
    container.style.opacity = '0';
    container.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }, 350);
  }

  function emitMarkProgress(percent, status, orgUnitId) {
    try {
      chrome.runtime.sendMessage({
        action: 'COURSE_MARK_PROGRESS',
        orgUnitId: String(orgUnitId),
        percent: Math.min(Math.max(percent, 0), 100),
        status: status
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }

  async function triggerCourseCompletion(orgUnitId, showToast = true) {
    if (!orgUnitId) throw new Error('Course OrgUnit ID required');
    const strOu = String(orgUnitId);
    if (markingInProgress.has(strOu)) {
      console.log(`[Course Exporter] Course ${strOu} completion already in progress.`);
      return { inProgress: true };
    }

    markingInProgress.add(strOu);

    try {
      console.log(`[Course Exporter] Starting topic completion for course ${strOu}...`);
      const courseInfo = await D2LApi.getCourseInfo(strOu);
      const cleanName = (courseInfo && courseInfo.name) || `Course ${strOu}`;

      if (showToast) {
        showCompletionToast(cleanName, 0, 100, 5, 'Fetching course Table of Contents...');
      }
      emitMarkProgress(5, 'Fetching course Table of Contents...', strOu);

      const tocData = await D2LApi.getTOC(strOu);
      if (!tocData) {
        throw new Error('Could not retrieve course Table of Contents from Brightspace.');
      }

      const topics = D2LApi.extractAllTopicsFromToc(tocData);
      console.log(`[Course Exporter] Discovered ${topics.length} total topics for course ${strOu}`);

      if (topics.length === 0) {
        if (showToast) {
          showCompletionToast(cleanName, 0, 0, 100, 'No topics found in course.', true);
        }
        emitMarkProgress(100, 'No topics found in course.', strOu);
        return { total: 0, completed: 0, failed: 0 };
      }

      const currentUser = await D2LApi.getCurrentUser();

      if (showToast) {
        showCompletionToast(cleanName, 0, topics.length, 10, `Starting background viewer for ${topics.length} items...`);
      }
      emitMarkProgress(10, `Starting background viewer for ${topics.length} items...`, strOu);

      // Delegate real navigation to background service worker tab runner
      const startResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'START_COURSE_COMPLETION_RUNNER',
          orgUnitId: strOu,
          topics: topics,
          userId: currentUser?.userId,
          courseName: cleanName
        }, (res) => resolve(res || { success: true }));
      });

      return startResult;

    } catch (err) {
      console.error(`[Course Exporter] Error completing course ${strOu}:`, err);
      if (showToast) {
        showCompletionToast(`Course ${strOu}`, 0, 0, 0, `Error: ${err.message}`, true);
      }
      throw err;
    } finally {
      markingInProgress.delete(strOu);
    }
  }

  let isBatchMarkingInProgress = false;

  async function checkAndAutoMarkAllCourses() {
    // Skip if on login or authentication screens
    const pathname = (window.location.pathname || '').toLowerCase();
    if (pathname.includes('/d2l/login') || pathname.includes('/d2l/lp/auth')) {
      return;
    }

    try {
      const storage = await new Promise(r => chrome.storage.local.get(['autoMarkCompleted', 'markedCourses'], r));
      // Feature is OFF by default unless enabled in onboarding or settings
      if (!storage || storage.autoMarkCompleted !== true) {
        return;
      }

      if (isBatchMarkingInProgress) {
        return;
      }

      const markedCourses = storage.markedCourses || {};

      // 1. Discover all attending courses
      let enrolled = await D2LApi.getEnrolledCourses().catch(err => {
        console.warn('[Course Exporter] Failed to get enrolled courses:', err);
        return [];
      });

      // 2. If no courses returned but currently inside a specific course, fallback to current course
      const currentOu = detectOrgUnitId();
      if (currentOu && !enrolled.some(c => String(c.id || c.orgUnitId) === String(currentOu))) {
        const info = await D2LApi.getCourseInfo(currentOu).catch(() => ({ id: currentOu, name: `Course ${currentOu}` }));
        enrolled.push({
          id: String(currentOu),
          orgUnitId: String(currentOu),
          name: info.name || `Course ${currentOu}`
        });
      }

      if (enrolled.length === 0) {
        return;
      }

      // 3. Filter down to unmarked courses
      const unmarkedCourses = enrolled.filter(c => {
        const idStr = String(c.id || c.orgUnitId);
        return !markedCourses[idStr] && !markingInProgress.has(idStr);
      });

      if (unmarkedCourses.length === 0) {
        console.log(`[Course Exporter] All ${enrolled.length} attending course(s) are already marked completed. Skipping.`);
        return;
      }

      console.log(`[Course Exporter] Auto-mark active: Discovered ${enrolled.length} enrolled courses (${unmarkedCourses.length} unmarked). Launching batch auto-mark...`);

      isBatchMarkingInProgress = true;
      unmarkedCourses.forEach(c => markingInProgress.add(String(c.id || c.orgUnitId)));

      showCompletionToast(
        'Auto-Marking Enrolled Courses',
        0,
        unmarkedCourses.length,
        5,
        `Found ${unmarkedCourses.length} attending course(s) to complete...`
      );

      chrome.runtime.sendMessage({
        action: 'START_BATCH_COURSE_COMPLETION',
        courses: unmarkedCourses.map(c => ({
          orgUnitId: String(c.id || c.orgUnitId),
          courseName: c.name
        }))
      }, (response) => {
        if (chrome.runtime.lastError || (response && !response.success)) {
          isBatchMarkingInProgress = false;
          unmarkedCourses.forEach(c => markingInProgress.delete(String(c.id || c.orgUnitId)));
        }
      });

    } catch (e) {
      console.warn('[Course Exporter] checkAndAutoMarkAllCourses error:', e);
      isBatchMarkingInProgress = false;
    }
  }

  let autoMarkDebounceTimer = null;
  function debouncedAutoMark(delay = 800) {
    if (autoMarkDebounceTimer) clearTimeout(autoMarkDebounceTimer);
    autoMarkDebounceTimer = setTimeout(() => {
      checkAndAutoMarkAllCourses();
    }, delay);
  }

  // Initialize auto-mark check on document idle
  debouncedAutoMark(1200);

  // Synchronize when settings or flags are changed in options page or popup
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.autoMarkCompleted && changes.autoMarkCompleted.newValue === true) {
          debouncedAutoMark(300);
        }
        if (changes.markedCourses) {
          debouncedAutoMark(400);
        }
      }
    });
  }

  // Monitor URL changes for Single Page Application (SPA) navigation inside Brightspace
  let lastObservedUrl = window.location.href;
  const onUrlChange = () => {
    if (window.location.href !== lastObservedUrl) {
      lastObservedUrl = window.location.href;
      debouncedAutoMark(800);
    }
  };

  window.addEventListener('popstate', onUrlChange);
  window.addEventListener('hashchange', onUrlChange);

  // Observe title for client-side navigation in Brightspace
  try {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      new MutationObserver(() => onUrlChange()).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  } catch (e) {}

  try {
    const origPushState = history.pushState;
    if (origPushState) {
      history.pushState = function () {
        origPushState.apply(this, arguments);
        onUrlChange();
      };
    }
    const origReplaceState = history.replaceState;
    if (origReplaceState) {
      history.replaceState = function () {
        origReplaceState.apply(this, arguments);
        onUrlChange();
      };
    }
  } catch (e) {}

  setInterval(onUrlChange, 2500);

})();

