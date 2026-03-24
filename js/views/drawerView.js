import Adapt from 'core/js/adapt';
import device from 'core/js/device';
import shadow from '../shadow';
import a11y from 'core/js/a11y';
import DrawerItemView from 'core/js/views/drawerItemView';
import Backbone from 'backbone';
import {
  transitionNextFrame,
  transitionsEnded
} from '../transitions';
import logging from '../logging';

class DrawerView extends Backbone.View {

  tagName() {
    return 'dialog';
  }

  className() {
    return [
      'drawer',
      'u-display-none'
    ].filter(Boolean).join(' ');
  }

  attributes() {
    return {
      'aria-labelledby': 'drawer-heading',
      'aria-hidden': 'true'
    };
  }

  events() {
    return {
      'click .drawer__back': 'onBackButtonClicked',
      'click .drawer__close': 'onCloseClicked'
    };
  }

  initialize() {
    _.bindAll(this, 'onShadowClicked');
    this._isVisible = false;
    this.disableAnimation = Adapt.config.get('_disableAnimation') ?? false;
    this.$el.toggleClass('disable-animation', Boolean(this.disableAnimation));
    this._globalDrawerPosition = this.config?._position ?? 'auto';
    this._configMode = this.config?._mode ?? 'overlay';
    this._pushBreakpoint = this.config?._pushBreakpoint ?? 'medium';
    this._startOpen = this.config?._startOpen ?? false;
    this._effectiveMode = this.calculateEffectiveMode();
    this.updateModeAttributes();
    const drawerDuration = this.config?._duration ?? 400;
    let showEasing = this.config?._showEasing || 'easeOutQuart';
    let hideEasing = this.config?._hideEasing || 'easeInQuart';
    showEasing = showEasing.toLowerCase();
    hideEasing = hideEasing.toLowerCase();
    if (showEasing.includes('elastic')) {
      logging.removed('drawer show elastic easing is replaced with quint');
      showEasing = showEasing.replace('elastic', 'quint');
    }
    if (showEasing.includes('bounce')) {
      logging.removed('drawer show bounce easing is replaced with back');
      showEasing = showEasing.replace('bounce', 'back');
    }
    if (hideEasing.includes('elastic')) {
      logging.removed('drawer hide elastic easing is replaced with quint');
      hideEasing = hideEasing.replace('elastic', 'quint');
    }
    if (hideEasing.includes('bounce')) {
      logging.removed('drawer hide bounce easing is replaced with back');
      hideEasing = hideEasing.replace('bounce', 'back');
    }
    const documentElementStyle = document.documentElement.style;
    documentElementStyle.setProperty('--adapt-drawer-duration', `${drawerDuration}ms`);
    documentElementStyle.setProperty('--adapt-drawer-show-easing', `var(--adapt-cubic-bezier-${showEasing})`);
    documentElementStyle.setProperty('--adapt-drawer-hide-easing', `var(--adapt-cubic-bezier-${hideEasing})`);
    this.setupEventListeners();
    this.render();
  }

  calculateEffectiveMode() {
    if (this._configMode !== 'push') return 'overlay';
    return device.isScreenSizeMin(this._pushBreakpoint)
      ? 'push'
      : 'overlay';
  }

  get isPush() {
    return this._effectiveMode === 'push';
  }

  updateModeAttributes() {
    const $html = $('html');
    $html.toggleClass('is-drawer-push', this.isPush);
    this.$el.attr('aria-modal', this.isPush ? 'false' : 'true');
  }

  onDeviceChanged() {
    const previousMode = this._effectiveMode;
    this._effectiveMode = this.calculateEffectiveMode();
    if (previousMode === this._effectiveMode) return;
    this.updateModeAttributes();
    if (this._isVisible) {
      this.hideDrawer(null, { force: true });
      if (this._startOpen && this.isPush) {
        _.defer(() => this.showDrawer(true));
      }
    }
  }

  get config () {
    return Adapt.config.get('_drawer');
  }

  setupEventListeners() {
    this.onKeyDown = this.onKeyDown.bind(this);
    $(window).on('keydown', this.onKeyDown);
    this.el.addEventListener('mousedown', this.onShadowClicked, { capture: true });
    if (this._configMode === 'push') {
      this.listenTo(Adapt, 'device:changed', this.onDeviceChanged);
    }
  }

  onKeyDown(event) {
    if (event.which !== 27) return;
    event.preventDefault();
    this.hideDrawer();
  }

  onShadowClicked(event) {
    const dialog = this.el;
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
    if (isInDialog) return;
    event.preventDefault();
    this.hideDrawer();
  }

  render() {
    const template = Handlebars.templates.drawer;
    this.$el.html(template({ _globals: Adapt.course.get('_globals') }));
    _.defer(this.postRender.bind(this));
    return this;
  }

  postRender() {
    this.checkIfDrawerIsAvailable();
  }

  setDrawerPosition(position) {
    if (this._useMenuPosition) position = null;
    const isGlobalPositionAuto = this._globalDrawerPosition === 'auto';
    const isRTL = Adapt.config.get('_defaultDirection') === 'rtl';
    if (position && isGlobalPositionAuto && isRTL) position = (position === 'left') ? 'right' : 'left';
    if (!isGlobalPositionAuto || !position) position = this._globalDrawerPosition;
    this.$el
      .removeClass(`is-position-${this.drawerPosition}`)
      .addClass(`is-position-${position}`);
    this.drawerPosition = position;
  }

