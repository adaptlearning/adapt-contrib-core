import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import ShadowView from './views/ShadowView';

class Shadow extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart
    });
  }

  onAdaptStart() {
    this._shadowView = new ShadowView();
    this._shadowView.$el.prependTo('body');
  }

  get isOpen() {
    return this._shadowView?.isOpen ?? false;
  }

  async show() {
    return this._shadowView?.showShadow();
  }

  async hide() {
    return this._shadowView?.hideShadow();
  }

  remove() {
    this._shadowView?.remove();
    this._shadowView = null;
  }

}

export default new Shadow();
