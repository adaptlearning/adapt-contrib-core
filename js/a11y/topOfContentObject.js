/**
 * @file Top of Content Object - Manages focus target for content object transitions.
 * @module core/js/a11y/topOfContentObject
 * @description Manages a visually hidden element that serves as a focus target when entering
 * new content objects (page or menu). Supports accessibility by providing screen reader users with
 * clear context about page transitions and enabling keyboard navigation to the top of new content.
 */

import Adapt from 'core/js/adapt';

const DEFAULT_TYPE_LABEL = {
  course: 'Main menu',
  menu: 'Sub menu',
  page: 'Page'
};

/**
 * @class TopOfContentObject
 * @classdesc Manages keyboard focus and screen reader announcements when entering
 * new pages or menus. Displays context like "Page Introduction" or "Sub menu Activities"
 * in a visually hidden element at the top of the page.
 * @extends {Backbone.Controller}
 */
export default class TopOfContentObject extends Backbone.Controller {

  /**
   * Sets up event listeners for accessibility readiness and router navigation.
   * When accessibility is ready, creates the top-of-content element. When route
   * location changes, updates the element with the new page/menu information.
   * @param {Object} options - Configuration options
   * @param {Object} options.a11y - The accessibility module instance
   * @returns {void}
   */
  initialize({ a11y }) {
    this.a11y = a11y;
    this.$body = $('body');
    this.listenTo(Adapt, {
      'accessibility:ready': this.createElement,
      'router:location': this.updateElement
    });
  }

  /**
   * Creates a div element with id "a11y-topofcontentobject" that is:
   * - Hidden visually with the "visually-hidden" class
   * - Focusable via tabindex="-1" (programmatically focusable only)
   * - Positioned at the beginning of the page body
   * Only creates the element if accessibility is enabled and popup management is configured.
   * @returns {void}
   */
  createElement() {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    this.$element = $('<div id="a11y-topofcontentobject" tabindex="-1" class="visually-hidden"></div>');
    this.$body.prepend(this.$element);
  }

  /**
   * Updates the top-of-content element with current page/menu information.
   * Extracts the current content model's type and title, normalizes the text for
   * accessibility, and renders the element's content using a Handlebars template
   * from the accessibility configuration. The template typically outputs text like
   * "Page My Page Title" or "Sub menu My Menu Title".
   * Uses global accessibility labels and falls back to DEFAULT_TYPE_LABEL if custom
   * labels are not configured. Only updates if accessibility is enabled and popup
   * management is configured.
   * @param {Object} location - Router location object containing current content model
   * @param {Object} location._currentModel - The current Adapt content model (page, menu, or course)
   * @returns {void}
   * @example
   * // Automatically called when router:location event fires
   * // Updates element text: <div>Page Introduction to Course</div>
   */
  updateElement(location) {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    if (!location._currentModel) return;
    const json = location._currentModel.toJSON();
    json._globals = Adapt.course.get('_globals');
    json.type = this.a11y.normalize(json._globals._accessibility._ariaLabels[json._type] ?? DEFAULT_TYPE_LABEL[json._type]);
    json.displayTitle = this.a11y.normalize(json.displayTitle);
    const template = Handlebars.compile(json._globals._accessibility._ariaLabels.topOfContentObject ?? '{{type}} {{displayTitle}}');
    this.$element.html(template(json));
  }

  /**
   * Sets focus to the top-of-content element.
   * Typically causes screen readers to announce the current page/menu information. Useful
   * for keyboard navigation when entering a new page or menu.
   * Only focuses the element if accessibility is enabled, popup management is configured,
   * and the element is not already focused.
   * @returns {void}
   * @example
   * a11y.topOfContentObject.goto();
   * // Screen reader announces: "Page Introduction to Course"
   */
  goto() {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    if (document.activeElement === this.$element[0]) return;
    this.$element[0].focus();
  }

}
