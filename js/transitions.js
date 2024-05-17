import logging from 'core/js/logging';

/**
 * Handler to await completion of active `CSSTransitions`.
 * An optional `transition-property` to await can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {string} [property=null]
 * @returns {Promise}
 */
export async function transitionsEnded($element, property = null) {
  if (!($element instanceof $)) $element = $($element);
  if (!willTransition($element, property)) return false;
  const longestEndTime = getTransitionsLongestEndTime($element, property);
  const buffer = 100;
  const timeoutDuration = longestEndTime + buffer;
  return new Promise(resolve => {
    const onRun = () => clearTimeout(resolveInterval);
    const onEnd = () => {
      if (hasActiveTransition($element, property)) return;
      done(true);
    };
    const done = (didTransition) => {
      clearTimeout(resolveInterval);
      $element
        .off('transitionrun', onRun)
        .off('transitioncancel transitionend', onEnd);
      resolve(didTransition);
    };
    $element.on('transitionrun', onRun);
    $element.on('transitioncancel transitionend', onEnd);
    const resolveInterval = setTimeout(() => {
      logging.warn('transition could/did not run forcing resolution', $element[0]);
      if (hasActiveTransition($element, property)) return;
      done(false);
    }, timeoutDuration);
  });
}

/**
 * Returns the longest end time of the configured transitions
 * @param {jQuery} $element
 * @param {string} [property=null]
 * @returns {number}
 */
export function getTransitionsLongestEndTime($element, property = null) {
  const properties = $element.css('transition-property').split(',').map(property => property.trim());
  const durations = $element.css('transition-duration').split(',').map(duration => parseFloat(duration));
  const delays = $element.css('transition-delay').split(',').map(delay => parseFloat(delay));
  const endTimes = properties.reduce((result, transitionProperty, index) => {
    // cycle through populated timings as per spec
    const duration = durations[index % durations.length];
    const delay = delays[index % delays.length];
    const endTime = duration + delay;
    result[transitionProperty] = endTime;
    return result;
  }, {});
  const isAllProperty = property === 'all' || Boolean(endTimes.all);
  const longestEndTime = (property && !isAllProperty)
    ? endTimes[property]
    : Math.max(...Object.values(endTimes));
  return (longestEndTime ?? 0) * 1000; // Convert to milliseconds
}

/**
 * Returns whether a `CSSTransition` will be run on an element.
 * An optional `transition-property` can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {string} [property=null]
 * @returns {boolean}
 */
export function willTransition($element, property = null) {
  if (hasActiveTransition($element, property)) return true;
  return (getTransitionsLongestEndTime($element, property) > 0);
}

/**
 * Returns whether `CSSTransitions` are still active for an element.
 * An optional `transition-property` can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {string} [property=null]
 * @returns {boolean}
 */
export function hasActiveTransition($element, property = null) {
  let element = $element;
  if (element instanceof $) element = element[0];
  let transitions = element.getAnimations().filter(animation => animation instanceof window.CSSTransition);
  if (property) transitions = transitions.filter(({ transitionProperty }) => transitionProperty === property);
  return Boolean(transitions.length);
}

export default {
  transitionsEnded,
  getTransitionsLongestEndTime,
  willTransition,
  hasActiveTransition
};
