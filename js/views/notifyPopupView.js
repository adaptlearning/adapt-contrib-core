/**
 * @file Popup Modal View - Renders popup, alert, and prompt notifications
 * @module core/js/views/notifyPopupView
 * @description View responsible for rendering and managing modal popup notifications
 * displayed in the center of the screen with shadow overlay. Handles three notification
 * types: popup (custom content), alert (single button), and prompt (multiple buttons).
 *
 * **Modal Types:**
 * - **popup**: Custom content view (ComponentView or custom view)
 * - **alert**: Simple notification with OK button and callback
 * - **prompt**: Question with multiple action buttons
 *
 * **Features:**
 * - Stack-based modal management (multiple modals supported)
 * - Focus management and keyboard navigation
 * - Shadow click to close (configurable)
 * - Escape key to cancel (configurable)
 * - Automatic resizing and responsive layout
 * - Scroll locking when modal open
 * - Animation support (can be disabled)
 * - Subview rendering with automatic component lookup
 *
 * **Lifecycle:**
 * 1. Created by NotifyView.create()
 * 2. Rendered with shadow overlay
 * 3. Subview rendered (if specified)
 * 4. Focus moved to first accessible element
 * 5. User interaction or programmatic close
 * 6. Focus restored to previous element
 * 7. View removed from DOM
 *
 * **Known Issues & Improvements:**
 * - **Issue:** Focus restoration - Can fail if original element was removed from DOM
 * - **Issue:** Animation timing - Disabled animation still has CSS transition delay
 * - **Issue:** Resize handling - Excessive resize calculations on every window resize
 * - **Issue:** Memory leak risk - Event listeners not always cleaned up on rapid close
 * - **Enhancement:** Debounce resize handler to reduce calculations
 * - **Enhancement:** Use IntersectionObserver for visibility detection
 * - **Enhancement:** Add `_maxHeight` option to constrain popup size
 * - **Enhancement:** Support `_position` option (top/center/bottom)
 *
 * **Important:** Do NOT manually instantiate with `new NotifyPopupView()`.
 * Views are created internally by {@link NotifyView}. Use `notify.popup()`, `notify.alert()`,
 * or `notify.prompt()` instead.
 */

import Adapt from 'core/js/adapt';
import components from 'core/js/components';
import data from 'core/js/data';
import a11y from 'core/js/a11y';
import AdaptView from 'core/js/views/adaptView';
import Backbone from 'backbone';
import { transitionNextFrame, transitionsEnded } from '../transitions';

/**
 * @class NotifyPopupView
 * @classdesc Stack-based modals (only top closeable). Focus managed (moved on open, restored on close).
 * Created internally by NotifyView - do not instantiate directly.
 * @extends {Backbone.View}
 */
export default class NotifyPopupView extends Backbone.View {

  className() {
    return `notify ${this.model.get('_classes') || ''}`;
  }

  attributes() {
    return this.model.get('_attributes');
  }

  events() {
    return {
      'click .js-notify-btn-alert': 'onAlertButtonClicked',
      'click .js-notify-btn-prompt': 'onPromptButtonClicked',
      'click .js-notify-close-btn': 'onCloseButtonClicked'
    };
  }

  initialize({ notify }) {
    this.notify = notify;
    _.bindAll(this, 'onShadowClicked', 'resetNotifySize', 'onKeyDown');

    this.disableAnimation = Adapt.config.get('_disableAnimation') ?? false;
    this.$el.toggleClass('disable-animation', Boolean(this.disableAnimation));

    this.isOpen = false;

    this.hasOpened = false;

    this.setupEventListeners();
    this.render();
    const dialog = this.$('.notify__popup')[0];
    dialog.addEventListener('mousedown', this.onShadowClicked, { capture: true });
  }

  setupEventListeners() {
    this.listenTo(Adapt, {
      remove: this.closeNotify,
      'notify:resize device:resize': this.resetNotifySize,
      'notify:cancel': this.cancelNotify,
      'notify:close': this.closeNotify
    });
    this.setupEscapeKey();
  }

  setupEscapeKey() {
    $(window).on('keydown', this.onKeyDown);
  }

  /**
   * Handles keydown events for Escape key cancellation.
   * Only triggers if focus is within the popup.
   * @param {jQuery.Event} event - Keyboard event
   * @private
   */
  onKeyDown(event) {
    if (event.which !== 27) return;
    const isFocusInPopup = Boolean($(document.activeElement).closest(this.$el).length);
    if (!isFocusInPopup) return;
    event.preventDefault();
    this.cancelNotify();
  }

  render() {
    const data = this.model.toJSON();
    const template = Handlebars.templates.notifyPopup;
    this.$el.html(template(data)).appendTo('.notify__popup-container');
    this.showNotify();
    return this;
  }

