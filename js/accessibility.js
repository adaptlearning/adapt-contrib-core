import Adapt from 'core/js/adapt';
import a11y from 'core/js/a11y';

/**
 * Backwards compatibility `Adapt.accessibility` reroutes to `a11y`
 * with a warning.
 */
Object.defineProperty(Adapt, 'accessibility', {

  get() {
    a11y.log.deprecated('Adapt.accessibility has moved to a11y');
    return a11y;
  }

});
