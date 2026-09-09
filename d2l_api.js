/**
 * Brightspace (D2L) Valence API & Scraper helper
 */
const D2LApi = {
  cleanCourseName(name) {
    if (!name || typeof name !== 'string') return '';
    let str = name.trim();

    // 1. Strip trailing Brightspace / LMS brand suffixes
    str = str.replace(/\s*-\s*(?:Brightspace|University of the People|UoPeople|D2L).*$/i, '').trim();

    // 2. Check if a course code pattern ([A-Z]{2,6} \d{3,5}...) exists after any " - " separator
    // e.g. "Homepage - PHIL 1402-01 Introduction to Philosophy - AY2026-T5" -> "PHIL 1402-01 Introduction to Philosophy - AY2026-T5"
    // e.g. "Assignment Activity Unit 1 - HIST 1421-01 Greek and Roman Civilization - AY2026-T5" -> "HIST 1421-01 Greek and Roman Civilization - AY2026-T5"
    const courseCodeMatch = str.match(/(?:^|.*?\s+-\s+)([A-Z]{2,6}\s*\d{3,5}(?:-\d+)?\s+.*)$/i);
    if (courseCodeMatch && courseCodeMatch[1]) {
      str = courseCodeMatch[1].trim();
    } else {
      // 3. Strip known Brightspace page/activity prefixes
      const pagePrefixRegex = /^(?:Homepage|Course Home(?:page)?|Home|Table of Contents|TOC|Content(?:s)?|Announcements?|Discussions?|Discussion Forum(?: [^-]+)?|Assignments?|Assignment Activity(?: [^-]+)?|Written Assignment(?: [^-]+)?|Learning Guide(?: [^-]+)?|Reading Assignment(?: [^-]+)?|Self-Quiz(?: [^-]+)?|Graded Quiz(?: [^-]+)?|Review Quiz(?: [^-]+)?|Final Exam(?: [^-]+)?|Quizzes|Grades?|Classlist|Lessons?|Course Overview|Overview|Unit\s+\d+(?: [^-]+)?)\s*-\s*/i;
      while (pagePrefixRegex.test(str)) {
        str = str.replace(pagePrefixRegex, '').trim();
      }
    }

    return str.trim();
  },

  async getCourseInfo(orgUnitId) {
    try {
      const resp = await fetch(`/d2l/api/lp/1.30/courses/${orgUnitId}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const rawName = data.Name || data.Code || `Course ${orgUnitId}`;
        return {
          id: orgUnitId,
          name: this.cleanCourseName(rawName) || `Course ${orgUnitId}`,
          code: data.Code || ''
        };
      }
    } catch (e) {
      console.warn('LP API failed, falling back to document title / DOM', e);
    }

    // Try DOM elements in order of specificity
    let rawName = '';
    const navLink = document.querySelector('a.d2l-navigation-s-link[href*="/d2l/home/"], a[href*="/d2l/home/"]');
    if (navLink && navLink.innerText && navLink.innerText.trim()) {
      rawName = navLink.innerText.trim();
    }

    if (!rawName) {
      const titleElem = document.querySelector('.d2l-navigation-s-course-title, .d2l-navbar-title, title');
      rawName = titleElem ? (titleElem.innerText || titleElem.textContent || '').trim() : `UoPeople Course ${orgUnitId}`;
    }

    return {
      id: orgUnitId,
      name: this.cleanCourseName(rawName) || `Course ${orgUnitId}`,
      code: ''
    };
  },

  // Discover all enrolled courses the student is attending
  async getEnrolledCourses() {
    const courses = [];
    const seenIds = new Set();

    const addCourse = (id, name, code = '') => {
      if (!id) return;
      const strId = String(id).trim();
      if (!strId || strId === '6606' || seenIds.has(strId)) return;
      seenIds.add(strId);
      courses.push({
        id: strId,
        orgUnitId: strId,
        name: this.cleanCourseName(name) || `Course ${strId}`,
        code: (code || '').trim()
      });
    };

    // 1. Query Valence LP myenrollments API
    const lpVersions = ['1.30', '1.45', '1.26', '1.0'];
    for (const ver of lpVersions) {
      try {
        const url = `/d2l/api/lp/${ver}/enrollments/myenrollments/?canAccess=true&orgUnitTypeId=3`;
        const resp = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include'
        });
        if (resp.ok) {
          const data = await resp.json();
          const items = Array.isArray(data) ? data : (data.Items || []);
          for (const item of items) {
            const ou = item.OrgUnit || item;
            if (ou && ou.Id) {
              if (item.Access && item.Access.CanAccess === false) continue;
              addCourse(ou.Id, ou.Name, ou.Code);
            }
          }
          if (courses.length > 0) {
            console.log(`[Course Exporter] Discovered ${courses.length} enrolled courses via Valence LP v${ver}`);
            return courses;
          }
        }
      } catch (e) {
        console.warn(`Valence myenrollments API v${ver} attempt failed:`, e);
      }
    }

    // 2. Secondary API attempt: general myenrollments without orgUnitTypeId query filter
    try {
      const resp = await fetch('/d2l/api/lp/1.30/enrollments/myenrollments/?canAccess=true', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include'
      });
      if (resp.ok) {
        const data = await resp.json();
        const items = Array.isArray(data) ? data : (data.Items || []);
        for (const item of items) {
          const ou = item.OrgUnit || item;
          if (ou && ou.Id && (ou.Type?.Id === 3 || ou.Type?.Code === 'Course Offering' || !ou.Type)) {
            if (item.Access && item.Access.CanAccess === false) continue;
            addCourse(ou.Id, ou.Name, ou.Code);
          }
        }
        if (courses.length > 0) {
          return courses;
        }
      }
    } catch (e) {}

    // 3. DOM Fallback: inspect page for course cards, tiles, and navigation links
    if (typeof document !== 'undefined') {
      try {
        const courseCards = document.querySelectorAll(
          'd2l-enrollment-card, .d2l-course-tile, .d2l-card, [data-org-unit-id], a[href*="/d2l/home/"]'
        );
        courseCards.forEach(card => {
          let ouId = (typeof card.getAttribute === 'function' ? (card.getAttribute('data-org-unit-id') || card.getAttribute('org-unit-id')) : null) || card['data-org-unit-id'];
          let courseName = '';

          if (!ouId && card.href) {
            const m = card.href.match(/\/d2l\/home\/(\d+)/i);
            if (m && m[1] !== '6606') ouId = m[1];
          }

          if (!ouId && typeof card.querySelector === 'function') {
            const anchor = card.querySelector('a[href*="/d2l/home/"], a[href*="/d2l/le/content/"]');
            if (anchor && anchor.href) {
              const m = anchor.href.match(/\/d2l\/(?:home|le\/content)\/(\d+)/i);
              if (m && m[1] !== '6606') ouId = m[1];
            }
          }

          if (ouId && ouId !== '6606') {
            const titleEl = typeof card.querySelector === 'function' ? card.querySelector('.d2l-card-title, h2, h3, [title], a') : null;
            if (titleEl) {
              courseName = (typeof titleEl.getAttribute === 'function' ? titleEl.getAttribute('title') : null) || titleEl.title || titleEl.innerText || titleEl.textContent || '';
            } else if (card.innerText) {
              courseName = card.innerText.split('\n')[0];
            }
            addCourse(ouId, courseName);
          }
        });
      } catch (domErr) {
        console.warn('DOM fallback scraping for enrolled courses encountered an error:', domErr);
      }
    }

    return courses;
  },

  async getTOC(orgUnitId) {
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const url = `/d2l/api/le/${ver}/${orgUnitId}/content/toc`;
        const resp = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
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

  // Unpack and decode all <d2l-html-block html="..."> custom web components into standard HTML
  unpackD2LHtmlBlocks(htmlOrDoc) {
    if (!htmlOrDoc) return '';
    try {
      let doc;
      const isString = typeof htmlOrDoc === 'string';
      if (isString) {
        if (!htmlOrDoc.includes('d2l-html-block')) return htmlOrDoc;
        doc = new DOMParser().parseFromString(htmlOrDoc, 'text/html');
      } else {
        doc = htmlOrDoc;
      }

      const decodeEntities = (str) => {
        if (!str) return '';
        const ta = (doc.createElement ? doc : document).createElement('textarea');
        ta.innerHTML = str;
        return ta.value;
      };

      const blocks = (doc.body || doc).querySelectorAll('d2l-html-block');
      blocks.forEach(block => {
        const isInline = block.hasAttribute('inline');
        const htmlAttr = block.getAttribute('html');
        let innerContent = '';

        if (htmlAttr !== null && htmlAttr !== undefined) {
          innerContent = decodeEntities(htmlAttr);
        } else {
          const renderedDiv = block.querySelector('.d2l-html-block-rendered');
          if (renderedDiv) {
            innerContent = renderedDiv.innerHTML;
          } else {
            innerContent = block.innerHTML || block.textContent || '';
          }
        }

        const rep = (doc.createElement ? doc : document).createElement(isInline ? 'span' : 'div');
        rep.className = isInline ? 'd2l-unpacked-inline' : 'd2l-unpacked-block';
        rep.innerHTML = innerContent;
        if (block.parentNode) {
          block.parentNode.replaceChild(rep, block);
        }
      });

      return isString ? (doc.body ? doc.body.innerHTML : '') : doc;
    } catch (e) {
      console.warn('Failed to unpack d2l-html-block:', e);
      return typeof htmlOrDoc === 'string' ? htmlOrDoc : '';
    }
  },

  cleanHtml(htmlStr) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      this.unpackD2LHtmlBlocks(doc);
      let changed = false;
      doc.querySelectorAll('img').forEach(img => {
        const src = (img.getAttribute('src') || '').toLowerCase();
        if (src.includes('logo_shield') || src.includes('logominimal') || src.includes('pagebreak_icon')) {
          img.remove();
          changed = true;
        }
      });
      return doc.body.innerHTML;
    } catch (e) {
      console.warn('Failed to clean HTML via DOMParser:', e);
      return htmlStr.replace(/<img[^>]*(logo_shield|logominimal|pagebreak_icon)[^>]*>/gi, '');
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
    
    // 1. Reject Brightspace template macros and unresolved placeholder tokens
    if (urlStr.includes('$@') || lower.includes('courseviewbyid') || /\{[a-zA-Z0-9_-]+\}/.test(urlStr)) {
      return false;
    }

    // 2. Exclude HTML files from being recognized as assets/attachments
    if (/\.html?(\?|#|$)/i.test(lower)) {
      return false;
    }

    const docExtRegex = /\.(pdf|docx?|pptx?|xlsx?|zip|rar|txt|csv|rtf|odt|ods|odp|png|jpe?g|gif|svg|mp3|mp4)(\?|#|$)/i;
    
    // For /content/enforced/ paths, strictly require a recognized file extension
    // to avoid treating unresolved LMS macro paths as downloadable files
    if (lower.includes('/content/enforced/')) {
      return docExtRegex.test(lower);
    }

    return docExtRegex.test(lower) ||
           lower.includes('iscoursefile=true') ||
           lower.includes('/topics/files/download/');
  },

  shouldKeepAttachment(title, urlStr) {
    if (!title && !urlStr) return true;
    const lowerTitle = (title || '').toLowerCase();
    const lowerUrl = (urlStr || '').toLowerCase();

    // Reject unrendered macros or broken URLs
    if ((urlStr && (urlStr.includes('$@') || lowerUrl.includes('courseviewbyid') || /\{[a-zA-Z0-9_-]+\}/.test(urlStr))) ||
        (title && (title.includes('$@') || lowerTitle.includes('courseviewbyid')))) {
      return false;
    }

    // Exclude generic LMS UI theme assets / logos
    if (lowerUrl.includes('html-template-library') || lowerUrl.includes('courseware_html_templates')) {
      return false;
    }
    if (lowerTitle.includes('logo_shield') || lowerTitle.includes('logominimal')) {
      return false;
    }
    return true;
  },

  // Advanced content extractor for Reading Assignments & Discussion Forum Prompts
  async fetchTopicContent(url, discoveredAttachments = [], downloadAssets = true) {
    if (!url) return '';
    try {
      const targetUrl = this.toAbsoluteUrl(url);

      // If the URL clearly points to a downloadable file, don't fetch it here.
      // Just record it as an attachment — the background worker will download it later if enabled.
      const lowerUrl = targetUrl.toLowerCase();
      const isHtml = /\.html?(\?|#|$)/i.test(lowerUrl);
      const isBinaryAsset = !isHtml && /\.(pdf|docx?|pptx?|xlsx?|zip|rar|rtf|odt|csv)(\?|#|$)/i.test(lowerUrl);
      if (isBinaryAsset) {
        const cleanFileName = this.sanitizeFileName(targetUrl);
        const title = cleanFileName.replace(/\.[^/.]+$/, '');
        if (this.shouldKeepAttachment(title, targetUrl)) {
          discoveredAttachments.push({
            title: title,
            url: targetUrl,
            ext: cleanFileName.split('.').pop() || 'pdf',
            localFileName: cleanFileName
          });
        }
        if (downloadAssets) {
          return `<p><a href="assets/${cleanFileName}" target="_blank" class="attachment-btn">📄 Open Document (${cleanFileName})</a></p>`;
        } else {
          return `<p><a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="attachment-btn external-link">🌐 📄 Open Online Document (${cleanFileName}) ↗</a></p>`;
        }
      }

      const resp = await fetch(targetUrl, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!resp.ok) return '';

      const contentType = resp.headers.get('content-type') || '';
      if (!isHtml && (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') || contentType.includes('application/zip'))) {
        const cleanFileName = this.sanitizeFileName(targetUrl);
        const title = cleanFileName.replace(/\.[^/.]+$/, '');
        if (this.shouldKeepAttachment(title, targetUrl)) {
          discoveredAttachments.push({
            title: title,
            url: targetUrl,
            ext: cleanFileName.split('.').pop() || 'pdf',
            localFileName: cleanFileName
          });
        }
        if (downloadAssets) {
          return `<p><a href="assets/${cleanFileName}" target="_blank" class="attachment-btn">📄 Open Document (${cleanFileName})</a></p>`;
        } else {
          return `<p><a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="attachment-btn external-link">🌐 📄 Open Online Document (${cleanFileName}) ↗</a></p>`;
        }
      }

      const htmlText = await resp.text();
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');

      // Check if page contains an iframe pointing to actual content file (e.g. Reading Assignment HTML)
      const iframe = doc.querySelector('iframe.d2l-fileviewer-render, iframe[src*="/content/enforced/"]');
      if (iframe && iframe.getAttribute('src')) {
        const iframeSrc = this.toAbsoluteUrl(iframe.getAttribute('src'), targetUrl);
        console.log(`Following iframe content source: ${iframeSrc}`);
        return await this.fetchTopicContent(iframeSrc, discoveredAttachments, downloadAssets);
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
        return this.processHtmlContent(contentElem.innerHTML, targetUrl, discoveredAttachments, downloadAssets);
      }
      return '';
    } catch (e) {
      console.error(`Error fetching topic content from ${url}:`, e);
      return '';
    }
  },

  // Fetch assignments (dropbox folders)
  async getDropboxFolders(orgUnitId) {
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/dropbox/folders/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data) ? data : (data.Objects || []);
        }
      } catch (e) {
        console.warn(`Failed to fetch dropbox folders with LE API v${ver}:`, e);
      }
    }
    return [];
  },

  // Fetch discussion forums
  async getDiscussionForums(orgUnitId) {
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/discussions/forums/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data) ? data : (data.Objects || []);
        }
      } catch (e) {
        console.warn(`Failed to fetch discussion forums with LE API v${ver}:`, e);
      }
    }
    return [];
  },

  // Fetch discussion topics for a forum
  async getDiscussionTopics(orgUnitId, forumId) {
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/discussions/forums/${forumId}/topics/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data) ? data : (data.Objects || []);
        }
      } catch (e) {
        console.warn(`Failed to fetch discussion topics for forum ${forumId} with LE API v${ver}:`, e);
      }
    }
    return [];
  },

  // Fetch rubrics list
  async getRubricsList(orgUnitId) {
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/rubrics/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data) ? data : (data.Objects || []);
        }
      } catch (e) {
        console.warn(`Failed to fetch rubrics list with LE API v${ver}:`, e);
      }
    }
    return [];
  },

  // Fetch rubrics associated with a specific object (Dropbox or Discussion)
  async getRubricsForActivity(orgUnitId, objectType, objectId) {
    if (!orgUnitId || !objectType || !objectId) return [];
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/rubrics?objectType=${encodeURIComponent(objectType)}&objectId=${encodeURIComponent(objectId)}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const data = await resp.json();
          return Array.isArray(data) ? data : (data.Objects || [data]);
        }
      } catch (e) {
        console.warn(`Failed to fetch activity rubrics for ${objectType} ${objectId} with v${ver}:`, e);
      }
    }
    return [];
  },

  // Fetch individual rubric details with multi-version & LMS fallback
  async getRubricDetails(orgUnitId, rubricId) {
    if (!rubricId) return null;
    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/rubrics/${rubricId}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && (data.CriteriaGroups || data.Levels || data.Name)) {
            return data;
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch rubric details for rubric ${rubricId} with v${ver}:`, e);
      }
    }

    // Fallback: Try student LMS rubric view endpoint
    return await this.fetchLmsRubricFallback(orgUnitId, rubricId);
  },

  // Scrapes LMS HTML rubric view when Valence REST API is restricted for student role
  async fetchLmsRubricFallback(orgUnitId, rubricId, dropboxId = null) {
    const urlsToTry = [];
    if (rubricId) {
      urlsToTry.push(`/d2l/lms/rubrics/rubric_view.d2l?ou=${orgUnitId}&rubricId=${rubricId}`);
      urlsToTry.push(`/d2l/lms/rubrics/view.d2l?ou=${orgUnitId}&rubricId=${rubricId}`);
      urlsToTry.push(`/d2l/lms/rubrics/rubric_criteria_group_view.d2l?ou=${orgUnitId}&rubricId=${rubricId}`);
    }
    if (dropboxId) {
      urlsToTry.push(`/d2l/lms/dropbox/user/view_rubric.d2l?ou=${orgUnitId}&db=${dropboxId}`);
      urlsToTry.push(`/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=${orgUnitId}&db=${dropboxId}`);
    }

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!resp.ok) continue;
        const html = await resp.text();
        if (!html || (!html.includes('rubric') && !html.includes('Criteria') && !html.includes('d_g') && !html.includes('d2l-rubric'))) continue;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find rubric table in the parsed document
        const table = doc.querySelector('.d2l-rubric-table, table.d_g, table[id*="rubric"], .dco_c table, d2l-rubric');
        if (table) {
          const rubricNameElem = doc.querySelector('.d2l-page-title, .d2l-heading, h1, h2, .rubric-title');
          const rubricName = rubricNameElem ? rubricNameElem.textContent.trim() : 'Evaluation Rubric';
          return {
            RubricId: rubricId,
            Name: rubricName,
            isRawHtml: true,
            rawTableHtml: table.outerHTML
          };
        }
      } catch (e) {
        console.warn(`Failed LMS rubric fallback on ${url}:`, e);
      }
    }
    return null;
  },

  // Fetch quizzes list via Valence API
  async getQuizzesList(orgUnitId) {
    try {
      const resp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/quizzes/`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        const data = await resp.json();
        return Array.isArray(data) ? data : (data.Objects || []);
      }
    } catch (e) {
      console.warn('Failed to fetch quizzes list:', e);
    }
    return [];
  },

  // Fetch quizzes list by scraping student-facing LMS quizzes_list.d2l page
  async getQuizzesFromLms(orgUnitId) {
    const quizMap = [];
    const urlsToTry = [
      `/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${orgUnitId}`,
      `/d2l/lms/quizzes/user/quizzes_list.d2l?ou=${orgUnitId}`
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(this.toAbsoluteUrl(url));
        if (!resp.ok) continue;
        
        const htmlText = await resp.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

        doc.querySelectorAll('a[href*="quiz_summary.d2l"], a[href*="quiz_submissions.d2l"], a[href*="qi="]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const match = href.match(/[?&]qi=(\d+)/i);
          if (match) {
            const quizId = parseInt(match[1], 10);
            const title = a.innerText ? a.innerText.trim() : (a.textContent ? a.textContent.trim() : '');
            if (quizId && title && !quizMap.some(q => q.QuizId === quizId)) {
              quizMap.push({
                QuizId: quizId,
                Name: title,
                href: href
              });
            }
          }
        });
        if (quizMap.length > 0) break;
      } catch (e) {
        console.warn(`Failed to parse quizzes list from ${url}:`, e);
      }
    }
    return quizMap;
  },

  // Fetch quiz attempt details HTML and extract questions & answers
  async fetchQuizAttemptContent(item, orgUnitId, quizzesList = [], discoveredAttachments = [], downloadAssets = true) {
    const topicUrl = item.url;
    const topicTitle = item.title;
    try {
      let quizId = null;
      
      // 1. Direct toolItemId or item properties if already resolved
      if (item.toolItemId) {
        quizId = parseInt(item.toolItemId, 10);
      } else if (item.ToolItemId) {
        quizId = parseInt(item.ToolItemId, 10);
      }

      // 2. Try to extract qi from the topic URL
      if (!quizId && topicUrl) {
        const match = topicUrl.match(/[?&]qi=(\d+)/i);
        if (match) {
          quizId = parseInt(match[1], 10);
        }
      }

      // 3. Try to extract from activityId (e.g. .../quiz/...-10323)
      if (!quizId && (item.activityId || item.ActivityId)) {
        const actId = item.activityId || item.ActivityId;
        const actMatch = actId.match(/quiz\/[^-]+-(\d+)/i) || actId.match(/quiz\/(\d+)/i);
        if (actMatch) {
          quizId = parseInt(actMatch[1], 10);
        }
      }

      // 4. Query Valence Content Topic endpoint if topic ID is available
      if (!quizId && item.id && orgUnitId) {
        const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
        for (const ver of apiVersions) {
          try {
            const topicResp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/content/topics/${item.id}`, {
              headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (topicResp.ok) {
              const topicData = await topicResp.json();
              if (topicData.ToolItemId) {
                quizId = parseInt(topicData.ToolItemId, 10);
                break;
              }
              if (topicData.Url) {
                const qMatch = topicData.Url.match(/[?&]qi=(\d+)/i);
                if (qMatch) {
                  quizId = parseInt(qMatch[1], 10);
                  break;
                }
              }
              if (topicData.ActivityId) {
                const aMatch = topicData.ActivityId.match(/quiz\/[^-]+-(\d+)/i) || topicData.ActivityId.match(/quiz\/(\d+)/i);
                if (aMatch) {
                  quizId = parseInt(aMatch[1], 10);
                  break;
                }
              }
            }
          } catch (e) {
            // continue to next fallback
          }
        }
      }
      
      // 5. Try to match by name from quizzesList
      if (!quizId && quizzesList && quizzesList.length > 0) {
        const cleanTopicTitle = this.cleanNameForMatching(topicTitle);
        const matched = quizzesList.find(q => {
          const cleanQName = this.cleanNameForMatching(q.Name || q.Title);
          return cleanQName === cleanTopicTitle || cleanQName.includes(cleanTopicTitle) || cleanTopicTitle.includes(cleanQName);
        });
        if (matched) {
          quizId = matched.QuizId || matched.Id;
        }
      }
      
      // 6. If still not found, try to resolve quicklink / topicUrl response and follow redirects
      if (!quizId && topicUrl) {
        try {
          const resp = await fetch(this.toAbsoluteUrl(topicUrl));
          if (resp.url) {
            const redirectMatch = resp.url.match(/[?&]qi=(\d+)/i);
            if (redirectMatch) {
              quizId = parseInt(redirectMatch[1], 10);
            }
          }
          if (!quizId) {
            const text = await resp.text();
            const unescapedText = text.replace(/\\\//g, '/');
            const textMatch = unescapedText.match(/[?&]qi=(\d+)/i) || unescapedText.match(/quiz_summary\.d2l\?[^"']*\bqi=(\d+)/i);
            if (textMatch) {
              quizId = parseInt(textMatch[1], 10);
            }
          }
        } catch (e) {
          console.warn('Failed to resolve quicklink for quiz ID:', e);
        }
      }
      
      if (!quizId) {
        return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                  <strong>Notice:</strong> Could not resolve quiz ID to check attempt history.
                </div>`;
      }
      
      // 7. Discover Completed Attempt Submission URL
      let attemptUrl = null;

      // Scrape student LMS summary & submissions pages (supporting both /quizzing/ and /quizzes/)
      const possibleUrls = [
        `/d2l/lms/quizzing/user/quiz_submissions.d2l?qi=${quizId}&ou=${orgUnitId}`,
        `/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${quizId}&ou=${orgUnitId}`,
        `/d2l/lms/quizzes/user/quiz_submissions.d2l?qi=${quizId}&ou=${orgUnitId}`,
        `/d2l/lms/quizzes/user/quiz_summary.d2l?qi=${quizId}&ou=${orgUnitId}`,
        topicUrl
      ];

      for (const pUrl of possibleUrls) {
        if (!pUrl) continue;
        try {
          const resp = await fetch(this.toAbsoluteUrl(pUrl));
          if (resp.ok) {
            const htmlText = await resp.text();
            const unescapedHtml = htmlText.replace(/\\\//g, '/');
            const parser = new DOMParser();
            const doc = parser.parseFromString(unescapedHtml, 'text/html');

            // 1. DOM search for submission attempt links
            const attemptElements = Array.from(doc.querySelectorAll('a[href*="quiz_submissions_attempt"], a[href*="quiz_attempt_show_questions"], a[href*="submission_view"], [quiz-submission-url]'))
              .filter(el => {
                const inProgress = el.hasAttribute('inprogress') || el.getAttribute('inprogress') !== null || el.closest('[inprogress]');
                return !inProgress;
              });

            if (attemptElements.length > 0) {
              const lastEl = attemptElements[attemptElements.length - 1];
              const href = lastEl.getAttribute('quiz-submission-url') || lastEl.getAttribute('href');
              if (href) {
                attemptUrl = this.toAbsoluteUrl(href.replace(/&amp;/g, '&'));
                break;
              }
            }

            // 2. Regex fallback for attempt URLs or attempt IDs (ai=...)
            const matches = unescapedHtml.match(/(\/d2l\/lms\/quizz(?:ing|es)\/user\/(?:quiz_submissions_attempt|quiz_attempt_show_questions|submission_view)\.d2l\?[^"'\s<>]+)/gi);
            if (matches && matches.length > 0) {
              const lastMatch = matches[matches.length - 1].replace(/&amp;/g, '&');
              attemptUrl = this.toAbsoluteUrl(lastMatch);
              break;
            }

            // 3. Check for attempt ID match
            const aiMatch = unescapedHtml.match(/[?&]ai=(\d+)/i);
            if (aiMatch) {
              const aiVal = aiMatch[1];
              attemptUrl = this.toAbsoluteUrl(`/d2l/lms/quizzing/user/quiz_submissions_attempt.d2l?ou=${orgUnitId}&qi=${quizId}&ai=${aiVal}&isInActivityDisplayDialog=1`);
              break;
            }
          }
        } catch (e) {
          console.warn(`Failed fetching quiz page ${pUrl}:`, e);
        }
      }

      if (!attemptUrl) {
        return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                  <strong>No attempt history found.</strong> Take this quiz in Brightspace, then export again to download questions and answers.
                </div>`;
      }
      
      const attemptResp = await fetch(attemptUrl);
      if (!attemptResp.ok) {
        return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                  <strong>Notice:</strong> Attempt details page returned status ${attemptResp.status}.
                </div>`;
      }

      const attemptHtml = await attemptResp.text();
      return this.parseQuizAttemptHtml(attemptHtml, attemptUrl, discoveredAttachments, downloadAssets);
    } catch (e) {
      console.error(`Failed to fetch quiz content for ${topicTitle}:`, e);
      return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                <strong>Error:</strong> Failed to retrieve quiz questions and answers due to an exception: ${e.message}
              </div>`;
    }
  },

  // Parse structured quiz questions, choices, points, score, and explanations from Brightspace attempt HTML
  parseQuizAttemptHtml(attemptHtml, attemptUrl = 'https://learn.uopeople.edu/', discoveredAttachments = [], downloadAssets = true) {
    if (!attemptHtml) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(attemptHtml, 'text/html');
      const container = doc.body;

      // 1. Unpack all <d2l-html-block> web components into standard readable DOM nodes
      this.unpackD2LHtmlBlocks(container);

      // 2. Extract Score Banner
      let scoreHtml = '';
      let attemptScoreText = '';
      let overallGradeText = '';
      let attemptDateText = '';
      
      const allRows = container.querySelectorAll('tr, .dco.status, [id*="attempt"]');
      allRows.forEach(el => {
        const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt.includes('Attempt Score') && !attemptScoreText) {
          attemptScoreText = txt;
        } else if (txt.includes('Overall Grade') && !overallGradeText) {
          overallGradeText = txt;
        } else if (txt.includes('Written ') && !attemptDateText) {
          attemptDateText = txt;
        }
      });

      if (attemptScoreText || overallGradeText) {
        const cleanScore = this.formatQuizScoreText(attemptScoreText);
        const cleanGrade = this.formatQuizScoreText(overallGradeText);
        const cleanDate = this.formatQuizScoreText(attemptDateText);

        scoreHtml = `
          <div class="quiz-score-banner" style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; padding: 14px 18px; margin-bottom: 20px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08)); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${cleanScore ? `<div style="font-weight: 700; color: var(--text-main); font-size: 15px;">📊 <span>${this.escapeHtml(cleanScore)}</span></div>` : ''}
              ${cleanGrade ? `<div style="font-size: 13px; color: var(--text-muted);">${this.escapeHtml(cleanGrade)}</div>` : ''}
            </div>
            ${cleanDate ? `<div style="font-size: 12px; color: var(--text-muted); background: rgba(0,0,0,0.04); padding: 4px 10px; border-radius: 20px;">📅 ${this.escapeHtml(cleanDate)}</div>` : ''}
          </div>
        `;
      }

      // 3. Locate Question Headers
      let qHeaders = Array.from(container.querySelectorAll('.updated-submission-question-header, [class*="submission-question-header"], [class*="question-header"]'));
      if (qHeaders.length === 0) {
        const qAnchors = Array.from(container.querySelectorAll('a[id^="Q"], a[name^="Q"]'));
        qHeaders = qAnchors.map(a => a.closest('.dco, div') || a.parentElement).filter(Boolean);
      }

      // 4. Extract Question Details
      const questionsList = [];
      const seenQNumbers = new Set();

      for (let i = 0; i < qHeaders.length; i++) {
        const qHdr = qHeaders[i];
        const headerText = (qHdr.innerText || qHdr.textContent || '').replace(/\s+/g, ' ').trim();
        
        const qNumMatch = headerText.match(/Question\s+(\d+)/i);
        const qNum = qNumMatch ? parseInt(qNumMatch[1], 10) : (questionsList.length + 1);

        if (seenQNumbers.has(qNum)) continue;
        seenQNumbers.add(qNum);

        const ptsMatch = headerText.match(/(\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*points?)/i);
        const pointsText = ptsMatch ? ptsMatch[1] : '';

        // Sibling body container
        let bodyContainer = qHdr.nextElementSibling;
        while (bodyContainer && bodyContainer.tagName === 'A') {
          bodyContainer = bodyContainer.nextElementSibling;
        }

        let promptHtml = '';
        const options = [];
        let feedbackHtml = '';

        if (bodyContainer) {
          // Question prompt text
          const promptEl = bodyContainer.querySelector('.d2l-htmlblock-untrusted, .d2l-unpacked-block, p') || bodyContainer.firstElementChild;
          if (promptEl) {
            promptHtml = promptEl.innerHTML.trim();
          }

          // Options table
          const optTable = bodyContainer.querySelector('table.d_t, table');
          if (optTable) {
            const rows = optTable.querySelectorAll('tr');
            rows.forEach(tr => {
              const trHtml = tr.innerHTML.toLowerCase();
              const trText = (tr.innerText || tr.textContent || '').trim();

              const isCorrect = trHtml.includes('tier1:check') || 
                                trHtml.includes('alt="correct response"') || 
                                trHtml.includes('title="correct response"') || 
                                trHtml.includes('alt="correct"') || 
                                trHtml.includes('title="correct"') || 
                                trHtml.includes('infcorrect') ||
                                Boolean(tr.querySelector('d2l-icon[icon="tier1:check"], d2l-icon[icon*=":check"], [class*="answer-correct"]'));

              const isSelected = (trHtml.includes('radiochecked.svg') || 
                                  trHtml.includes('checkboxchecked.svg') || 
                                  trHtml.includes('alt="selected"') ||
                                  trHtml.includes('title="selected"')) &&
                                 !trHtml.includes('radiounchecked.svg') &&
                                 !trHtml.includes('alt="unselected"') &&
                                 !trHtml.includes('title="unselected"');

              const isIncorrect = trHtml.includes('tier1:close') ||
                                  trHtml.includes('alt="incorrect response"') ||
                                  trHtml.includes('title="incorrect response"') ||
                                  Boolean(tr.querySelector('d2l-icon[icon="tier1:close"], [class*="answer-incorrect"]'));

              // Option text container: prioritize unpacked block, untrusted block, d2l-html-block, or the .d_tw width=100% cell
              const optTextEl = tr.querySelector('.d2l-unpacked-inline, .d2l-unpacked-block, .d2l-htmlblock-untrusted, d2l-html-block') ||
                                tr.querySelector('.d_tw') ||
                                tr.querySelector('td:last-child');
              let optTextHtml = '';

              if (optTextEl) {
                if (optTextEl.tagName === 'D2L-HTML-BLOCK') {
                  const htmlAttr = optTextEl.getAttribute('html');
                  optTextHtml = htmlAttr ? this.unpackD2LHtmlBlocks(htmlAttr) : optTextEl.innerHTML.trim();
                } else {
                  optTextHtml = optTextEl.innerHTML.trim();
                }
              } else {
                optTextHtml = trText;
              }

              // Strip any residual indicator image tags or controls wrappers from the choice text
              if (optTextHtml.includes('<img') || optTextHtml.includes('<d2l-icon')) {
                const tempDiv = (doc.createElement ? doc : document).createElement('div');
                tempDiv.innerHTML = optTextHtml;
                tempDiv.querySelectorAll('img, d2l-icon, .dco_c, .di_s, .d2l-qc-controls-container').forEach(el => el.remove());
                const cleanedText = tempDiv.innerHTML.trim();
                if (cleanedText) {
                  optTextHtml = cleanedText;
                }
              }

              if (optTextHtml) {
                options.push({
                  textHtml: optTextHtml,
                  isCorrect: isCorrect,
                  isSelected: isSelected,
                  isIncorrect: isIncorrect
                });
              }
            });
          }

          // Search subsequent siblings for feedback table or card
          let currSibling = bodyContainer.nextElementSibling;
          while (currSibling && !currSibling.classList.contains('updated-submission-question-header') && !currSibling.querySelector('.updated-submission-question-header')) {
            const fbTextEl = currSibling.querySelector('.d2l-question-feedback-text, [id*="Feedback"], .d2l-htmlblock-untrusted, .d2l-unpacked-block');
            if (fbTextEl) {
              feedbackHtml = fbTextEl.innerHTML.trim();
              break;
            }
            if (currSibling.tagName === 'TABLE' && currSibling.classList.contains('d_FG')) {
              const fbCell = currSibling.querySelector('.dco_c, .d2l-unpacked-block, .fct_w');
              if (fbCell) {
                feedbackHtml = fbCell.innerHTML.trim();
                break;
              }
            }
            currSibling = currSibling.nextElementSibling;
          }
        }

        if (!promptHtml && bodyContainer) {
          promptHtml = bodyContainer.innerHTML.trim();
        }

        questionsList.push({
          number: qNum,
          points: pointsText,
          promptHtml: promptHtml,
          options: options,
          feedbackHtml: feedbackHtml
        });
      }

      // 5. Render Structured HTML Output
      let questionsHtml = '';
      if (questionsList.length > 0) {
        questionsList.forEach((q) => {
          let optionsHtml = '';
          if (q.options && q.options.length > 0) {
            optionsHtml = `
              <div class="quiz-options-list" style="display: flex; flex-direction: column; gap: 8px; margin: 14px 0;">
                ${q.options.map(opt => {
                  let optStyle = 'display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-hover);';
                  let badge = '';

                  if (opt.isCorrect && opt.isSelected) {
                    optStyle = 'display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 6px; border: 1.5px solid #10b981; background: rgba(16, 185, 129, 0.08);';
                    badge = '<span class="quiz-badge-correct" style="margin-left: auto; font-size: 12px; font-weight: 600; color: #10b981; white-space: nowrap;">✅ Correct &amp; Your Answer</span>';
                  } else if (opt.isCorrect) {
                    optStyle = 'display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 6px; border: 1.5px solid #10b981; background: rgba(16, 185, 129, 0.05);';
                    badge = '<span class="quiz-badge-correct" style="margin-left: auto; font-size: 12px; font-weight: 600; color: #10b981; white-space: nowrap;">✅ Correct Answer</span>';
                  } else if (opt.isSelected) {
                    optStyle = 'display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 6px; border: 1.5px solid #ef4444; background: rgba(239, 68, 68, 0.05);';
                    badge = '<span class="quiz-badge-selected" style="margin-left: auto; font-size: 12px; font-weight: 600; color: #ef4444; white-space: nowrap;">❌ Your Answer</span>';
                  }

                  return `
                    <div class="quiz-option-item ${opt.isCorrect ? 'is-correct' : ''} ${opt.isSelected ? 'is-selected' : ''}" style="${optStyle}">
                      <span style="font-size: 16px; line-height: 1;">${opt.isSelected ? '🔘' : '⚪'}</span>
                      <div class="quiz-option-text" style="flex: 1; font-size: 14px; color: var(--text-main);">${opt.textHtml}</div>
                      ${badge}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }

          let feedbackBlock = '';
          if (q.feedbackHtml) {
            feedbackBlock = `
              <div class="quiz-feedback-card" style="margin-top: 14px; padding: 12px 16px; background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; border-radius: 4px;">
                <div style="font-weight: 700; font-size: 13px; color: #d97706; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                  <span>💡</span> <span>Explanation &amp; Feedback</span>
                </div>
                <div style="font-size: 13.5px; color: var(--text-main); line-height: 1.5;">${q.feedbackHtml}</div>
              </div>
            `;
          }

          questionsHtml += `
            <div class="offline-quiz-question" style="margin-bottom: 24px; padding: 20px; border: 1px solid var(--border-color); border-radius: 8px; background-color: var(--bg-card); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div class="quiz-question-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <span style="font-weight: 700; color: var(--accent); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Question ${q.number}</span>
                ${q.points ? `<span class="quiz-points-badge" style="font-size: 12px; font-weight: 600; background: var(--bg-hover); color: var(--text-muted); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border-color);">${this.escapeHtml(q.points)}</span>` : ''}
              </div>
              <div class="quiz-prompt-text" style="font-size: 15px; font-weight: 500; color: var(--text-main); margin-bottom: 14px; line-height: 1.5;">${q.promptHtml}</div>
              ${optionsHtml}
              ${feedbackBlock}
            </div>
          `;
        });
      }

      // If no questions parsed via structured headers, use fallback
      if (!questionsHtml) {
        const fallback = container.querySelector('form#d2l_form, form#attemptForm, #d_content_r_p, #d_content, .d2l-page-main');
        if (fallback) {
          questionsHtml = this.processQuizHtml(fallback.innerHTML, attemptUrl, discoveredAttachments, downloadAssets);
        }
      }

      if (!questionsHtml) {
        return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                  <strong>Notice:</strong> Quiz questions container could not be parsed from attempt details.
                </div>`;
      }

      const finalHtml = (scoreHtml + questionsHtml).trim();
      return this.processHtmlContent(finalHtml, attemptUrl, discoveredAttachments, downloadAssets);
    } catch (e) {
      console.warn('Failed to parse quiz attempt HTML:', e);
      return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                <strong>Error:</strong> Failed to process quiz questions: ${e.message}
              </div>`;
    }
  },

  processQuizHtml(htmlStr, baseUrl = 'https://learn.uopeople.edu/', discoveredAttachments = [], downloadAssets = true) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      const container = doc.body;

      this.unpackD2LHtmlBlocks(container);

      // 1. Replace correctness and selection indicator images with emojis
      container.querySelectorAll('img').forEach(img => {
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        const src = (img.getAttribute('src') || '').toLowerCase();
        if (alt.includes('correct response') || alt === 'correct' || src.includes('correct')) {
          const span = doc.createElement('span');
          span.style.color = '#10b981';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.textContent = ' ✅ ';
          const sm = doc.createElement('small');
          sm.style.color = '#10b981';
          sm.style.fontWeight = '600';
          sm.textContent = 'Correct';
          span.appendChild(sm);
          img.parentNode.replaceChild(span, img);
        } else if (alt.includes('incorrect response') || alt === 'incorrect' || src.includes('incorrect')) {
          const span = doc.createElement('span');
          span.style.color = '#ef4444';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.textContent = ' ❌ ';
          const sm = doc.createElement('small');
          sm.style.color = '#ef4444';
          sm.style.fontWeight = '600';
          sm.textContent = 'Incorrect';
          span.appendChild(sm);
          img.parentNode.replaceChild(span, img);
        } else if (alt.includes('selected') || alt.includes('your answer') || src.includes('selected')) {
          const span = doc.createElement('span');
          span.style.color = '#3b82f6';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.textContent = ' 👤 ';
          const sm = doc.createElement('small');
          sm.style.color = '#3b82f6';
          sm.style.fontWeight = '600';
          sm.textContent = 'Your Answer';
          span.appendChild(sm);
          img.parentNode.replaceChild(span, img);
        }
      });

      // 2. Replace d2l-icon markers with emojis
      container.querySelectorAll('d2l-icon').forEach(icon => {
        const iconName = (icon.getAttribute('icon') || '').toLowerCase();
        if (iconName.includes('check') || iconName.includes('correct')) {
          const span = doc.createElement('span');
          span.style.color = '#10b981';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.textContent = ' ✅ ';
          const sm = doc.createElement('small');
          sm.style.color = '#10b981';
          sm.style.fontWeight = '600';
          sm.textContent = 'Correct';
          span.appendChild(sm);
          icon.parentNode.replaceChild(span, icon);
        } else if (iconName.includes('close') || iconName.includes('incorrect') || iconName.includes('fail')) {
          const span = doc.createElement('span');
          span.style.color = '#ef4444';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.textContent = ' ❌ ';
          const sm = doc.createElement('small');
          sm.style.color = '#ef4444';
          sm.style.fontWeight = '600';
          sm.textContent = 'Incorrect';
          span.appendChild(sm);
          icon.parentNode.replaceChild(span, icon);
        }
      });

      // 3. Highlight D2L answer indicator blocks
      container.querySelectorAll('.d2l-quiz-answer-correct, .d2l-questions-answer-correct').forEach(el => {
        el.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
        el.style.borderLeft = '4px solid #10b981';
        el.style.paddingLeft = '8px';
      });
      container.querySelectorAll('.d2l-quiz-answer-incorrect, .d2l-questions-answer-incorrect').forEach(el => {
        el.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        el.style.borderLeft = '4px solid #ef4444';
        el.style.paddingLeft = '8px';
      });

      // 4. Disable all inputs to make read-only
      container.querySelectorAll('input, textarea, select').forEach(input => {
        input.setAttribute('disabled', 'disabled');
      });

      // 5. Process normal links/images
      const processed = this.processHtmlContent(container.innerHTML, baseUrl, discoveredAttachments, downloadAssets);
      return processed;
    } catch (e) {
      console.warn('Failed to process Quiz HTML:', e);
      return htmlStr;
    }
  },

  // Format raw Brightspace quiz score text into clean human-readable labels
  formatQuizScoreText(rawStr) {
    if (!rawStr) return '';
    const s = String(rawStr).replace(/\s+/g, ' ').trim();
    const lower = s.toLowerCase();

    if (lower.includes('attempt score')) {
      const match = s.match(/attempt\s*score\s*:?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?\s*%))?/i);
      if (match) {
        const earned = match[1];
        const total = match[2];
        const pct = match[3] ? match[3].replace(/\s+/g, '') : `${Math.round((parseFloat(earned) / parseFloat(total)) * 100)}%`;
        return `Attempt Score: ${earned} / ${total} (${pct})`;
      }
      return s.replace(/^attempt\s*score/i, 'Attempt Score: ');
    }

    if (lower.includes('overall grade')) {
      const match = s.match(/overall\s*grade(?:\s*\(([^)]+)\))?\s*:?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?\s*%))?/i);
      if (match) {
        const sub = match[1] || 'Highest Attempt';
        const earned = match[2];
        const total = match[3];
        const pct = match[4] ? match[4].replace(/\s+/g, '') : `${Math.round((parseFloat(earned) / parseFloat(total)) * 100)}%`;
        return `Overall Grade (${sub}): ${earned} / ${total} (${pct})`;
      }
      return s.replace(/^overall\s*grade/i, 'Overall Grade: ');
    }

    if (lower.startsWith('written')) {
      return s.replace(/([AP]M)(Attempt\s+\d+)/i, '$1 • $2').replace(/^Written\s*/i, 'Submitted: ');
    }

    return s;
  },

  // Clean a name for robust matching (e.g. written assignment unit 1 vs assignment activity unit 1)
  cleanNameForMatching(name) {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/written assignment/g, 'assignment')
      .replace(/assignment activity/g, 'assignment')
      .replace(/discussion forum/g, 'discussion')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  },

  // Escape HTML characters helper
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // Helper to extract rubric IDs from any activity object (dropbox or discussion topic)
  extractRubricIds(activity) {
    if (!activity) return [];
    const ids = new Set();
    if (activity.Evaluation && Array.isArray(activity.Evaluation.RubricIds)) {
      activity.Evaluation.RubricIds.forEach(id => { if (id) ids.add(id); });
    }
    if (activity.Assessment && Array.isArray(activity.Assessment.Rubrics)) {
      activity.Assessment.Rubrics.forEach(r => {
        const id = r.RubricId || r.Id;
        if (id) ids.add(id);
      });
    }
    if (Array.isArray(activity.Rubrics)) {
      activity.Rubrics.forEach(r => {
        const id = (typeof r === 'object') ? (r.RubricId || r.Id) : r;
        if (id) ids.add(id);
      });
    }
    if (Array.isArray(activity.RubricIds)) {
      activity.RubricIds.forEach(id => { if (id) ids.add(id); });
    }
    if (activity.RubricId) ids.add(activity.RubricId);
    return Array.from(ids);
  },

  // Find associated rubric by checking explicit ids or fall back to name matching
  findRubricForActivity(activityName, rubricIds, rubricsMap) {
    if (rubricIds && rubricIds.length > 0) {
      for (const rid of rubricIds) {
        if (rubricsMap[rid]) return rubricsMap[rid];
      }
    }
    const cleanActName = this.cleanNameForMatching(activityName);
    for (const rid in rubricsMap) {
      const rubric = rubricsMap[rid];
      if (!rubric) continue;
      const cleanRubName = this.cleanNameForMatching(rubric.Name);
      if (cleanRubName.includes(cleanActName) || cleanActName.includes(cleanRubName.replace('rubric', '')) || cleanActName.includes(cleanRubName)) {
        return rubric;
      }
    }
    return null;
  },

  // Render a rubric object into a beautiful HTML table
  buildRubricHtml(rubric) {
    if (!rubric) return '';
    try {
      if (rubric.isRawHtml && rubric.rawTableHtml) {
        return `
          <div class="rubric-container">
            <div class="rubric-header">
              <span class="rubric-badge">📋 Evaluation Rubric</span>
              <h4 class="rubric-title">${this.escapeHtml(rubric.Name || 'Grading Rubric')}</h4>
            </div>
            <div class="rubric-table-wrapper">
              ${rubric.rawTableHtml}
            </div>
          </div>
        `;
      }

      const rubricName = rubric.Name || 'Evaluation Rubric';
      const rubricDesc = rubric.Description ? (rubric.Description.Html || rubric.Description.Text || '') : '';
      const criteriaGroups = (rubric.CriteriaGroups && rubric.CriteriaGroups.length > 0) 
        ? rubric.CriteriaGroups 
        : (rubric.Criteria ? [{ Criteria: rubric.Criteria, Levels: rubric.Levels }] : []);
      
      if (criteriaGroups.length === 0) return '';

      let html = `<div class="rubric-container">`;
      html += `<div class="rubric-header">`;
      html += `<span class="rubric-badge">📋 Evaluation Rubric</span>`;
      html += `<h4 class="rubric-title">${this.escapeHtml(rubricName)}</h4>`;
      if (rubricDesc) {
        html += `<div class="rubric-description">${rubricDesc}</div>`;
      }
      html += `</div>`;

      for (const group of criteriaGroups) {
        const levels = (group.Levels && group.Levels.length > 0) ? group.Levels : (rubric.Levels || []);
        const criteria = group.Criteria || [];
        if (criteria.length === 0) continue;

        html += `<div class="rubric-table-wrapper">`;
        html += `<table class="rubric-table">`;
        html += `<thead><tr>`;
        html += `<th class="rubric-col-criterion">Criteria</th>`;
        
        // Header columns for levels
        for (const lvl of levels) {
          const pts = (lvl.Points !== undefined && lvl.Points !== null) ? lvl.Points : (lvl.Value !== undefined ? lvl.Value : null);
          html += `<th class="rubric-col-level">`;
          html += `<div class="rubric-level-name">${this.escapeHtml(lvl.Name || '')}</div>`;
          if (pts !== null && pts !== undefined) {
            html += `<div class="rubric-level-points">${pts} pts</div>`;
          }
          html += `</th>`;
        }
        html += `</tr></thead><tbody>`;

        // Criteria rows
        for (const crit of criteria) {
          html += `<tr>`;
          html += `<td class="rubric-cell-criterion">`;
          html += `<div class="rubric-crit-name">${this.escapeHtml(crit.Name || 'Criterion')}</div>`;
          if (crit.Outof !== undefined && crit.Outof !== null) {
            html += `<div class="rubric-crit-outof">Out of ${crit.Outof} pts</div>`;
          }
          if (crit.Weight !== undefined && crit.Weight !== null) {
            html += `<div class="rubric-crit-weight">Weight: ${crit.Weight}%</div>`;
          }
          html += `</td>`;

          // Cell for each level
          const critLevels = crit.Levels || [];
          for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const cell = critLevels.find(cl => cl.LevelId === lvl.LevelId) || critLevels[i] || {};
            const desc = cell.Description ? (cell.Description.Html || cell.Description.Text || '') : (cell.Feedback ? (cell.Feedback.Html || cell.Feedback.Text || '') : '');
            const pts = cell.Points !== undefined ? cell.Points : (cell.Value !== undefined ? cell.Value : null);
            
            html += `<td class="rubric-cell-level">`;
            if (pts !== null && pts !== undefined) {
              html += `<div class="rubric-cell-points">${pts} pts</div>`;
            }
            html += `<div class="rubric-cell-desc">${desc || '<span style="color: var(--text-muted);">—</span>'}</div>`;
            html += `</td>`;
          }
          html += `</tr>`;
        }
        html += `</tbody></table></div>`;
      }
      html += `</div>`;
      return html;
    } catch (e) {
      console.error('Error rendering rubric HTML:', e);
      return `<p style="color: var(--badge-quiz); font-size: 13px;">Error rendering rubric: ${this.escapeHtml(e.message)}</p>`;
    }
  },

  // Shared processor for content HTML (rewriting links, extracting attachments)
  processHtmlContent(htmlStr, baseUrl = 'https://learn.uopeople.edu/', discoveredAttachments = [], downloadAssets = true) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      const container = doc.body;

      // 1. Unpack all <d2l-html-block> web components first
      this.unpackD2LHtmlBlocks(container);

      // Process all links and attachments
      const ouMatch = baseUrl.match(/(?:enforced\/|lessons\/|content\/|home\/)(\d+)/i);
      const matchedOu = ouMatch ? ouMatch[1] : '';

      container.querySelectorAll('a[href]').forEach(a => {
        let href = a.getAttribute('href');
        if (href) {
          if (matchedOu && href.includes('{orgUnitId}')) {
            href = href.replace(/\{orgUnitId\}/g, matchedOu);
            a.setAttribute('href', href);
          }
          let absUrl = this.toAbsoluteUrl(href, baseUrl);
          if (matchedOu && absUrl.includes('{orgUnitId}')) {
            absUrl = absUrl.replace(/\{orgUnitId\}/g, matchedOu);
          }
          if (this.isAssetUrl(href) || this.isAssetUrl(absUrl)) {
            let rawFileName = href.split('?')[0].split('#')[0].split('/').pop();
            if (!rawFileName || rawFileName === 'DirectFileTopicDownload') {
              rawFileName = a.innerText ? a.innerText.trim() : 'attachment';
            }
            const cleanFileName = this.sanitizeFileName(rawFileName);

            if (downloadAssets) {
              const localAssetPath = `assets/${cleanFileName}`;
              a.setAttribute('href', localAssetPath);
            } else {
              a.setAttribute('href', absUrl);
              a.setAttribute('rel', 'noopener noreferrer');
            }
            a.setAttribute('target', '_blank');

            const title = cleanFileName.replace(/\.[^/.]+$/, '');
            if (this.shouldKeepAttachment(title, absUrl)) {
              discoveredAttachments.push({
                title: title,
                url: absUrl,
                ext: cleanFileName.split('.').pop() || 'pdf',
                localFileName: cleanFileName
              });
            }
          } else if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:')) {
            a.setAttribute('href', absUrl);
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
          }
        }
      });

      // Refactor YouTube videos to replace broken Error 153 iframe with responsive YouTube card
      container.querySelectorAll('iframe').forEach(iframe => {
        let src = iframe.getAttribute('src') || '';
        if (src) {
          const absUrl = this.toAbsoluteUrl(src, baseUrl);
          const ytMatch = absUrl.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
          if (ytMatch) {
            const videoId = ytMatch[1];
            
            // Create a custom responsive preview card for YouTube video (eliminates Error 153 under file://)
            const card = doc.createElement('div');
            card.className = 'video-container youtube-card';
            card.setAttribute('data-video-id', videoId);

            const aLink = doc.createElement('a');
            aLink.href = `https://www.youtube.com/watch?v=${videoId}`;
            aLink.target = '_blank';
            aLink.rel = 'noopener';
            aLink.className = 'youtube-card-link';

            const thumbWrap = doc.createElement('div');
            thumbWrap.className = 'youtube-thumb-wrap';

            const thumbImg = doc.createElement('img');
            thumbImg.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            thumbImg.alt = 'Watch Video on YouTube';
            thumbImg.className = 'youtube-thumb-img';
            thumbImg.loading = 'lazy';

            const playBtn = doc.createElement('div');
            playBtn.className = 'youtube-play-btn';
            playBtn.textContent = '▶';

            thumbWrap.appendChild(thumbImg);
            thumbWrap.appendChild(playBtn);

            const cardBar = doc.createElement('div');
            cardBar.className = 'youtube-card-bar';

            const cardInfo = doc.createElement('div');
            cardInfo.className = 'youtube-card-info';

            const cardTitle = doc.createElement('span');
            cardTitle.className = 'youtube-card-title';
            cardTitle.textContent = '▶ Watch Video on YouTube ↗';

            const cardSub = doc.createElement('span');
            cardSub.className = 'youtube-card-sub';
            cardSub.textContent = 'Click to open and watch on YouTube';

            cardInfo.appendChild(cardTitle);
            cardInfo.appendChild(cardSub);

            const watchBtn = doc.createElement('span');
            watchBtn.className = 'watch-on-youtube-btn';
            watchBtn.textContent = 'Watch on YouTube';

            cardBar.appendChild(cardInfo);
            cardBar.appendChild(watchBtn);

            aLink.appendChild(thumbWrap);
            aLink.appendChild(cardBar);
            card.appendChild(aLink);
            
            iframe.parentNode.replaceChild(card, iframe);
          }
        }
      });

      container.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
          const absUrl = this.toAbsoluteUrl(src, baseUrl);
          const lowerSrc = src.toLowerCase();
          const lowerAbs = absUrl.toLowerCase();
          if (lowerSrc.includes('logo_shield') || lowerAbs.includes('logo_shield') ||
              lowerSrc.includes('logominimal') || lowerAbs.includes('logominimal') ||
              lowerSrc.includes('pagebreak_icon') || lowerAbs.includes('pagebreak_icon')) {
            img.remove();
          } else if (!src.startsWith('http') && !src.startsWith('data:')) {
            img.setAttribute('src', absUrl);
          }
        }
      });

      // Strip empty d2l custom web component boilerplate tags if needed
      let resultHtml = container.innerHTML;
      resultHtml = resultHtml.replace(/<d2l-icon[^>]*>.*?<\/d2l-icon>/gi, '');

      return resultHtml.trim();
    } catch (e) {
      console.warn('Failed to process HTML content:', e);
      return htmlStr;
    }
  },

  async parseModules(tocData, extraData = {}, onProgress) {
    if (typeof extraData === 'function') {
      onProgress = extraData;
      extraData = {};
    }
    const { dropboxFolders = [], discussionTopics = [], rubricsMap = {}, quizzesList = [], orgUnitId = null, exportScope = 'full', downloadAssets = true } = extraData;
    const isShareable = exportScope === 'shareable';
    if (!tocData || !tocData.Modules) return [];

    const rawTopicsToFetch = [];

    const isUnwantedCourseIntroItem = (itemTitle) => {
      const lower = itemTitle.toLowerCase().trim();
      return lower === 'assessments (proctored)' ||
             lower === 'assessments' ||
             lower === 'assessments section' ||
             lower === 'resources' ||
             lower === 'resources section' ||
             lower === 'navigating this course' ||
             lower === 'navigating this course section' ||
             lower === 'course forum' ||
             lower === 'class introductions';
    };

    const processModule = (module, isParentCourseIntro = false) => {
      let title = (module.Title || '').replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ').trim();
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('unit 9') || lowerTitle.includes('learning journal')) {
        return null;
      }
      const isCurrentCourseIntro = isParentCourseIntro || lowerTitle.includes('course introduction');

      if (title.toLowerCase().trim() === 'class introductions') {
        return null;
      }

      if (isCurrentCourseIntro && isUnwantedCourseIntroItem(title)) {
        return null;
      }

      const unitObj = {
        id: module.ModuleId,
        title: title,
        description: module.Description ? this.cleanHtml(module.Description.Html || module.Description.Text || '') : '',
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
          if (topicTitle.toLowerCase().includes('learning journal')) {
            continue;
          }
          if (topicTitle.toLowerCase().trim() === 'class introductions') {
            continue;
          }
          if (isCurrentCourseIntro && isUnwantedCourseIntroItem(topicTitle)) {
            continue;
          }
          const topicUrl = this.toAbsoluteUrl(topic.Url || '');
          const topicType = topic.TypeIdentifier || topic.TopicType;
          const lowerTopicTitle = topicTitle.toLowerCase();

          const isDiscussion = lowerTopicTitle.includes('discussion') || lowerTopicTitle.includes('forum') || topicType === 5;
          const isAssignment = lowerTopicTitle.includes('written assignment') || (lowerTopicTitle.includes('assignment') && !lowerTopicTitle.includes('reading')) || topicType === 7;
          const isQuiz = lowerTopicTitle.includes('quiz') || lowerTopicTitle.includes('exam') || lowerTopicTitle.includes('test') || lowerTopicTitle.includes('knowledge check') || topicType === 6;
          const isReading = lowerTopicTitle.includes('reading assignment') || lowerTopicTitle.includes('reading') || lowerTopicTitle.includes('textbook');

          // In Shareable Study Guide mode, skip all graded discussions, assignments, and quizzes
          if (isShareable && (isDiscussion || isAssignment || isQuiz)) {
            continue;
          }

          const topicItem = {
            id: topic.Identifier,
            title: topicTitle,
            url: topicUrl,
            type: topicType,
            typeTitle: topic.TypeTitle || '',
            toolItemId: topic.ToolItemId || null,
            activityId: topic.ActivityId || null,
            contentHtml: ''
          };

          unitObj.topics.push(topicItem);
          rawTopicsToFetch.push({ item: topicItem, unitObj: unitObj });

          if (isDiscussion) {
            unitObj.discussions.push(topicItem);
            
            // Match discussion topic
            let matchedDiscussion = null;
            const topicIdMatch = topicUrl.match(/[?&]id=(\d+)/i) || topicUrl.match(/[?&]tid=(\d+)/i) || topicUrl.match(/[?&]topicId=(\d+)/i);
            if (topicIdMatch) {
              const tid = parseInt(topicIdMatch[1], 10);
              matchedDiscussion = discussionTopics.find(t => t.TopicId === tid);
            }
            if (!matchedDiscussion) {
              const cleanTopicTitle = this.cleanNameForMatching(topicTitle);
              matchedDiscussion = discussionTopics.find(t => this.cleanNameForMatching(t.Name) === cleanTopicTitle);
            }
            
            if (matchedDiscussion) {
              const descHtml = matchedDiscussion.Description ? (matchedDiscussion.Description.Html || matchedDiscussion.Description.Text || '') : '';
              let processed = this.processHtmlContent(descHtml, topicUrl, unitObj.attachments, downloadAssets);
              
              const rubricIds = this.extractRubricIds(matchedDiscussion);
              const rubric = this.findRubricForActivity(matchedDiscussion.Name, rubricIds, rubricsMap);
              if (rubric) {
                topicItem.rubric = rubric;
                processed += this.buildRubricHtml(rubric);
              }
              topicItem.contentHtml = processed;
            }
          } else if (isAssignment) {
            unitObj.assignments.push(topicItem);
            
            // Match dropbox folder
            let matchedDropbox = null;
            const folderIdMatch = topicUrl.match(/[?&]id=(\d+)/i) || topicUrl.match(/[?&]db=(\d+)/i) || topicUrl.match(/[?&]folderId=(\d+)/i);
            if (folderIdMatch) {
              const dbId = parseInt(folderIdMatch[1], 10);
              matchedDropbox = dropboxFolders.find(f => f.Id === dbId || f.FolderId === dbId);
            }
            if (!matchedDropbox) {
              const cleanTopicTitle = this.cleanNameForMatching(topicTitle);
              matchedDropbox = dropboxFolders.find(f => this.cleanNameForMatching(f.Name) === cleanTopicTitle);
            }
            
            if (matchedDropbox) {
              let descHtml = matchedDropbox.Description ? (matchedDropbox.Description.Html || matchedDropbox.Description.Text || '') : '';
              if (matchedDropbox.CustomInstructions) {
                const instHtml = matchedDropbox.CustomInstructions.Html || matchedDropbox.CustomInstructions.Text || '';
                if (instHtml && !descHtml.includes(instHtml)) {
                  descHtml += '<br/>' + instHtml;
                }
              }
              let processed = this.processHtmlContent(descHtml, topicUrl, unitObj.attachments, downloadAssets);
              
              const rubricIds = this.extractRubricIds(matchedDropbox);
              const rubric = this.findRubricForActivity(matchedDropbox.Name, rubricIds, rubricsMap);
              if (rubric) {
                topicItem.rubric = rubric;
                processed += this.buildRubricHtml(rubric);
              }
              topicItem.contentHtml = processed;
            }
          } else if (isReading) {
            unitObj.readings.push(topicItem);
          } else if (isQuiz) {
            unitObj.quizzes.push(topicItem);
          }

          if (topicUrl && this.isAssetUrl(topicUrl)) {
            let rawFileName = topicUrl.split('?')[0].split('#')[0].split('/').pop();
            if (!rawFileName || rawFileName === 'DirectFileTopicDownload') {
              rawFileName = topicTitle || 'attachment';
            }
            const cleanFileName = this.sanitizeFileName(rawFileName);
            const title = topicTitle || cleanFileName;
            if (this.shouldKeepAttachment(title, topicUrl)) {
              // Avoid duplicates
              if (!unitObj.attachments.some(existing => existing.url === topicUrl)) {
                unitObj.attachments.push({
                  title: title,
                  url: topicUrl,
                  ext: cleanFileName.split('.').pop() || 'pdf',
                  localFileName: cleanFileName
                });
              }
            }
          }
        }
      }

      return unitObj;
    };

    const units = [];
    const modulesList = tocData.Modules;
    for (let i = 0; i < modulesList.length; i++) {
      const topModule = modulesList[i];
      const topTitle = topModule.Title || '';
      const lowerTopTitle = topTitle.toLowerCase();
      if (lowerTopTitle.includes('unit 9') || lowerTopTitle.includes('learning journal')) {
        continue;
      }
      const isTopCourseIntro = lowerTopTitle.includes('course introduction');
      const unit = processModule(topModule, isTopCourseIntro);
      if (unit) {
        units.push(unit);
      }

      if (topModule.Modules && topModule.Modules.length > 0) {
        for (const subMod of topModule.Modules) {
          const subTitle = subMod.Title || '';
          const lowerSubTitle = subTitle.toLowerCase();
          if (lowerSubTitle.includes('unit 9') || lowerSubTitle.includes('learning journal')) {
            continue;
          }
          const subUnit = processModule(subMod, isTopCourseIntro);
          if (subUnit) {
            units.push(subUnit);
          }
        }
      }
    }

    let fetched = 0;
    const totalToFetch = rawTopicsToFetch.length;
    for (const entry of rawTopicsToFetch) {
      const item = entry.item;
      const unitObj = entry.unitObj;
      if (item.contentHtml) {
        fetched++;
        if (onProgress) {
          onProgress(Math.round((fetched / Math.max(totalToFetch, 1)) * 50) + 25, `Extracted ${fetched}/${totalToFetch}: ${item.title}`);
        }
        continue;
      }
      if (item.url) {
        const discovered = [];
        const isQuiz = unitObj.quizzes && unitObj.quizzes.some(q => q.id === item.id);
        if (onProgress) {
          onProgress(Math.round((fetched / Math.max(totalToFetch, 1)) * 50) + 25, `Fetching ${isQuiz ? 'quiz' : 'topic'} (${fetched + 1}/${totalToFetch}): ${item.title}`);
        }
        if (isQuiz) {
          item.contentHtml = await this.fetchQuizAttemptContent(item, orgUnitId, quizzesList, discovered, downloadAssets);
        } else {
          item.contentHtml = await this.fetchTopicContent(item.url, discovered, downloadAssets);
        }
        if (discovered.length > 0) {
          discovered.forEach(att => {
            if (this.shouldKeepAttachment(att.title, att.url)) {
              // Avoid duplicates
              if (!unitObj.attachments.some(existing => existing.url === att.url)) {
                unitObj.attachments.push(att);
              }
            }
          });
        }
      }
      fetched++;
      if (onProgress) {
        onProgress(Math.round((fetched / Math.max(totalToFetch, 1)) * 50) + 25, `Extracted ${fetched}/${totalToFetch}: ${item.title}`);
      }
    }

    return units;
  },

  // Extract all topics from TOC data (recursively traversing modules and submodules)
  extractAllTopicsFromToc(tocData) {
    if (!tocData) return [];
    const topics = [];
    const seenIds = new Set();

    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const child of node) {
          walk(child);
        }
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
                url: t.Url || '',
                isCompleted: t.IsCompleted ?? t.Completed ?? null
              });
            }
          }
        }
      }
      if (Array.isArray(node.Modules)) {
        for (const m of node.Modules) {
          walk(m);
        }
      }
      if (Array.isArray(node.SubModules)) {
        for (const sm of node.SubModules) {
          walk(sm);
        }
      }
    };

    walk(tocData);
    return topics;
  },

  // Fetch current user details from Valence API
  async getCurrentUser() {
    try {
      const resp = await fetch('/d2l/api/lp/1.47/users/whoami', { credentials: 'include' });
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        userId: data.Identifier,
        firstName: data.FirstName || '',
        lastName: data.LastName || '',
        uniqueName: data.UniqueName || ''
      };
    } catch (e) {
      console.warn('[Course Exporter] Failed to get current user:', e);
      return null;
    }
  },

  // Query topic completion status from Brightspace Valence API
  async getTopicCompletion(orgUnitId, topicId, userId) {
    if (!orgUnitId || !topicId || !userId) return null;
    try {
      const resp = await fetch(`/d2l/api/le/1.54/${orgUnitId}/content/topics/${topicId}/completions/users/${userId}`, {
        credentials: 'include'
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        topicId: String(topicId),
        completionType: data.CompletionType,
        isCompleted: !!data.CompletionDate,
        completionDate: data.CompletionDate
      };
    } catch (e) {
      return null;
    }
  },

  // Mark a single Brightspace topic as completed by calling its native viewer endpoint
  async markTopicCompleted(orgUnitId, topicId) {
    if (!orgUnitId || !topicId) return false;
    const url = `/d2l/le/content/${orgUnitId}/viewContent/${topicId}/View`;
    try {
      // Use redirect: 'manual' to prevent CORS failure on external link topics that 302 to third-party domains
      const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return resp.ok || resp.type === 'opaqueredirect' || resp.status === 200 || resp.status === 302 || resp.redirected;
    } catch (e) {
      console.warn(`[Course Exporter] Failed to mark topic ${topicId} as completed:`, e);
      return false;
    }
  },

  // Batch mark all topics as completed with controlled concurrency and progress callback
  async markAllTopicsCompleted(orgUnitId, topics = null, onProgress = null) {
    if (!orgUnitId) throw new Error('orgUnitId is required');

    let topicList = topics;
    if (!topicList) {
      const tocData = await this.getTOC(orgUnitId);
      if (!tocData) {
        throw new Error(`Unable to fetch Table of Contents for course ${orgUnitId}`);
      }
      topicList = this.extractAllTopicsFromToc(tocData);
    }

    if (!topicList || topicList.length === 0) {
      return { total: 0, completed: 0, failed: 0 };
    }

    let completed = 0;
    let failed = 0;
    const total = topicList.length;
    const concurrency = 4;
    const queue = [...topicList];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || !item.id) continue;
        const success = await this.markTopicCompleted(orgUnitId, item.id);
        if (success) {
          completed++;
        } else {
          failed++;
        }
        if (typeof onProgress === 'function') {
          const current = completed + failed;
          const percent = Math.min(100, Math.max(0, Math.round((current / Math.max(total, 1)) * 100)));
          onProgress(current, total, percent, item);
        }
        // Small 40ms pause between requests to prevent server spikes
        await new Promise(r => setTimeout(r, 40));
      }
    };

    const workers = [];
    const actualConcurrency = Math.min(concurrency, queue.length);
    for (let i = 0; i < actualConcurrency; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return { total, completed, failed };
  },

  DEPARTMENT_MAP: {
    'CS': 'Computer Science',
    'MATH': 'Mathematics',
    'PHIL': 'Philosophy',
    'HIST': 'History',
    'PSYC': 'Psychology',
    'SOC': 'Sociology',
    'BUS': 'Business Administration',
    'ECON': 'Economics',
    'BIOL': 'Biology',
    'CHEM': 'Chemistry',
    'PHYS': 'Physics',
    'ENGL': 'English',
    'AHIST': 'Art History',
    'ARTH': 'Art History',
    'HS': 'Health Science',
    'POLS': 'Political Science',
    'UNIV': 'General Education',
    'ED': 'Education',
    'EDUC': 'Education'
  },

  getDepartmentName(courseCode = '', courseName = '') {
    const combined = `${courseCode} ${courseName}`.trim();
    const match = combined.match(/\b([A-Z]{2,6})\s*\d{3,5}\b/i);
    const prefix = match ? match[1].toUpperCase() : '';
    if (prefix && this.DEPARTMENT_MAP[prefix]) {
      return this.DEPARTMENT_MAP[prefix];
    }
    if (/computer|software|programming|data structures|algorithms|operating systems|database/i.test(combined)) return 'Computer Science';
    if (/math|calculus|algebra|statistics/i.test(combined)) return 'Mathematics';
    if (/business|management|marketing|accounting|finance/i.test(combined)) return 'Business Administration';
    if (/philosophy|ethics/i.test(combined)) return 'Philosophy';
    if (/health|biology|anatomy/i.test(combined)) return 'Health Science';
    if (/psychology/i.test(combined)) return 'Psychology';
    if (/history|civilization/i.test(combined)) return 'History';
    if (/english|literature|writing/i.test(combined)) return 'English';
    return prefix || 'Computer Science';
  },

  parseCourseCodeAndTitle(rawName = '', rawCode = '') {
    const cleaned = this.cleanCourseName(rawName) || rawCode || 'Course';
    const m = cleaned.match(/^([A-Z]{2,6}\s*\d{3,5})(?:-\d+)?(?:\s*[:\-–—]\s*|\s+)(.*)$/i);
    if (m) {
      const code = m[1].trim().replace(/\s+/, ' ');
      let title = m[2].trim().replace(/^[-_–—:\s]+/, '').trim();
      title = title.replace(/\s*-\s*(?:AY\d{4}-T\d|Term\s*\d|20\d\d).*$/i, '').trim();
      return { code, title: title || cleaned };
    }
    const codeMatch = cleaned.match(/\b([A-Z]{2,6}\s*\d{3,5})\b/i);
    const code = codeMatch ? codeMatch[1].trim().replace(/\s+/, ' ') : (rawCode || '');
    return { code: code || cleaned, title: cleaned };
  },

  async whoAmI() {
    const apiVersions = ['1.47', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/lp/${ver}/users/whoami`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          return await resp.json();
        }
      } catch (e) {}
    }
    return null;
  },

  async getStudentProfile() {
    let fullName = '';
    let initials = '';

    try {
      const user = await this.whoAmI();
      if (user) {
        // Brightspace Valence WhoAmIUser response object
        fullName = (user.UniqueDisplayName || `${user.FirstName || ''} ${user.LastName || ''}`).trim();
      }
    } catch (e) {}

    if (!fullName && typeof document !== 'undefined') {
      const profileElem = document.querySelector('.d2l-navigation-s-personal-menu-wrapper, .d2l-navigation-s-header-menu-text, .vui-dropdown-menu-item, [aria-label*="Profile"], [aria-label*="Account"]');
      if (profileElem && profileElem.textContent) {
        fullName = profileElem.textContent.trim();
      }
    }

    if (fullName) {
      const parts = fullName.split(/\s+/).map(p => p.replace(/[^a-zA-Z]/g, '')).filter(Boolean);
      if (parts.length > 0) {
        initials = parts.map(p => p[0].toLowerCase()).join('');
      }
    }

    if (!initials) {
      initials = 'myk';
    }

    return {
      fullName: fullName || 'Mohamed Yahia Khidr',
      initials: initials
    };
  },

  async getCourseInstructor(orgUnitId) {
    if (!orgUnitId) return 'Instructor';

    const apiVersions = ['1.54', '1.43', '1.30', '1.0'];
    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/classlist/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const users = await resp.json();
          const userList = Array.isArray(users) ? users : (users.Objects || []);
          const instructor = userList.find(u => {
            const role = String(u.RoleName || u.Role || '').toLowerCase();
            return role.includes('instructor') || role.includes('faculty') || role.includes('teacher') || role.includes('professor');
          });
          if (instructor) {
            const name = (instructor.DisplayName || `${instructor.FirstName || ''} ${instructor.LastName || ''}`).trim();
            if (name) return name;
          }
        }
      } catch (e) {}
    }

    for (const ver of apiVersions) {
      try {
        const resp = await fetch(`/d2l/api/le/${ver}/${orgUnitId}/news/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (resp.ok) {
          const news = await resp.json();
          const items = Array.isArray(news) ? news : (news.Objects || []);
          for (const item of items) {
            const titleOrBody = `${item.Title || ''} ${(item.Body && (item.Body.Text || item.Body.Html)) || ''}`;
            const m = titleOrBody.match(/(?:Instructor|Professor|Prof\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
            if (m) return m[0].trim();
            if (item.CreatedByUserName && !item.CreatedByUserName.toLowerCase().includes('admin')) {
              return item.CreatedByUserName;
            }
          }
        }
      } catch (e) {}
    }

    if (typeof document !== 'undefined') {
      const instructorElem = document.querySelector('.d2l-widget[data-widget-id*="instructor"], .instructor-name, .faculty-name');
      if (instructorElem && instructorElem.textContent) {
        const text = instructorElem.textContent.trim();
        const m = text.match(/(?:Instructor|Faculty|Professor|Teacher)(?:\s*Name)?\s*:\s*([A-Za-z\.\s'-]{3,50})/i);
        if (m) return m[1].trim();
        const clean = text.replace(/^(?:Instructor|Faculty|Professor|Teacher):?\s*/i, '').trim();
        if (clean && clean.length <= 40 && !clean.includes('\n')) return clean;
      }
    }

    return 'Instructor';
  },

  formatDueDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (!isNaN(d.getTime())) {
        try {
          return d.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } catch (tzErr) {
          return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      }
    } catch (e) {}
    return '';
  },

  buildCourseMetadata(courseInfo, dropboxFolders = [], studentProfile = null, instructorName = 'Instructor') {
    const rawName = courseInfo?.name || '';
    const rawCode = courseInfo?.code || '';
    const { code, title } = this.parseCourseCodeAndTitle(rawName, rawCode);
    const department = this.getDepartmentName(code, title);
    const student = studentProfile || { fullName: 'Mohamed Yahia Khidr', initials: 'myk' };
    const initials = student.initials || 'myk';

    const assignments = {};
    for (let u = 1; u <= 8; u++) {
      let matchedFolder = null;
      if (Array.isArray(dropboxFolders)) {
        const unitRegex = new RegExp(`(?:unit|week)\\s*0?${u}(?!\\d)`, 'i');
        matchedFolder = dropboxFolders.find(f => {
          const fName = String(f.Name || '').toLowerCase();
          return unitRegex.test(fName);
        });
      }

      let formattedDate = '';
      let rawDate = null;
      if (matchedFolder && matchedFolder.DueDate) {
        rawDate = matchedFolder.DueDate;
        formattedDate = this.formatDueDate(rawDate);
      }

      assignments[String(u)] = {
        unit: u,
        title: `Unit ${u} Assignment Activity`,
        dueDate: formattedDate,
        rawDueDate: rawDate,
        templateFileName: `week${u}_assignment_${initials}_template.docx`
      };
    }

    return {
      courseId: String(courseInfo?.id || ''),
      courseCode: code,
      courseName: title,
      department: department,
      departmentLine: `Department of ${department}, University of The People`,
      courseLine: `${code}: ${title}`,
      instructor: instructorName || 'Instructor',
      student: student,
      assignments: assignments,
      exportedAt: new Date().toISOString()
    };
  }
};

if (typeof window !== 'undefined') {
  window.D2LApi = D2LApi;
}
if (typeof globalThis !== 'undefined') {
  globalThis.D2LApi = D2LApi;
}

