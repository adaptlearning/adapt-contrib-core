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

  /**
   * Handles new push notification added to collection.
   * Checks if push can be displayed immediately or must be queued.
   * @param {NotifyModel} model - Push notification model
   * @private
   */
  onPushAdded(model) {
    this.checkPushCanShow(model);
  }

  /**
   * Attempts to display a push notification if slot available.
   * Marks push as active and creates view if under concurrent limit.
   * @param {NotifyModel} model - Push notification model to display
   * @private
   */
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

  /**
   * Handles push notification removal.
   * Automatically displays next queued push if available.
   * @param {NotifyPushView} view - Removed push notification view
   * @private
   */
  onRemovePush(view) {
    const inactivePushNotifications = this.where({ _isActive: false });
    if (inactivePushNotifications.length === 0) return;
    this.checkPushCanShow(inactivePushNotifications[0]);
  }

}
