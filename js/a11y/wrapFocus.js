import Adapt from 'core/js/adapt';

/**
 * Controller for managing tab wrapping for popups.
 * @class
 */
export default class WrapFocus extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    _.bindAll(this, '_onWrapAround');
    this.listenTo(Adapt, {
      'accessibility:ready': this._attachEventListeners
    });
  }

  _attachEventListeners() {
    const config = this.a11y.config;
    $('body').on('click focus', config._options._focusguard, this._onWrapAround);
  }

  /**
   * If click or focus is received on any element with the focusguard class,
   * loop focus around to the top of the document.
   *
   * @param {JQuery.Event} event
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
