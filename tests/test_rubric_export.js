const assert = require('assert');
const MarkdownBuilder = require('../markdown_builder.js');
const D2LApi = require('../d2l_api.js');

console.log('--- Starting Rubric Export Verification Tests ---');

// Test 1: findRubricForActivity matching mechanisms & detail resolution
console.log('Test 1: D2LApi.findRubricForActivity matching & detailed rubric resolution');
{
  const detailedRubric = {
    RubricId: 10,
    Id: 10,
    Name: 'Unit 5 Assignment Rubric',
    CriteriaGroups: [{
      Levels: [{ Id: 1, Name: 'Exemplary', Points: 4 }],
      Criteria: [{ Id: 1, Name: 'Prose Analysis', Outof: 4, Cells: [{ LevelId: 1, Points: 4, Description: 'Flawless' }] }]
    }]
  };

  const rubricsMap = {
    // 1a. Shallow summary mapped to activity key
    'dropbox_501': { Id: 10, RubricId: 10, Name: 'Unit 5 Assignment Rubric' },
    // Detailed rubric resolved by ID
    '10': detailedRubric,
    10: detailedRubric,
    'discussion_601': { Id: 20, Name: 'Unit 6 Discussion Rubric', CriteriaGroups: [] },
    '99': { Id: 99, Name: 'Generic Rubric', CriteriaGroups: [] },
    'منتدى المناقشة الوحدة 7': { Id: 30, Name: 'منتدى المناقشة الوحدة 7', CriteriaGroups: [] }
  };

  // 1a. Match by activity type & id AND resolve detailed rubric with CriteriaGroups
  const rDropbox = D2LApi.findRubricForActivity('Assignment Activity Unit 5', [], rubricsMap, 501, 'dropbox');
  assert.strictEqual(rDropbox?.Id, 10, 'Should match dropbox by type and id');
  assert.ok(rDropbox?.CriteriaGroups?.length > 0, 'findRubricForActivity MUST resolve detailed rubric with CriteriaGroups');

  const rDiscussion = D2LApi.findRubricForActivity('Discussion Forum Unit 6', [], rubricsMap, 601, 'discussion');
  assert.strictEqual(rDiscussion?.Id, 20, 'Should match discussion by type and id');

  // 1b. Match by explicit rubricIds
  const rByRid = D2LApi.findRubricForActivity('Some Other Activity', [99], rubricsMap);
  assert.strictEqual(rByRid?.Id, 99, 'Should match by explicit rubricIds array');

  // 1c. Match by Arabic name cleaning with tashkeel and alif normalization
  const rArabicWithDiacritics = D2LApi.findRubricForActivity('مُنتدى المُناقشة - الوحدة ٧', [], rubricsMap);
  assert.strictEqual(rArabicWithDiacritics?.Id, 30, 'Should match Arabic discussion name with tashkeel/diacritics');
  console.log('✓ Test 1 passed: findRubricForActivity matches correctly and resolves detailed rubrics.');
}