  openCustomView(view, hasBackButton = true, position) {
    this.$('.js-drawer-holder').removeAttr('role');
    this._hasBackButton = hasBackButton;
    this._isCustomViewVisible = true;
    this._customView = view;
    Adapt.trigger('drawer:empty');
    this.showDrawer(null, position);
    this.$('.drawer__holder').html(view instanceof Backbone.View ? view.$el : view);
  }

  checkIfDrawerIsAvailable() {
    const isEmptyDrawer = (this.collection.length === 0);
    $('.js-nav-drawer-btn').toggleClass('u-display-none', isEmptyDrawer);
    if (isEmptyDrawer) {
      Adapt.trigger('drawer:noItems');
    }
  }

  onBackButtonClicked(event) {
    event.preventDefault();
    this.showDrawer(true);
  }

  onCloseClicked(event) {
    event.preventDefault();
    this.hideDrawer();
  }

  get isOpen() {
    return (this._isVisible && this._isCustomViewVisible === false);
  }

  async showDrawer(emptyDrawer, position = null) {
    this._effectiveMode = this.calculateEffectiveMode();
    this.updateModeAttributes();

    if (this.isPush) {
      this.applyPushMargin();
    } else {
      shadow.show();
    }

    this.setDrawerPosition(position);
    this.$el
      .removeClass('u-display-none')
      .attr('aria-hidden', 'false');

    if (!this._isVisible) {
      if (this.isPush) {
        this.el.show();
        a11y.focusFirst(this.$el, { defer: true });
      } else {
        a11y.popupOpened(this.$el);
        a11y.scrollDisable('body');
      }
      this._isVisible = true;
    }

    if (emptyDrawer) {
      this.$('.drawer__back').addClass('u-display-none');
      this._isCustomViewVisible = false;
      this.emptyDrawer();
      if (this.collection.models.length === 1) {
        // This callback triggers openCustomView() and sets
        // _isCustomViewVisible to true, causing toggleDrawer()
        // to re-render the drawer on every toggle button press
        Adapt.trigger(this.collection.models[0].get('eventCallback'));
        // Set _isCustomViewVisible to false to prevent re-rendering
        // the drawer and fix the toggle functionality on toggle button press
        this._isCustomViewVisible = false;
      } else {
        this._useMenuPosition = true;
        this.renderItems();
        Adapt.trigger('drawer:openedItemView');
      }
    } else {
      const hideDrawerBackButton = (!this._hasBackButton || this.collection.models.length <= 1);
      this.$('.drawer__back').toggleClass('u-display-none', hideDrawerBackButton);
      Adapt.trigger('drawer:openedCustomView');
    }

    $('.js-drawer-holder').scrollTop(0);
    Adapt.trigger('drawer:opened');

    this.$el.addClass('anim-show-before');
    if (!this.isPush) a11y.focusFirst(this.$el, { defer: true });
    await transitionNextFrame();
    this.$el.addClass('anim-show-after');
    await transitionsEnded(this.$el);
  }

  applyPushMargin() {
    const prop = (this.drawerPosition === 'left')
      ? 'margin-inline-start'
      : 'margin-inline-end';
    const value = 'var(--adapt-drawer-width, 20rem)';
    $('#wrapper, .nav').css(prop, value);
  }

  removePushMargin() {
    $('#wrapper, .nav').css({
      'margin-inline-start': '',
      'margin-inline-end': ''
    });
  }

  emptyDrawer() {
    this.$('.drawer__holder').empty();
  }

  renderItems() {
    Adapt.trigger('drawer:empty');
    this.emptyDrawer();
    const isList = (this.collection.length > 1);
    if (isList) this.$('.js-drawer-holder').attr('role', 'list');
    else this.$('.js-drawer-holder').removeAttr('role');
    this.collection.forEach(model => new DrawerItemView({ model }));
  }

  async hideDrawer($toElement, {
    force = false // close the drawer immediately
  } = {}) {
    if (!this._isVisible) return;
    this._useMenuPosition = false;

    if (this.isPush) {
      this.removePushMargin();
      if (this.el.open) this.el.close();
    } else {
      // make sure that the HTMLDialogElement.close in a11y.popupClosed() does not hide the dialog
      this.$el.css('display', 'block');
      a11y.popupClosed($toElement);
      shadow.hide();
    }

    this._isCustomViewVisible = false;

    this.$el.addClass('anim-hide-before');
    if (!force) await transitionNextFrame();
    this.$el.addClass('anim-hide-after');
    if (!force) await transitionsEnded(this.$el);

    this._customView = null;
    Adapt.trigger('drawer:closed');

    this._isVisible = false;
    if (!this.isPush) a11y.scrollEnable('body');
    this.$('.js-drawer-holder').removeAttr('role');

    this.$el.removeClass('anim-show-before anim-show-after anim-hide-before anim-hide-after');

    this.$el
      .removeAttr('style')
      .addClass('u-display-none')
      .attr('aria-hidden', 'true');
    this.setDrawerPosition(this._globalDrawerPosition);
  }

  remove() {
    this.hideDrawer(null, { force: true });
    this.removePushMargin();
    $('html').removeClass('is-drawer-push');
    super.remove();
    this.el.removeEventListener('mousedown', this.onShadowClicked, { capture: true });
    $(window).off('keydown', this.onKeyDown);
    Adapt.trigger('drawer:empty');
    this.collection.reset();
  }

}

Object.assign(DrawerView, {
  childContainer: '.js-drawer-holder',
  childView: DrawerItemView
});

export default DrawerView;
