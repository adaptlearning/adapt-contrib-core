import Adapt from 'core/js/adapt';
import _ from 'underscore';
import logging from './logging';
import TooltipView from './views/tooltipView';
import TooltipModel from './models/TooltipModel';
import Backbone from 'backbone';

class TooltipController extends Backbone.Controller {

  initialize() {
    _.bindAll(this, 'onMouseOver', 'onMouseOut');
    this._tooltipData = [];
    this._containerView = new TooltipContainerView();
    this._containerView.$el.appendTo('body');
    this.listenTo(Adapt, 'adapt:preInitialize', this.onAdaptPreInitialize);
  }

  removeListener() {
    $(document).off('mouseover', '[data-tooltip-id]', this.onMouseOver);
  }

  addListener() {
    this.removeListener();
    $(document).on('mouseover', '[data-tooltip-id]', this.onMouseOver);
  }

  getConfig() {
    return Adapt.course.get('_tooltips');
  }

  registerGlobalTooltips() {
    const tooltips = Adapt.course.get('_globals')?._tooltips;
    if (!tooltips) return;
    tooltips.forEach(tooltip => this.register(tooltip));
  }

  getTooltip(id) {
    return this._tooltipData.find(tooltip => tooltip.get('_id') === id);
  }

  register(data) {
    const tooltip = this.getTooltip();
    if (tooltip) {
      logging.warn(`Tooltip with id ${tooltip._id} already registered`);
      return;
    }
    this._tooltipData.push(new TooltipModel(data));
  }

  show(tooltip) {
    this.hide();

    console.log('show tooltip', tooltip.get('_id'));
    this.tooltipsView = new TooltipView({model:tooltip, target:this.$mouseoverEl});
    this.tooltipsView.attach('appendTo', this._containerView.$el);

    if (!this._containerView.$el.is(':last-child')) {
      this._containerView.$el.appendTo('body');
    }
  }

  hide() {
    if (!this.tooltipsView) return;

    console.log('hide tooltip', this.tooltipsView.model.get('_id'));

    if (this.$mouseoverEl[0] === this.tooltipsView.$target[0]) {
      // mouse has left current tooltip target and not entered another
      this.$mouseoverEl = this.$prevMouseoverEl = null;
    }

    this.tooltipsView.$target.off('mouseout', this.onMouseOut);

    this.tooltipsView.remove();
    this.tooltipsView = null;
  }

  checkShouldHide() {
    if (this.shouldIgnoreMouseout) {
      this.shouldIgnoreMouseout = false;
      return;
    }

    this.hide();
  }

  onAdaptPreInitialize() {
    this.registerGlobalTooltips();

    const config = this.getConfig();

    if (!config || config._isEnabled !== false) {
      this.addListener();
    }
  }

  onMouseOver(e) {
    this.$prevMouseoverEl = this.$mouseoverEl;

    this.$mouseoverEl = $(e.currentTarget);

    const id = this.$mouseoverEl.data('tooltip-id');
    const tooltip = this.getTooltip(id);

    if (!tooltip || !tooltip.get('_isEnabled')) {
      return;
    };

    // ignore mouseover descendant elements
    if (this.$mouseoverEl[0] === this.$prevMouseoverEl?.[0]) {
      this.shouldIgnoreMouseout = true;
      return;
    }

    // ensure we remove any previous listener
    if (this.$prevMouseoverEl) this.$prevMouseoverEl.off('mouseout', this.onMouseOut);

    this.$mouseoverEl.on('mouseout', this.onMouseOut);

    this.show(tooltip);
  }

  onMouseOut(e) {
    _.defer(() => this.checkShouldHide());
  }
}

class TooltipContainerView extends Backbone.View {
  attributes() {
    return {
      'aria-live':  'assertive'
    };
  }
}

export default new TooltipController();