// Test 2: D2LApi.buildRubricHtml rendering
console.log('Test 2: D2LApi.buildRubricHtml rendering');
{
  const sampleRubric = {
    Name: 'World Literature Unit 5 Discussion Rubric',
    Description: { Text: 'Grading criteria for novel analysis.' },
    CriteriaGroups: [{
      Levels: [
        { Id: 'lvl_4', Name: 'Exemplary', Points: 4 },
        { Id: 'lvl_3', Name: 'Proficient', Points: 3 },
        { Id: 'lvl_2', Name: 'Developing', Points: 2 },
        { Id: 'lvl_1', Name: 'Novice', Points: 1 }
      ],
      Criteria: [
        {
          Id: 1,
          Name: 'Novel Form & Features',
          Outof: 4,
          Cells: [
            { LevelId: 'lvl_4', Points: 4, Description: { Text: 'Deep and comprehensive analysis.' } },
            { LevelId: 'lvl_3', Points: 3, Description: { Text: 'Clear analysis of main features.' } },
            { LevelId: 'lvl_2', Points: 2, Description: { Text: 'Surface level analysis.' } },
            { LevelId: 'lvl_1', Points: 1, Description: { Text: 'Incomplete analysis.' } }
          ]
        },
        {
          Id: 2,
          Name: 'Character Analysis & Comparison',
          Outof: 4,
          Cells: [
            { LevelId: 'lvl_4', Points: 4, Description: { Text: 'Insightful comparison.' } },
            { LevelId: 'lvl_3', Points: 3, Description: { Text: 'Solid comparison.' } },
            { LevelId: 'lvl_2', Points: 2, Description: { Text: 'Partial comparison.' } },
            { LevelId: 'lvl_1', Points: 1, Description: { Text: 'Weak comparison.' } }
          ]
        }
      ]
    }]
  };

  const html = D2LApi.buildRubricHtml(sampleRubric);
  assert.ok(html.includes('rubric-container'), 'HTML should contain rubric-container wrapper');
  assert.ok(html.includes('World Literature Unit 5 Discussion Rubric'), 'HTML should contain rubric title');
  assert.ok(html.includes('Novel Form &amp; Features'), 'HTML should contain criterion name');
  assert.ok(html.includes('Exemplary'), 'HTML should contain level name');
  assert.ok(html.includes('4 pts'), 'HTML should contain points');
  assert.ok(html.includes('Deep and comprehensive analysis.'), 'HTML should contain cell description');
  console.log('✓ Test 2 passed: buildRubricHtml generates valid structured HTML table.');
}

// Test 3: MarkdownBuilder.renderRubricMarkdown (Structured & Raw Table Fallback)
console.log('Test 3: MarkdownBuilder.renderRubricMarkdown');
{
  const sampleRubric = {
    Name: 'Unit 7 Fiction Prose II Assignment Rubric',
    Description: 'Evaluates close reading and thematic analysis of modern prose.',
    CriteriaGroups: [{
      Levels: [
        { Id: 1, Name: 'Advanced', Points: 4 },
        { Id: 2, Name: 'Competent', Points: 3 }
      ],
      Criteria: [
        {
          Name: 'Theme & Symbolism',
          Outof: 4,
          Cells: [
            { LevelId: 1, Points: 4, Description: { Text: 'Exemplary analysis of motifs and themes.' } },
            { LevelId: 2, Points: 3, Description: { Text: 'Satisfactory identification of themes.' } }
          ]
        },
        {
          Name: 'APA Documentation',
          Outof: 2,
          Cells: [
            { LevelId: 1, Points: 2, Description: { Text: 'Flawless APA 7th format.' } },
            { LevelId: 2, Points: 1.5, Description: { Text: 'Minor APA formatting errors.' } }
          ]
        }
      ]
    }]
  };

  const md = MarkdownBuilder.renderRubricMarkdown(sampleRubric);
  assert.ok(md.startsWith('### 📋 Evaluation Rubric: Unit 7 Fiction Prose II Assignment Rubric'), 'Should start with H3 rubric title');
  assert.ok(md.includes('> Evaluates close reading and thematic analysis of modern prose.'), 'Should include blockquote description');
  assert.ok(md.includes('| Criteria | Advanced<br>*(4 pts)* | Competent<br>*(3 pts)* |'), 'Should format header row with levels and points');
  assert.ok(md.includes('| **Theme & Symbolism**<br>*(Out of 4 pts)* |'), 'Should format criterion row with out-of points');
  assert.ok(md.includes('**4 pts**<br>Exemplary analysis of motifs and themes.'), 'Should include points and description in cell');

  // Test 3b: Raw HTML Table fallback without throwing DOMParser error
  const rawHtmlRubric = {
    Name: 'Raw Table Rubric',
    isRawHtml: true,
    rawTableHtml: '<table><tr><th>Criterion</th><th>Exemplary</th></tr><tr><td>Grammar</td><td>4 pts</td></tr></table>'
  };
  const rawMd = MarkdownBuilder.renderRubricMarkdown(rawHtmlRubric);
  assert.ok(rawMd.includes('### 📋 Evaluation Rubric: Raw Table Rubric'), 'Should render raw table rubric heading');
  assert.ok(rawMd.includes('| Criterion | Exemplary |'), 'Should parse table header');
  assert.ok(rawMd.includes('| Grammar | 4 pts |'), 'Should parse table row');

  console.log('✓ Test 3 passed: renderRubricMarkdown produces clean standard Markdown tables in all modes.');
}

