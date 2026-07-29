/**
 * Brightspace (D2L) Valence API & Scraper helper
 */
const D2LApi = {
  async getCourseInfo(orgUnitId) {
    try {
      const resp = await fetch(`/d2l/api/lp/1.30/courses/${orgUnitId}`);
      if (resp.ok) {
        const data = await resp.json();
        return {
          id: orgUnitId,
          name: data.Name || data.Code || `Course ${orgUnitId}`,
          code: data.Code || ''
        };
      }
    } catch (e) {
      console.warn('LP API failed, falling back to document title / DOM', e);
    }

    const titleElem = document.querySelector('.d2l-navigation-s-course-title, .d2l-navbar-title, title');
    let name = titleElem ? titleElem.innerText.trim() : `UoPeople Course ${orgUnitId}`;
    name = name.replace(/ - Brightspace.*$/, '').replace(/^Home - /, '');

    return {
      id: orgUnitId,
      name: name,
      code: ''
    };
  },

  async getTOC(orgUnitId) {
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const url = `/d2l/api/le/${ver}/${orgUnitId}/content/toc`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          console.log(`Successfully fetched TOC using LE API v${ver}`);
          return data;
        }
      } catch (e) {
        console.warn(`Failed TOC API v${ver}:`, e);
      }
    }
    return null;
  },

  toAbsoluteUrl(relativeUrl, baseUrl = 'https://learn.uopeople.edu/') {
    if (!relativeUrl) return '';
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
      if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
        return relativeUrl;
      }
      return `https://learn.uopeople.edu${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
    }
  },

  sanitizeFileName(fileName) {
    if (!fileName) return 'attachment.pdf';
    try {
      fileName = decodeURIComponent(fileName);
    } catch (e) {}

    fileName = fileName.split('?')[0].split('#')[0];
    fileName = fileName.split('/').pop().split('\\').pop();

    const lastDotIndex = fileName.lastIndexOf('.');
    let baseName = fileName;
    let ext = '';
    if (lastDotIndex > 0) {
      baseName = fileName.substring(0, lastDotIndex);
      ext = fileName.substring(lastDotIndex);
    } else if (!fileName.includes('.')) {
      ext = '.pdf';
    }

    let cleanBase = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    let cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '');

    if (!cleanBase) cleanBase = 'document';
    if (!cleanExt) cleanExt = '.pdf';

    return `${cleanBase}${cleanExt}`;
  },

  isAssetUrl(urlStr) {
    if (!urlStr) return false;
    const lower = urlStr.toLowerCase();
    const docExtRegex = /\.(pdf|docx?|pptx?|xlsx?|zip|rar|txt|csv|rtf|odt|ods|odp|png|jpe?g|gif|svg|mp3|mp4)(\?|#|$)/i;
    return docExtRegex.test(lower) ||
           lower.includes('iscoursefile=true') ||
           lower.includes('/content/enforced/') ||
           lower.includes('/topics/files/download/');
  },

  // Advanced content extractor for Reading Assignments & Discussion Forum Prompts
  async fetchTopicContent(url, discoveredAttachments = []) {
    if (!url) return '';
    try {
      const targetUrl = this.toAbsoluteUrl(url);

      if (this.isAssetUrl(targetUrl) && (targetUrl.toLowerCase().endsWith('.pdf') || targetUrl.toLowerCase().endsWith('.docx') || targetUrl.toLowerCase().endsWith('.zip'))) {
        const cleanFileName = this.sanitizeFileName(targetUrl);
        discoveredAttachments.push({
          title: cleanFileName.replace(/\.[^/.]+$/, ''),
          url: targetUrl,
          ext: cleanFileName.split('.').pop() || 'pdf',
          localFileName: cleanFileName
        });
        return `<p><a href="assets/${cleanFileName}" target="_blank" class="attachment-btn">📄 Open Document (${cleanFileName})</a></p>`;
      }

      const resp = await fetch(targetUrl);
      if (!resp.ok) return '';

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') || contentType.includes('application/zip')) {
        const cleanFileName = this.sanitizeFileName(targetUrl);
        discoveredAttachments.push({
          title: cleanFileName.replace(/\.[^/.]+$/, ''),
          url: targetUrl,
          ext: cleanFileName.split('.').pop() || 'pdf',
          localFileName: cleanFileName
        });
        return `<p><a href="assets/${cleanFileName}" target="_blank" class="attachment-btn">📄 Open Document (${cleanFileName})</a></p>`;
      }

      const htmlText = await resp.text();
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');

      // Check if page contains an iframe pointing to actual content file (e.g. Reading Assignment HTML)
      const iframe = doc.querySelector('iframe.d2l-fileviewer-render, iframe[src*="/content/enforced/"]');
      if (iframe && iframe.getAttribute('src')) {
        const iframeSrc = this.toAbsoluteUrl(iframe.getAttribute('src'), targetUrl);
        console.log(`Following iframe content source: ${iframeSrc}`);
        return await this.fetchTopicContent(iframeSrc, discoveredAttachments);
      }

      // If page is a Discussion Forum topic, extract ONLY the Activity Content / Topic Prompt, NOT student posts
      const isDiscussion = url.includes('discuss') || doc.querySelector('.d2l-discussions-topic-description, #topic-description');
      if (isDiscussion) {
        // Remove student thread lists and replies
        doc.querySelectorAll('.d2l-discussions-thread-list, .d2l-discussions-posts, .d2l-datalist, #posts-container').forEach(el => el.remove());
      }

      // Target topic prompt / content elements
      const contentElem = doc.querySelector(
        '#topic-description, .d2l-discussions-topic-description, .d2l-collapsible-panel-content, .d2l-htmlblock-rendered, d2l-htmlblock, .courseware-layouts-content-wrapper, .d2l-fileviewer-text, main, #content, .d2l-page-main'
      ) || doc.body;

      if (contentElem) {
        // Clone element to sanitize and process links
        const container = contentElem.cloneNode(true);

        // Process all links and attachments
        container.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (href) {
            const absUrl = this.toAbsoluteUrl(href, targetUrl);
            if (this.isAssetUrl(href) || this.isAssetUrl(absUrl)) {
              let rawFileName = href.split('?')[0].split('#')[0].split('/').pop();
              if (!rawFileName || rawFileName === 'DirectFileTopicDownload') {
                rawFileName = a.innerText ? a.innerText.trim() : 'attachment';
              }
              const cleanFileName = this.sanitizeFileName(rawFileName);

              const localAssetPath = `assets/${cleanFileName}`;
              a.setAttribute('href', localAssetPath);
              a.setAttribute('target', '_blank');

              discoveredAttachments.push({
                title: cleanFileName.replace(/\.[^/.]+$/, ''),
                url: absUrl,
                ext: cleanFileName.split('.').pop() || 'pdf',
                localFileName: cleanFileName
              });
            } else if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
              a.setAttribute('href', absUrl);
              a.setAttribute('target', '_blank');
            }
          }
        });

        container.querySelectorAll('img[src]').forEach(img => {
          const src = img.getAttribute('src');
          if (src && !src.startsWith('http') && !src.startsWith('data:')) {
            img.setAttribute('src', this.toAbsoluteUrl(src, targetUrl));
          }
        });

        // Strip empty d2l custom web component boilerplate tags if needed
        let resultHtml = container.innerHTML;
        // Clean out empty d2l icon tags
        resultHtml = resultHtml.replace(/<d2l-icon[^>]*>.*?<\/d2l-icon>/gi, '');

        return resultHtml.trim();
      }
      return '';
    } catch (e) {
      console.error(`Error fetching topic content from ${url}:`, e);
      return '';
    }
  },

  async parseModules(tocData, onProgress) {
    if (!tocData || !tocData.Modules) return [];

    const rawTopicsToFetch = [];

    const processModule = (module) => {
      const title = module.Title || '';

      const unitObj = {
        id: module.ModuleId,
        title: title,
        description: module.Description ? (module.Description.Html || module.Description.Text || '') : '',
        topics: [],
        readings: [],
        discussions: [],
        assignments: [],
        quizzes: [],
        attachments: []
      };

      if (module.Topics && module.Topics.length > 0) {
        for (const topic of module.Topics) {
          const topicTitle = topic.Title || '';
          const topicUrl = this.toAbsoluteUrl(topic.Url || '');
          const topicType = topic.TypeIdentifier || topic.TopicType;

          const topicItem = {
            id: topic.Identifier,
            title: topicTitle,
            url: topicUrl,
            type: topicType,
            typeTitle: topic.TypeTitle || '',
            contentHtml: ''
          };

          unitObj.topics.push(topicItem);
          rawTopicsToFetch.push({ item: topicItem, unitObj: unitObj });

          const lowerTitle = topicTitle.toLowerCase();
          if (lowerTitle.includes('reading assignment') || lowerTitle.includes('reading') || lowerTitle.includes('textbook')) {
            unitObj.readings.push(topicItem);
          } else if (lowerTitle.includes('discussion') || lowerTitle.includes('forum') || topicType === 5) {
            unitObj.discussions.push(topicItem);
          } else if (lowerTitle.includes('written assignment') || lowerTitle.includes('learning journal') || lowerTitle.includes('assignment') || topicType === 7) {
            unitObj.assignments.push(topicItem);
          } else if (lowerTitle.includes('quiz') || lowerTitle.includes('exam') || lowerTitle.includes('test') || topicType === 6) {
            unitObj.quizzes.push(topicItem);
          }

          if (topicUrl && this.isAssetUrl(topicUrl)) {
            let rawFileName = topicUrl.split('?')[0].split('#')[0].split('/').pop();
            if (!rawFileName || rawFileName === 'DirectFileTopicDownload') {
              rawFileName = topicTitle || 'attachment';
            }
            const cleanFileName = this.sanitizeFileName(rawFileName);
            unitObj.attachments.push({
              title: topicTitle || cleanFileName,
              url: topicUrl,
              ext: cleanFileName.split('.').pop() || 'pdf',
              localFileName: cleanFileName
            });
          }
        }
      }

      return unitObj;
    };

    const units = [];
    const modulesList = tocData.Modules;
    for (let i = 0; i < modulesList.length; i++) {
      const topModule = modulesList[i];
      const unit = processModule(topModule);
      units.push(unit);

      if (topModule.Modules && topModule.Modules.length > 0) {
        for (const subMod of topModule.Modules) {
          units.push(processModule(subMod));
        }
      }
    }

    let fetched = 0;
    const totalToFetch = rawTopicsToFetch.length;
    for (const entry of rawTopicsToFetch) {
      const item = entry.item;
      const unitObj = entry.unitObj;
      if (item.url) {
        const discovered = [];
        item.contentHtml = await this.fetchTopicContent(item.url, discovered);
        if (discovered.length > 0) {
          discovered.forEach(att => unitObj.attachments.push(att));
        }
      }
      fetched++;
      if (onProgress) {
        onProgress(Math.round((fetched / Math.max(totalToFetch, 1)) * 60) + 20);
      }
    }

    return units;
  }
};

