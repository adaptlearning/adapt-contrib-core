/**
 * @file Notification View Controller - Main notification system controller
 * @module core/js/views/notifyView
 * @description Central controller for the notification system. Manages all notification types
 * (popup, alert, prompt, push) and their display lifecycle. Coordinates between models,
 * views, and collections to provide a unified notification API.
 *
 * **Notification Types:**
 * - **popup**: Modal overlay with custom content
 * - **alert**: Modal with title, body, and confirm button
 * - **prompt**: Modal with title, body, and multiple action buttons
 * - **push**: Non-blocking notification in top-right corner (max 2 visible)
 * - **a11y-push**: Screen reader announcement (invisible)
 *
 * **Integration Points:**
 *   - {@link module:core/js/models/notifyModel} - Notification data
 *   - {@link module:core/js/views/notifyPopupView} - Modal rendering
 *   - {@link module:core/js/views/notifyPushView} - Push rendering
 *   - {@link module:core/js/collections/notifyPushCollection} - Push queue management
 *   - {@link module:core/js/a11y} - Accessibility coordination
 */

import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';
import NotifyPushCollection from 'core/js/collections/notifyPushCollection';
import NotifyPopupView from 'core/js/views/notifyPopupView';
import NotifyModel from 'core/js/models/notifyModel';
import a11y from '../a11y';

/**
 * @class NotifyView
 * @classdesc Modal notifications stack (only topmost closeable). Push notifications queue (max 2 visible).
 * @extends {Backbone.View}
 */
export default class NotifyView extends Backbone.View {

  className() {
    return 'notify__container';
  }

  initialize() {
    this._stack = [];

    this.notifyPushes = new NotifyPushCollection();

    this.listenTo(Adapt, {
      'app:dataReady': this.onDataReady,
      'notify:popup': this._deprecated.bind(this, 'popup'),
      'notify:alert': this._deprecated.bind(this, 'alert'),
      'notify:prompt': this._deprecated.bind(this, 'prompt'),
      'notify:push': this._deprecated.bind(this, 'push')
    });
    this.render();
  }

  onDataReady() {
    const notifyDuration = Adapt.config.get('_notify')?._duration ?? 400;
    document.documentElement.style.setProperty('--adapt-notify-duration', `${notifyDuration}ms`);
  }

  /**
   * Gets the current modal notification stack.
   * @returns {NotifyPopupView[]} Array of open modal notifications
   */
  get stack() {
    return this._stack;
  }

  /**
   * Checks if any modal notifications are currently open.
   * @returns {boolean} True if one or more modals are open
   * @example
   * if (notify.isOpen) {
   *   return;
   * }
   */
  get isOpen() {
    return (this.stack.length > 0);
  }

  /**
   * Handles deprecated event-based notification API.
   * Logs deprecation warning and delegates to new API.
   * @param {string} type - Notification type (popup/alert/prompt/push)
   * @param {Object} notifyObject - Notification options
   * @returns {NotifyModel|NotifyPopupView} Created notification instance
   * @deprecated Use `notify.popup()`, `notify.alert()`, etc. directly
   * @private
   */
  _deprecated(type, notifyObject) {
    logging.deprecated(`NOTIFY DEPRECATED: Adapt.trigger('notify:${type}', notifyObject); is no longer supported, please use notify.${type}(notifyObject);`);
    return this.create(notifyObject, { _type: type });
  }

  render() {
    const notifyTemplate = Handlebars.templates.notify;
    this.$el.html(notifyTemplate());
    this.$el.appendTo('body');
  }

