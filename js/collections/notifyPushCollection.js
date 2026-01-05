/**
 * @file Push Notification Collection - Manages queue of push notifications
 * @module core/js/collections/notifyPushCollection
 * @description Collection managing the queue and display of push notifications.
 * Ensures maximum of 2 push notifications are visible simultaneously.
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
 * - Requires NotifyPushView for rendering
 * - Listens to Adapt global event bus
 * - Expects models to have `_isActive` and `_delay` properties
 *
 * **Known Issues & Improvements:**
 *   - ⚠️ **No queue limit**: Could queue unlimited notifications (memory leak risk)
 *   - ⚠️ **Race condition**: Rapid add/remove can trigger duplicate displays
 *   - ⚠️ **Hardcoded limit**: Max 2 visible is not configurable
 *   - 💡 **Improvement**: Add max queue size with overflow handling
 *   - 💡 **Improvement**: Make visible limit configurable via `_maxVisible` option
 *   - 💡 **Improvement**: Add `clearQueue()` method to dismiss all queued notifications
 *   - 💡 **Improvement**: Return view instance from `showPush()` for external control
 *
 * @example
 * import NotifyPushCollection from 'core/js/collections/notifyPushCollection';
 *
 * const pushes = new NotifyPushCollection();
 *
 * pushes.add(new NotifyModel({
 *   title: 'First',
 *   body: 'First notification',
 *   _timeout: 3000,
 *   _delay: 500  // Optional: wait 500ms before showing
 * }));
 */

import Adapt from 'core/js/adapt';
import NotifyPushView from 'core/js/views/notifyPushView';
import NotifyModel from 'core/js/models/notifyModel';

/**
 * @class NotifyPushCollection
 * @extends {Backbone.Collection}
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
   * @returns {boolean} True if fewer than 2 active notifications
   * @private
   */
  canShowPush() {
    const availablePushNotifications = this.where({ _isActive: true });
    return (availablePushNotifications.length < 2);
  }

  /**
   * Displays a push notification by creating its view.
   * **Side effect:** Creates new NotifyPushView instance.
   * @param {NotifyModel} model - The notification model to display
   * @param {number} [model._delay=0] - Milliseconds to wait before showing
   * @private
   * @example
   * const model = new NotifyModel({
   *   body: 'Delayed message',
   *   _delay: 1000
   * });
   * collection.add(model);
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