  /**
   * Handles alert button click.
   * Closes popup and triggers callback event specified in model.
   * @param {jQuery.Event} event - Click event
   * @example
   * const view = notify.alert({
   *   title: 'Confirmation',
   *   body: 'Your action was successful',
   *   _callbackEvent: 'action:confirmed'
   * });
   *
   * const onConfirmed = (notifyView) => {
   *   if (notifyView !== view) return;
   *   console.log('User clicked OK');
   *   Adapt.off('action:confirmed', onConfirmed);
   * };
   * Adapt.on('action:confirmed', onConfirmed);
   */
  onAlertButtonClicked(event) {
    event.preventDefault();
    // tab index preservation, notify must close before subsequent callback is triggered
    this.closeNotify();
    Adapt.trigger(this.model.get('_callbackEvent'), this);
  }

  /**
   * Handles prompt button click.
   * Closes popup and triggers event specified in button's `data-event` attribute.
   * @param {jQuery.Event} event - Click event
   * @example
   * const view = notify.prompt({
   *   title: 'Confirm Action',
   *   body: 'Are you sure?',
   *   _prompts: [
   *     { promptText: 'Yes', _callbackEvent: 'action:confirmed' },
   *     { promptText: 'No', _callbackEvent: 'action:cancelled' }
   *   ]
   * });
   *
   * const onConfirmed = (notifyView) => {
   *   if (notifyView !== view) return;
   *   console.log('User clicked Yes');
   *   cleanUp();
   * };
   * const onCancelled = (notifyView) => {
   *   if (notifyView !== view) return;
   *   console.log('User clicked No');
   *   cleanUp();
   * };
   * Adapt.on('action:confirmed', onConfirmed);
   * Adapt.on('action:cancelled', onCancelled);
   * function cleanUp() {
   *   Adapt.off('action:confirmed', onConfirmed);
   *   Adapt.off('action:cancelled', onCancelled);
   * }
   */
  onPromptButtonClicked(event) {
    event.preventDefault();
    // tab index preservation, notify must close before subsequent callback is triggered
    this.closeNotify();
    Adapt.trigger($(event.currentTarget).attr('data-event'), this);
  }

  onCloseButtonClicked(event) {
    event.preventDefault();
    // tab index preservation, notify must close before subsequent callback is triggered
    this.cancelNotify();
  }

  /**
   * Handles clicks on the shadow overlay outside the popup.
   * Closes popup if `_closeOnShadowClick` is true (default).
   * Set `_closeOnShadowClick: false` to prevent closing on shadow click.
   * @param {MouseEvent} event - Native mouse event
   * @private
   */
  onShadowClicked(event) {
    const dialog = this.$('.notify__popup')[0];
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
    if (isInDialog) return;
    event.preventDefault();
    if (this.model.get('_closeOnShadowClick') === false) return;
    this.cancelNotify();
  }

  /**
   * Cancels the notification without triggering callback.
   * Respects `_isCancellable` flag - cannot cancel if false.
   *
   * Triggered by Escape key press or by `Adapt.trigger('notify:cancel')` event.
   * Set `_isCancellable: false` to prevent cancellation.
   *
   * @fires notify:cancelled
   * @example
   * notify.alert({
   *   title: 'Required',
   *   body: 'You must read this',
   *   _isCancellable: false
   * });
   */
  cancelNotify() {
    if (this.model.get('_isCancellable') === false) return;
    // tab index preservation, notify must close before subsequent callback is triggered
    this.closeNotify();
    Adapt.trigger('notify:cancelled', this);
  }

  resetNotifySize() {
    if (!this.hasOpened) return;
    this.resizeNotify();
  }

  /**
   * Recalculates and applies popup dimensions.
   * Makes popup full-screen with scroll if content exceeds viewport height.
   * @private
   */
  resizeNotify() {
    const windowHeight = $(window).height();
    const notifyHeight = this.$('.notify__popup-inner').outerHeight();
    const isFullWindow = (notifyHeight >= windowHeight);
    this.$('.notify__popup').css({
      height: isFullWindow ? '100%' : notifyHeight,
      'overflow-y': isFullWindow ? 'scroll' : '',
      '-webkit-overflow-scrolling': isFullWindow ? 'touch' : ''
    });
  }

  /**
   * Displays the notification with animation.
   * Renders subview, adds to stack, and waits for images to load.
   * @async
   * @fires notify:opened
   * @private
   */
  async showNotify() {
    this.isOpen = true;
    await this.addSubView();
    // Add to the list of open popups
    this.notify.stack.push(this);
    Adapt.trigger('notify:opened', this);
    this.$el.imageready(this.onLoaded.bind(this));
  }

