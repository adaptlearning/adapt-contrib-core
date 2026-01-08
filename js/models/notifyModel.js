/**
 * @file Notification Model - Data model for notification instances
 * @module core/js/models/notifyModel
 * @description Model representing a single notification (popup, alert, prompt, or push).
 * Manages notification state, timing, and lifecycle.
 *
 * **Side Effects:**
 * - `close()` can only be called once (idempotent - subsequent calls ignored)
 * - Triggers `'closed'` event when closed
 * - Automatically sets `_hasClosed: true` on close
 *
 * **Important Properties:**
 * - `_isActive` - Whether notification is currently displayed
 * - `_timeout` - Auto-close delay in milliseconds (default: 3000)
 * - `_delay` - Display delay before showing (default: 0)
 * - `_hasClosed` - Tracks if notification already closed
 *
 * **Known Issues & Improvements:**
 * - **Issue:** No validation - accepts any property without schema validation
 * - **Issue:** Silent failures - invalid `_timeout` or `_delay` values don't throw errors
 * - **Enhancement:** Add property validation for `_timeout`/`_delay` (must be numbers >= 0)
 * - **Enhancement:** Add `isActive()` getter method instead of direct property access
 * - **Enhancement:** Support cancellation tokens for `onClosed()` promise
 *
 * **Important:** Do NOT manually instantiate with `new NotifyModel()`.
 * Models are created internally by notify service methods: `notify.push()`, `notify.popup()`,
 * `notify.alert()`, and `notify.prompt()`.
 */

import LockingModel from 'core/js/models/lockingModel';

/**
 * @class NotifyModel
 * @classdesc Lifecycle: Created → Rendered → Displayed → Closed → Removed
 * @extends {module:core/js/models/lockingModel.LockingModel}
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
   * Closes the notification and triggers 'closed' event.
   * **Idempotent:** Can be called multiple times safely (subsequent calls ignored).
   * @fires closed
   * @example
   * notification.close();
   */
  close() {
    if (this.get('_hasClosed')) return;
    this.set('_hasClosed', true);
    this.trigger('closed');
  }

  /**
   * Returns a promise that resolves when the notification is closed.
   * Useful for waiting on notification completion before proceeding.
   * @async
   * @returns {Promise<void>} Resolves when notification closes
   * @example
   * await notification.onClosed();
   * console.log('Notification closed');
   *
   * @example
   * const notif1 = notify.popup({ title: 'First' });
   * await notif1.onClosed();
   * const notif2 = notify.popup({ title: 'Second' });
   * await notif2.onClosed();
   */
  async onClosed() {
    if (this.get('_hasClosed')) return;
    return new Promise(resolve => this.once('closed', resolve));
  }

}
