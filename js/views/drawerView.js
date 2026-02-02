/**
 * @file Drawer View - Main controller for sidebar drawer display and content
 * @module core/js/views/drawerView
 * @description View managing the drawer sidebar with two operational modes: drawer list showing
 * registered items via {@link DrawerItemView} or custom view content. Handles positioning,
 * animations, accessibility, and lifecycle management.
 *
 * **Operational Modes:**
 * 1. **Drawer Mode** - Shows {@link DrawerItemView} instances from collection
 * 2. **Custom Mode** - Shows arbitrary view/HTML with optional back button
 *
 * **Display Behavior:**
 * - Uses `<dialog>` element for semantic HTML
 * - Position: left/right/auto (with RTL support)
 * - Animated entrance/exit via CSS transitions
 * - Backdrop shadow coordination
 * - Keyboard support (Escape to close)
 * - Click outside to close
 * - Scroll locking while open
 * - Auto-focus management
 *
 * **Configuration** (via `Adapt.config._drawer`):
 * - `_position` - 'left', 'right', 'auto' (default: 'auto')
 * - `_duration` - Animation duration in ms (default: 400)
 * - `_showEasing` - Show easing function (default: 'easeOutQuart')
 * - `_hideEasing` - Hide easing function (default: 'easeInQuart')
 *
 * **Position Logic:**
 * - If custom position provided AND global is 'auto' AND RTL: flip left↔right
 * - Else if global is not 'auto': use global position
 * - Else: use provided position
 *
 * **Public Events Triggered:**
 * - `drawer:opened` - Drawer opened (any mode)
 * - `drawer:openedItemView` - Drawer shown
 * - `drawer:openedCustomView` - Custom view shown
 * - `drawer:empty` - Drawer content cleared
 * - `drawer:closed` - Drawer closed
 * - `drawer:noItems` - No drawer items in collection
 *
 * **Important:** Created internally by {@link module:core/js/drawer}. Use drawer service API, not direct instantiation.
 */

import Adapt from 'core/js/adapt';
import shadow from '../shadow';
import a11y from 'core/js/a11y';
import DrawerItemView from 'core/js/views/drawerItemView';
import Backbone from 'backbone';
import {
  transitionNextFrame,
  transitionsEnded
} from '../transitions';
import logging from '../logging';

