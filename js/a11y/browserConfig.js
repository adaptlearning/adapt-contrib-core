import Adapt from '../adapt';

/**
 * Browser configuration helper.
 * @class
 */
export default class BrowserConfig extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    this.listenTo(Adapt, {
      'accessibility:ready': this._onReady
    });
  }

  _onReady() {
    if (this.a11y.config._options._isPrefersReducedMotionEnabled) this._enablePrefersReducedMotion();
  }

  _enablePrefersReducedMotion() {
    if (!window.matchMedia) return;
    const isEnabledInBrowser = window.matchMedia('(prefers-reduced-motion: reduce');
    $('html').toggleClass('is-prefers-reduced-motion', Boolean(isEnabledInBrowser?.matches));
  }
}
