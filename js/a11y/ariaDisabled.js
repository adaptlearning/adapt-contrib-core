import Adapt from 'core/js/adapt';

/**
 * Browser aria-disabled element interaction prevention
 * @class
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

  isAriaDisabled($element) {
    // search element and parents for aria-disabled - see https://github.com/adaptlearning/adapt_framework/issues/3097
    // search closest 'for' element for aria-disabled - see https://github.com/adaptlearning/adapt-contrib-core/issues/623
    const $closestFor = $element.closest('[for]');
    const isAriaDisabled = $element.closest('[aria-disabled=true]').length === 1 ||
      ($closestFor.length && $(`#${$closestFor.attr('for')}`).is('[aria-disabled=true]'));
    return isAriaDisabled;
  }

  /**
   * Stop click handling on aria-disabled elements.
   *
   * @param {JQuery.Event} event
   */
  _onClick(event) {
    if (!event.isTrusted) return;
    const $element = $(event.target);
    if (!this.isAriaDisabled($element)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /**
   * Stop enter and space handling on aria-disabled elements.
   *
   * @param {JQuery.Event} event
   */
  _onKeyDown(event) {
    if (!event.isTrusted) return;
    if (!['Enter', ' '].includes(event.key)) return;
    const $element = $(event.target);
    if (!this.isAriaDisabled($element)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

}
