/**
 * Background Service Worker for handling file downloads
 * Fetches run here to bypass download manager interception (IDM, etc.)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TRIGGER_ZIP_DOWNLOAD') {
    handleZipDownload(message, sendResponse);
    return true;
  }

  if (message.action === 'FETCH_FILE') {
    handleFetchFile(message, sendResponse);
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

