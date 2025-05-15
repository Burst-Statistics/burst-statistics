/**
 * Setup event listeners for goals.
 */

let viewportGoals = [];
const scrollListeners = new Map();

const burst_goals_setup = () => {
  // Filter out goals that don't match the current path
  burst.goals.active = burst.goals.active.filter(
      (goal) => !goal.url || goal.url === window.location.pathname || goal.url === '*'
  );

  // Loop through goals and setup event listeners
  burst.goals.active.forEach((goal) => {
    if (goal.type === 'views') {
      burst_setup_viewport_tracker(goal);
    } else {
      burst_setup_click_tracker(goal);
    }
  });

  window.addEventListener('scroll', handle_viewport_scroll, true);
};

/**
 * Throttled scroll handler.
 */
let ticking = false;
const handle_viewport_scroll = () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      handle_viewport_goals();
      ticking = false;
    });
    ticking = true;
  }
};

/**
 * Check if any goals are in the viewport.
 */
const handle_viewport_goals = () => {
  [...viewportGoals].forEach((goalData) => {
    if (burst_is_element_in_viewport(goalData.element)) {
      burst_goal_triggered(goalData.goal);
      viewportGoals = viewportGoals.filter(
          (g) => g.goal.ID !== goalData.goal.ID
      );

      // Remove scroll listener if exists
      if (scrollListeners.has(goalData.goal.ID)) {
        window.removeEventListener('scroll', scrollListeners.get(goalData.goal.ID), true);
        scrollListeners.delete(goalData.goal.ID);
      }
    }
  });
};

/**
 * Setup a viewport tracker for a goal.
 * @param goal
 */
const burst_setup_viewport_tracker = (goal) => {
  if (!goal.selector.length) return;

  const elements = document.querySelectorAll(goal.selector);

  elements.forEach((element) => {
    if (burst_is_element_in_viewport(element)) {
      burst_goal_triggered(goal);
    } else {
      viewportGoals.push({ element, goal });
      const listener = () => burst_listener_view(element, goal);
      scrollListeners.set(goal.ID, listener);
      window.addEventListener('scroll', listener, true);
    }
  });
};

/**
 * Check visibility up the parent chain.
 * @param element
 * @return {boolean}
 */
const is_element_truly_visible = (element) => {
  while (element) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.opacity === '0') {
      return false;
    }
    element = element.parentElement;
  }
  return true;
};

/**
 * Check if an element is in the viewport.
 * @param element
 * @returns {boolean}
 */
const burst_is_element_in_viewport = (element) => {
  if (!is_element_truly_visible(element)) return false;
  const rect = element.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
};

/**
 * Function to check and trigger a goal when an element is in the viewport.
 * @param element
 * @param goal
 */
const burst_listener_view = (element, goal) => {
  if (burst_is_element_in_viewport(element)) {
    burst_goal_triggered(goal);

    if (scrollListeners.has(goal.ID)) {
      window.removeEventListener('scroll', scrollListeners.get(goal.ID), true);
      scrollListeners.delete(goal.ID);
    }

    viewportGoals = viewportGoals.filter(
        (g) => g.goal.ID !== goal.ID
    );
  }
};

/**
 * Setup a click tracker for a goal.
 * @param goal
 */
const burst_setup_click_tracker = (goal) => {
  if (!goal.selector.length) return;

  document.body.addEventListener('click', (event) => {
    if (event.target.closest(goal.selector)) {
      burst_goal_triggered(goal);
    }
  });
};

/**
 * Handle message goals.
 *       window.parent.postMessage(
 *         {
 *           type: 'clicks',
 *           selector: '.btn-submit',
 *         },
 *         '*'
 *       );
 *
 * @param data
 */
const handle_burst_message_goal = (data) => {
  burst.goals.active.forEach((goal) => {
    if (
        goal.type === data.type &&
        goal.selector === data.selector
    ) {
      burst_goal_triggered(goal);
    }
  });
};

window.addEventListener('message', (event) => {
  if (
      event.data &&
      event.data.type &&
      event.data.selector
  ) {
    handle_burst_message_goal(event.data);
  }
});

/**
 * Trigger a goal and add to the completed goals array.
 * @param goal
 */
const burst_goal_triggered = (goal) => {
  const goalId = parseInt(goal.ID, 10);
  if (!burst.goals.completed.includes(goalId)) {
    burst.goals.completed.push(goalId);
    viewportGoals = viewportGoals.filter(
        (goalData) => parseInt(goalData.goal.ID, 10) !== goalId
    );
  }
  burst_update_hit(false, true);
};

/**
 * Default export for goals.
 */
export default () => {
  burst_goals_setup();
};
