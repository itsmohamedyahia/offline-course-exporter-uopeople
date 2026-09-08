/**
 * Background Service Worker for handling file downloads and background course topic completion
 * Fetches run here to bypass download manager interception (IDM, etc.)
 */

// Active completion runner state
let activeCompletionRun = null;

// First-time install onboarding
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  }
});

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

  if (message.action === 'START_BATCH_COURSE_COMPLETION') {
    handleStartBatchCourseCompletion(message, sendResponse);
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
 * Helpers for TOC extraction and Brightspace Valence API
 */
function extractTopicsFromToc(tocData) {
  if (!tocData) return [];
  const topics = [];
  const seenIds = new Set();
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (Array.isArray(node.Topics)) {
      for (const t of node.Topics) {
        if (!t) continue;
        const id = t.Identifier || t.TopicId || t.Id;
        if (id !== undefined && id !== null) {
          const strId = String(id);
          if (!seenIds.has(strId)) {
            seenIds.add(strId);
            topics.push({
              id: strId,
              title: (t.Title || '').trim(),
              type: t.TypeIdentifier || t.TopicType || '',
              url: t.Url || ''
            });
          }
        }
      }
    }
    if (Array.isArray(node.Modules)) {
      for (const m of node.Modules) walk(m);
    }
    if (Array.isArray(node.SubModules)) {
      for (const sm of node.SubModules) walk(sm);
    }
  };
  walk(tocData);
  return topics;
}

