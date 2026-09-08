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

  function savePreference(autoMark) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        autoMarkCompleted: autoMark,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString()
      }, () => {
        displayConfirmation(autoMark);
      });
    } else {
      displayConfirmation(autoMark);
    }
  }

  function displayConfirmation(autoMark) {
    if (questionView) questionView.classList.add('hidden');
    if (confirmedView) confirmedView.classList.remove('hidden');

    if (confirmedSummary) {
      if (autoMark) {
        confirmedSummary.innerHTML = '<strong>Auto-Marking is Enabled.</strong> When you open <a href="https://learn.uopeople.edu" target="_blank" style="color: var(--accent-rose-light); text-decoration: underline;">learn.uopeople.edu</a> on the first day of the term, all pages across all your attending courses will be automatically marked as completed.';
      } else {
        confirmedSummary.innerHTML = '<strong>Manual Mode is Selected.</strong> Course pages will not be auto-marked. You can manually complete topics or export materials anytime using the extension popup.';
      }
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
