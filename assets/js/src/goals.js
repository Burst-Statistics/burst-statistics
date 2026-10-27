/**
 * Goals tracking bootstrap: normalizes active/completed goal IDs and loads
 * the goals tracking script if active goals match the current page.
 *
 * Concatenated into full builds; omitted from essentials builds.
 */

// Normalize goal IDs
if (burst.goals?.active) {
  burst.goals.active = burst.goals.active.map(goal => ({
    ...goal,
    ID: parseInt(goal.ID, 10)
  }));
}
if (burst.goals?.completed) {
  burst.goals.completed = burst.goals.completed.map(id => parseInt(id, 10));
}

// Inject goals script as a regular script tag to avoid CORS issues in headless setups.
// Dynamic import() enforces CORS; a script tag does not.
if (burst.goals?.active?.some(goal => !goal.page_url || goal.page_url === '' || goal.page_url === burst.options.pageUrl)) {
  const script = document.createElement('script');
  script.id = 'burst-goals-js';
  script.async = true;
  script.src = burst.goals.scriptUrl;
  document.head.appendChild(script);
}

burst.getGoalsData = function () {
  return {
    completed_goals: burst.goals?.completed || [],
  };
};