async function fetchCourseToc(orgUnitId) {
  const versions = ['1.54', '1.43', '1.30', '1.0'];
  for (const ver of versions) {
    try {
      const resp = await fetch(`https://learn.uopeople.edu/d2l/api/le/${ver}/${orgUnitId}/content/toc`, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {}
  }
  return null;
}

let cachedStudentId = null;
async function getStudentIdentifier() {
  if (cachedStudentId) return cachedStudentId;
  try {
    const whoamiResp = await fetch('https://learn.uopeople.edu/d2l/api/lp/1.47/users/whoami', { credentials: 'include' });
    if (whoamiResp.ok) {
      const whoData = await whoamiResp.json();
      cachedStudentId = whoData.Identifier;
      return cachedStudentId;
    }
  } catch (e) {}
  return null;
}

/**
 * Handle background tab navigation to mark topics completed.
 * Uses a single inactive background tab (active: false) so Brightspace client scripts
 * (TopicTrackingPlugin.js and unload beacons) execute naturally.
 */
async function handleStartCourseCompletion(payload, sendResponse) {
  const { orgUnitId, topics, userId, courseName } = payload;
  const strOu = String(orgUnitId);

  if (!strOu) {
    sendResponse({ success: false, error: 'orgUnitId required' });
    return;
  }

  const singleCourse = {
    orgUnitId: strOu,
    courseName: courseName || `Course ${strOu}`,
    topics: topics || null,
    userId: userId || null
  };

  await executeCourseBatchRunner([singleCourse], sendResponse);
}

async function handleStartBatchCourseCompletion(payload, sendResponse) {
  const { courses } = payload;
  if (!Array.isArray(courses) || courses.length === 0) {
    sendResponse({ success: false, error: 'courses list required' });
    return;
  }

  await executeCourseBatchRunner(courses, sendResponse);
}

async function executeCourseBatchRunner(coursesList, sendResponse) {
  if (!Array.isArray(coursesList) || coursesList.length === 0) {
    if (sendResponse) sendResponse({ success: false, error: 'No courses provided' });
    return;
  }

  if (activeCompletionRun && activeCompletionRun.isRunning) {
    if (sendResponse) sendResponse({ success: true, inProgress: true });
    return;
  }

  const runState = {
    isRunning: true,
    isCancelled: false,
    tabId: null,
    totalCourses: coursesList.length,
    currentCourseIndex: 0
  };
  activeCompletionRun = runState;

  if (sendResponse) sendResponse({ success: true, started: true });

  const defaultStudentId = await getStudentIdentifier();

  try {
    // Open a single inactive background tab
    const runnerTab = await chrome.tabs.create({
      url: 'about:blank',
      active: false
    });
    runState.tabId = runnerTab.id;

    let overallTopicsVisited = 0;
    let overallTopicsVerified = 0;
    let completedCoursesCount = 0;

    for (let cIdx = 0; cIdx < coursesList.length; cIdx++) {
      if (runState.isCancelled) break;

      const course = coursesList[cIdx];
      const strOu = String(course.orgUnitId || course.id);
      const cleanName = (course.courseName || course.name || `Course ${strOu}`).trim();
      runState.currentCourseIndex = cIdx + 1;
      runState.orgUnitId = strOu;
      runState.courseName = cleanName;

      // 1. Progress: Fetching Table of Contents
      broadcastMessage({
        action: 'BATCH_MARK_PROGRESS',
        courseIndex: cIdx + 1,
        totalCourses: coursesList.length,
        currentCourseName: cleanName,
        orgUnitId: strOu,
        percent: Math.round((cIdx / coursesList.length) * 100),
        status: `[${cIdx + 1}/${coursesList.length}] Fetching Table of Contents: ${cleanName}...`
      });

      broadcastMessage({
        action: 'COURSE_MARK_PROGRESS',
        orgUnitId: strOu,
        current: 0,
        total: 100,
        percent: 5,
        status: 'Fetching course Table of Contents...'
      });

      let topics = course.topics;
      if (!topics || topics.length === 0) {
        const tocData = await fetchCourseToc(strOu);
        topics = extractTopicsFromToc(tocData);
      }

      if (!topics || topics.length === 0) {
        console.log(`[Batch Runner] No topics found for course ${strOu}`);
        broadcastMessage({
          action: 'COURSE_MARK_PROGRESS',
          orgUnitId: strOu,
          current: 0,
          total: 0,
          percent: 100,
          status: 'No topics found in course.'
        });
        continue;
      }

      console.log(`[Batch Runner] Course ${strOu} (${cleanName}) has ${topics.length} topics.`);

      // 2. Dwell & visit topics
      let visitedCount = 0;
      const total = topics.length;

      for (let tIdx = 0; tIdx < total; tIdx++) {
        if (runState.isCancelled) break;

        const item = topics[tIdx];
        if (!item || !item.id) continue;

        const targetUrl = `https://learn.uopeople.edu/d2l/le/content/${strOu}/viewContent/${item.id}/View`;
        const current = tIdx + 1;
        const itemTitle = item.title || `Item ${current}`;

        const singlePercent = Math.min(90, Math.round((current / total) * 90));
        const courseBasePct = Math.round((cIdx / coursesList.length) * 100);
        const courseSpanPct = Math.round((1 / coursesList.length) * 90);
        const batchPercent = courseBasePct + Math.round((current / total) * courseSpanPct);

        broadcastMessage({
          action: 'BATCH_MARK_PROGRESS',
          courseIndex: cIdx + 1,
          totalCourses: coursesList.length,
          currentCourseName: cleanName,
          orgUnitId: strOu,
          current: current,
          total: total,
          percent: batchPercent,
          status: `[${cIdx + 1}/${coursesList.length}] ${cleanName}: Viewing (${current}/${total}) - ${itemTitle}`
        });

        broadcastMessage({
          action: 'COURSE_MARK_PROGRESS',
          orgUnitId: strOu,
          current: current,
          total: total,
          percent: singlePercent,
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

        // Dwell 3.5s so Brightspace topic tracking beacons execute
        await new Promise(r => setTimeout(r, 3500));
        visitedCount++;
      }

      overallTopicsVisited += visitedCount;

      // Allow 1s for final unload beacon
      await new Promise(r => setTimeout(r, 1000));

      // 3. Valence API verification
      let verifiedCount = 0;
      const studentId = course.userId || defaultStudentId;
      if (studentId && !runState.isCancelled) {
        broadcastMessage({
          action: 'COURSE_MARK_PROGRESS',
          orgUnitId: strOu,
          current: total,
          total: total,
          percent: 94,
          status: 'Verifying completions with Brightspace Valence API...'
        });

        const checkTopic = async (item) => {
          if (!item || !item.id) return false;
          try {
            const compResp = await fetch(`https://learn.uopeople.edu/d2l/api/le/1.54/${strOu}/content/topics/${item.id}/completions/users/${studentId}`, {
              credentials: 'include'
            });
            if (compResp.ok) {
              const compData = await compResp.json();
              if (compData.CompletionDate) return true;
            }
          } catch (e) {}
          return false;
        };

        const concurrency = 6;
        for (let i = 0; i < topics.length; i += concurrency) {
          if (runState.isCancelled) break;
          const chunk = topics.slice(i, i + concurrency);
          const results = await Promise.all(chunk.map(checkTopic));
          verifiedCount += results.filter(Boolean).length;

          const checked = Math.min(topics.length, i + concurrency);
          const pct = 94 + Math.round((checked / topics.length) * 5);
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

      overallTopicsVerified += verifiedCount;
      console.log(`[Batch Runner] Finished course ${strOu}: ${visitedCount} visited, ${verifiedCount} verified.`);

      // 4. Save to markedCourses storage
      if (verifiedCount > 0 || visitedCount > 0) {
        const storageData = await new Promise(r => chrome.storage.local.get(['markedCourses'], r));
        const marked = (storageData && storageData.markedCourses) || {};
        marked[strOu] = {
          orgUnitId: strOu,
          courseName: cleanName,
          markedAt: new Date().toISOString(),
          topicsCount: total,
          visitedCount: visitedCount,
          verifiedCount: verifiedCount
        };
        await new Promise(r => chrome.storage.local.set({ markedCourses: marked }, r));
        completedCoursesCount++;
      }

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
    }

    // Close runner tab cleanly
    if (runState.tabId) {
      try { await chrome.tabs.remove(runState.tabId); } catch (e) {}
      runState.tabId = null;
    }

    // Broadcast batch completed
    broadcastMessage({
      action: 'BATCH_COURSES_COMPLETED',
      totalCourses: coursesList.length,
      completedCourses: completedCoursesCount,
      totalTopics: overallTopicsVisited,
      verifiedTopics: overallTopicsVerified,
      result: {
        success: true,
        cancelled: runState.isCancelled
      }
    });

  } catch (err) {
    console.error('[Batch Runner] Error:', err);
    if (runState.tabId) {
      try { await chrome.tabs.remove(runState.tabId); } catch (e) {}
    }
    broadcastMessage({
      action: 'BATCH_MARK_PROGRESS',
      percent: 100,
      status: `Error: ${err.message}`
    });
  } finally {
    runState.isRunning = false;
    activeCompletionRun = null;
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
