/**
 * Handler to await completion of `CSSTransitions` to be run at point of execution.
 * An optional `transition-property` to await can be specified, else all properties will be included.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Promise}
 */
export async function transitionsEnded($element, property = null) {
  return new Promise(resolve => {
    if (!($element instanceof $)) $element = $($element);
    // only listen to transitions running after execution
    const onRun = () => $element.on('transitioncancel transitionend', onEnd);
    const onEnd = () => {
      if (!hasActiveTransition($element, property)) done(true);
    };
    const done = (didTransition) => {
      $element
        .off('transitionrun', onRun)
        .off('transitioncancel transitionend', onEnd);
      resolve(didTransition);
    };
    $element.on('transitionrun', onRun);
    if (!willTransition($element, property)) done(false);
  });
}

/**
 * Returns all `CSSTransitions` affecting an element.
 * @param {jQuery} $element
 * @returns {Array<CSSTransition>}
 */
export function getTransitions($element) {
  let element = $element;
  if ($element instanceof $) element = element[0];
  return element.getAnimations().filter(animation => animation instanceof CSSTransition);
}

/**
 * Returns whether a `CSSTransition` will be run on an element.
 * An optional `transition-property` can be specified, else all properties will be included.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Boolean}
 */
export function willTransition($element, property = null) {
  // `getAnimations()` only populated with `CSSTransitions` following `transitionrun` - use CSS to know if they will run at time of execution
  const durations = $element.css('transition-duration').split(',').map(duration => parseFloat(duration));
  const properties = $element.css('transition-property').split(',').map(property => property.trim());
  const isAllProperty = property === 'all' || properties[0] === 'all';
  if (!property || isAllProperty) return durations.some(duration => duration > 0);
  const transitionIndex = properties.findIndex(transitionProperty => transitionProperty === property);
  if (transitionIndex === -1) return false;
  // cycle through populated durations as per spec
  const duration = durations[transitionIndex % durations.length];
  return Boolean(duration);
}

/**
 * Returns whether `CSSTransitions` are still active for an element.
 * An optional `transition-property` can be specified, else all properties will be included.
 * @param {jQuery} $element
 * @param {String} property
 * @returns {Boolean}
 */
export function hasActiveTransition($element, property = null) {
  let transitions = getTransitions($element);
  if (property) transitions = transitions.filter(({ transitionProperty }) => transitionProperty === property);
  return Boolean(transitions.length);
}

export default {
  transitionsEnded,
  getTransitions,
  willTransition,
  hasActiveTransition
};
