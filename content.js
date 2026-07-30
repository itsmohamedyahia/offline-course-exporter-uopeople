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
      const exportFormat = request.exportFormat || 'html';

      if (!orgUnitId) {
        sendResponse({ success: false, error: 'Could not identify course ID.' });
        return true;
      }

      runExportPipeline(orgUnitId, downloadAssets, exportFormat, sendResponse);
      return true;
    }
  });

  async function runExportPipeline(orgUnitId, downloadAssets, exportFormat, sendResponse) {
    try {
      console.log(`Starting export pipeline for OrgUnitID: ${orgUnitId} (Format: ${exportFormat})`);

      const courseInfo = await D2LApi.getCourseInfo(orgUnitId);
      const tocData = await D2LApi.getTOC(orgUnitId);
      if (!tocData) {
        throw new Error('Unable to retrieve course Table of Contents.');
      }

      console.log('Fetching course assignment activities, discussions, rubrics and quizzes from D2L API...');
      let dropboxFolders = [];
      let discussionForums = [];
      let rubricsList = [];
      const rubricsMap = {};
      const discussionTopics = [];
      let quizzesList = [];

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

        if (rubricsList.length > 0) {
          await Promise.all(rubricsList.map(async (r) => {
            try {
              const details = await D2LApi.getRubricDetails(orgUnitId, r.RubricId);
              if (details) {
                rubricsMap[r.RubricId] = details;
              }
            } catch (e) {
              console.warn(`Failed to fetch details for rubric ${r.RubricId}:`, e);
            }
          }));
        }
      } catch (e) {
        console.warn('Metadata pre-fetching encountered errors:', e);
      }

      const units = await D2LApi.parseModules(tocData, { dropboxFolders, discussionTopics, rubricsMap, quizzesList, orgUnitId }, (progress) => {
        console.log(`Extraction progress: ${progress}%`);
      });

      const exportedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const zipFiles = [];

      if (exportFormat === 'markdown') {
        const markdownFiles = MarkdownBuilder.buildMarkdownZip(courseInfo, units);
        zipFiles.push(...markdownFiles);

        // Fetch attachment files & embedded PDFs if enabled
        if (downloadAssets) {
          const downloadedCache = new Map(); // url -> Uint8Array

          for (let unitIdx = 0; unitIdx < units.length; unitIdx++) {
            const unit = units[unitIdx];
            const unitFolderName = `${String(unitIdx + 1).padStart(2, '0')}_${MarkdownBuilder.sanitizeFolderName(unit.title)}`;

            if (unit.attachments && unit.attachments.length > 0) {
              for (const att of unit.attachments) {
                if (att.url) {
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
                    const cleanFileName = att.localFileName || D2LApi.sanitizeFileName(att.title || 'attachment');
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
        const htmlContent = HTMLBuilder.buildOfflineSite({
          courseInfo: courseInfo,
          units: units,
          exportedAt: exportedAt
        });

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

                      const cleanFileName = att.localFileName || D2LApi.sanitizeFileName(att.title || 'attachment');
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
          zipDataUrl: dataUrl,
          suffix: exportFormat === 'markdown' ? 'Markdown_Offline' : 'Offline'
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
