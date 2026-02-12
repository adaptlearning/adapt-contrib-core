/**
 * @file Aria Disabled - Prevents interaction with aria-disabled elements
 * @module core/js/a11y/ariaDisabled
 * @description Intercepts keyboard and click events on elements marked with
 * aria-disabled="true" to prevent their activation. Checks for aria-disabled
 * on associated label 'for' attributes. Only responds to trusted user events.
 */

import Adapt from 'core/js/adapt';

/**
 * @class BrowserFocus
 * @classdesc Prevents activation of elements marked with aria-disabled="true".
 * @extends Backbone.Controller
 * @see https://github.com/adaptlearning/adapt_framework/issues/3097
 * @see https://github.com/adaptlearning/adapt-contrib-core/issues/623
 */
export default class BrowserFocus extends Backbone.Controller {
  initialize({ a11y }) {
    this.a11y = a11y;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onClick = this._onClick.bind(this);
    this.$body = $('body');
    this.listenTo(Adapt, {
      'accessibility:ready': this._attachEventListeners
    });
  }

  _attachEventListeners() {
    // 'Capture' events
    this.$body[0].addEventListener('keydown', this._onKeyDown, true);
    this.$body[0].addEventListener('click', this._onClick, true);
  }

  /**
   * Checks if an element or its associated label is marked as aria-disabled.
   * Searches up the DOM tree for aria-disabled="true" on the element itself
   * or its parents.
   * Checks if the element is an input with a label that has aria-disabled="true".
   * @param {jQuery} $element - The jQuery-wrapped DOM element to check
   * @returns {boolean} True if the element or its label is aria-disabled, false otherwise
   */
  isAriaDisabled($element) {
    // search element and parents for aria-disabled - see https://github.com/adaptlearning/adapt_framework/issues/3097
    // search closest 'for' element for aria-disabled - see https://github.com/adaptlearning/adapt-contrib-core/issues/623
    const $closestFor = $element.closest('[for]');
    const isAriaDisabled = $element.closest('[aria-disabled=true]').length === 1 ||
      ($closestFor.length && $(`#${$closestFor.attr('for')}`).is('[aria-disabled=true]'));
    return isAriaDisabled;
  }

  _onClick(event) {
    if (!event.isTrusted) return;
    const $element = $(event.target);
    if (!this.isAriaDisabled($element)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  _onKeyDown(event) {
    if (!event.isTrusted) return;
    if (!['Enter', ' '].includes(event.key)) return;
    const $element = $(event.target);
    if (!this.isAriaDisabled($element)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

}
