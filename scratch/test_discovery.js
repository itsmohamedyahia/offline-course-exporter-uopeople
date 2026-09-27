const assert = require('assert');
const fs = require('fs');

// Mock browser globals for Node test runner
global.window = {};
global.document = {
  querySelectorAll: () => []
};

const d2lApiCode = fs.readFileSync('d2l_api.js', 'utf8');
eval(d2lApiCode);

// 1. Test cleanCourseName logic
const sampleTitle = 'Homepage - CS 2301-01 Operating Systems - AY2026-T5 - Brightspace';
const cleaned = D2LApi.cleanCourseName(sampleTitle);
assert.strictEqual(cleaned, 'CS 2301-01 Operating Systems - AY2026-T5', `Expected cleaned title but got: ${cleaned}`);
console.log('✓ cleanCourseName passed');

async function runTests() {
  // 2. Test Valence LP API parsing & pagination bookmark handling
  let fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push(url);
    if (url.includes('bookmark=PAGE2')) {
      return {
        ok: true,
        json: async () => ({
          PagingInfo: { Bookmark: null, HasMoreItems: false },
          Items: [
            {
              OrgUnit: { Id: '2002', Name: 'MATH 1201 College Algebra', Code: 'MATH 1201' },
              Access: { CanAccess: true }
            }
          ]
        })
      };
    }
    if (url.includes('/d2l/api/lp/1.30/enrollments/myenrollments/?canAccess=true&orgUnitTypeId=3&isActive=true')) {
      return {
        ok: true,
        json: async () => ({
          PagingInfo: { Bookmark: 'PAGE2', HasMoreItems: true },
          Items: [
            {
              OrgUnit: { Id: '6606', Name: 'Root Sandbox Org', Code: 'ROOT' },
              Access: { CanAccess: true }
            },
            {
              OrgUnit: { Id: '1001', Name: 'CS 1101-01 Programming Fundamentals', Code: 'CS 1101' },
              Access: { CanAccess: true }
            },
            {
              OrgUnit: { Id: '9999', Name: 'Inactive Closed Course', Code: 'CS 9999' },
              Access: { CanAccess: false }
            }
          ]
        })
      };
    }
    return { ok: false, status: 404 };
  };

  const valenceCourses = await D2LApi.getEnrolledCourses();
  assert.strictEqual(valenceCourses.length, 2, `Expected 2 courses from Valence API, got ${valenceCourses.length}`);
  assert.strictEqual(valenceCourses[0].id, '1001');
  assert.strictEqual(valenceCourses[0].name, 'CS 1101-01 Programming Fundamentals');
  assert.strictEqual(valenceCourses[1].id, '2002');
  assert.strictEqual(valenceCourses[1].name, 'MATH 1201 College Algebra');
  // Ensure 6606 and CanAccess:false were excluded
  assert.ok(!valenceCourses.some(c => c.id === '6606'), '6606 should be excluded');
  assert.ok(!valenceCourses.some(c => c.id === '9999'), 'CanAccess: false should be excluded');
  console.log('✓ Valence API parsing, bookmark pagination, and filtering passed');

  // 3. Test DOM fallback scraping
  global.fetch = async () => ({ ok: false, status: 500 }); // simulate API failure
  
  const mockElements = [
    {
      getAttribute: (attr) => attr === 'data-org-unit-id' ? '3003' : null,
      querySelector: (sel) => sel.includes('title') ? { textContent: 'Homepage - ENGL 1102 English Composition 2 - AY2026-T5' } : null
    },
    {
      getAttribute: () => null,
      href: 'https://learn.uopeople.edu/d2l/home/4004',
      querySelector: () => ({ innerText: 'PSYC 1504 Introduction to Psychology' })
    },
    {
      getAttribute: () => null,
      href: 'https://learn.uopeople.edu/d2l/common/dialogs/quickLink/quickLink.d2l?ou=5005',
      querySelector: () => ({ textContent: 'PHIL 1402 Introduction to Philosophy' })
    },
    {
      // 6606 should be ignored in DOM too
      getAttribute: () => null,
      href: 'https://learn.uopeople.edu/d2l/home/6606',
      querySelector: () => ({ innerText: 'Root Portal' })
    }
  ];

  global.document = {
    querySelectorAll: (selector) => {
      assert.ok(selector.includes('ou='), 'Selector should include a[href*="ou="]');
      return mockElements;
    }
  };

  const domCourses = await D2LApi.getEnrolledCourses();
  assert.strictEqual(domCourses.length, 3, `Expected 3 courses from DOM, got ${domCourses.length}`);
  assert.strictEqual(domCourses[0].id, '3003');
  assert.strictEqual(domCourses[0].name, 'ENGL 1102 English Composition 2 - AY2026-T5');
  assert.strictEqual(domCourses[1].id, '4004');
  assert.strictEqual(domCourses[1].name, 'PSYC 1504 Introduction to Psychology');
  assert.strictEqual(domCourses[2].id, '5005');
  assert.strictEqual(domCourses[2].name, 'PHIL 1402 Introduction to Philosophy');
  assert.ok(!domCourses.some(c => c.id === '6606'), 'DOM 6606 should be excluded');
  console.log('✓ DOM fallback scraping (cards, home links, ou= links) passed');

  console.log('\nAll tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