/**
 * @class DrawerView
 * @classdesc Main drawer controller managing display, positioning, and content rendering.
 * Lifecycle: Created → Positioned → Animated in → User interaction → Animated out → Removed
 * @extends {Backbone.View}
 */
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

  get config () {
    return Adapt.config.get('_drawer');
  }

  setupEventListeners() {
    this.onKeyDown = this.onKeyDown.bind(this);
    $(window).on('keydown', this.onKeyDown);
    this.el.addEventListener('mousedown', this.onShadowClicked, { capture: true });
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

  /**
   * Sets drawer position (left/right) with RTL and global config support.
   * Complex resolution: custom position + auto mode + RTL = flipped position.
   * @param {string} [position] - Desired position ('left'|'right', null uses global config)
   * @private
   * @example
   * this.setDrawerPosition('right');
   * this.setDrawerPosition(null);
   */
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

  /**
   * Opens drawer with custom view content.
   * Called by {@link module:core/js/drawer#openCustomView}.
   * @param {Backbone.View|jQuery|HTMLElement|string} view - View instance or HTML content
   * @param {boolean} [hasBackButton=true] - Show back button to return to drawer.
   * @param {string} [position] - Override drawer position ('left'|'right')
   * @fires drawer:empty
   * @fires drawer:opened
   * @fires drawer:openedCustomView
   * @example
   * this.openCustomView(new ResourcesView(), true, 'right');
   * this.openCustomView($('<div>Content</div>'), false);
   */
  openCustomView(view, hasBackButton = true, position) {
    this.$('.js-drawer-holder').removeAttr('role');
    this._hasBackButton = hasBackButton;
    this._isCustomViewVisible = true;
    this._customView = view;
    Adapt.trigger('drawer:empty');
    this.showDrawer(null, position);
    this.$('.drawer__holder').html(view instanceof Backbone.View ? view.$el : view);
  }

  /**
   * Checks if drawer has drawer items and updates drawer button visibility.
   * Directly manipulates drawer button DOM (couples to toolbar implementation).
   * @fires drawer:noItems
   * @private
   */
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

  /**
   * Checks if drawer is open showing drawer.
   * Returns false if showing custom view or closed.
   * @returns {boolean} True if visible showing drawer (not custom view)
   */
  get isOpen() {
    return (this._isVisible && this._isCustomViewVisible === false);
  }

  /**
   * Opens and displays the drawer with animation.
   * Handles both drawer mode and custom view mode.
   * @async
   * @param {boolean} [emptyDrawer] - True for drawer mode, false/null for custom mode
   * @param {string} [position=null] - Override drawer position
   * @fires drawer:opened
   * @fires drawer:openedItemView
   * @fires drawer:openedCustomView
   * @fires drawer:empty
   * @example
   * await this.showDrawer(true);
   * await this.showDrawer(null, 'right');
   */
  async showDrawer(emptyDrawer, position = null) {
    shadow.show();
    this.setDrawerPosition(position);
    this.$el
      .removeClass('u-display-none')
      .attr('aria-hidden', 'false');
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
    Adapt.trigger('drawer:opened');

    this.$el.addClass('anim-show-before');
    // focus on first tabbable element in drawer
    a11y.focusFirst(this.$el, { defer: true });
    await transitionNextFrame();
    this.$el.addClass('anim-show-after');
    await transitionsEnded(this.$el);

  }

  /**
   * Clears drawer content container.
   * @private
   * @example
   * this.emptyDrawer();
   * Adapt.trigger('drawer:empty');
   */
  emptyDrawer() {
    this.$('.drawer__holder').empty();
  }

  /**
   * Renders drawer items from collection.
   * Creates {@link DrawerItemView} for each model.
   * Sets ARIA role='list' if multiple items.
   * @fires drawer:empty
   * @private
   * @example
   * this.renderItems();
   * // Triggers drawer:empty and populates drawer with DrawerItemView instances
   */
  renderItems() {
    Adapt.trigger('drawer:empty');
    this.emptyDrawer();
    const isList = (this.collection.length > 1);
    if (isList) this.$('.js-drawer-holder').attr('role', 'list');
    else this.$('.js-drawer-holder').removeAttr('role');
    this.collection.forEach(model => new DrawerItemView({ model }));
  }

  /**
   * Closes and hides the drawer with animation.
   * Can force immediate close (skip animation).
   * @async
   * @param {jQuery} [$toElement] - Element to focus after closing
   * @param {Object} [options] - Close options
   * @param {boolean} [options.force=false] - Skip animation, close immediately
   * @fires drawer:closed
   * @example
   * await this.hideDrawer();
   * await this.hideDrawer($('.js-nav-home-btn'), { force: true });
   */
  async hideDrawer($toElement, {
    force = false // close the drawer immediately
  } = {}) {
    if (!this._isVisible) return;
    this._useMenuPosition = false;

    // make sure that the HTMLDialogElement.close in a11y.popupClosed() does not hide the dialog
    this.$el.css('display', 'block');
    a11y.popupClosed($toElement);

    this._isCustomViewVisible = false;
    shadow.hide();

    this.$el.addClass('anim-hide-before');
    if (!force) await transitionNextFrame();
    this.$el.addClass('anim-hide-after');
    if (!force) await transitionsEnded(this.$el);

    this._customView = null;
    Adapt.trigger('drawer:closed');

    this._isVisible = false;
    a11y.scrollEnable('body');
    this.$('.js-drawer-holder').removeAttr('role');

    this.$el.removeClass('anim-show-before anim-show-after anim-hide-before anim-hide-after');

    this.$el
      .removeAttr('style')
      .addClass('u-display-none')
      .attr('aria-hidden', 'true');
    this.setDrawerPosition(this._globalDrawerPosition);
  }

  /**
   * Cleanup when view is removed.
   * Forces drawer closed, removes event listeners, resets collection.
   * @fires drawer:empty
   * @example
   * drawerView.remove();
   */
  remove() {
    this.hideDrawer(null, { force: true });
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
