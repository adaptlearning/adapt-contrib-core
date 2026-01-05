/**
 * @file Push Notification View - Renders individual push notifications
 * @module core/js/views/notifyPushView
 * @description View responsible for rendering and managing individual push notifications
 * in the top-right corner of the viewport. Handles auto-close timing, positioning,
 * click callbacks, and accessibility.
 *
 * **Display Behavior:**
 * - Appears in top-right corner
 * - Maximum 2 visible simultaneously (managed by {@link NotifyPushCollection})
 * - Auto-closes after timeout
 * - Can be manually closed via close button
 * - Uses `<dialog>` element for semantic HTML
 * - Animated entrance/exit via CSS transitions
 *
 * **Positioning:**
 * - Top notification: below navigation bar + offset
 * - Second notification: below first notification + offset
 * - Automatically repositions when notifications added/removed
 *
 * **Known Issues & Improvements:**
 *   - ⚠️ **Hardcoded positioning**: Assumes navigation bar exists and is fixed height
 *   - ⚠️ **No mobile optimization**: Top-right position may be obscured on mobile
 *   - ⚠️ **Race condition**: updatePushPosition() can be called before render completes
 *   - ⚠️ **No Z-index management**: Multiple notifications can overlap with other UI
 *   - 💡 **Improvement**: Make position configurable (_position: 'top-right' | 'top-left' | 'bottom-right')
 *   - 💡 **Improvement**: Calculate nav height dynamically instead of hardcoding
 *   - 💡 **Improvement**: Add mobile-specific positioning (bottom of screen)
 *   - 💡 **Improvement**: Support `_priority` to control stacking order
 *
 * @example
 * import NotifyPushView from 'core/js/views/notifyPushView';
 * import NotifyModel from 'core/js/models/notifyModel';
 *
 * const model = new NotifyModel({
 *   title: 'Success',
 *   body: 'Your changes have been saved',
 *   _timeout: 5000
 * });
 *
 * const pushView = new NotifyPushView({ model });
 */

import Adapt from 'core/js/adapt';
import a11y from '../a11y';
import {
  transitionsEnded
} from '../transitions';

/**
 * @class NotifyPushView
 * @classdesc Lifecycle: Created → Delayed render → Positioned → Auto-closed → Removed
 * @extends {Backbone.View}
 */
export default class NotifyPushView extends Backbone.View {

  tagName() {
    return 'dialog';
  }

  className() {
    const classes = [
      'notify-push',
      this.model.get('_classes'),
      this.model.get('_type') === 'a11y-push' && 'aria-label'
    ].filter(Boolean).join(' ');
    return classes;
  }

  attributes() {
    return {
      'aria-labelledby': 'notify-push-heading',
      'aria-modal': 'false'
    };
  }

  initialize() {
    _.bindAll(this, 'onKeyDown');
    this.listenTo(Adapt, {
      'notify:pushShown notify:pushRemoved': this.updateIndexPosition,
      remove: this.remove
    });
    this.listenTo(this.model.collection, {
      remove: this.updateIndexPosition,
      'change:_index': this.updatePushPosition
    });
    this.setupEscapeKey();
    this.preRender();
    this.render();
  }

  /**
   * Sets up Escape key listener for keyboard accessibility.
   * Allows users to dismiss push notification with Esc key.
   * @private
   */
  setupEscapeKey() {
    $(window).on('keydown', this.onKeyDown);
  }

  /**
   * Handles keydown events for Escape key dismissal.
   * Only triggers if focus is within the push notification.
   * @param {jQuery.Event} event - Keyboard event
   * @private
   */
  onKeyDown(event) {
    if (event.which !== 27) return;
    const isFocusInPopup = Boolean($(document.activeElement).closest(this.$el).length);
    if (!isFocusInPopup) return;
    event.preventDefault();
    this.closePush();
  }

  events() {
    return {
      'click .js-notify-push-close-btn': 'closePush',
      'click .js-notify-push-inner': 'triggerEvent'
    };
  }

  preRender() {
    this.hasBeenRemoved = false;
  }

  render() {
    const data = this.model.toJSON();
    const template = Handlebars.templates.notifyPush;
    this.$el.html(template(data));

    _.defer(this.postRender.bind(this));

    return this;
  }

  postRender() {
    this.$el[0].open = true;
    this.$el.appendTo('.notify__push-container');
    this.$el.addClass('is-active');

    _.delay(this.closePush.bind(this), this.model.get('_timeout'));

    Adapt.trigger('notify:pushShown');
  }

  /**
   * Closes and removes the push notification.
   * Handles animation, accessibility cleanup, and model removal.
   * Can be triggered by: timeout, close button, Esc key, or notification click.
   * @async
   * @param {jQuery.Event} [event] - Click event if triggered by user interaction
   * @example
   * pushView.closePush();
   *
   * _.delay(() => this.closePush(), this.model.get('_timeout'));
   */
  async closePush(event) {
    if (event) {
      event.preventDefault();
    }

    // Check whether this view has been removed in case called multiple times whilst closing
    if (this.hasBeenRemoved === false) {
      this.hasBeenRemoved = true;
      this.$el.removeClass('is-active');
      await transitionsEnded(this.$el);
      this.$el[0].open = false;
      a11y.gotoPreviousActiveElement();
      this.model.collection.remove(this.model);
      Adapt.trigger('notify:pushRemoved', this);
      this.model.close();
      this.remove();
    }
  }

  /**
   * Triggers the callback event associated with this notification.
   * Called when user clicks the notification body (not the close button).
   * @param {jQuery.Event} event - Click event
   * @example
   * // In notification creation:
   * notify.push({
   *   title: 'New Message',
   *   body: 'Click to view',
   *   _callbackEvent: 'messages:show'
   * });
   *
   * // Handler:
   * Adapt.on('messages:show', () => {
   *   console.log('User clicked notification');
   * });
   */
  triggerEvent(event) {
    Adapt.trigger(this.model.get('_callbackEvent'));
    this.closePush();
  }

  /**
   * Updates position index for all active push notifications.
   * Recalculates and applies index to each active notification.
   * @private
   */
  updateIndexPosition() {
    if (this.hasBeenRemoved) return;
    const models = this.model.collection.models;
    models.forEach((model, index) => {
      if (!model.get('_isActive')) return;
      model.set('_index', index);
      this.updatePushPosition();
    });
  }

  /**
   * Updates the vertical position of this push notification.
   * Positions based on index (0 = top, 1 = below first notification).
   * Takes navigation bar height into account.
   * @private
   */
  updatePushPosition() {
    if (this.hasBeenRemoved) {
      return;
    }

    if (typeof this.model.get('_index') !== 'undefined') {
      const elementHeight = this.$el.height();
      const offset = 20;
      const navigationHeight = $('.nav').height();
      const currentIndex = this.model.get('_index');
      let flippedIndex = (currentIndex === 0) ? 1 : 0;

      if (this.model.collection.where({ _isActive: true }).length === 1) {
        flippedIndex = 0;
      }

      const positionLowerPush = (elementHeight + offset) * flippedIndex + navigationHeight + offset;
      this.$el.css('top', positionLowerPush);
    }
  }

  /**
   * Cleanup when view is removed.
   * Removes global event listeners.
   * @param {...*} args - Arguments passed to Backbone's remove method
   */
  remove(...args) {
    $(window).off('keydown', this.onKeyDown);
    super.remove(...args);
  }
}
