import Adapt from 'core/js/adapt';
import _ from 'underscore';
import logging from './logging';
import TooltipView from './views/TooltipView';
import TooltipModel from './models/TooltipModel';
import Backbone from 'backbone';

export default new class TooltipController extends Backbone.Controller {

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
    $(document).on('keydown', this.onKeyDown.bind(this));
    this.onMouseOver = _.debounce(this.onMouseOver.bind(this), 500);
    $(document).on('mouseenter focus', '[data-tooltip-id]', this.onMouseOver);
    $(document).on('mouseleave blur', '[data-tooltip-id]', this.onMouseOut.bind(this));
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
  onKeyDown(event) {
    if (event.key !== 'Escape') return;
    this.hide();
  }

  /**
   * @param {jQuery} event
   */
  onMouseOver(event) {
    // Ignore propagated events
    // if (event.currentTarget !== event.target) return;
    const $mouseoverEl = $(event.currentTarget);
    const id = $mouseoverEl.data('tooltip-id');
    // Cancel if id is already tabbed to and gets focused again (from notify etc)
    if (this._currentId === id && event.type === 'focusin') return;
    this._currentId = id;
    const tooltip = this.getTooltip(id);
    if (!tooltip?.get('_isEnabled')) return this.hide();
    this.show(tooltip, $mouseoverEl);
    $(document).on('scroll', this.hide.bind(this));
  }

  /**
   * @param {jQuery} event
   */
  onMouseOut(event) {
    this.onMouseOver.cancel();
    this.hide();
  }

  /**
   * @param {string} id
   * @returns {TooltipModel}
   */
  getTooltip(id) {
    return this._tooltipData[id];
  }

  /**
   * @param {TooltipModel} tooltip
   * @param {jQuery} $mouseoverEl
   */
  show(tooltip, $mouseoverEl) {
    this.attachToBody();
    this.tooltipsView.show(tooltip, $mouseoverEl);
  }

  hide() {
    $(document).off('scroll');
    this.tooltipsView.hide();
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
}();
