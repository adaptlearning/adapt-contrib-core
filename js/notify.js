/**
 * @file Notification Service - Global notification system singleton
 * @module core/js/notify
 * @description The Notification Service provides a unified API for displaying notifications,
 * alerts, prompts, and push notifications throughout the framework. This singleton instance
 * manages all notification types and their lifecycles.
 *
 * **Module Responsibility:** Centralized notification management for all user-facing messages
 *
 * **Public API for Plugins:**
 *   - `notify.popup(options)` - Display modal popup
 *   - `notify.alert(options)` - Display alert with confirm button
 *   - `notify.prompt(options)` - Display prompt with custom buttons
 *   - `notify.push(options)` - Display non-blocking push notification
 *   - `notify.read(text)` - Screen reader announcement via a11y-push
 *
 * **Integration Points:**
 *   - {@link module:core/js/views/notifyView} - Main notification view controller
 *   - {@link module:core/js/views/notifyPopupView} - Modal popup renderer
 *   - {@link module:core/js/views/notifyPushView} - Push notification renderer
 *   - {@link module:core/js/a11y} - Accessibility integration
 *
 * **Public Events (plugins can listen to these):**
 *   - `notify:opened` - Modal notification opened
 *   - `notify:closed` - Modal notification closed
 *   - `notify:cancelled` - Modal cancelled by user
 *   - `notify:pushShown` - Push notification displayed
 *   - `notify:pushRemoved` - Push notification removed
 *
 * **Dependencies:**
 *   - {@link module:core/js/views/notifyView} - Core view implementation
 *   - {@link module:core/js/a11y} - Screen reader integration
 *   - Handlebars templates - `notifyPopup`, `notifyPush`
 *
 * **Extraction Viability:** Medium
 *   - Could be extracted to `adapt-contrib-notify` plugin
 *   - Requires: Config integration, a11y coordination, template system access
 *   - Breaking Change Risk: High - Widely used throughout framework and plugins
 *
 * @example
 * import notify from 'core/js/notify';
 *
 * notify.popup({
 *   title: 'Welcome',
 *   body: 'Welcome to the course!'
 * });
 *
 * notify.alert({
 *   title: 'Confirm',
 *   body: 'Are you sure?',
 *   confirmText: 'Yes',
 *   _callbackEvent: 'myPlugin:confirmed'
 * });
 *
 * notify.push({
 *   title: 'New message',
 *   body: 'You have completed this page',
 *   _timeout: 5000
 * });
 *
 * await notify.read('Page navigation complete');
 *
 * notify.popup({
 *   title: 'Warning',
 *   body: 'Check your work',
 *   _classes: 'my-custom-warning'
 * });
 *
 * notify.popup({
 *   title: 'Custom Content',
 *   _view: new MyCustomView({ model: myModel })
 * });
 *
 * const onNotifyClosed = (notifyView) => {
 *   Adapt.off('notify:closed', onNotifyClosed);
 * };
 * Adapt.on('notify:closed', onNotifyClosed);
 */

import NotifyView from 'core/js/views/notifyView';

/**
 * Global notification service singleton instance
 * @type {NotifyView}
 */
const notify = new NotifyView();

export default notify;
