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

  cleanHtml(htmlStr) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      let changed = false;
      doc.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.toLowerCase().includes('logo_shield.png')) {
          img.remove();
          changed = true;
        }
      });
      return changed ? doc.body.innerHTML : htmlStr;
    } catch (e) {
      console.warn('Failed to clean HTML via DOMParser:', e);
      return htmlStr.replace(/<img[^>]*logo_shield[^>]*>/gi, '');
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
    
    // Exclude HTML files from being recognized as assets/attachments
    if (/\.html?(\?|#|$)/i.test(lower)) {
      return false;
    }

    const docExtRegex = /\.(pdf|docx?|pptx?|xlsx?|zip|rar|txt|csv|rtf|odt|ods|odp|png|jpe?g|gif|svg|mp3|mp4)(\?|#|$)/i;
    return docExtRegex.test(lower) ||
           lower.includes('iscoursefile=true') ||
           lower.includes('/content/enforced/') ||
           lower.includes('/topics/files/download/');
  },

  shouldKeepAttachment(title, urlStr) {
    if (!title && !urlStr) return true;
    const lowerTitle = (title || '').toLowerCase();
    const lowerUrl = (urlStr || '').toLowerCase();
    return !lowerTitle.includes('course overview') &&
           !lowerTitle.includes('syllabus') &&
           !lowerUrl.includes('courseoverview') &&
           !lowerUrl.includes('syllabus');
  },

  // Advanced content extractor for Reading Assignments & Discussion Forum Prompts
  async fetchTopicContent(url, discoveredAttachments = []) {
    if (!url) return '';
    try {
      const targetUrl = this.toAbsoluteUrl(url);

      // If the URL clearly points to a downloadable file, don't fetch it here.
      // Just record it as an attachment — the background worker will download it later.
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
        return `<p><a href="assets/${cleanFileName}" target="_blank" class="attachment-btn">📄 Open Document (${cleanFileName})</a></p>`;
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
        return this.processHtmlContent(contentElem.innerHTML, targetUrl, discoveredAttachments);
      }
      return '';
    } catch (e) {
      console.error(`Error fetching topic content from ${url}:`, e);
      return '';
    }
  },

  // Fetch assignments (dropbox folders)
  async getDropboxFolders(orgUnitId) {
    try {
      const resp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/dropbox/folders/`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('Failed to fetch dropbox folders:', e);
    }
    return [];
  },

  // Fetch discussion forums
  async getDiscussionForums(orgUnitId) {
    try {
      const resp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/discussions/forums/`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('Failed to fetch discussion forums:', e);
    }
    return [];
  },

  // Fetch discussion topics for a forum
  async getDiscussionTopics(orgUnitId, forumId) {
    try {
      const resp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/discussions/forums/${forumId}/topics/`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn(`Failed to fetch discussion topics for forum ${forumId}:`, e);
    }
    return [];
  },

  // Fetch rubrics list
  async getRubricsList(orgUnitId) {
    try {
      const resp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/rubrics/`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('Failed to fetch rubrics list:', e);
    }
    return [];
  },

  // Fetch individual rubric details
  // Fetch individual rubric details
  async getRubricDetails(orgUnitId, rubricId) {
    try {
      const resp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/rubrics/${rubricId}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn(`Failed to fetch rubric details for rubric ${rubricId}:`, e);
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
    try {
      const url = `/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${orgUnitId}`;
      const resp = await fetch(this.toAbsoluteUrl(url));
      if (!resp.ok) return [];
      
      const htmlText = await resp.text();
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const quizMap = [];

      doc.querySelectorAll('a[href*="quiz_summary.d2l"], a[href*="quiz_submissions.d2l"], a[href*="qi="]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/[?&]qi=(\d+)/i);
        if (match) {
          const quizId = parseInt(match[1], 10);
          const title = a.innerText ? a.innerText.trim() : '';
          if (quizId && title) {
            quizMap.push({
              QuizId: quizId,
              Name: title,
              href: href
            });
          }
        }
      });
      return quizMap;
    } catch (e) {
      console.warn('Failed to parse quizzes_list.d2l:', e);
      return [];
    }
  },

  // Fetch quiz attempt details HTML and extract questions & answers
  async fetchQuizAttemptContent(item, orgUnitId, quizzesList = [], discoveredAttachments = []) {
    const topicUrl = item.url;
    const topicTitle = item.title;
    try {
      let quizId = null;
      
      // 1. Try to extract qi from the topic URL
      let match = topicUrl ? topicUrl.match(/[?&]qi=(\d+)/i) : null;
      if (match) {
        quizId = parseInt(match[1], 10);
      }
      
      // 2. Try to match by name from quizzesList
      if (!quizId) {
        const cleanTopicTitle = this.cleanNameForMatching(topicTitle);
        const matched = quizzesList.find(q => {
          const cleanQName = this.cleanNameForMatching(q.Name || q.Title);
          return cleanQName === cleanTopicTitle || cleanQName.includes(cleanTopicTitle) || cleanTopicTitle.includes(cleanQName);
        });
        if (matched) {
          quizId = matched.QuizId || matched.Id;
        }
      }
      
      // 3. If still not found, try to resolve quicklink response text
      if (!quizId && topicUrl) {
        try {
          const resp = await fetch(this.toAbsoluteUrl(topicUrl));
          const text = await resp.text();
          const textMatch = text.match(/[?&]qi=(\d+)/i) || text.match(/quiz_summary\.d2l\?[^"']*\bqi=(\d+)/i);
          if (textMatch) {
            quizId = parseInt(textMatch[1], 10);
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
      
      // 4. Try fetching attempts list via Valence API first
      let attemptUrl = null;
      try {
        const attemptsResp = await fetch(`/d2l/api/le/1.30/${orgUnitId}/quizzes/${quizId}/attempts/`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (attemptsResp.ok) {
          const attemptsData = await attemptsResp.json();
          const attemptsList = Array.isArray(attemptsData) ? attemptsData : (attemptsData.Objects || []);
          if (attemptsList.length > 0) {
            console.log(`[Quiz Exporter Debug] Quiz ${quizId} raw attempts:`, attemptsList);
            // Filter out attempts that are still in-progress (Completed date is null)
            const completedAttempts = attemptsList.filter(a => {
              const isCompleted = (a.Completed !== null && a.Completed !== undefined && a.Completed !== '') ||
                                  (a.CompletedDate !== null && a.CompletedDate !== undefined && a.CompletedDate !== '') ||
                                  (a.Score !== null && a.Score !== undefined) ||
                                  (a.IsCompleted === true);
              return isCompleted;
            });
            const latestAttempt = completedAttempts.length > 0 ? completedAttempts[completedAttempts.length - 1] : attemptsList[attemptsList.length - 1];
            console.log(`[Quiz Exporter Debug] Selected target attempt from Valence list:`, latestAttempt);
            const attemptId = latestAttempt.AttemptId || latestAttempt.Id;
            if (attemptId) {
              attemptUrl = this.toAbsoluteUrl(`/d2l/lms/quizzing/user/quiz_submissions_attempt.d2l?ou=${orgUnitId}&qi=${quizId}&ai=${attemptId}`);
            }
          }
        }
      } catch (e) {
        console.warn('Valence quiz attempts API failed, falling back to HTML scraping:', e);
      }

      // 5. Fallback to scraping valid LMS summary and submission pages using regex + DOM
      if (!attemptUrl) {
        console.log(`[Quiz Exporter Debug] Valence API was not used or did not resolve attemptUrl. Starting HTML scraping fallback for quiz ${quizId}...`);
        const possibleUrls = [
          `/d2l/lms/quizzing/user/quiz_submissions.d2l?qi=${quizId}&ou=${orgUnitId}`,
          `/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${quizId}&ou=${orgUnitId}`,
          topicUrl
        ];

        for (const pUrl of possibleUrls) {
          if (!pUrl) continue;
          try {
            console.log(`[Quiz Exporter Debug] Fetching fallback URL: ${pUrl}`);
            const resp = await fetch(this.toAbsoluteUrl(pUrl));
            if (resp.ok) {
              const htmlText = await resp.text();
              const parser = new DOMParser();
              const doc = parser.parseFromString(htmlText, 'text/html');

              // 1. Try DOM search filtering out inprogress elements (very precise)
              const attemptElements = Array.from(doc.querySelectorAll('a[href*="quiz_submissions_attempt"], a[href*="quiz_attempt_show_questions"], a[href*="submission_view"], [quiz-submission-url]'))
                .filter(el => {
                  const inProgress = el.hasAttribute('inprogress') || el.getAttribute('inprogress') !== null || el.closest('[inprogress]');
                  return !inProgress;
                });
              console.log(`[Quiz Exporter Debug] Scraped completed attempt elements count: ${attemptElements.length}`);
              if (attemptElements.length > 0) {
                const lastEl = attemptElements[attemptElements.length - 1];
                const href = lastEl.getAttribute('quiz-submission-url') || lastEl.getAttribute('href');
                if (href) {
                  attemptUrl = this.toAbsoluteUrl(href.replace(/&amp;/g, '&'));
                  console.log(`[Quiz Exporter Debug] Found completed attemptUrl via DOM selector: ${attemptUrl}`);
                  break;
                }
              }

              // 2. Regex fallback if DOM parsing yielded no results
              const matches = htmlText.match(/(\/d2l\/lms\/quizzing\/user\/(?:quiz_submissions_attempt|quiz_attempt_show_questions|submission_view)\.d2l\?[^"'\s<>]+)/gi);
              console.log(`[Quiz Exporter Debug] Scraped matches via Regex search:`, matches);
              if (matches && matches.length > 0) {
                let lastMatch = matches[matches.length - 1].replace(/&amp;/g, '&');
                attemptUrl = this.toAbsoluteUrl(lastMatch);
                console.log(`[Quiz Exporter Debug] Found completed attemptUrl via Regex fallback: ${attemptUrl}`);
                break;
              }
            }
          } catch (e) {
            console.warn(`Failed fetching quiz page ${pUrl}:`, e);
          }
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
      const parser = new DOMParser();
      const attemptDoc = parser.parseFromString(attemptHtml, 'text/html');
      
      // Extract questions
      const questions = attemptDoc.querySelectorAll('.d2l-questions-question-container, .d2l-quiz-question, .d2l-qsh, [class*="question-container"], [id^="q_"]');
      if (questions.length === 0) {
        const fallback = attemptDoc.querySelector('form#attemptForm, #d2l_content, .d2l-page-main');
        if (fallback) {
          return this.processQuizHtml(fallback.innerHTML, attemptUrl, discoveredAttachments);
        }
        return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                  <strong>Notice:</strong> Attempt page found, but quiz questions container could not be parsed.
                </div>`;
      }
      
      let combinedHtml = '';
      let index = 0;
      questions.forEach((q) => {
        let isNested = false;
        let parent = q.parentElement;
        while (parent) {
          if (parent.classList && (
            parent.classList.contains('d2l-questions-question-container') ||
            parent.classList.contains('d2l-quiz-question') ||
            parent.classList.contains('d2l-qsh')
          )) {
            isNested = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!isNested) {
          const qCleanHtml = this.processQuizHtml(q.innerHTML, attemptUrl, discoveredAttachments);
          combinedHtml += `<div class="offline-quiz-question" style="margin-bottom: 24px; padding: 20px; border: 1px solid var(--border-color); border-radius: 8px; background-color: var(--bg-card); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-weight: 600; color: var(--accent); margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Question ${index + 1}</div>
                            ${qCleanHtml}
                           </div>`;
          index++;
        }
      });
      
      return combinedHtml || `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                                <strong>Notice:</strong> No quiz questions could be extracted from attempt details.
                              </div>`;
    } catch (e) {
      console.error(`Failed to fetch quiz content for ${topicTitle}:`, e);
      return `<div class="quiz-notice" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px;">
                <strong>Error:</strong> Failed to retrieve quiz questions and answers due to an exception: ${e.message}
              </div>`;

    }
  },

  processQuizHtml(htmlStr, baseUrl = 'https://learn.uopeople.edu/', discoveredAttachments = []) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      const container = doc.body;

      // 1. Replace correctness and selection indicator images with emojis
      container.querySelectorAll('img').forEach(img => {
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        const src = (img.getAttribute('src') || '').toLowerCase();
        if (alt.includes('correct response') || alt === 'correct' || src.includes('correct')) {
          const span = doc.createElement('span');
          span.style.color = '#10b981';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.innerHTML = ' ✅ <small style="color:#10b981; font-weight:600;">Correct</small>';
          img.parentNode.replaceChild(span, img);
        } else if (alt.includes('incorrect response') || alt === 'incorrect' || src.includes('incorrect')) {
          const span = doc.createElement('span');
          span.style.color = '#ef4444';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.innerHTML = ' ❌ <small style="color:#ef4444; font-weight:600;">Incorrect</small>';
          img.parentNode.replaceChild(span, img);
        } else if (alt.includes('selected') || alt.includes('your answer') || src.includes('selected')) {
          const span = doc.createElement('span');
          span.style.color = '#3b82f6';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.innerHTML = ' 👤 <small style="color:#3b82f6; font-weight:600;">Your Answer</small>';
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
          span.innerHTML = ' ✅ <small style="color:#10b981; font-weight:600;">Correct</small>';
          icon.parentNode.replaceChild(span, icon);
        } else if (iconName.includes('close') || iconName.includes('incorrect') || iconName.includes('fail')) {
          const span = doc.createElement('span');
          span.style.color = '#ef4444';
          span.style.fontWeight = 'bold';
          span.style.marginLeft = '6px';
          span.innerHTML = ' ❌ <small style="color:#ef4444; font-weight:600;">Incorrect</small>';
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
      const processed = this.processHtmlContent(container.innerHTML, baseUrl, discoveredAttachments);
      return processed;
    } catch (e) {
      console.warn('Failed to process Quiz HTML:', e);
      return htmlStr;
    }
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
      if (cleanRubName.includes(cleanActName) || cleanActName.includes(cleanRubName.replace('rubric', ''))) {
        return rubric;
      }
    }
    return null;
  },

  // Render a rubric object into a beautiful HTML table
  buildRubricHtml(rubric) {
    if (!rubric) return '';
    try {
      let html = `<div class="rubric-container" style="margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 16px;">`;
      html += `<h4 class="rubric-title">📋 Rubric: ${rubric.Name || 'Evaluation Rubric'}</h4>`;
      
      const levels = rubric.Levels || [];
      const criteriaGroups = rubric.CriteriaGroups || [];
      
      for (const group of criteriaGroups) {
        html += `<table class="rubric-table">`;
        html += `<thead><tr><th>Criteria</th>`;
        
        // Header for levels
        for (const lvl of levels) {
          html += `<th>${lvl.Name || ''} (${lvl.Value !== undefined ? lvl.Value : ''} pts)</th>`;
        }
        html += `</tr></thead><tbody>`;
        
        const criteria = group.Criteria || [];
        for (const crit of criteria) {
          html += `<tr>`;
          html += `<td><strong>${crit.Name || ''}</strong><br/><small style="color: var(--text-muted);">Out of ${crit.Outof !== undefined ? crit.Outof : ''}</small></td>`;
          
          // Cells for each level
          const critLevels = crit.Levels || [];
          for (const lvl of levels) {
            const cell = critLevels.find(cl => cl.LevelId === lvl.LevelId);
            const desc = cell && cell.Description ? (cell.Description.Html || cell.Description.Text || '') : '';
            html += `<td>${desc}</td>`;
          }
          html += `</tr>`;
        }
        html += `</tbody></table>`;
      }
      html += `</div>`;
      return html;
    } catch (e) {
      console.error('Error rendering rubric HTML:', e);
      return `<p style="color: var(--badge-quiz); font-size: 13px;">Error rendering rubric: ${e.message}</p>`;
    }
  },

  // Shared processor for content HTML (rewriting links, extracting attachments)
  processHtmlContent(htmlStr, baseUrl = 'https://learn.uopeople.edu/', discoveredAttachments = []) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      const container = doc.body;

      // Process all links and attachments
      container.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (href) {
          const absUrl = this.toAbsoluteUrl(href, baseUrl);
          if (this.isAssetUrl(href) || this.isAssetUrl(absUrl)) {
            let rawFileName = href.split('?')[0].split('#')[0].split('/').pop();
            if (!rawFileName || rawFileName === 'DirectFileTopicDownload') {
              rawFileName = a.innerText ? a.innerText.trim() : 'attachment';
            }
            const cleanFileName = this.sanitizeFileName(rawFileName);

            const localAssetPath = `assets/${cleanFileName}`;
            a.setAttribute('href', localAssetPath);
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
          }
        }
      });

      // Refactor YouTube videos to fix Error 153 and add a direct link
      container.querySelectorAll('iframe').forEach(iframe => {
        let src = iframe.getAttribute('src') || '';
        if (src) {
          const absUrl = this.toAbsoluteUrl(src, baseUrl);
          const ytMatch = absUrl.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
          if (ytMatch) {
            const videoId = ytMatch[1];
            const newSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
            iframe.setAttribute('src', newSrc);
            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            
            // Create a wrapper container for video player
            const wrapper = doc.createElement('div');
            wrapper.className = 'video-container';
            
            // Replace iframe with the wrapper containing both the iframe and the button
            iframe.parentNode.insertBefore(wrapper, iframe);
            wrapper.appendChild(iframe);
            
            const btnContainer = doc.createElement('div');
            btnContainer.style.marginTop = '8px';
            btnContainer.style.textAlign = 'center';
            btnContainer.innerHTML = `
              <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" class="watch-on-youtube-btn">
                ▶ Watch on YouTube ↗
              </a>
            `;
            wrapper.appendChild(btnContainer);
          }
        }
      });

      container.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
          const absUrl = this.toAbsoluteUrl(src, baseUrl);
          if (src.toLowerCase().includes('logo_shield.png') || absUrl.toLowerCase().includes('logo_shield.png')) {
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
    const { dropboxFolders = [], discussionTopics = [], rubricsMap = {}, quizzesList = [], orgUnitId = null } = extraData;
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
      const title = module.Title || '';
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
          if (lowerTitle.includes('discussion') || lowerTitle.includes('forum') || topicType === 5) {
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
              let processed = this.processHtmlContent(descHtml, topicUrl, unitObj.attachments);
              
              const rubricIds = (matchedDiscussion.Evaluation && matchedDiscussion.Evaluation.RubricIds) || [];
              const rubric = this.findRubricForActivity(matchedDiscussion.Name, rubricIds, rubricsMap);
              if (rubric) {
                processed += this.buildRubricHtml(rubric);
              }
              topicItem.contentHtml = processed;
            }
          } else if (lowerTitle.includes('written assignment') || (lowerTitle.includes('assignment') && !lowerTitle.includes('reading')) || topicType === 7) {
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
              let processed = this.processHtmlContent(descHtml, topicUrl, unitObj.attachments);
              
              const rubricIds = (matchedDropbox.Evaluation && matchedDropbox.Evaluation.RubricIds) || [];
              const rubric = this.findRubricForActivity(matchedDropbox.Name, rubricIds, rubricsMap);
              if (rubric) {
                processed += this.buildRubricHtml(rubric);
              }
              topicItem.contentHtml = processed;
            }
          } else if (lowerTitle.includes('reading assignment') || lowerTitle.includes('reading') || lowerTitle.includes('textbook')) {
            unitObj.readings.push(topicItem);
          } else if (lowerTitle.includes('quiz') || lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('knowledge check') || topicType === 6) {
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
          item.contentHtml = await this.fetchQuizAttemptContent(item, orgUnitId, quizzesList, discovered);
        } else {
          item.contentHtml = await this.fetchTopicContent(item.url, discovered);
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
  }
};

