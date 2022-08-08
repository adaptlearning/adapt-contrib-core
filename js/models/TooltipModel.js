import Backbone from 'backbone';

export default class TooltipModel extends Backbone.Model {

  defaults() {
    return {
      _id: null.
      _isEnabled: true,
      text: ''
    };
  }
}
