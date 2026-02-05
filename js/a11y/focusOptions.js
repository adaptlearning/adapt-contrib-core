/**
 * @file Focus Options - Configuration object for A11y focus methods
 * @module core/js/a11y/focusOptions
 * @description Provides a standardized options container for focus-related methods
 * in the A11y module.
 * Encapsulates scroll prevention and deferred focus settings.
 *
 * @example
 * import FocusOptions from 'core/js/a11y/focusOptions';
 *
 * const options = new FocusOptions({ preventScroll: true, defer: true });
 * a11y.focus(element, options);
 */

/**
 * @class FocusOptions
 * @classdesc Configuration container for A11y focus method options.
 */
export default class FocusOptions {

  /**
   * Creates a FocusOptions instance with normalized default values.
   * @param {Object} [options={}] - Focus configuration options
   * @param {boolean} [options.preventScroll=false] - Prevents browser scrolling to focused element
   * @param {boolean} [options.defer=false] - Defers focus call to allow UI settling
   */
  constructor({
    preventScroll = false,
    defer = false
  } = {}) {
    /**
     * Prevents browser scrolling to focused element.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus|MDN HTMLElement.focus()}
     * @type {boolean}
     */
    this.preventScroll = preventScroll;
    /**
     * Defers the focus call, allowing UI to settle.
     * @type {boolean}
     */
    this.defer = defer;
  }

}
