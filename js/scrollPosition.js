import Adapt from 'core/js/adapt';
import scrolling from 'core/js/scrolling';

class ScrollPosition extends Backbone.Controller {

  initialize() {
    this.$html = $('html');
    this._scrollContainer = null;
    this._isCheckingScroll = false;
    this.checkScrollPosition = this.checkScrollPosition.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.listenToOnce(Adapt, 'configModel:dataLoaded', this.setup);
  }

  setup() {
    this._$scrollContainer = $(scrolling.isLegacyScrolling ? window : document.body);

    this.checkScrollPosition();

    this.listenTo(Adapt, {
      'contentObjectView:ready': this.onContentObjectReady,
      'contentObjectView:preRemove': this.onContentObjectPreRemove
    });
  }

  onContentObjectReady() {
    this._$scrollContainer.on('scroll.scrollPosition', this.onScroll);
    this.checkScrollPosition();
  }

  onContentObjectPreRemove() {
    this._$scrollContainer.off('scroll.scrollPosition');
  }

  onScroll() {
    if (this._isCheckingScroll) return;
    this._isCheckingScroll = true;
    requestAnimationFrame(this.checkScrollPosition);
  }

  checkScrollPosition() {
    this._isCheckingScroll = false;
    this.$html.toggleClass('is-scroll-at-top', this.isAtTop);
  }

  get isAtTop() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const isAtTop = (scrollY === 0);
    return isAtTop;
  }

}

export default new ScrollPosition();
