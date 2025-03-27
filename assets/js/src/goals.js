/**
 * Setup event listeners for goals.
 */

let viewportGoals = [];
const burst_goals_setup = () => {

  // loop through goals and remove any that don't match the current path or
  // don't have a path
  for ( let i = 0; i < burst.goals.active.length; i++ ) {
    let goal = burst.goals.active[i];
    if ( goal.url && ( goal.url !== window.location.pathname && '*' !== goal.url ) ) {
      burst.goals.active.splice( i, 1 );
    }
  }

  // loop through all goals and setup event listeners
  for ( let i = 0; i < burst.goals.active.length; i++ ) {
    let goal = burst.goals.active[i];
    switch ( goal.type ) {
      case 'views':
        burst_setup_viewport_tracker( goal );
        break;
      case 'clicks':
      default:
        burst_setup_click_tracker( goal );
        break;
    }
  }

  window.addEventListener( 'scroll', handle_viewport_goals, true );
};

/**
 * Check if any goals are in the viewport.
 */
const handle_viewport_goals = () => {

  // Create a copy of the array to avoid modification during iteration
  [...viewportGoals].forEach((goalData, index) => {
    if (burst_is_element_in_viewport(goalData.element)) {
      burst_goal_triggered(goalData.goal);

      // Remove the goal from the viewportGoals array
      const actualIndex = viewportGoals.findIndex(g => g.goal.ID === goalData.goal.ID);
      if (actualIndex !== -1) {
        viewportGoals.splice(actualIndex, 1);
      }
    }
  });
};

/**
 * Setup a viewport tracker for a goal.
 * @param goal
 */
const burst_setup_viewport_tracker = (goal) => {
  if (0 === goal.attribute_value.length) {
    return;
  }

  let selector = 'id' === goal.attribute ? '#' : '.';
  let elements = document.querySelectorAll(selector + goal.attribute_value);

  for (let i = 0; i < elements.length; i++) {
    let element = elements[i];

    // Check if already in viewport
    if (burst_is_element_in_viewport(element)) {
      burst_goal_triggered(goal);
    } else {
      // Add to our list of elements to monitor
      viewportGoals.push({element, goal});
    }
  }
};

/**
 * Recursive function to check all parents.
 * @param element
 * @return {boolean|boolean|*}
 */
const is_element_truly_visible = ( element ) => {
  if ( ! element ) {
return true;
}

  const style = window.getComputedStyle( element );

  if ( 'none' === style.display || '0' === style.opacity ) {
    return false;
  }

  return is_element_truly_visible( element.parentElement );
};

/**
 * Check if an element is in the viewport.
 * @param element
 * @returns {boolean}
 */
const burst_is_element_in_viewport = ( element ) => {
  if ( ! is_element_truly_visible( element ) ) {
    return false;
  }

  let rect = element.getBoundingClientRect();
  return (
      0 <= rect.top &&
      0 <= rect.left &&
      rect.bottom <=
      ( window.innerHeight || document.documentElement.clientHeight ) && /* or $(window).height() */
      rect.right <= ( window.innerWidth || document.documentElement.clientWidth ) /* or $(window).width() */
  );
};

/**
 * Function to check and trigger a goal when an element is in the viewport.
 * @param element
 * @param goal
 */
const burst_listener_view = ( element, goal ) => {
    if ( burst_is_element_in_viewport( element ) ) {
      burst_goal_triggered( goal );

      // @todo event listener does not get removed
      window.removeEventListener( 'scroll',
          () => burst_listener_view( element, goal ), true );
    }
};

/**
 * Setup a click tracker for a goal.
 * @param goal
 */
const burst_setup_click_tracker = ( goal ) => {
  document.body.addEventListener( 'click', function( event ) {
      burst_recursive_trigger_check( event.target, goal );
  });
};

const burst_recursive_trigger_check = ( target, goal ) => {

  //if there is no attribute value, exit
  if ( 0 === goal.attribute_value.length ) {
    return;
  }

  let selector = 'id' === goal.attribute ? '#' : '.';
  if ( target.matches( selector + goal.attribute_value ) ) {
    burst_goal_triggered( goal );
  } else if ( target.parentElement ) {
    burst_recursive_trigger_check( target.parentElement, goal );
  }
};

/**
 * Trigger a goal and add to the completed goals array.
 * @param goal
 */
const burst_goal_triggered = ( goal ) => {
  // if burst_completed_goals does not contain goal.id, add it
  const goalId = parseInt(goal.ID, 10);
  if ( -1 === burst.goals.completed.indexOf( goalId ) ) {
    burst.goals.completed.push( goalId );
    viewportGoals = viewportGoals.filter( goalData => parseInt(goalData.goal.ID, 10) !== goalId );
  }

  // send update to server
  burst_update_hit( false, true);
};

/**
 * Default export for goals.
 */
export default () => {
  burst_goals_setup();
};
