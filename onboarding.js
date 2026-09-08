/**
 * First-Time Onboarding Logic for Offline Course Exporter
 * Sets user preference for automatic course page completion
 */

document.addEventListener('DOMContentLoaded', () => {
  const questionView = document.getElementById('question-view');
  const confirmedView = document.getElementById('confirmed-view');
  const confirmedSummary = document.getElementById('confirmed-summary');
  const btnChoiceYes = document.getElementById('btn-choice-yes');
  const btnChoiceNo = document.getElementById('btn-choice-no');
  const btnCloseOnboarding = document.getElementById('btn-close-onboarding');
  const onboardingActiveFolder = document.getElementById('onboarding-active-folder');
  const btnOnboardingResetFolder = document.getElementById('btn-onboarding-reset-folder');

  const DEFAULT_ACTIVE_FOLDER = 'S:\\01_ACADEMIC_STUDY\\UoPeople as Student\\01_ACTIVE_COURSES';

  if (btnOnboardingResetFolder && onboardingActiveFolder) {
    btnOnboardingResetFolder.addEventListener('click', () => {
      onboardingActiveFolder.value = DEFAULT_ACTIVE_FOLDER;
    });
  }

  function getSelectedActiveFolder() {
    if (!onboardingActiveFolder) return DEFAULT_ACTIVE_FOLDER;
    return (onboardingActiveFolder.value || '').trim() || DEFAULT_ACTIVE_FOLDER;
  }

  function savePreference(autoMark) {
    const activeFolder = getSelectedActiveFolder();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        autoMarkCompleted: autoMark,
        activeCoursesFolder: activeFolder,
        exportFormat: 'combined',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString()
      }, () => {
        displayConfirmation(autoMark, activeFolder);
      });
    } else {
      displayConfirmation(autoMark, activeFolder);
    }
  }

  function displayConfirmation(autoMark, activeFolder) {
    if (questionView) questionView.classList.add('hidden');
    if (confirmedView) confirmedView.classList.remove('hidden');

    const folderDisplay = activeFolder || DEFAULT_ACTIVE_FOLDER;

    if (confirmedSummary) {
      let html = '';
      if (autoMark) {
        html += '<strong>Auto-Marking is Enabled.</strong> When you open <a href="https://learn.uopeople.edu" target="_blank" style="color: var(--accent-rose-light); text-decoration: underline;">learn.uopeople.edu</a> on the first day of the term, all pages across all your attending courses will be automatically marked as completed.<br><br>';
      } else {
        html += '<strong>Manual Mode is Selected.</strong> Course pages will not be auto-marked. You can manually complete topics or export materials anytime using the extension popup.<br><br>';
      }
      html += `<strong>Active Courses Directory:</strong> <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px;">${folderDisplay}</code>`;
      confirmedSummary.innerHTML = html;
    }
  }

  if (btnChoiceYes) {
    btnChoiceYes.addEventListener('click', () => {
      savePreference(true);
    });
  }

  if (btnChoiceNo) {
    btnChoiceNo.addEventListener('click', () => {
      savePreference(false);
    });
  }

  if (btnCloseOnboarding) {
    btnCloseOnboarding.addEventListener('click', () => {
      try {
        window.close();
      } catch (e) {
        window.location.href = 'options.html';
      }
    });
  }
});
