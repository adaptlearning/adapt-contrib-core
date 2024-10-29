import Adapt from 'core/js/adapt';
import shadow from '../shadow';
import a11y from 'core/js/a11y';
import DrawerItemView from 'core/js/views/drawerItemView';
import Backbone from 'backbone';
import {
  transitionNextFrame,
  transitionsEnded
} from '../transitions';

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
      'aria-modal': 'true',
      'aria-labelledby': 'drawer-heading',
      'aria-hidden': 'true',
      'aria-expanded': 'false'
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
    this._globalDrawerPosition = Adapt.config.get('_drawer')?._position ?? 'auto';
    this.drawerDuration = Adapt.config.get('_drawer')?._duration ?? 400;
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.onKeyUp = this.onKeyUp.bind(this);
    $(window).on('keyup', this.onKeyUp);
    this.el.addEventListener('click', this.onShadowClicked, { capture: true });
  }

  onKeyUp(event) {
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
    shadow.show();
    this.setDrawerPosition(position);
    this.$el
      .removeClass('u-display-none')
      .attr('aria-hidden', 'false')
      .attr('aria-expanded', 'true');
    // Only trigger popup:opened if drawer is visible, pass popup manager drawer element
    if (!this._isVisible) {
      a11y.popupOpened(this.$el);
      a11y.scrollDisable('body');
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
    $('.js-nav-drawer-btn').attr('aria-expanded', true);
    Adapt.trigger('drawer:opened');

    this.$el.addClass('anim-show-before');
    await transitionNextFrame();
    this.$el.addClass('anim-show-after');
    await transitionsEnded(this.$el);

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

  async hideDrawer($toElement) {
    if (!this._isVisible) return;
    this._useMenuPosition = false;

    this._isCustomViewVisible = false;
    shadow.hide();

    this.$el.addClass('anim-hide-before');
    await transitionNextFrame();
    this.$el.addClass('anim-hide-after');
    await transitionsEnded(this.$el);

    this.$el.removeClass('anim-show-before anim-show-after anim-hide-before anim-hide-after');

    a11y.popupClosed($toElement);
    this._isVisible = false;
    a11y.scrollEnable('body');

    this.$el
      .removeAttr('style')
      .addClass('u-display-none')
      .attr('aria-hidden', 'true')
      .attr('aria-expanded', 'false');
    this.$('.js-drawer-holder').removeAttr('role');
    this._customView = null;
    $('.js-nav-drawer-btn').attr('aria-expanded', false);
    Adapt.trigger('drawer:closed');
    this.setDrawerPosition(this._globalDrawerPosition);
  }

  remove() {
    this.hideDrawer();
    super.remove();
    $(window).off('keyup', this.onKeyUp);
    Adapt.trigger('drawer:empty');
    this.collection.reset();
  }

}

Object.assign(DrawerView, {
  childContainer: '.js-drawer-holder',
  childView: DrawerItemView
});

export default DrawerView;
