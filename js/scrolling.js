import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';
import router from 'core/js/router';

/**
 * This allows Adapt to:
 * - Be embedded in iframes on ios
 *   ios iframes assume the content height and no scrolling
 *   https://blog.codepen.io/2017/12/01/stupid-iframes-stupid-ios/
 *   https://stackoverflow.com/questions/23083462/how-to-get-an-iframe-to-be-responsive-in-ios-safari
 * - Prevent the 44px click region occluding trickle at the bottom of
 *   ios safari by keeping the controls always visible
 *   https://github.com/adaptlearning/adapt-contrib-trickle/issues/132
 *   https://www.eventbrite.com/engineering/mobile-safari-why/
 */
class Scrolling extends Backbone.Controller {

  initialize() {
    this.scrollTo = this.scrollTo.bind(this);
    this.$html = $('html');
    this.isLegacyScrolling = true;
    Adapt.once('configModel:dataLoaded', this._loadConfig.bind(this));
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
    this._updateScrollbarWidth();
    // Update the scrollbar width on zooming/resize as it changes in chrome and firefox
    this.listenTo(Adapt, 'device:resize', this._updateScrollbarWidth);
  }

  _addStyling() {
    this.$html.addClass('adapt-scrolling');
  }

  /**
   * Set the --adapt-scrollbar-width css variable to be used to offset the navigation bar
   * width against the body scrollbar
   * The body scrollbar does not constrain the navigation width in the same way the viewport
   * scrollbar does
   * IE11 always defaults to 18px
   * Chrome and firefox change based on zooming
   * Safari has floating scrollbars, so 0px
   */
  _updateScrollbarWidth() {
    const $tester = $('<div class="outer" style="overflow:scroll; visibility: hidden; position:fixed; top: 0; left: 0;"><div class="inner"> </div></div>"');
    $('body').append($tester);
    const scrollBarWidth = $tester.outerWidth() - $tester.find('.inner').outerWidth();
    $tester.remove();
    const documentStyle = document.documentElement.style;
    documentStyle.setProperty('--adapt-scrollbar-width', `${scrollBarWidth}px`);
  }

  /**
   * Correct scrolling to use the body element rather than the html element or viewport
   */
  _windowScrollFix() {
    /** @type {HTMLDivElement} */
    const body = document.body;
    const html = Adapt.scrolling.$html[0];
    const scrollY = {
      get: () => body.scrollTop,
      set: value => (body.scrollTop = value)
    };
    const scrollX = {
      get: () => body.scrollLeft,
      set: value => (body.scrollLeft = value)
    };
    const scrollHeight = {
      get: () => body.scrollHeight,
      set: value => (body.scrollHeight = value)
    };
    const scrollWidth = {
      get: () => body.scrollWidth,
      set: value => (body.scrollWidth = value)
    };
    // Fix window.scrollY, window.scrollX, window.pageYOffset and window.pageXOffset
    Object.defineProperties(window, {
      scrollY,
      scrollX,
      // Note: jQuery uses pageYOffset and pageXOffset instead of scrollY and scrollX
      pageYOffset: scrollY,
      pageXOffset: scrollX
    });
    // Fix html.scrollHeight and html.scrollWidth
    Object.defineProperties(html, {
      // Note: jQuery animate as used in scrollTo library, uses scrollHeight to determine animation maxiumum
      scrollHeight,
      scrollWidth
    });
    // Fix window.scrollTo
    window.scrollTo = (...args) => {
      const isObject = (args.length === 1 && typeof args[0] === 'object' && args[0] !== null);
      const left = (isObject ? args[0].left : args[0]) ?? null;
      const top = (isObject ? args[0].top : args[1]) ?? null;
      left !== null && (body.scrollLeft = left);
      top !== null && (body.scrollTop = top);
    };
    // Fix MouseEvent.prototype.pageX and MouseEvent.prototype.pageY
    const MouseEvent = window.MouseEvent;
    Object.defineProperties(MouseEvent.prototype, {
      pageX: {
        get: function() { return this.clientX + scrollX.get(); }
      },
      pageY: {
        // Note: MediaElementJS uses event.pageY to work out the mouse position for the volume controls
        get: function() { return this.clientY + scrollY.get(); }
      }
    });
    // Trigger scroll events on window when scrolling
    const $window = $(window);
    $(document.body).on('scroll', () => $window.scroll());
  }

  /**
   * Allows a selector to be passed in and Adapt will scroll to this element. Resolves
   * asynchronously when the element has been navigated/scrolled to.
   * @param {string} selector CSS selector of the Adapt element you want to navigate to e.g. `".co-05"`
   * @param {Object} [settings={}] The settings for the `$.scrollTo` function (See https://github.com/flesler/jquery.scrollTo#settings).
   * @param {Object} [settings.replace=false] Set to `true` if you want to update the URL without creating an entry in the browser's history.
   */
  async scrollTo(selector, settings = {}) {
    logging.deprecated('Adapt.scrollTo and Adapt.scrolling.scrollTo, use router.navigateToElement instead.');
    return router.navigateToElement(selector, settings);
  }

}

const scrolling = new Scrolling();
export default scrolling;