  /**
   * Creates a notification instance of the specified type.
   * Central factory method for all notification types.
   * @param {Object} notifyObject - Notification configuration options
   * @param {string} notifyObject.title - Notification title
   * @param {string} notifyObject.body - Notification body text/HTML
   * @param {string} [notifyObject._classes] - Additional CSS classes
   * @param {Object} defaults - Default options to merge with notifyObject
   * @param {string} defaults._type - Notification type (popup/alert/prompt/push/a11y-push)
   * @returns {NotifyModel|NotifyPopupView} Created notification instance
   * @private
   */
  create(notifyObject, defaults) {
    notifyObject = _.defaults({}, notifyObject, defaults, {
      _type: 'popup',
      _shouldRenderId: false,
      _isCancellable: true,
      _showCloseButton: true,
      _closeOnShadowClick: true
    });

    if (notifyObject._type === 'a11y-push') notifyObject._showCloseButton = false;

    switch (notifyObject._type) {
      case 'a11y-push':
      case 'push': {
        const model = new NotifyModel(notifyObject);
        this.notifyPushes.push(model);
        return model;
      }
    }

    return new NotifyPopupView({
      model: new NotifyModel(notifyObject),
      notify: this
    });
  }

  /**
   * Creates a 'popup' notify - a modal overlay with custom content.
   * @param {Object} notifyObject - Configuration object for the popup
   * @param {string} notifyObject.title - Title of the popup
   * @param {string} notifyObject.body - Body content of the popup (HTML supported)
   * @param {boolean} [notifyObject._showCloseButton=true] - If set to `false` the popup will not have a close button. The learner will still be able to dismiss the popup by clicking outside of it or by pressing the Esc key. This setting is typically used mainly for popups that have a subview (where the subview contains the close button)
   * @param {boolean} [notifyObject._isCancellable=true] - If set to `false` the learner will not be able to close the popup - use with caution!
   * @param {boolean} [notifyObject._closeOnShadowClick=true] - Whether clicking outside popup closes it
   * @param {string} [notifyObject._classes] - A class name or (space separated) list of class names you'd like to be applied to the popup's `<div>`. Use this for styling and custom CSS targeting
   * @param {Backbone.View} [notifyObject._view] - Subview to display in the popup instead of the standard view. Inject a Backbone.View instance for custom content rendering
   * @param {Object} [notifyObject._attributes] - HTML attributes to apply to popup element
   * @param {string} [notifyObject._id] - Content ID to auto-render (when `_shouldRenderId` is true)
   * @param {boolean} [notifyObject._shouldRenderId=false] - Auto-render content model by ID
   * @returns {NotifyPopupView} The created popup view instance
   * @example
   * import notify from 'core/js/notify';
   *
   * notify.popup({
   *   title: 'Information',
   *   body: '<p>This is important information.</p>'
   * });
   *
   * notify.popup({
   *   title: 'Warning',
   *   body: 'Please review before proceeding.',
   *   _classes: 'warning-popup'
   * });
   *
   * notify.popup({
   *   title: 'Custom Content',
   *   _view: new MyCustomView()
   * });
   */
  popup(notifyObject) {
    return this.create(notifyObject, { _type: 'popup' });
  }

  /**
   * Creates an 'alert' notify popup - a modal with a confirm button and optional callback.
   * @param {Object} notifyObject - Configuration object for the alert popup
   * @param {string} notifyObject.title - Title of the alert popup
   * @param {string} notifyObject.body - Body content of the alert popup
   * @param {string} notifyObject.confirmText - Label for the popup confirm button
   * @param {boolean} [notifyObject._isCancellable=true] - If set to `false` only the confirm button can be used to dismiss/close the popup
   * @param {boolean} [notifyObject._showIcon=false] - If set to `true` an 'alert' icon will be displayed in the popup
   * @param {string} [notifyObject._callbackEvent] - Event to trigger when the confirm button is clicked
   * @param {string} [notifyObject._classes] - A class name or (space separated) list of class names you'd like to be applied to the popup's `<div>`
   * @param {Backbone.View} [notifyObject._view] - Subview to display in the popup instead of the standard view
   * @returns {NotifyPopupView} The created alert view instance
   * @example
   * import notify from 'core/js/notify';
   *
   * notify.alert({
   *   title: 'Complete',
   *   body: 'You have finished this section.',
   *   confirmText: 'Continue'
   * });
   */
  alert(notifyObject) {
    return this.create(notifyObject, { _type: 'alert' });
  }

