/**
 * Markdown Builder Module
 * Converts course materials from HTML to Markdown and compiles them into a structured folder layout,
 * including a Master Course Reading Matrix in README.md and a consolidated Master_Course_Complete.md companion file.
 */
const MarkdownBuilder = {
  sanitizeFolderName(name) {
    if (!name) return 'Unit';
    // Normalize unicode whitespace (non-breaking spaces, em-space, etc.) to standard space
    let clean = name.replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ');
    // Replace characters not allowed in file/folder names on Windows/Mac/Linux
    clean = clean.replace(/[\\/:*?"<>|]/g, '_').trim();
    // Collapse multiple underscores and spaces
    clean = clean.replace(/_+/g, '_').replace(/\s+/g, ' ').replace(/^_+|_+$/g, '');
    return clean || 'Unit';
  },

  cleanContentHtml(html, title = '') {
    if (!html) return '';
    let clean = html;

    // 1. Remove duplicate logo footers, copyright footers, and decorative page breaks
    clean = clean.replace(/<footer[^>]* class="mceNonEditable"[^>]*>[\s\S]*?<\/footer>/gi, '');
    clean = clean.replace(/<p>\s*<img[^>]*(LogoMinimal_Purple|logo_shield|PageBreak_icon)[^>]*>\s*<\/p>/gi, '');
    clean = clean.replace(/<img[^>]*(LogoMinimal_Purple|logo_shield|PageBreak_icon)[^>]*>/gi, '');

    // 2. Remove duplicate hero headers and banners
    clean = clean.replace(/<div[^>]*class="[^"]*courseware-headers-[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '');
    
    // Remove duplicate title headers if they match the topic title
    if (title) {
      const escapedTitle = title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const hRegex = new RegExp('<(h1|h2|h3|h4|h5|h6)[^>]*>\\s*(?:<span[^>]*>\\s*)*' + escapedTitle + '\\s*(?:<\\/span>\\s*)*<\\/\\1>', 'i');
      clean = clean.replace(hRegex, '');
    }

    // 3. Remove LockDown Browser scaffolding & forms (keep inside content)
    clean = clean.replace(/<iframe id="LockDownBrowserLaunchFrame"[\s\S]*?<\/iframe>/gi, '');
    clean = clean.replace(/<input[^>]*type="hidden"[^>]*>/gi, '');
    clean = clean.replace(/<button[^>]*id="z_a"[^>]*>[\s\S]*?<\/button>/gi, '');
    clean = clean.replace(/<d2l-floating-buttons[\s\S]*?<\/d2l-floating-buttons>/gi, '');
    clean = clean.replace(/<form[^>]*id="d2l_form"[^>]*>/gi, '');
    clean = clean.replace(/<\/form>/gi, '');
    
    // 4. Strip inline font-sizes style="font-size: ..."
    clean = clean.replace(/style="[^"]*font-size:\s*[^";]+;?[^"]*"/gi, (match) => {
      let style = match.replace(/font-size:\s*[^";]+;?/gi, '');
      if (style === 'style=""') return '';
      return style;
    });

    // 5. Clean up non-breaking spaces and empty tags
    clean = clean.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');
    clean = clean.replace(/<p>\s*<\/p>/gi, '');
    clean = clean.replace(/<span[^>]*>\s*<\/span>/gi, '');

    return clean;
  },

  cleanUnitDescription(htmlStr, title = '') {
    if (!htmlStr) return '';
    let clean = htmlStr;
    clean = clean.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');
    clean = clean.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, (match) => {
      const headerText = match.replace(/<[^>]+>/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (headerText === cleanTitle || (cleanTitle && headerText.includes(cleanTitle)) || (headerText && cleanTitle.includes(headerText))) {
        return '';
      }
      return match;
    });
    clean = clean.replace(/<hr\s*\/?>/gi, '');
    clean = clean.replace(/<(p|div|span)[^>]*>\s*<\/\1>/gi, '');
    clean = clean.trim();
    const textContent = clean.replace(/<[^>]+>/g, '').trim();
    if (!textContent) return '';
    return clean;
  },

  cleanMarkdown(md) {
    if (!md) return '';
    let clean = md;

    // 1. Replace non-breaking spaces
    clean = clean.replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');

    // 2. Fix double list bullets: "- - " or "* - " or "1. - "
    clean = clean.replace(/^(\s*[-*]|\s*\d+\.)\s*[-*•]\s+/gm, '$1 ');
    clean = clean.replace(/^(\s*[-*])\s+-\s+/gm, '$1 ');

    // 3. Remove nested bold or italic markers inside markdown headings (# **Heading** -> # Heading)
    clean = clean.replace(/^(#{1,6}\s+)\*\*(.*?)\*\*\s*$/gm, '$1$2');
    clean = clean.replace(/^(#{1,6}\s+)\*(.*?)\*\s*$/gm, '$1$2');

    // 4. Ensure proper spacing around italic asterisks touching punctuation like (2019).*[Title]*
    clean = clean.replace(/([.)\]])\*([A-Za-z0-9])/g, '$1 *$2');
    clean = clean.replace(/([A-Za-z0-9])\*([(\[])/g, '$1* $2');

    // 5. Ensure proper spacing around inline markdown links: [Link](url)word -> [Link](url) word
    clean = clean.replace(/(\]\([^)]+\))([A-Za-z0-9])/g, '$1 $2');

    // 6. Clean up duplicate adjacent YouTube image + text link stacks
    clean = clean.replace(/(\[!\[Watch on YouTube\]\([^)]+\)\]\((https?:\/\/[^)]+)\))\s*\n+\s*\[▶ Watch on YouTube ↗\]\(\2\)/g, '$1\n\n*[▶ Watch on YouTube ↗]($2)*');

    // 7. Clean up excessive blank lines
    clean = clean.replace(/\n{3,}/g, '\n\n');

    return clean.trim();
  },

  htmlToMarkdown(htmlStr) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      const rawMd = this.nodeToMarkdown(doc.body).trim();
      return this.cleanMarkdown(rawMd);
    } catch (e) {
      console.error('Error converting HTML to Markdown:', e);
      return htmlStr; // Fallback
    }
  },

  nodeToMarkdown(node) {
    if (!node) return '';

    if (node.nodeType === Node.TEXT_NODE) {
      const parentTag = node.parentNode ? node.parentNode.tagName.toLowerCase() : '';
      if (parentTag === 'ul' || parentTag === 'ol' || parentTag === 'table' || parentTag === 'thead' || parentTag === 'tbody' || parentTag === 'tr') {
        // Ignore whitespace-only text nodes inside structure elements
        if (!node.textContent.trim()) {
          return '';
        }
      }
      if (parentTag === 'pre' || parentTag === 'code') {
        return node.textContent;
      }
      // Normalize multiple spaces/newlines to a single space
      return node.textContent.replace(/\s+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName.toLowerCase();
    
    // Ignore script, style, and comments
    if (tagName === 'script' || tagName === 'style') {
      return '';
    }

    // Process children first
    let childrenMarkdown = '';
    for (const child of node.childNodes) {
      childrenMarkdown += this.nodeToMarkdown(child);
    }

    switch (tagName) {
      case 'h1':
        return `\n\n# ${childrenMarkdown.trim()}\n\n`;
      case 'h2':
        return `\n\n## ${childrenMarkdown.trim()}\n\n`;
      case 'h3':
        return `\n\n### ${childrenMarkdown.trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${childrenMarkdown.trim()}\n\n`;
      case 'h5':
        return `\n\n##### ${childrenMarkdown.trim()}\n\n`;
      case 'h6':
        return `\n\n###### ${childrenMarkdown.trim()}\n\n`;
      case 'p':
        return `\n\n${childrenMarkdown.trim()}\n\n`;
      case 'br':
        return `\n`;
      case 'strong':
      case 'b':
        return childrenMarkdown.trim() ? `**${childrenMarkdown.trim()}**` : '';
      case 'em':
      case 'i':
        return childrenMarkdown.trim() ? `*${childrenMarkdown.trim()}*` : '';
      case 'code':
        return `\`${childrenMarkdown.trim()}\``;
      case 'pre':
        return `\n\`\`\`\n${node.textContent}\n\`\`\`\n`;
      case 'a': {
        const href = node.getAttribute('href') || '';
        const linkText = childrenMarkdown.trim() || href;
        return href ? `[${linkText}](${href})` : childrenMarkdown;
      }
      case 'img': {
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || 'image';
        return src ? `\n![${alt}](${src})\n` : '';
      }
      case 'ul':
        return `\n${childrenMarkdown}\n`;
      case 'ol':
        return `\n${childrenMarkdown}\n`;
      case 'li': {
        const parent = node.parentNode;
        let prefix = '- ';
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = Array.from(parent.children).indexOf(node) + 1;
          prefix = `${index}. `;
        }
        let innerMd = '';
        for (const child of node.childNodes) {
          innerMd += this.nodeToMarkdown(child);
        }
        // Strip any redundant leading dashes or bullets to prevent "- - "
        const cleanInner = innerMd.trim().replace(/^[-*•]\s+/, '');
        return `${prefix}${cleanInner}\n`;
      }
      case 'blockquote':
        return `\n> ${childrenMarkdown.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'hr':
        return `\n\n---\n\n`;
      case 'table':
        return `\n\n${this.tableToMarkdown(node)}\n\n`;
      case 'div':
      case 'span':
        if (node.classList.contains('video-container')) {
          const ytLink = node.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]');
          const videoId = node.getAttribute('data-video-id');
          if (ytLink || videoId) {
            const watchUrl = ytLink ? (ytLink.getAttribute('href') || '') : `https://www.youtube.com/watch?v=${videoId}`;
            const id = videoId || (watchUrl.match(/(?:watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i) || [])[1];
            let videoMd = '\n\n';
            if (id) {
              videoMd += `[![Watch on YouTube](https://img.youtube.com/vi/${id}/hqdefault.jpg)](${watchUrl})\n\n`;
            }
            videoMd += `[▶ Watch on YouTube ↗](${watchUrl})\n\n`;
            return videoMd;
          }
          const watchBtn = node.querySelector('.watch-on-youtube-btn');
          const iframe = node.querySelector('iframe');
          let videoMd = '\n\n';
          if (watchBtn) {
            const watchUrl = watchBtn.getAttribute('href');
            videoMd += `[▶ Watch on YouTube ↗](${watchUrl})\n\n`;
          } else if (iframe) {
            const iframeSrc = iframe.getAttribute('src');
            videoMd += `[📺 Embedded Video](${iframeSrc})\n\n`;
          }
          return videoMd;
        }
        if (node.classList.contains('rubric-badge')) {
          const badgeText = childrenMarkdown.trim().replace(/^📋\s*/, '');
          return `\n📋 **${badgeText}**\n\n`;
        }
        if (node.classList.contains('rubric-title')) {
          return `### ${childrenMarkdown.trim()}\n\n`;
        }
        if (node.classList.contains('rubric-container')) {
          return `\n\n${childrenMarkdown}\n\n`;
        }
        if (node.classList.contains('rubric-crit-name')) {
          return `**${childrenMarkdown.trim()}**`;
        }
        if (node.classList.contains('rubric-crit-outof') || node.classList.contains('rubric-crit-weight') || node.classList.contains('rubric-level-points')) {
          return `<br>*(${childrenMarkdown.trim()})*`;
        }
        if (node.classList.contains('rubric-cell-points')) {
          return `**${childrenMarkdown.trim()}**<br>`;
        }
        if (node.classList.contains('quiz-score-banner')) {
          const scoreText = (node.textContent || '').replace(/\s+/g, ' ').trim();
          return `\n\n> 📊 **Quiz Attempt Score & Grade:** ${scoreText}\n\n`;
        }
        if (node.classList.contains('quiz-question-header')) {
          return `\n\n### ${childrenMarkdown.trim()}\n\n`;
        }
        if (node.classList.contains('quiz-points-badge')) {
          return ` *(${childrenMarkdown.trim()})*`;
        }
        if (node.classList.contains('quiz-prompt-text')) {
          return `\n\n${childrenMarkdown.trim()}\n\n`;
        }
        if (node.classList.contains('quiz-options-list')) {
          return `\n${childrenMarkdown}\n`;
        }
        if (node.classList.contains('quiz-option-item')) {
          const isCorrect = node.classList.contains('is-correct');
          const isSelected = node.classList.contains('is-selected');
          const optTextEl = node.querySelector('.quiz-option-text');
          const optText = optTextEl ? this.nodeToMarkdown(optTextEl).trim() : childrenMarkdown.trim().replace(/^[🔘⚪]\s*/, '').replace(/✅.*|❌.*/, '').trim();
          
          if (isCorrect && isSelected) {
            return `- [x] **${optText}** ✅ *(Correct & Your Answer)*\n`;
          } else if (isCorrect) {
            return `- [ ] **${optText}** ✅ *(Correct Answer)*\n`;
          } else if (isSelected) {
            return `- [x] ~~${optText}~~ ❌ *(Your Answer)*\n`;
          } else {
            return `- [ ] ${optText}\n`;
          }
        }
        if (node.classList.contains('quiz-feedback-card')) {
          const cleanFb = childrenMarkdown.replace(/💡\s*Explanation\s*&amp;\s*Feedback/gi, '').replace(/💡\s*Explanation\s*&\s*Feedback/gi, '').trim();
          return `\n> 💡 **Explanation & Feedback:**\n> ${cleanFb.replace(/\n+/g, '\n> ')}\n\n`;
        }
        if (node.classList.contains('offline-quiz-question')) {
          return `\n\n---\n\n${childrenMarkdown}\n\n`;
        }
        if (node.textContent && node.textContent.trim().startsWith('Question ') && node.textContent.trim().length < 20) {
          return `\n\n### ${node.textContent.trim()}\n\n`;
        }
        return childrenMarkdown;
      default:
        return childrenMarkdown;
    }
  },

  tableToMarkdown(tableNode) {
    let md = '';
    const rows = Array.from(tableNode.querySelectorAll('tr'));
    if (rows.length === 0) return '';
    
    let headerRow = tableNode.querySelector('thead tr');
    let bodyRows = Array.from(tableNode.querySelectorAll('tbody tr'));
    
    if (!headerRow && rows.length > 0) {
      headerRow = rows[0];
      bodyRows = rows.slice(1);
    }
    
    const sanitizeCell = (str) => {
      return str
        .trim()
        .replace(/\|/g, '\\|')
        .replace(/\n+/g, '<br>')
        .replace(/(?:<br>\s*)+/g, '<br>')
        .replace(/^<br>/, '')
        .replace(/<br>$/, '');
    };

    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => sanitizeCell(this.nodeToMarkdown(cell)));
      md += `| ${headers.join(' | ')} |\n`;
      md += `| ${headers.map(() => '---').join(' | ')} |\n`;
    }
    
    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll('td, th')).map(cell => sanitizeCell(this.nodeToMarkdown(cell)));
      md += `| ${cells.join(' | ')} |\n`;
    }
    
    return md;
  },

  isDuplicateTitle(parentTitle, childTitle) {
    if (!childTitle || !parentTitle) return false;
    const p = parentTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const c = childTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    return p === c || p.includes(c) || c.includes(p) || c === 'overview' || c === 'readingassignment' || c === 'readingassignments';
  },

  buildMarkdownZip(courseInfo, units, exportScope = 'full', downloadAssets = true) {
    const files = [];
    const isShareable = exportScope === 'shareable';

    // Helper: Add markdown file if it has content
    const addFile = (folderName, fileName, content) => {
      const cleaned = this.cleanMarkdown(content);
      if (cleaned) {
        files.push({
          name: `${folderName}/${fileName}`,
          content: cleaned
        });
      }
    };

    // Calculate course summary stats
    let totalTopics = 0;
    let totalReadings = 0;
    let totalAssignments = 0;
    let totalQuizzes = 0;
    let totalAttachments = 0;
    const readingMatrix = [];

    units.forEach((unit) => {
      totalTopics += (unit.topics || []).length;
      totalReadings += (unit.readings || []).length;
      totalAssignments += (unit.assignments || []).length;
      totalQuizzes += (unit.quizzes || []).length;
      totalAttachments += (unit.attachments || []).length;

      (unit.readings || []).forEach((r) => {
        readingMatrix.push({
          unit: unit.title,
          title: r.title,
          url: r.url || '#'
        });
      });
      (unit.attachments || []).forEach((att) => {
        readingMatrix.push({
          unit: unit.title,
          title: `📎 [Attachment] ${att.title}`,
          url: att.url || '#'
        });
      });
    });

    // 1. Generate README.md at the root
    let readmeContent = `# ${courseInfo.name}${isShareable ? ' - Study Guide & Reading List' : ''}\n\n`;
    readmeContent += `> Exported from Brightspace on **${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}**\n\n`;

    if (isShareable) {
      readmeContent += `> [!NOTE]\n`;
      readmeContent += `> **Export Mode: Shareable Study Guide (Peer-Safe)**\n`;
      readmeContent += `> This package contains the course syllabus, unit overviews, and reading assignment references intended for preparation and study.\n`;
      readmeContent += `> Graded discussion questions, written assignment prompts, rubrics, and assessment quizzes are excluded in compliance with academic integrity policies.\n\n`;
    } else {
      readmeContent += `> [!WARNING]\n`;
      readmeContent += `> **PERSONAL USE ONLY — ACADEMIC INTEGRITY NOTICE**\n`;
      readmeContent += `> This course archive contains quiz questions, discussion prompts, grading rubrics, and assignment details generated strictly for personal offline study by an enrolled student.\n`;
      readmeContent += `> Distributing, publishing, or sharing this archive with peers violates the University of the People Code of Academic Integrity.\n\n`;
    }

    readmeContent += `## Course Overview\n\n`;
    readmeContent += `| Metric | Count |\n`;
    readmeContent += `| :--- | :--- |\n`;
    readmeContent += `| **Total Units** | ${units.length} |\n`;
    readmeContent += `| **Reading Items & Textbooks** | ${totalReadings} |\n`;
    if (!isShareable) {
      readmeContent += `| **Graded Discussions & Assignments** | ${totalAssignments} |\n`;
      readmeContent += `| **Quizzes & Knowledge Checks** | ${totalQuizzes} |\n`;
    }
    readmeContent += `| **Downloaded Attachments** | ${totalAttachments} |\n\n`;

    readmeContent += `## Course Structure & Navigation\n\n`;

    // 2. Generate Master_Course_Complete.md Table of Contents first
    let masterNotesContent = `# ${courseInfo.name} - Complete Course Notes\n\n`;
    masterNotesContent += `> **Course Code:** ${courseInfo.code || courseInfo.name}  \n`;
    masterNotesContent += `> **Export Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}  \n`;
    masterNotesContent += `> **Format:** Consolidated All-In-One Study Document\n\n`;

    if (isShareable) {
      masterNotesContent += `> [!NOTE]\n`;
      masterNotesContent += `> **Peer-Safe Study Guide:** Contains course overviews, reading lists, and study notes. Graded assignments, discussion prompts, and quizzes are excluded.\n\n---\n\n`;
    } else {
      masterNotesContent += `> [!WARNING]\n`;
      masterNotesContent += `> **PERSONAL USE ONLY — ACADEMIC INTEGRITY NOTICE**\n`;
      masterNotesContent += `> This document contains quiz questions, assignments, and study materials for personal offline revision only. Sharing or distributing this document with peers violates the University of the People Code of Academic Integrity.\n\n---\n\n`;
    }
    masterNotesContent += `## Table of Contents\n\n`;

    units.forEach((unit) => {
      const cleanTitle = (unit.title || '').replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ').trim();
      const unitAnchor = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      masterNotesContent += `- [${cleanTitle}](#${unitAnchor})\n`;
    });
    masterNotesContent += `\n---\n\n`;

    // 3. Loop through units to write individual files and append to Master Notes
    units.forEach((unit, unitIdx) => {
      const cleanTitle = (unit.title || '').replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ').trim();
      const folderName = `${String(unitIdx + 1).padStart(2, '0')}_${this.sanitizeFolderName(cleanTitle)}`;
      readmeContent += `- [${cleanTitle}](./${encodeURIComponent(folderName)}/01_Overview.md)\n`;

      // Collect IDs of topics assigned to specialized sections to prevent duplicates in Overview
      const categorizedIds = new Set();
      (unit.readings || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
      if (!isShareable) {
        (unit.discussions || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
        (unit.assignments || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
        (unit.quizzes || []).forEach(t => { if (t.id) categorizedIds.add(t.id); });
      }
      const conclusionTopics = (unit.topics || []).filter(t => {
        const title = t.title.toLowerCase();
        return title.includes('conclusion');
      });
      conclusionTopics.forEach(t => { if (t.id) categorizedIds.add(t.id); });

      // Start unit section in Master file
      masterNotesContent += `# ${unit.title}\n\n`;

      // 1. Overview -> 01_Overview.md
      let overviewMd = `# ${unit.title} - Overview\n\n`;
      const cleanDesc = this.cleanUnitDescription(unit.description, unit.title);
      if (cleanDesc) {
        const descMd = this.htmlToMarkdown(cleanDesc);
        overviewMd += `${descMd}\n\n`;
        masterNotesContent += `## Unit Overview\n\n${descMd}\n\n`;
      }
      const generalTopics = (unit.topics || []).filter(t => !categorizedIds.has(t.id));
      if (generalTopics.length > 0) {
        generalTopics.forEach(t => {
          // Avoid duplicate subheaders if topic title is identical or redundant to unit overview
          if (!this.isDuplicateTitle(unit.title, t.title) && generalTopics.length > 1) {
            overviewMd += `## ${t.title}\n\n`;
            masterNotesContent += `### ${t.title}\n\n`;
          }
          if (t.contentHtml) {
            const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(t.contentHtml, t.title));
            overviewMd += `${bodyMd}\n\n`;
            masterNotesContent += `${bodyMd}\n\n`;
          }
          if (t.url) {
            overviewMd += `*Brightspace Link: [Open Topic ↗](${t.url})*\n\n`;
          }
          overviewMd += `---\n\n`;
        });
      }
      addFile(folderName, '01_Overview.md', overviewMd);

      // 2. Readings -> 02_Readings.md
      if ((unit.readings && unit.readings.length > 0) || (unit.attachments && unit.attachments.length > 0)) {
        let md = `# ${unit.title} - Reading Assignments\n\n`;
        masterNotesContent += `## 📖 Reading Assignments\n\n`;
        if (isShareable) {
          const tip = `> [!TIP]\n> **Accessing Required Textbooks:** For proprietary textbooks and articles (e.g. LIRN library materials), please log into the official UoPeople Library portal and search for the titles using the citations listed below. Open Educational Resources (OER) and open-access links can be accessed directly online.\n\n---\n\n`;
          md += tip;
          masterNotesContent += tip;
        }
        (unit.readings || []).forEach(r => {
          if (!this.isDuplicateTitle(unit.title + ' Reading Assignment', r.title) && (unit.readings || []).length > 1) {
            md += `## ${r.title}\n\n`;
            masterNotesContent += `### ${r.title}\n\n`;
          }
          if (r.url) {
            md += `*Brightspace Link: [Open Reading Topic ↗](${r.url})*\n\n`;
          }
          if (r.contentHtml) {
            const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(r.contentHtml, r.title));
            md += `${bodyMd}\n\n`;
            masterNotesContent += `${bodyMd}\n\n`;
          }
          md += `---\n\n`;
        });

        // Add downloaded local attachments or live online links reference if present
        if (unit.attachments && unit.attachments.length > 0) {
          if (downloadAssets) {
            md += `## 📎 Downloaded Attachments & Files\n\n`;
            masterNotesContent += `### 📎 Attachments & Files\n\n`;
            unit.attachments.forEach(att => {
              const cleanFileName = att.localFileName || (att.title.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.' + (att.ext || 'pdf'));
              const attLink = `- [📄 ${att.title}](assets/${cleanFileName})\n`;
              md += attLink;
              masterNotesContent += attLink;
            });
          } else {
            md += `## 🌐 Course Attachments & Online Resources\n\n`;
            masterNotesContent += `### 🌐 Online Resources\n\n`;
            md += `> *Note: Offline file downloading was disabled during export. The links below direct to the live online Brightspace course resources.*\n\n`;
            unit.attachments.forEach(att => {
              const attLink = `- [🌐 📄 ${att.title} (Open Online ↗)](${att.url || '#'})\n`;
              md += attLink;
              masterNotesContent += attLink;
            });
          }
          md += `\n---\n\n`;
        }

        addFile(folderName, '02_Readings.md', md);
      }

      // ONLY in Full Archive mode: Include graded prompts & quizzes
      if (!isShareable) {
        // 3. Discussion -> 03_Discussions.md
        if (unit.discussions && unit.discussions.length > 0) {
          let md = `# ${unit.title} - Discussion Forum\n\n`;
          masterNotesContent += `## 💬 Discussion Forum\n\n`;
          unit.discussions.forEach(d => {
            md += `## ${d.title}\n\n`;
            masterNotesContent += `### ${d.title}\n\n`;
            if (d.url) {
              md += `*Brightspace Link: [Open Discussion Thread ↗](${d.url})*\n\n`;
            }
            if (d.contentHtml) {
              const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(d.contentHtml, d.title));
              md += `${bodyMd}\n\n`;
              masterNotesContent += `${bodyMd}\n\n`;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '03_Discussions.md', md);
        }

        // 4. Assignments -> 04_Assignments.md
        if (unit.assignments && unit.assignments.length > 0) {
          let md = `# ${unit.title} - Assignment Activities\n\n`;
          masterNotesContent += `## 📝 Assignment Activities\n\n`;
          unit.assignments.forEach(a => {
            md += `## ${a.title}\n\n`;
            masterNotesContent += `### ${a.title}\n\n`;
            if (a.url) {
              md += `*Brightspace Link: [Open Assignment Submission ↗](${a.url})*\n\n`;
            }
            if (a.contentHtml) {
              const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(a.contentHtml, a.title));
              md += `${bodyMd}\n\n`;
              masterNotesContent += `${bodyMd}\n\n`;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '04_Assignments.md', md);
        }

        // Quizzes Sub-sections
        const allQuizzes = unit.quizzes || [];
        const knowledgeChecks = allQuizzes.filter(q => q.title.toLowerCase().includes('knowledge check'));
        const selfQuizzes = allQuizzes.filter(q => {
          const lower = q.title.toLowerCase();
          return (lower.includes('self-quiz') || lower.includes('self quiz')) && !lower.includes('knowledge check');
        });
        const assessmentQuizzes = allQuizzes.filter(q => {
          const lower = q.title.toLowerCase();
          return !lower.includes('knowledge check') && !lower.includes('self-quiz') && !lower.includes('self quiz');
        });

        // 5. Knowledge Checks -> 05_Knowledge_Checks.md
        if (knowledgeChecks.length > 0) {
          let md = `# ${unit.title} - Knowledge Checks\n\n`;
          masterNotesContent += `## 💡 Knowledge Checks\n\n`;
          knowledgeChecks.forEach(q => {
            md += `## ${q.title}\n\n`;
            masterNotesContent += `### ${q.title}\n\n`;
            if (q.url) {
              md += `*Brightspace Link: [Open Quiz ↗](${q.url})*\n\n`;
            }
            if (q.contentHtml) {
              const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(q.contentHtml, q.title));
              md += `${bodyMd}\n\n`;
              masterNotesContent += `${bodyMd}\n\n`;
            } else {
              const notice = `> 💡 **Quiz Ready on Brightspace:** Take your first attempt online on Brightspace, then re-export this course to download full questions, answers, and explanations for offline exam prep!\n\n`;
              md += notice;
              masterNotesContent += notice;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '05_Knowledge_Checks.md', md);
        }

        // 6. Self-Quizzes -> 06_Self_Quizzes.md
        if (selfQuizzes.length > 0) {
          let md = `# ${unit.title} - Self-Quizzes\n\n`;
          masterNotesContent += `## ❓ Self-Quizzes\n\n`;
          selfQuizzes.forEach(q => {
            md += `## ${q.title}\n\n`;
            masterNotesContent += `### ${q.title}\n\n`;
            if (q.url) {
              md += `*Brightspace Link: [Open Quiz ↗](${q.url})*\n\n`;
            }
            if (q.contentHtml) {
              const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(q.contentHtml, q.title));
              md += `${bodyMd}\n\n`;
              masterNotesContent += `${bodyMd}\n\n`;
            } else {
              const notice = `> 💡 **Quiz Ready on Brightspace:** Take your first attempt online on Brightspace, then re-export this course to download full questions, answers, and explanations for offline exam prep!\n\n`;
              md += notice;
              masterNotesContent += notice;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '06_Self_Quizzes.md', md);
        }

        // 7. Assessments -> 07_Assessments.md
        if (assessmentQuizzes.length > 0) {
          let md = `# ${unit.title} - Assessments\n\n`;
          masterNotesContent += `## 📊 Assessments\n\n`;
          assessmentQuizzes.forEach(q => {
            md += `## ${q.title}\n\n`;
            masterNotesContent += `### ${q.title}\n\n`;
            if (q.url) {
              md += `*Brightspace Link: [Open Quiz ↗](${q.url})*\n\n`;
            }
            if (q.contentHtml) {
              const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(q.contentHtml, q.title));
              md += `${bodyMd}\n\n`;
              masterNotesContent += `${bodyMd}\n\n`;
            } else {
              const notice = `> 💡 **Quiz Ready on Brightspace:** Take your first attempt online on Brightspace, then re-export this course to download full questions, answers, and explanations for offline exam prep!\n\n`;
              md += notice;
              masterNotesContent += notice;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '07_Assessments.md', md);
        }
      }

      // 8. Conclusion -> 08_Conclusion.md (Included in both)
      if (conclusionTopics.length > 0) {
        let md = `# ${unit.title} - Conclusion\n\n`;
        masterNotesContent += `## 🏁 Conclusion\n\n`;
        conclusionTopics.forEach(c => {
          if (!this.isDuplicateTitle(unit.title + ' Conclusion', c.title) && conclusionTopics.length > 1) {
            md += `## ${c.title}\n\n`;
            masterNotesContent += `### ${c.title}\n\n`;
          }
          if (c.url) {
            md += `*Brightspace Link: [Open Live Topic ↗](${c.url})*\n\n`;
          }
          if (c.contentHtml) {
            const bodyMd = this.htmlToMarkdown(this.cleanContentHtml(c.contentHtml, c.title));
            md += `${bodyMd}\n\n`;
            masterNotesContent += `${bodyMd}\n\n`;
          }
          md += `---\n\n`;
        });
        addFile(folderName, '08_Conclusion.md', md);
      }

      masterNotesContent += `\n---\n\n`;
    });

    // Master Course Reading Matrix in README
    if (readingMatrix.length > 0) {
      readmeContent += `\n## 📚 Master Course Reading Matrix\n\n`;
      readmeContent += `| Unit | Assigned Resource / Textbook | Link |\n`;
      readmeContent += `| :--- | :--- | :--- |\n`;
      readingMatrix.forEach((rm) => {
        readmeContent += `| ${rm.unit} | ${rm.title} | [Open Link ↗](${rm.url}) |\n`;
      });
      readmeContent += `\n`;
    }

    readmeContent += `\n---\n\n`;
    readmeContent += `### 💡 Support & Community Feedback\n\n`;
    readmeContent += `- 🌟 **Enjoying this tool?** Leave a ⭐ on [GitHub](https://github.com/itsmohamedyahia/offline-course-exporter-uopeople) & a 5-star review on the Web Store!\n`;
    readmeContent += `- ☕ **Support the Developer:** [Buy Me a Coffee / Ko-fi](https://ko-fi.com/myahiakhidr)\n`;
    readmeContent += `- 💼 **Author:** Built with ❤️ by **Mohamed Yahia** • [GitHub](https://github.com/itsmohamedyahia) • [LinkedIn](https://www.linkedin.com/in/myahiakhidr/) • [⭐ Star on GitHub](https://github.com/itsmohamedyahia/offline-course-exporter-uopeople)\n\n`;
    readmeContent += `*Unofficial open-source study tool for personal offline study. Not affiliated with University of the People or D2L.*\n`;

    files.push({
      name: 'README.md',
      content: this.cleanMarkdown(readmeContent)
    });

    files.push({
      name: 'Master_Course_Complete.md',
      content: this.cleanMarkdown(masterNotesContent)
    });

    return files;
  }
};