  /**
   * Handles post-load setup after images have loaded.
   * Sets up focus, scroll locking, and animation.
   * @async
   * @private
   */
  async onLoaded() {
    this.hasOpened = true;
    // Allows popup manager to control focus
    a11y.popupOpened(this.$('.notify__popup'));
    a11y.scrollDisable('body');
    $('html').addClass('notify');

    this.$el.addClass('anim-show-before');
    // Set focus to first accessible element
    a11y.focusFirst(this.$('.notify__popup'), { defer: false });
    await transitionNextFrame();
    this.resetNotifySize();
    await transitionNextFrame();
    this.$el.addClass('anim-show-after');
    await transitionsEnded(this.$('.notify__popup, .notify__shadow'));
  }

  /**
   * Renders subview if specified in model.
   *
   * **Supports three patterns:**
   * 1. **Custom view** - Pass Backbone.View via `_view` property
   * 2. **Auto-render component** - Set `_shouldRenderId: true` and provide `_id`
   * 3. **Text-only notification** - Omit `_view` and `_shouldRenderId`
   *
   * @async
   * @private
   * @example
   * notify.popup({
   *   _view: new MyView({ model: myModel })
   * });
   *
   * notify.popup({
   *   _id: 'c-05',
   *   _shouldRenderId: true
   * });
   *
   * notify.alert({
   *   title: 'Hello',
   *   body: 'World'
   * });
   */
  async addSubView() {
    this.subView = this.model.get('_view');
    if (this.model.get('_shouldRenderId') && this.model.get('_id')) {
      // Automatically render the specified id
      const model = data.findById(this.model.get('_id'));
      const View = components.getViewClass(model);
      this.subView = new View({ model });
    }
    if (!this.subView) return;
    this.subView.$el.on('resize', this.resetNotifySize);
    this.$('.notify__content-inner').append(this.subView.$el);
    if (!(this.subView instanceof AdaptView) || this.subView.model.get('_isReady')) return;
    // Wait for the AdaptView subview to be ready
    return new Promise(resolve => {
      const check = (model, value) => {
        if (!value) return;
        this.subView.model.off('change:_isReady', check);
        resolve();
      };
      this.subView.model.on('change:_isReady', check);
    });
  }

  /**
   * Closes the popup notification.
   * Only closes if this is the top-most popup in the stack.
   * Waits for opening animation to complete if necessary.
   *
   * **Note:** This is an internal method. Notifications close automatically when:
   * - User clicks alert/prompt button
   * - User clicks close button
   * - User presses Escape key (if `_isCancellable` is true)
   * - User clicks shadow overlay (if `_closeOnShadowClick` is true)
   *
   * @private
   */
  closeNotify() {
    // Make sure that only the top most notify is closed
    const stackItem = this.notify.stack[this.notify.stack.length - 1];
    if (this !== stackItem) return;
    this.notify.stack.pop();
    // Prevent from being invoked multiple times - see https://github.com/adaptlearning/adapt_framework/issues/1659
    if (!this.isOpen) return;
    this.isOpen = false;
    // If closeNotify is called before showNotify has finished then wait
    // until it's open.
    if (this.hasOpened) {
      this.onCloseReady();
      return;
    }
    this.listenToOnce(Adapt, 'popup:opened', () => {
      // Wait for popup:opened to finish processing
      _.defer(this.onCloseReady.bind(this));
    });
  }

  /**
   * Handles close animation and cleanup.
   * @async
   * @fires notify:closed
   * @private
   */
  async onCloseReady() {
    this.$el.addClass('anim-hide-before');
    await transitionNextFrame();
    this.$el.addClass('anim-hide-after');
    await transitionsEnded(this.$('.notify__popup, .notify__shadow'));

    this.remove();

    a11y.scrollEnable('body');
    $('html').removeClass('notify');
    // Return focus to previous active element
    await a11y.popupClosed();
    // Return reference to the notify view
    Adapt.trigger('notify:closed', this);
  }

  /**
   * Cleanup when view is removed.
   * Removes event listeners and cleans up subview.
   * @param {...*} args - Arguments passed to Backbone's remove method
   */
  remove(...args) {
    this.removeSubView();
    this.el.removeEventListener('mousedown', this.onShadowClicked, { capture: true });
    $(window).off('keydown', this.onKeyDown);
    super.remove(...args);
  }

  /**
   * Removes subview and cleans up nested views.
   * For AdaptView subviews, recursively removes all descendants.
   * @private
   */
  removeSubView() {
    if (!this.subView) return;
    this.subView.$el.off('resize', this.resetNotifySize);
    if (this.subView instanceof AdaptView) {
      // Clear up nested views and models
      const views = [...this.subView.findDescendantViews(), this.subView];
      views.forEach(view => {
        view.model.set('_isReady', false);
        view.remove();
      });
    } else {
      this.subView.remove();
    }
    this.subView = null;
  }

}
