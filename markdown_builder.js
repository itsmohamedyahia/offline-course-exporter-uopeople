/**
 * Markdown Builder Module
 * Converts course materials from HTML to Markdown and compiles them into a structured folder layout.
 */
const MarkdownBuilder = {
  sanitizeFolderName(name) {
    if (!name) return 'Unit';
    // Replace characters not allowed in file/folder names on Windows/Mac/Linux
    let clean = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    // Collapse multiple underscores
    clean = clean.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return clean || 'Unit';
  },

  htmlToMarkdown(htmlStr) {
    if (!htmlStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');
      return this.nodeToMarkdown(doc.body).trim();
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
      case 'a':
        const href = node.getAttribute('href') || '';
        const linkText = childrenMarkdown.trim() || href;
        return href ? `[${linkText}](${href})` : childrenMarkdown;
      case 'img':
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || 'image';
        return src ? `\n![${alt}](${src})\n` : '';
      case 'ul':
        return `\n${childrenMarkdown}\n`;
      case 'ol':
        return `\n${childrenMarkdown}\n`;
      case 'li':
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
        return `${prefix}${innerMd.trim()}\n`;
      case 'blockquote':
        return `\n> ${childrenMarkdown.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'hr':
        return `\n\n---\n\n`;
      case 'table':
        return `\n\n${this.tableToMarkdown(node)}\n\n`;
      case 'div':
      case 'span':
        if (node.classList.contains('video-container')) {
          const watchBtn = node.querySelector('.watch-on-youtube-btn');
          const iframe = node.querySelector('iframe');
          let videoMd = '\n\n';
          if (iframe) {
            const iframeSrc = iframe.getAttribute('src');
            videoMd += `[📺 Embedded Video](${iframeSrc})\n`;
          }
          if (watchBtn) {
            const watchUrl = watchBtn.getAttribute('href');
            videoMd += `[▶ Watch on YouTube](${watchUrl})\n`;
          }
          return videoMd + '\n';
        }
        if (node.classList.contains('rubric-container')) {
          return `\n\n${childrenMarkdown}\n\n`;
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
    
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => this.nodeToMarkdown(cell).trim().replace(/\n/g, ' '));
      md += `| ${headers.join(' | ')} |\n`;
      md += `| ${headers.map(() => '---').join(' | ')} |\n`;
    }
    
    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll('td, th')).map(cell => this.nodeToMarkdown(cell).trim().replace(/\n/g, '<br>'));
      md += `| ${cells.join(' | ')} |\n`;
    }
    
    return md;
  },

  buildMarkdownZip(courseInfo, units, exportScope = 'full') {
    const files = [];
    const isShareable = exportScope === 'shareable';

    // Helper: Add markdown file if it has content
    const addFile = (folderName, fileName, content) => {
      files.push({
        name: `${folderName}/${fileName}`,
        content: content.trim()
      });
    };

    // Generate README.md at the root
    let readmeContent = `# ${courseInfo.name}${isShareable ? ' - Study Guide & Reading List' : ''}\n\n`;
    readmeContent += `Exported from Brightspace on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}\n\n`;

    if (isShareable) {
      readmeContent += `> **Export Mode: Shareable Study Guide (Peer-Safe)**\n`;
      readmeContent += `> This package contains the course syllabus, unit overviews, and reading assignment references intended for preparation and study.\n`;
      readmeContent += `> Graded discussion questions, written assignment prompts, and assessment quizzes are excluded in compliance with academic policies.\n\n`;
    }

    readmeContent += `## Course Structure\n\n`;

    units.forEach((unit, unitIdx) => {
      const folderName = `${String(unitIdx + 1).padStart(2, '0')}_${this.sanitizeFolderName(unit.title)}`;
      readmeContent += `- [${unit.title}](./${encodeURIComponent(folderName)})\n`;

      // 1. General topics -> 01_Overview.md
      const generalTopics = (unit.topics || []).filter(t => {
        const title = t.title.toLowerCase();
        return !title.includes('reading') &&
               !title.includes('textbook') &&
               !title.includes('discussion') &&
               !title.includes('forum') &&
               !title.includes('assignment') &&
               !title.includes('learning journal') &&
               !title.includes('quiz') &&
               !title.includes('exam') &&
               !title.includes('test') &&
               !title.includes('conclusion');
      });

      if (generalTopics.length > 0 || unit.description) {
        let md = `# ${unit.title} - Overview\n\n`;
        if (unit.description) {
          md += `## Unit Description\n\n${this.htmlToMarkdown(unit.description)}\n\n---\n\n`;
        }
        generalTopics.forEach(t => {
          md += `## ${t.title}\n\n`;
          if (t.url) {
            md += `*Brightspace Link: [Open Live Topic ↗](${t.url})*\n\n`;
          }
          if (t.contentHtml) {
            md += `${this.htmlToMarkdown(t.contentHtml)}\n\n`;
          }
          md += `---\n\n`;
        });
        addFile(folderName, '01_Overview.md', md);
      }

      // 2. Reading -> 02_Readings.md
      if (unit.readings && unit.readings.length > 0) {
        let md = `# ${unit.title} - Reading Assignments\n\n`;
        unit.readings.forEach(r => {
          md += `## ${r.title}\n\n`;
          if (r.url) {
            md += `*Brightspace Link: [Open Live Resource ↗](${r.url})*\n\n`;
          }
          if (r.contentHtml) {
            md += `${this.htmlToMarkdown(r.contentHtml)}\n\n`;
          }
          md += `---\n\n`;
        });
        addFile(folderName, '02_Readings.md', md);
      }

      // ONLY in Full Archive mode: Include graded prompts & quizzes
      if (!isShareable) {
        // 3. Discussion -> 03_Discussions.md
        if (unit.discussions && unit.discussions.length > 0) {
          let md = `# ${unit.title} - Discussion Forum\n\n`;
          unit.discussions.forEach(d => {
            md += `## ${d.title}\n\n`;
            if (d.url) {
              md += `*Brightspace Link: [Open Discussion Thread ↗](${d.url})*\n\n`;
            }
            if (d.contentHtml) {
              md += `${this.htmlToMarkdown(d.contentHtml)}\n\n`;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '03_Discussions.md', md);
        }

        // 4. Assignments -> 04_Assignments.md
        if (unit.assignments && unit.assignments.length > 0) {
          let md = `# ${unit.title} - Assignment Activities\n\n`;
          unit.assignments.forEach(a => {
            md += `## ${a.title}\n\n`;
            if (a.url) {
              md += `*Brightspace Link: [Open Assignment Submission ↗](${a.url})*\n\n`;
            }
            if (a.contentHtml) {
              md += `${this.htmlToMarkdown(a.contentHtml)}\n\n`;
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
          knowledgeChecks.forEach(q => {
            md += `## ${q.title}\n\n`;
            if (q.url) {
              md += `*Brightspace Link: [Open Quiz ↗](${q.url})*\n\n`;
            }
            if (q.contentHtml) {
              md += `${this.htmlToMarkdown(q.contentHtml)}\n\n`;
            } else {
              md += `*No attempt history found. Take this quiz in Brightspace, then export again to download questions and answers.*\n\n`;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '05_Knowledge_Checks.md', md);
        }

        // 6. Self-Quizzes -> 06_Self_Quizzes.md
        if (selfQuizzes.length > 0) {
          let md = `# ${unit.title} - Self-Quizzes\n\n`;
          selfQuizzes.forEach(q => {
            md += `## ${q.title}\n\n`;
            if (q.url) {
              md += `*Brightspace Link: [Open Quiz ↗](${q.url})*\n\n`;
            }
            if (q.contentHtml) {
              md += `${this.htmlToMarkdown(q.contentHtml)}\n\n`;
            } else {
              md += `*No attempt history found. Take this quiz in Brightspace, then export again to download questions and answers.*\n\n`;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '06_Self_Quizzes.md', md);
        }

        // 7. Assessments -> 07_Assessments.md
        if (assessmentQuizzes.length > 0) {
          let md = `# ${unit.title} - Assessments\n\n`;
          assessmentQuizzes.forEach(q => {
            md += `## ${q.title}\n\n`;
            if (q.url) {
              md += `*Brightspace Link: [Open Quiz ↗](${q.url})*\n\n`;
            }
            if (q.contentHtml) {
              md += `${this.htmlToMarkdown(q.contentHtml)}\n\n`;
            } else {
              md += `*No attempt history found. Take this quiz in Brightspace, then export again to download questions and answers.*\n\n`;
            }
            md += `---\n\n`;
          });
          addFile(folderName, '07_Assessments.md', md);
        }
      }

      // 8. Conclusion -> 08_Conclusion.md (Included in both)
      const conclusionTopics = (unit.topics || []).filter(t => {
        const title = t.title.toLowerCase();
        return title.includes('conclusion');
      });

      if (conclusionTopics.length > 0) {
        let md = `# ${unit.title} - Conclusion\n\n`;
        conclusionTopics.forEach(c => {
          md += `## ${c.title}\n\n`;
          if (c.url) {
            md += `*Brightspace Link: [Open Live Topic ↗](${c.url})*\n\n`;
          }
          if (c.contentHtml) {
            md += `${this.htmlToMarkdown(c.contentHtml)}\n\n`;
          }
          md += `---\n\n`;
        });
        addFile(folderName, '08_Conclusion.md', md);
      }
    });

    files.push({
      name: 'README.md',
      content: readmeContent
    });

    return files;
  }
};
