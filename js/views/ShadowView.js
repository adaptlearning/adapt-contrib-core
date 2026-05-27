import Adapt from 'core/js/adapt';
import Backbone from 'backbone';
import { transitionNextFrame, transitionsEnded } from '../transitions';

class ShadowView extends Backbone.View {

  className() {
    return 'shadow js-shadow u-display-none';
  }

  attributes() {
    return {
      id: 'shadow'
    };
  }

  initialize() {
    this._isOpen = false;
    this.disableAnimation = Adapt.config.get('_disableAnimation') ?? false;
    this.$el.toggleClass('disable-animation', Boolean(this.disableAnimation));
    this.render();
  }

  render() {
    const template = Handlebars.templates.shadow;
    this.$el.html(template({ _globals: Adapt.course.get('_globals') }));
    return this;
  }

  get isOpen() {
    return this._isOpen;
  }

  async showShadow() {
    this._isOpen = true;
    this.$el.addClass('anim-show-before');
    await transitionNextFrame();
    this.$el.removeClass('u-display-none');
    await transitionNextFrame();
    this.$el.addClass('anim-show-after');
    await transitionsEnded(this.$el);
  }

  async hideShadow() {
    this._isOpen = false;
    this.$el.addClass('anim-hide-before');
    await transitionNextFrame();
    this.$el.addClass('anim-hide-after');
    await transitionsEnded(this.$el);
    this.$el.addClass('u-display-none');
    await transitionNextFrame();
    this.$el.removeClass('anim-open-before anim-open-after anim-hide-before anim-hide-after');
  }

}

export default ShadowView;
