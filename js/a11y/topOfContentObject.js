import Adapt from 'core/js/adapt';

const DEFAULT_TYPE_LABEL = {
  course: 'Main menu',
  menu: 'Sub menu',
  page: 'Page'
};

/**
 * Add element to focus when entering a new content object
 * @class
 */
export default class TopOfContentObject extends Backbone.Controller {

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
    this.$element = $('<div id="a11y-topofcontentobject" tabindex="-1" class="visually-hidden"></div>');
    this.$body.prepend(this.$element);
  }

  updateElement(location) {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    const json = location._currentModel.toJSON();
    json._globals = Adapt.course.get('_globals');
    json.type = this.a11y.normalize(json._globals._accessibility._ariaLabels[json._type] ?? DEFAULT_TYPE_LABEL[json._type]);
    json.displayTitle = this.a11y.normalize(json.displayTitle);
    const template = Handlebars.compile(json._globals._accessibility._ariaLabels.topOfContentObject ?? '{{type}} {{displayTitle}}');
    this.$element.html(template(json));
  }

  goto() {
    const config = this.a11y.config;
    if (!config._isEnabled || !config._options._isPopupManagementEnabled) return;
    if (document.activeElement === this.$element[0]) return;
    this.$element[0].focus();
  }

}
