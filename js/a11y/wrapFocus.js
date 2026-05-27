/**
 * @file Wrap Focus - Manages focus wrapping for keyboard navigation in popups.
 * @module core/js/a11y/wrapFocus
 * @description Prevents tab focus from escaping popup elements by detecting when focus
 * reaches the end of focusable content. Uses guard elements (marked with the
 * focusguard class) to detect when keyboard users try to tab out of the popup,
 * and redirects focus to the top of the accessible content.
 * Supports both click and focus events to handle different browser behaviors
 * and keyboard/mouse navigation patterns.
 */
import Adapt from 'core/js/adapt';

/**
 * @class WrapFocus
 * @classdesc Implements focus wrapping for popups by detecting when focus reaches
 * guard elements at popup boundaries and resetting focus to the top of the document.
 * Improves accessibility by keeping keyboard users within modal popups.
 * @extends {Backbone.Controller}
 */
export default class WrapFocus extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    _.bindAll(this, '_onWrapAround');
    this.listenTo(Adapt, {
      'accessibility:ready': this._attachEventListeners
    });
  }

  /**
   * Attaches click and focus event listeners to focusguard elements.
   * @private
   * @returns {void}
   * @example
   * // Called automatically when accessibility:ready event fires
   * // Listens for click/focus on elements with focusguard class
   */
  _attachEventListeners() {
    const config = this.a11y.config;
    $('body').on('click focus', config._options._focusguard, this._onWrapAround);
  }

  /**
   * Wraps focus around when focus reaches a guard element.
   * Handles click or focus events on focusguard elements by preventing the event
   * and resetting focus to the first focusable element at the top of the document.
   * This keeps keyboard focus contained within the popup or modal dialog.
   * Only executes focus wrapping if focus wrapping is enabled and accessibility
   * is configured. Handles both prevent behavior (stop event propagation and default action).
   * @private
   * @param {Event} event - The click or focus event triggered on a focusguard element
   * @returns {void}
   * @example
   * // User tabs to the end of popup content and reaches guard element
   * // Focus automatically wrapped back to first focusable element in popup
   */
  _onWrapAround(event) {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupWrapFocusEnabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.a11y.focusFirst('body', { defer: false });
  }

}
