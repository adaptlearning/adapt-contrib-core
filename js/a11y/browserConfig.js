/**
 * @file Browser Configuration - Accessibility browser feature detection
 * @module core/js/a11y/browserConfig
 * @description Handles browser-level accessibility configuration, particularly
 * detecting and responding to user preferences like reduced motion settings.
 * Applies appropriate CSS classes to the document based on browser capabilities
 * and user preferences.
 *
 * **Responsibilities:**
 * - Detects `prefers-reduced-motion` media query preference
 * - Applies `is-prefers-reduced-motion` class to HTML element when enabled
 * - Integrates with the A11y module configuration system
 *
 * @example
 * import BrowserConfig from 'core/js/a11y/browserConfig';
 * const browserConfig = new BrowserConfig({ a11y });
 */

import Adapt from '../adapt';

/**
 * @class BrowserConfig
 * @classdesc Detects browser accessibility preferences and applies CSS class.
 * @extends Backbone.Controller
 */
export default class BrowserConfig extends Backbone.Controller {

  /**
   * Initializes the browser configuration controller.
   * Stores reference to the A11y module and sets up event listeners
   * for accessibility ready state.
   * @param {Object} options - Configuration options
   * @param {Object} options.a11y - Reference to the parent A11y module instance
   */
  initialize({ a11y }) {
    this.a11y = a11y;
    this.listenTo(Adapt, {
      'accessibility:ready': this._onReady
    });
  }

  /**
   * Handles accessibility ready event.
   * @private
   */
  _onReady() {
    if (this.a11y.config._options._isPrefersReducedMotionEnabled) this._enablePrefersReducedMotion();
  }

  /**
   * Enables prefers-reduced-motion detection and applies CSS class.
   * @private
   */
  _enablePrefersReducedMotion() {
    if (!window.matchMedia) return;
    const isEnabledInBrowser = window.matchMedia('(prefers-reduced-motion: reduce');
    $('html').toggleClass('is-prefers-reduced-motion', Boolean(isEnabledInBrowser?.matches));
  }
}