// Test 4: MarkdownBuilder.buildMarkdownZip output structure & multi-activity rubric preservation
console.log('Test 4: MarkdownBuilder.buildMarkdownZip attaches rubric at end of 03_Discussions.md and 04_Assignments.md');
{
  const courseInfo = {
    code: 'ENGL 1405',
    name: 'World Literature',
    term: 'Term 1 2026-2027'
  };

  const sampleDiscussionRubric1 = {
    Name: 'Discussion Forum Unit 5 Rubric',
    CriteriaGroups: [{
      Levels: [
        { Id: 1, Name: 'Exemplary', Points: 4 },
        { Id: 2, Name: 'Proficient', Points: 3 }
      ],
      Criteria: [{
        Name: 'Novel Form & Analysis',
        Outof: 4,
        Cells: [
          { LevelId: 1, Points: 4, Description: { Text: 'Thorough literary analysis.' } },
          { LevelId: 2, Points: 3, Description: { Text: 'Competent literary analysis.' } }
        ]
      }]
    }]
  };

  const sampleDiscussionRubric2 = {
    Name: 'Discussion Forum Bonus Rubric',
    CriteriaGroups: [{
      Levels: [
        { Id: 1, Name: 'High', Points: 5 }
      ],
      Criteria: [{
        Name: 'Peer Interaction',
        Outof: 5,
        Cells: [
          { LevelId: 1, Points: 5, Description: { Text: 'Active engagement.' } }
        ]
      }]
    }]
  };

  const sampleAssignmentRubric = {
    Name: 'Assignment Activity Unit 7 Rubric',
    CriteriaGroups: [{
      Levels: [
        { Id: 1, Name: 'Exemplary', Points: 4 },
        { Id: 2, Name: 'Proficient', Points: 3 }
      ],
      Criteria: [{
        Name: 'Prose & Thematic Depth',
        Outof: 4,
        Cells: [
          { LevelId: 1, Points: 4, Description: { Text: 'Deep insight into prose structure.' } },
          { LevelId: 2, Points: 3, Description: { Text: 'Clear analysis of themes.' } }
        ]
      }]
    }]
  };

  const units = [
    {
      id: 101,
      title: '06_Unit 5_ Fiction Prose I',
      discussions: [
        {
          id: 'd1',
          title: 'Discussion Forum Unit 5',
          url: 'https://learn.uopeople.edu/d2l/le/15554/discussions/topics/101',
          contentHtml: '<p>Answer the discussion questions based on the unit readings.</p><p>Your instructor will grade your assignment based on the attached rubric.</p>',
          rubric: sampleDiscussionRubric1
        },
        {
          id: 'd2',
          title: 'Discussion Forum Reflection',
          url: 'https://learn.uopeople.edu/d2l/le/15554/discussions/topics/102',
          contentHtml: '<p>Reflect on your reading progress.</p>',
          rubric: sampleDiscussionRubric2
        }
      ],
      assignments: [],
      quizzes: [],
      readings: [],
      attachments: []
    },
    {
      id: 102,
      title: '08_Unit 7_ Fiction Prose II',
      discussions: [],
      assignments: [
        {
          id: 'a1',
          title: 'Assignment Activity Unit 7',
          url: 'https://learn.uopeople.edu/d2l/le/15554/dropbox/folders/202',
          contentHtml: '<p>Write an essay analyzing the chosen literary work.</p><p>This assignment will be assessed by your instructor using the attached rubric.</p>',
          rubric: sampleAssignmentRubric
        }
      ],
      quizzes: [],
      readings: [],
      attachments: []
    }
  ];

  const files = MarkdownBuilder.buildMarkdownZip(courseInfo, units, 'full', false);
  const fileMap = {};
  files.forEach(f => { fileMap[f.name] = f.content; });

  // 4a. Verify 03_Discussions.md contains BOTH discussions and BOTH rubrics
  const discFile = files.find(f => f.name.endsWith('03_Discussions.md'));
  assert.ok(discFile, 'Expected 03_Discussions.md in exported files');
  const discContent = discFile.content;
  assert.ok(discContent.includes('## Discussion Forum Unit 5'), 'Should contain discussion 1 title');
  assert.ok(discContent.includes('### 📋 Evaluation Rubric: Discussion Forum Unit 5 Rubric'), 'Should contain discussion 1 rubric heading');
  assert.ok(discContent.includes('| **Novel Form & Analysis**<br>*(Out of 4 pts)* |'), 'Should contain discussion 1 criterion row');
  
  assert.ok(discContent.includes('## Discussion Forum Reflection'), 'Should contain discussion 2 title');
  assert.ok(discContent.includes('### 📋 Evaluation Rubric: Discussion Forum Bonus Rubric'), 'Should contain discussion 2 rubric heading (MUST NOT BE DROPPED)');
  assert.ok(discContent.includes('| **Peer Interaction**<br>*(Out of 5 pts)* |'), 'Should contain discussion 2 criterion row');

  // Verify rubrics are placed before their respective section separators
  const rubricIdxDisc = discContent.indexOf('### 📋 Evaluation Rubric: Discussion Forum Unit 5 Rubric');
  const sepIdxDisc = discContent.indexOf('---');
  assert.ok(rubricIdxDisc < sepIdxDisc, 'Discussion 1 rubric must appear before its section separator');

  // 4b. Verify 04_Assignments.md
  const assignFile = files.find(f => f.name.endsWith('04_Assignments.md'));
  assert.ok(assignFile, 'Expected 04_Assignments.md in exported files');
  const assignContent = assignFile.content;
  assert.ok(assignContent.includes('## Assignment Activity Unit 7'), 'Should contain assignment title');
  assert.ok(assignContent.includes('### 📋 Evaluation Rubric: Assignment Activity Unit 7 Rubric'), 'Should contain assignment rubric heading');
  assert.ok(assignContent.includes('| Criteria | Exemplary<br>*(4 pts)* | Proficient<br>*(3 pts)* |'), 'Should contain rubric table header');
  assert.ok(assignContent.includes('| **Prose & Thematic Depth**<br>*(Out of 4 pts)* |'), 'Should contain criterion row');

  // Verify rubric is placed before the trailing section separator '---'
  const rubricIdxAssign = assignContent.indexOf('### 📋 Evaluation Rubric');
  const trailingSepIdxAssign = assignContent.lastIndexOf('---');
  assert.ok(rubricIdxAssign < trailingSepIdxAssign, 'Rubric must appear before trailing separator in 04_Assignments.md');

  // 4c. Verify Master_Course_Complete.md contains all rubrics
  const masterContent = fileMap['Master_Course_Complete.md'];
  assert.ok(masterContent, 'Master_Course_Complete.md must be generated');
  assert.ok(masterContent.includes('### 📋 Evaluation Rubric: Discussion Forum Unit 5 Rubric'), 'Master doc must include discussion 1 rubric');
  assert.ok(masterContent.includes('### 📋 Evaluation Rubric: Discussion Forum Bonus Rubric'), 'Master doc must include discussion 2 rubric');
  assert.ok(masterContent.includes('### 📋 Evaluation Rubric: Assignment Activity Unit 7 Rubric'), 'Master doc must include assignment rubric');

  console.log('✓ Test 4 passed: 03_Discussions.md, 04_Assignments.md, and Master_Course_Complete.md contain all properly formatted rubrics.');
}

console.log('🎉 All Rubric Export Verification Tests Passed Successfully!');
