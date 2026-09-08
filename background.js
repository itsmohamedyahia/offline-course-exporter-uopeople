/**
 * Background Service Worker for handling file downloads and background course topic completion
 * Fetches run here to bypass download manager interception (IDM, etc.)
 */

// Active completion runner state
let activeCompletionRun = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TRIGGER_ZIP_DOWNLOAD') {
    handleZipDownload(message, sendResponse);
    return true;
  }

  if (message.action === 'FETCH_FILE') {
    handleFetchFile(message, sendResponse);
    return true;
  }

  if (message.action === 'START_COURSE_COMPLETION_RUNNER') {
    handleStartCourseCompletion(message, sendResponse);
    return true;
  }

  if (message.action === 'CANCEL_COURSE_COMPLETION_RUNNER') {
    handleCancelCourseCompletion(message, sendResponse);
    return true;
  }
});

/**
 * Fetch a file URL in the background service worker context.
 * IDM cannot intercept service worker network requests.
 * Returns the file as a base64 string to avoid chrome messaging binary limits.
 */
async function handleFetchFile(payload, sendResponse) {
  try {
    const resp = await fetch(payload.url, {
      credentials: 'include'
    });
    if (!resp.ok) {
      sendResponse({ success: false, error: `HTTP ${resp.status}` });
      return;
    }
    const buffer = await resp.arrayBuffer();
    // Convert to base64 for safe transport over chrome.runtime messaging
    const bytes = new Uint8Array(buffer);
    let binary = '';
    // Process in chunks to avoid call stack overflow on large files
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);
    sendResponse({ success: true, base64: base64, size: bytes.length });
  } catch (err) {
    console.error('FETCH_FILE error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleZipDownload(payload, sendResponse) {
  try {
    const { courseId, courseName, zipDataUrl, suffix } = payload;
    let cleanName = (courseName || `Course_${courseId}`).trim();

    // 1. Strip trailing Brightspace / LMS brand suffixes
    cleanName = cleanName.replace(/\s*-\s*(?:Brightspace|University of the People|UoPeople|D2L).*$/i, '').trim();

    // 2. Extract course code onwards if preceded by page title
    const courseCodeMatch = cleanName.match(/(?:^|.*?\s+-\s+)([A-Z]{2,6}\s*\d{3,5}(?:-\d+)?\s+.*)$/i);
    if (courseCodeMatch && courseCodeMatch[1]) {
      cleanName = courseCodeMatch[1].trim();
    } else {
      const pagePrefixRegex = /^(?:Homepage|Course Home(?:page)?|Home|Table of Contents|TOC|Content(?:s)?|Announcements?|Discussions?|Discussion Forum(?: [^-]+)?|Assignments?|Assignment Activity(?: [^-]+)?|Written Assignment(?: [^-]+)?|Learning Guide(?: [^-]+)?|Reading Assignment(?: [^-]+)?|Self-Quiz(?: [^-]+)?|Graded Quiz(?: [^-]+)?|Review Quiz(?: [^-]+)?|Final Exam(?: [^-]+)?|Quizzes|Grades?|Classlist|Lessons?|Course Overview|Overview|Unit\s+\d+(?: [^-]+)?)\s*-\s*/i;
      while (pagePrefixRegex.test(cleanName)) {
        cleanName = cleanName.replace(pagePrefixRegex, '').trim();
      }
    }

    // 3. Clean up non-alphanumeric chars for safe filename without ugly multiple underscores
    const sanitizedCourseName = cleanName
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const zipFileName = `UoPeople_${sanitizedCourseName || `Course_${courseId}`}_${suffix || 'Offline'}.zip`;

    // Triggers a SINGLE download prompt for the entire course package (.zip)
    await chrome.downloads.download({
      url: zipDataUrl,
      filename: zipFileName,
      saveAs: false
    });

    sendResponse({ success: true, fileName: zipFileName });
  } catch (err) {
    console.error('ZIP Download Error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle background tab navigation to mark topics completed.
 * Uses a single inactive background tab (active: false) so Brightspace client scripts
 * (TopicTrackingPlugin.js and unload beacons) execute naturally.
 */
async function handleStartCourseCompletion(payload, sendResponse) {
  const { orgUnitId, topics, userId, courseName } = payload;
  const strOu = String(orgUnitId);

  if (!strOu || !topics || topics.length === 0) {
    sendResponse({ success: false, error: 'orgUnitId and topics required' });
    return;
  }

  if (activeCompletionRun && activeCompletionRun.orgUnitId === strOu && activeCompletionRun.isRunning) {
    sendResponse({ success: true, inProgress: true });
    return;
  }

  if (activeCompletionRun && activeCompletionRun.isRunning) {
    activeCompletionRun.isCancelled = true;
  }

  const runState = {
    orgUnitId: strOu,
    courseName: courseName || `Course ${strOu}`,
    isRunning: true,
    isCancelled: false,
    tabId: null
  };
  activeCompletionRun = runState;

  sendResponse({ success: true, started: true });

  try {
    // Open a single inactive background tab
    const runnerTab = await chrome.tabs.create({
      url: 'about:blank',
      active: false
    });
    runState.tabId = runnerTab.id;

    let visitedCount = 0;
    const total = topics.length;

    for (let i = 0; i < total; i++) {
      if (runState.isCancelled) {
        console.log(`[Completion Runner] Cancelled for course ${strOu}`);
        break;
      }

      const item = topics[i];
      if (!item || !item.id) continue;

      const targetUrl = `https://learn.uopeople.edu/d2l/le/content/${strOu}/viewContent/${item.id}/View`;
      const current = i + 1;
      const percent = Math.min(90, Math.round((current / total) * 90));
      const itemTitle = item.title || `Item ${current}`;

      broadcastMessage({
        action: 'COURSE_MARK_PROGRESS',
        orgUnitId: strOu,
        current: current,
        total: total,
        percent: percent,
        status: `Viewing (${current}/${total}): ${itemTitle}`
      });

      try {
        await chrome.tabs.update(runState.tabId, { url: targetUrl });
      } catch (tabErr) {
        if (!runState.isCancelled) {
          const newTab = await chrome.tabs.create({ url: targetUrl, active: false });
          runState.tabId = newTab.id;
        }
      }

      // Dwell for 3.5s so scripts execute and tracking beacon initializes
      await new Promise(r => setTimeout(r, 3500));
      visitedCount++;
    }

    // Close the runner tab cleanly
    if (runState.tabId) {
      try {
        await chrome.tabs.remove(runState.tabId);
      } catch (e) {}
      runState.tabId = null;
    }

    // Allow 1s for the final unload beacon to complete on the server
    await new Promise(r => setTimeout(r, 1000));

    broadcastMessage({
      action: 'COURSE_MARK_PROGRESS',
      orgUnitId: strOu,
      current: total,
      total: total,
      percent: 94,
      status: 'Verifying completions with Brightspace Valence API...'
    });

    // Verification phase via Valence API
    let verifiedCount = 0;
    let studentId = userId;
    if (!studentId) {
      try {
        const whoamiResp = await fetch('https://learn.uopeople.edu/d2l/api/lp/1.47/users/whoami', { credentials: 'include' });
        if (whoamiResp.ok) {
          const whoData = await whoamiResp.json();
          studentId = whoData.Identifier;
        }
      } catch (e) {}
    }

    if (studentId) {
      const checkTopic = async (item) => {
        if (!item || !item.id) return false;
        try {
          const compResp = await fetch(`https://learn.uopeople.edu/d2l/api/le/1.54/${strOu}/content/topics/${item.id}/completions/users/${studentId}`, {
            credentials: 'include'
          });
          if (compResp.ok) {
            const compData = await compResp.json();
            if (compData.CompletionDate) {
              return true;
            }
          }
        } catch (e) {}
        return false;
      };

      // Check completions concurrently in chunks to prevent hanging and finish in 1-2 seconds
      const concurrency = 6;
      for (let i = 0; i < topics.length; i += concurrency) {
        const chunk = topics.slice(i, i + concurrency);
        const results = await Promise.all(chunk.map(checkTopic));
        verifiedCount += results.filter(Boolean).length;
        
        const checked = Math.min(topics.length, i + concurrency);
        const pct = 94 + Math.round((checked / topics.length) * 5); // 94% to 99%
        broadcastMessage({
          action: 'COURSE_MARK_PROGRESS',
          orgUnitId: strOu,
          current: checked,
          total: total,
          percent: pct,
          status: `Verifying with Valence API (${verifiedCount} verified)...`
        });
      }
    }

    console.log(`[Completion Runner] Finished course ${strOu}: ${visitedCount} visited, ${verifiedCount} verified.`);

    // Only flag course in storage if at least one topic is verified completed or visited
    if (verifiedCount > 0 || visitedCount > 0) {
      const storageData = await new Promise(r => chrome.storage.local.get(['markedCourses'], r));
      const marked = (storageData && storageData.markedCourses) || {};
      marked[strOu] = {
        orgUnitId: strOu,
        courseName: runState.courseName,
        markedAt: new Date().toISOString(),
        topicsCount: total,
        visitedCount: visitedCount,
        verifiedCount: verifiedCount
      };
      await new Promise(r => chrome.storage.local.set({ markedCourses: marked }, r));
    }

    // Final 100% progress update
    broadcastMessage({
      action: 'COURSE_MARK_PROGRESS',
      orgUnitId: strOu,
      current: total,
      total: total,
      percent: 100,
      status: `Done! Verified ${verifiedCount} of ${total} topics on Brightspace.`
    });

    broadcastMessage({
      action: 'COURSE_MARKED_COMPLETED',
      orgUnitId: strOu,
      result: {
        total: total,
        visited: visitedCount,
        verified: verifiedCount,
        cancelled: runState.isCancelled
      }
    });

  } catch (err) {
    console.error('[Completion Runner] Error:', err);
    if (runState.tabId) {
      try { await chrome.tabs.remove(runState.tabId); } catch (e) {}
    }
    broadcastMessage({
      action: 'COURSE_MARK_PROGRESS',
      orgUnitId: strOu,
      percent: 100,
      status: `Error: ${err.message}`
    });
  } finally {
    runState.isRunning = false;
  }
}

function handleCancelCourseCompletion(payload, sendResponse) {
  if (activeCompletionRun && activeCompletionRun.isRunning) {
    activeCompletionRun.isCancelled = true;
    if (activeCompletionRun.tabId) {
      chrome.tabs.remove(activeCompletionRun.tabId).catch(() => {});
    }
  }
  sendResponse({ success: true, cancelled: true });
}

function broadcastMessage(msg) {
  // 1. Dispatch to internal extension views (options page, popup)
  try {
    chrome.runtime.sendMessage(msg, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch (e) {}

  // 2. Dispatch to all open Brightspace tabs so in-page toast and content scripts update
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!tabs || !tabs.length) return;
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.includes('learn.uopeople.edu')) {
          chrome.tabs.sendMessage(tab.id, msg, () => {
            if (chrome.runtime.lastError) {}
          });
        }
      }
    });
  } catch (e) {}
}
