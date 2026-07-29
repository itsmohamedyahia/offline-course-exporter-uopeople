/**
 * Background Service Worker for handling file downloads
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TRIGGER_ZIP_DOWNLOAD') {
    handleZipDownload(message, sendResponse);
    return true;
  }
});

async function handleZipDownload(payload, sendResponse) {
  try {
    const { courseId, courseName, zipDataUrl } = payload;
    const sanitizedCourseName = (courseName || `Course_${courseId}`).replace(/[^a-z0-9_-]/gi, '_');
    const zipFileName = `UoPeople_${sanitizedCourseName}_Offline.zip`;

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
