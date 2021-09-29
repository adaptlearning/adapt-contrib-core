import Adapt from 'core/js/adapt';

class Scrolling extends Backbone.Controller {

  initialize() {
    this.$html = null;
    this.$app = null;
    this.isLegacyScrolling = true;
    this._checkApp();
    Adapt.once('configModel:dataLoaded', this._loadConfig.bind(this));
  }

  _checkApp() {
    this.$html = $('html');
    this.$app = $('#app');
    if (this.$app.length) return;
    this.$app = $('<div id="app">');
    $('body').append(this.$app);
    this.$app.append($('#wrapper'));
    Adapt.log.warn('UPDATE - Your html file needs to have #app adding. See https://github.com/adaptlearning/adapt_framework/issues/2168');
  }

  _loadConfig() {
    const config = Adapt.config.get('_scrollingContainer');
    if (!config?._isEnabled) return;
    const limitTo = config._limitToSelector;
    const isIncluded = !limitTo || (this.$html.is(limitTo) || this.$html.hasClass(limitTo));
    if (!isIncluded) return;
    this.isLegacyScrolling = false;
    this._windowScrollFix();
    this._addStyling();
  }

  _addStyling() {
    this.$html.addClass('adapt-scrolling');
  }

  _windowScrollFix() {
    /** @type {HTMLDivElement} */
    const app = Adapt.scrolling.$app[0];
    const html = Adapt.scrolling.$html[0];
    const scrollY = {
      get: () => app.scrollTop,
      set: value => (app.scrollTop = value)
    };
    const scrollX = {
      get: () => app.scrollLeft,
      set: value => (app.scrollLeft = value)
    };
    const scrollHeight = {
      get: () => app.scrollHeight,
      set: value => (app.scrollHeight = value)
    };
    const scrollWidth = {
      get: () => app.scrollWidth,
      set: value => (app.scrollWidth = value)
    };
    // Fix window.scrollY, window.scrollX, window.pageYOffsert and window.pageXOffset
    Object.defineProperties(window, {
      scrollY,
      scrollX,
      pageYOffset: scrollY,
      pageXOffset: scrollX
    });
    // Fix html.scrollHeight and html.scrollWidth
    Object.defineProperties(html, {
      scrollHeight,
      scrollWidth
    });
    // Fix window.scrollTo
    window.scrollTo = (...args) => {
      const isObject = (args.length === 1 && typeof args[0] === 'object' && args[0] !== null);
      const left = (isObject ? args[0].left : args[0]) ?? null;
      const top = (isObject ? args[0].top : args[1]) ?? null;
      left !== null && (app.scrollLeft = left);
      top !== null && (app.scrollTop = top);
    };
    // Fix MouseEvent.prototype.pageX and MouseEvent.prototype.pageY
    const MouseEvent = window.MouseEvent;
    Object.defineProperties(MouseEvent.prototype, {
      pageX: {
        get: function() { return this.clientX + scrollX.get(); }
      },
      pageY: {
        get: function() { return this.clientY + scrollY.get(); }
      }
    });
    // Trigger scroll events on window when scrolling
    const $window = $(window);
    this.$app.on('scroll', () => $window.scroll());
  }

  /**
   * Allows a selector to be passed in and Adapt will scroll to this element. Resolves
   * asynchronously when the element has been navigated/scrolled to.
   * Backend for Adapt.scrollTo
   * @param {string} selector CSS selector of the Adapt element you want to navigate to e.g. `".co-05"`
   * @param {Object} [settings={}] The settings for the `$.scrollTo` function (See https://github.com/flesler/jquery.scrollTo#settings).
   * @param {Object} [settings.replace=false] Set to `true` if you want to update the URL without creating an entry in the browser's history.
   */
  async scrollTo(selector, settings = {}) {
    Adapt.log.deprecated('Adapt.scrollTo and Adapt.scrolling.scrollTo, use Adapt.navigateToElement instead.');
    return Adapt.router.navigateToElement(selector, settings);
  }

}

Adapt.scrolling = new Scrolling();

Adapt.scrollTo = Adapt.scrolling.scrollTo.bind(Adapt.scrolling);

export default Adapt.scrolling;