  /**
   * Creates a 'prompt dialog' notify popup - a modal with multiple custom action buttons.
   * @param {Object} notifyObject - Configuration object for the prompt dialog
   * @param {string} notifyObject.title - Title of the prompt
   * @param {string} notifyObject.body - Body content of the prompt
   * @param {Object[]} notifyObject._prompts - Array of objects that each define a button (and associated callback event) that you want shown in the prompt
   * @param {string} notifyObject._prompts[].promptText - Label for this button
   * @param {string} notifyObject._prompts[]._callbackEvent - Event to be triggered when this button is clicked
   * @param {boolean} [notifyObject._isCancellable=true] - If set to `false` only the action buttons can be used to dismiss/close the prompt
   * @param {boolean} [notifyObject._showIcon=true] - If set to `true` a 'query' icon will be displayed in the popup
   * @param {string} [notifyObject._callbackEvent] - Event to trigger when the confirm button is clicked (deprecated - use _prompts)
   * @param {string} [notifyObject._classes] - A class name or (space separated) list of class names you'd like to be applied to the popup's `<div>`
   * @param {Backbone.View} [notifyObject._view] - Subview to display in the popup instead of the standard view
   * @returns {NotifyPopupView} The created prompt view instance
   * @example
   * import notify from 'core/js/notify';
   *
   * notify.prompt({
   *   title: 'Choose an Option',
   *   body: 'How would you like to proceed?',
   *   _prompts: [
   *     {
   *       promptText: 'Option 1',
   *       _callbackEvent: 'pluginName:option1'
   *     },
   *     {
   *       promptText: 'Option 2',
   *       _callbackEvent: 'pluginName:option2'
   *     }
   *   ],
   *   _showIcon: true
   * });
   */
  prompt(notifyObject) {
    return this.create(notifyObject, { _type: 'prompt' });
  }

  /**
   * Creates a 'push notification' - a non-blocking notification in the top-right corner.
   * Push notifications auto-close after a timeout and up to 2 can be shown simultaneously.
   * @param {Object} notifyObject - Configuration object for the push notification
   * @param {string} notifyObject.title - Title of the push notification
   * @param {string} notifyObject.body - Body content of the push notification
   * @param {number} [notifyObject._timeout=3000] - Length of time (in milliseconds) the notification should be displayed before automatically fading away
   * @param {number} [notifyObject._delay=0] - Delay (in milliseconds) before displaying the notification. Useful for showing notifications after a specific user action completes
   * @param {string} [notifyObject._callbackEvent] - Event to be triggered if the learner clicks on the push notification (not triggered if they use the close button)
   * @param {string} [notifyObject._classes] - A class name or (space separated) list of class names you'd like to be applied to the notification's `<div>`
   * @returns {NotifyModel} The created notification model (queued for display)
   * @example
   * import notify from 'core/js/notify';
   *
   * notify.push({
   *   title: 'Page Complete',
   *   body: 'You have completed this page.',
   *   _timeout: 5000
   * });
   *
   * notify.push({
   *   title: 'Reminder',
   *   body: 'Don't forget to complete the assessment.',
   *   _delay: 10000,
   *   _timeout: 5000
   * });
   */
  push(notifyObject) {
    return this.create(notifyObject, { _type: 'push' });
  }

  /**
   * Creates and waits for an a11y-push notification to be read by screen readers.
   * This creates an invisible notification that announces text to assistive technology.
   * Automatically calculates display duration based on text length (200ms per word + 150ms base + delay buffer).
   * @async
   * @param {string} body - Text to announce to screen readers
   * @returns {Promise<void>} Resolves when the announcement has had time to be read
   * @example
   * import notify from 'core/js/notify';
   *
   * await notify.read('Page navigation complete');
   *
   * await notify.read('Loading content');
   * await notify.read('Content loaded successfully');
   */
  async read (body) {
    // Allow time enough for the message to be read before focusing.
    // Rough estimate: 200ms per word + buffer
    // Delay until 200ms after last focus event
    const timeSinceLastFocus = a11y.timeSinceLastFocus;
    const delayTime = Math.max(200 - timeSinceLastFocus, 0);
    const words = body.split(' ').length;
    const item = this.create({
      _type: 'a11y-push',
      _timeout: (words * 200) + 150,
      _delay: delayTime,
      body
    });
    await item.onClosed();
  }

}
