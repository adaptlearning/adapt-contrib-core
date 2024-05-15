import logging from 'core/js/logging';

/**
 * Handler to await completion of active `CSSTransitions`.
 * An optional `transition-property` to await can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Promise}
 */
export async function transitionsEnded($element, property = null) {
  return new Promise(resolve => {
    if (!($element instanceof $)) $element = $($element);
    const onRun = () => clearTimeout(resolveInterval);
    const onEnd = () => {
      if (!hasActiveTransition($element, property)) done(true);
    };
    const done = (didTransition) => {
      clearTimeout(resolveInterval);
      $element
        .off('transitionrun', onRun)
        .off('transitioncancel transitionend', onEnd);
      resolve(didTransition);
    };
    if (!willTransition($element, property)) return resolve(false);
    $element.on('transitionrun', onRun);
    $element.on('transitioncancel transitionend', onEnd);
    const resolveInterval = setTimeout(() => {
      const element = $element[0];
      const id = element.name || element.id || element.className;
      logging.warn(`transition could/did not run for '${id}', forcing resolution`);
      if (!hasActiveTransition($element, property)) done(false);
    }, getResolutionDuration($element, property));
  });
}

/**
 * Returns all `CSSTransitions` currently affecting an element.
 * @param {jQuery} $element
 * @returns {Array<CSSTransition>}
 */
export function getActiveTransitions($element) {
  let element = $element;
  if (element instanceof $) element = element[0];
  return element.getAnimations().filter(animation => animation instanceof CSSTransition);
}

/**
 * Returns a transition object by evaluating the CSS properties of an element.
 * @param {jQuery} $element
 * @returns {Object}
 */
export function getTransitionsFromCSS($element) {
  const properties = $element.css('transition-property').split(',').map(property => property.trim());
  const durations = $element.css('transition-duration').split(',').map(duration => parseFloat(duration));
  const delays = $element.css('transition-delay').split(',').map(delay => parseFloat(delay));
  return properties.map((transitionProperty, index) => {
    // cycle through populated timings as per spec
    const duration = durations[index % durations.length];
    const delay = delays[index % delays.length];
    const timeToEnd = duration + delay;
    return {
      transitionProperty,
      timeToEnd
    }
  });
}

/**
 * Returns whether a `CSSTransition` will be run on an element.
 * An optional `transition-property` can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Boolean}
 */
export function willTransition($element, property = null) {
  if (hasActiveTransition($element, property)) return true;
  // `getAnimations()` only populated with `CSSTransitions` following `transitionrun` - use CSS to know if they will run at time of execution
  const transitions = getTransitionsFromCSS($element, property);
  const isAllProperty = property === 'all' || transitions[0].transitionProperty === 'all';
  if (!property || isAllProperty) return transitions.some(({ timeToEnd }) => timeToEnd > 0);
  const transition = transitions.find(({ transitionProperty }) => transitionProperty === property);
  return transition?.timeToEnd > 0;
}

/**
 * Returns whether `CSSTransitions` are still active for an element.
 * An optional `transition-property` can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Boolean}
 */
export function hasActiveTransition($element, property = null) {
  let transitions = getActiveTransitions($element);
  if (property) transitions = transitions.filter(({ transitionProperty }) => transitionProperty === property);
  return Boolean(transitions.length);
}

/**
 * Returns the resolution duration, by identifying the transition with the longest `timeToEnd` (`transition-duration` + `transition-delay`).
 * An optional `transition-property` can be specified, else all properties will be evaluated.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Number}
 */
export function getResolutionDuration($element, property = null) {
  let transitions = getTransitionsFromCSS($element, property);
  const isAllProperty = property === 'all' || transitions[0].transitionProperty === 'all';
  if (property && !isAllProperty) transitions = transitions.filter(({ transitionProperty }) => transitionProperty === property);
  const longestTransition = transitions.slice().sort((a, b) => a.timeToEnd - b.timeToEnd).pop();
  const buffer = 100;
  return ((longestTransition?.timeToEnd ?? 0) * 1000) + buffer;
}

export default {
  transitionsEnded,
  getActiveTransitions,
  getTransitionsFromCSS,
  willTransition,
  hasActiveTransition,
  getResolutionDuration
};
