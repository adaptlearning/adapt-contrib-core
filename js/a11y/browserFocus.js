import Adapt from 'core/js/adapt';

/**
 * Browser modifications to focus handling.
 * @class
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

  _attachEventListeners() {
    this.$body
      .on('blur', '*', this._onBlur)
      .on('blur', this._onBlur);
    // 'Capture' event attachment for click
    this.$body[0].addEventListener('click', this._onClick, true);
  }

  /**
   * When any element in the document receives a blur event,
   * check to see if it needs the `data-a11y-force-focus` attribute removing
   * and check to see if it was blurred because a disabled attribute was added.
   * If a disabled attribute was added, the focus will be moved forward.
   *
   * @param {JQuery.Event} event
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
    if (!$(event.relatedTarget).is('body, html') && event.relatedTarget !== null) {
      return;
    }
    // Check if element losing focus is losing focus
    // due to the addition of a disabled class, display none, visibility hidden,
    // or because it has been removed from the dom
    const isNotDisabledHiddenOrDetached = (!$element.is('[disabled]') && $element.css('display') !== 'none' && $element.css('visibility') !== 'hidden' && $element.parents('html').length);
    if (isNotDisabledHiddenOrDetached) {
      // the element is still available, refocus
      // this can happen when jaws screen reader on role=group takes enter click
      //   when the focus was on the input element
      this._refocusCurrentActiveElement();
      return;
    }
    // Move focus to next readable element
    this.a11y.focusNext($element);
  }

  _refocusCurrentActiveElement() {
    const element = this.a11y.currentActiveElement;
    if (!element) return;
    // refocus on the existing active element to stop jaws from scrolling
    this.a11y.focus(element, { preventScroll: true });
  }

  /**
   * Force focus when clicked on a tabbable element,
   * making sure `document.activeElement` is updated.
   *
   * @param {JQuery.Event} event
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
