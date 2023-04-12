import Backbone from 'backbone';
import Adapt from 'core/js/adapt';

export default class TooltipItemModel extends Backbone.Model {

  defaults() {
    return {
      ...Adapt.course.get('_tooltips') || {},
      _id: null,
      _isEnabled: true,
      _classes: '',
      disabledText: '{{text}}',
      text: ''
    };
  }
}
