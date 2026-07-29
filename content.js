/**
 * Content Script injected into Brightspace pages
 */
(function () {
  function detectOrgUnitId() {
    const url = window.location.href;

    let match = url.match(/\/d2l\/home\/(\d+)/i);
    if (match) return match[1];

    match = url.match(/\/d2l\/le\/lessons\/(\d+)/i);
    if (match) return match[1];

    match = url.match(/\/d2l\/le\/content\/(\d+)/i);
    if (match) return match[1];

    match = url.match(/[?&]ou=(\d+)/i);
    if (match) return match[1];

    const navLink = document.querySelector('a[href*="/d2l/home/"]');
    if (navLink) {
      const m = navLink.href.match(/\/d2l\/home\/(\d+)/i);
      if (m) return m[1];
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

      D2LApi.getCourseInfo(orgUnitId).then(courseInfo => {
        sendResponse({
          detected: true,
          orgUnitId: orgUnitId,
          courseInfo: courseInfo
        });
      });

      return true;
    }

    if (request.action === 'START_EXPORT') {
      const orgUnitId = request.orgUnitId || detectOrgUnitId();
      const downloadAssets = request.downloadAssets !== false;

      if (!orgUnitId) {
        sendResponse({ success: false, error: 'Could not identify course ID.' });
        return true;
      }

      runExportPipeline(orgUnitId, downloadAssets, sendResponse);
      return true;
    }
  });

  async function runExportPipeline(orgUnitId, downloadAssets, sendResponse) {
    try {
      console.log(`Starting export pipeline for OrgUnitID: ${orgUnitId}`);

      const courseInfo = await D2LApi.getCourseInfo(orgUnitId);
      const tocData = await D2LApi.getTOC(orgUnitId);
      if (!tocData) {
        throw new Error('Unable to retrieve course Table of Contents.');
      }

      const units = await D2LApi.parseModules(tocData, (progress) => {
        console.log(`Extraction progress: ${progress}%`);
      });

      const exportedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const htmlContent = HTMLBuilder.buildOfflineSite({
        courseInfo: courseInfo,
        units: units,
        exportedAt: exportedAt
      });

      const zipFiles = [];
      zipFiles.push({
        name: 'index.html',
        content: htmlContent
      });

      // Fetch attachment files & embedded PDFs if enabled
      if (downloadAssets) {
        const downloadedUrls = new Set();

        for (const unit of units) {
          if (unit.attachments && unit.attachments.length > 0) {
            for (const att of unit.attachments) {
              if (att.url && !downloadedUrls.has(att.url)) {
                downloadedUrls.add(att.url);
                try {
                  const resp = await fetch(att.url);
                  if (resp.ok) {
                    const blobData = await resp.arrayBuffer();
                    const cleanFileName = att.localFileName || D2LApi.sanitizeFileName(att.title || 'attachment');

                    zipFiles.push({
                      name: `assets/${cleanFileName}`,
                      content: new Uint8Array(blobData)
                    });
                  }
                } catch (e) {
                  console.warn(`Could not download attachment ${att.url}:`, e);
                }
              }
            }
          }
        }
      }

      const zipBlob = await ZipBuilder.createZip(zipFiles);

      const reader = new FileReader();
      reader.onloadend = function () {
        const dataUrl = reader.result;
        chrome.runtime.sendMessage({
          action: 'TRIGGER_ZIP_DOWNLOAD',
          courseId: courseInfo.id,
          courseName: courseInfo.name,
          zipDataUrl: dataUrl
        }, (res) => {
          sendResponse({ success: true, unitsCount: units.length });
        });
      };
      reader.readAsDataURL(zipBlob);

    } catch (err) {
      console.error('Export Pipeline Error:', err);
      sendResponse({ success: false, error: err.message });
    }
  }

})();
