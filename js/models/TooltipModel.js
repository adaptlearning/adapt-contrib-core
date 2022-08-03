import Backbone from 'backbone';

export default class TooltipModel extends Backbone.Model {

  defaults() {
    return {
      text:''
    };
  }
}
