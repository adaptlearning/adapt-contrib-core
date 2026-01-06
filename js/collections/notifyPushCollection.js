/**
 * @file Push Notification Collection - Manages queue of push notifications
 * @module core/js/collections/notifyPushCollection
 *
 * Collection managing the queue and display of push notifications.
 * Ensures maximum of **2 push notifications** are visible simultaneously.
 *
 * **SINGLETON PATTERN**: Only ONE instance of NotifyPushCollection should exist
 * in the application. Do NOT instantiate this class directly.
 *
 * **Side Effects (Important):**
 * - Adding a model **automatically triggers display logic** (not just storage)
 * - Collection **mutates models** by setting `_isActive: true` when displaying
 * - Models with `_isActive: false` are queued; collection activates them when space available
 * - **Creates {@link NotifyPushView} instances** automatically when displaying (side effect)
 * - Listens to global `notify:pushRemoved` event to activate queued notifications
 *
 * **Queueing Behavior:**
 * - Maximum 2 push notifications visible at once
 * - Additional notifications queued until space available
 * - Automatic positioning (top-right of viewport)
 * - Delayed display via model `_delay` property
 *
 * **Dependencies:**
 * - Requires {@link NotifyPushView} for rendering
 * - Listens to {@link module:core/js/adapt Adapt} global event bus
 * - Expects models to have `_isActive` and `_delay` properties
 *
 * **Known Issues & Improvements:**
 * - **Issue:** Max queue size hardcoded to 2 - should be configurable
 * - **Issue:** No queue overflow handling or limits
 * - **Enhancement:** Add configurable `_maxVisible` option
 * - **Enhancement:** Add `clearQueue()` method to dismiss all queued notifications
 * - **Enhancement:** Return view instance from `showPush()` for external control
 * - **Enhancement:** Handle race conditions when rapid add/remove occurs
 *
 * **Important:** Do NOT manually instantiate with `new NotifyPushCollection()`.
 * The singleton instance is accessed internally via `notify.notifyPushes`.
 * Developers should use `notify.push(options)` instead of `notify.notifyPushes.add(model)`.
 *
 * @see {@link NotifyPushView} for rendering implementation
 */

import Adapt from 'core/js/adapt';
import NotifyPushView from 'core/js/views/notifyPushView';
import NotifyModel from 'core/js/models/notifyModel';

/**
 * @class NotifyPushCollection
 * @extends {Backbone.Collection}
 * @singleton
 *
 * Only **one instance** should exist in the application.
 * Do not use `new NotifyPushCollection()` directly.
 * Access through Adapt's internal notification system.
 */
export default class NotifyPushCollection extends Backbone.Collection {

  initialize() {
    this.model = NotifyModel;
    this.listenTo(this, 'add', this.onPushAdded);
    this.listenTo(Adapt, 'notify:pushRemoved', this.onRemovePush);
  }

  onPushAdded(model) {
    this.checkPushCanShow(model);
  }

  checkPushCanShow(model) {
    if (!this.canShowPush()) return;
    model.set('_isActive', true);
    this.showPush(model);
  }

  /**
   * Determines if another push notification can be shown.
   *
   * **Logic:** Counts active notifications (where `_isActive === true`)
   * and returns `true` if fewer than 2 are currently displayed.
   *
   * @returns {boolean} `true` if fewer than 2 active notifications, `false` otherwise
   * @private
   */
  canShowPush() {
    const availablePushNotifications = this.where({ _isActive: true });
    return (availablePushNotifications.length < 2);
  }

  /**
   * Displays a push notification by creating its view.
   *
   * **Side effect:** Creates new {@link NotifyPushView} instance.
   *
   * **Delay Behavior:**
   * - If `model._delay` is set, waits that many milliseconds before showing
   * - Useful for staggering multiple notifications
   *
   * @param {NotifyModel} model - The notification model to display
   * @param {number} [model._delay=0] - Milliseconds to wait before showing
   * @private
   */
  showPush(model) {
    _.delay(() => {
      new NotifyPushView({
        model
      });
    }, model.get('_delay'));
  }

  onRemovePush(view) {
    const inactivePushNotifications = this.where({ _isActive: false });
    if (inactivePushNotifications.length === 0) return;
    this.checkPushCanShow(inactivePushNotifications[0]);
  }

}
