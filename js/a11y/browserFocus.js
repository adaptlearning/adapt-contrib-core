/**
 * @file Browser Focus - Accessibility focus handling modifications
 * @module core/js/a11y/browserFocus
 * @description Manages browser focus behavior for accessibility compliance.
 * Handles focus movement when elements become disabled, hidden, or removed.
 * Ensures screen readers properly track focus on click interactions.
 *
 * **Responsibilities:**
 * - Moves focus forward when focused element becomes disabled/hidden/removed
 * - Forces focus updates on click for screen reader compatibility
 * - Manages `data-a11y-force-focus` attribute cleanup on blur
 * - Adds click delay for screen reader focus processing when configured
 *
 * @example
 * import BrowserFocus from 'core/js/a11y/browserFocus';
 * const browserFocus = new BrowserFocus({ a11y });
 */
import Adapt from 'core/js/adapt';

/**
 * @class BrowserFocus
 * @classdesc Modifies browser focus behavior for accessibility and screen reader support.
 * @extends Backbone.Controller
 */
export default class BrowserFocus extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    this._onBlur = this._onBlur.bind(this);
    this._onClick = this._onClick.bind(this);
    this.$body = $('body');
    this.listenTo(Adapt, {
      'accessibility:ready': this._attachEventListeners
    });
  }

  /**
   * Attaches blur and click event listeners to the document body.
   * Uses event capturing for click to intercept before bubbling.
   * @private
   */
  _attachEventListeners() {
    this.$body
      .on('blur', '*', this._onBlur)
      .on('blur', this._onBlur);
    // 'Capture' event attachment for click
    this.$body[0].addEventListener('click', this._onClick, true);
  }

  /**
   * Handles blur events to manage focus transitions.
   * Removes `data-a11y-force-focus` attribute when element loses focus,
   * and moves focus to next readable element if the blurred element
   * became disabled, hidden, or was removed from the DOM.
   * @param {jQuery.Event} event - The blur event
   * @private
   */
  _onBlur(event) {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isFocusNextOnDisabled) {
      return;
    }
    const $element = $(event.target);
    if ($element.is('[data-a11y-force-focus]')) {
      $element.removeAttr('tabindex data-a11y-force-focus');
    }
    // From here, only check source elements
    if (event.target !== event.currentTarget) {
      return;
    }
    // Do not auto next if the focus isn't returning to the body or html element
    // or if we're not losing focus
    const isNotBodyHTMLOrLostFocus = (!$(event.relatedTarget).is('body, html') && event.relatedTarget !== null);
    if (isNotBodyHTMLOrLostFocus) {
      return;
    }
    // Check if element is losing focus
    // due to the addition of a disabled class, display none, visibility hidden,
    // or because it has been removed from the DOM
    const isNotDisabledHiddenOrDetached = (!$element.is('[disabled]') && $element.css('display') !== 'none' && $element.css('visibility') !== 'hidden' && $element.parents('html').length);
    if (isNotDisabledHiddenOrDetached) {
      // The element is still available, refocus
      // This can happen when JAWS screen reader on `role="group"` takes enter click
      // when the focus was on the input element
      this._refocusCurrentActiveElement();
      return;
    }
    // Move focus to next readable element
    this.a11y.focusNext($element);
  }

  /**
   * Refocuses the current active element without scrolling.
   * Prevents JAWS screen reader from scrolling when focus is temporarily lost.
   * @private
   */
  _refocusCurrentActiveElement() {
    const element = this.a11y.currentActiveElement;
    if (!element) return;
    this.a11y.focus(element, { preventScroll: true });
  }

  /**
   * Handles click events to force focus updates for screen readers.
   * Ensures `document.activeElement` is updated when clicking tabbable elements.
   * Delay click to allow screen readers to process focus changes.
   * @param {MouseEvent} event - The click event (uses native event for isTrusted check)
   * @private
   */
  _onClick(event) {
    if (!event.isTrusted) return;
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isFocusOnClickEnabled) {
      return;
    }
    const $element = $(event.target);
    const $stack = $([...$element.toArray(), ...$element.parents().toArray()]);
    const $focusable = $stack.filter(config._options._tabbableElements);
    if (!$focusable.length) {
      this._refocusCurrentActiveElement();
      return;
    }
    const $closestFocusable = $element.closest(config._options._tabbableElements);
    // Force focus for screen reader enter / space press
    if ($closestFocusable[0] !== document.activeElement) {
      // Focus on the nearest focusable element if not already with focus
      this.a11y._isForcedFocus = true;
      $closestFocusable[0].focus();
      this.a11y._isForcedFocus = false;
    }
    if (!config._options._isClickDelayedAfterFocusEnabled) return;
    // Add a small delay to each click to allow screen readers to process focus
    const element = $element[0];
    event.preventDefault();
    event.stopImmediatePropagation();
    setTimeout(() => {
      element.focus();
      element.click();
    }, 50);
  }

}
