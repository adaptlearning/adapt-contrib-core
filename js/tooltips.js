import Adapt from 'core/js/adapt';
import _ from 'underscore';
import logging from './logging';
import TooltipView from './views/TooltipView';
import TooltipModel from './models/TooltipModel';
import Backbone from 'backbone';

class TooltipController extends Backbone.Controller {

  initialize() {
    _.bindAll(this, 'onMouseOver');
    this._tooltipData = {};
    this._currentId = null;
    this.listenTo(Adapt, 'adapt:preInitialize', this.onAdaptPreInitialize);
  }

  onAdaptPreInitialize() {
    const config = this.getConfig();
    if (config?._isEnabled === false) return;
    this.attachToBody();
    $(document).on('mouseover', '*', this.onMouseOver);
  }

  getConfig() {
    return Adapt.course.get('_tooltips');
  }

  attachToBody() {
    this.tooltipsView = this.tooltipsView || new TooltipView();
    const $el = this.tooltipsView.$el;
    if ($el[0].parentNode && $el.is(':last-child')) return;
    $el.appendTo('body');
  }

  /**
   * @param {jQuery} event
   */
  onMouseOver(event) {
    // Ignore propagated events
    if (event.currentTarget !== event.target) return;
    // Fetch first found tooltip element from target, through parents to html
    const $mouseoverEl = $(event.currentTarget).parents().add(event.currentTarget).filter('[data-tooltip-id]').last();
    const id = $mouseoverEl.data('tooltip-id');
    // Cancel if id is already displayed
    if (this._currentId === id) return;
    this._currentId = id;
    const tooltip = this.getTooltip(id);
    if (!tooltip?.get('_isEnabled')) return this.hide();
    this.show(tooltip, $mouseoverEl);
  }

  /**
   * @param {string} id
   * @returns {TooltipModel}
   */
  getTooltip(id) {
    return this._tooltipData[id];
  }

  hide() {
    this._currentId = null;
    this.tooltipsView.hide();
  }

  /**
   * @param {TooltipModel} tooltip
   * @param {jQuery} $mouseoverEl
   */
  show(tooltip, $mouseoverEl) {
    this.attachToBody();
    this.tooltipsView.show(tooltip, $mouseoverEl);
  }

  /**
   * @param {Object} tooltipData
   * @param {boolean} tooltipData._isEnabled
   * @param {string} tooltipData._id Id of registered tooltip text
   * @param {string} tooltipData.text Text to be displayed
   */
  register(tooltipData) {
    if (!tooltipData._id) return logging.warn('Tooltip cannot be registered with no id');
    this._tooltipData[tooltipData._id] = new TooltipModel(tooltipData);
  }

}

export default new TooltipController();
