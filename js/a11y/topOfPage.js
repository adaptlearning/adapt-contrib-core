import Adapt from 'core/js/adapt';

/**
 * Add element to focus when entering a new page
 * @class
 */
export default class TopOfPage extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    this.$body = $('body');
    this.listenTo(Adapt, {
      'accessibility:ready': this.createElement,
      'router:location': this.updateElement
    });
  }

  createElement() {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    this.$element = $('<div id="a11y-topofpage" tabindex="-1" class="visually-hidden"></div>');
    this.$body.prepend(this.$element);
  }

  updateElement(location) {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    const json = location._currentModel.toJSON();
    json._globals = Adapt.course.get('_globals');
    json.heading = this.a11y.normalize(Handlebars.templates.heading(json));
    const template = Handlebars.compile(json._globals._accessibility._ariaLabels.topOfPage || 'Top of page {{a11y.normalize displayTitle}}');
    this.$element.html(template(json));
  }

  goto() {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    this.a11y.focus(this.$element, { preventScroll: false, defer: true });
  }

}
