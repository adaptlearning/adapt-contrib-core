/**
 * @file Notify Model - Data model for popup and push notifications
 * @module core/js/models/notifyModel
 * @description Model representing a single notification (popup or push) with display configuration
 * and lifecycle state. Extends {@link LockingModel} to prevent simultaneous interactions.
 *
 * **Model Properties:**
 * - `_isActive` {boolean} - Whether notification is currently displayed (default: false)
 * - `_showIcon` {boolean} - Whether to show notification icon (default: false)
 * - `_timeout` {number} - Auto-dismiss timeout in milliseconds (default: 3000)
 * - `_delay` {number} - Delay before showing notification in milliseconds (default: 0)
 * - `_hasClosed` {boolean} - Whether notification has been closed (default: false)
 *
 * **Lifecycle Events:**
 * - `closed` - Triggered when notification is closed via {@link close}
 *
 * **Important:** Created by {@link module:core/js/notify} service.
 * Not intended for direct instantiation by plugins.
 */

import LockingModel from 'core/js/models/lockingModel';

/**
 * @class NotifyModel
 * @classdesc Data model for notification configuration and state tracking.
 * @extends {LockingModel}
 */
export default class NotifyModel extends LockingModel {

  defaults() {
    return {
      _isActive: false,
      _showIcon: false,
      _timeout: 3000,
      _delay: 0,
      _hasClosed: false
    };
  }

  /**
   * Closes the notification and triggers cleanup.
   * Idempotent - safe to call multiple times.
   * @fires closed When notification is closed (first call only)
   * @example
   * notifyModel.close();
   */
  close() {
    if (this.get('_hasClosed')) return;
    this.set('_hasClosed', true);
    this.trigger('closed');
  }

  /**
   * Returns a promise that resolves when notification is closed.
   * Useful for waiting on user interaction or timeout completion.
   * @async
   * @returns {Promise<void>} Resolves when notification closes
   */
  async onClosed() {
    if (this.get('_hasClosed')) return;
    return new Promise(resolve => this.once('closed', resolve));
  }

}
