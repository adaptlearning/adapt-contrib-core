import Adapt from '../adapt';
import logging from '../logging';
import TooltipItemView from './TooltipItemView';
import TooltipItemModel from '../models/TooltipItemModel';

export default class TooltipView extends Backbone.View {

  className() {
    return 'tooltip__container';
  }

  attributes() {
    return {
      role: 'region',
      'aria-live': 'assertive'
    };
  }

  initialize() {
    _.bindAll(this, 'onMouseOver', 'onKeyDown', 'onMouseOut');
    this._tooltipData = {};
    this._tooltips = [];
    this.listenTo(Adapt, 'adapt:preInitialize', this.onAdaptPreInitialize);
    this.render();
  }

  onAdaptPreInitialize() {
    if (this.config?._isEnabled === false) return;
    this.onMouseOver = _.debounce(this.onMouseOver, 500);
    $(document).on('keydown', this.onKeyDown);
    $(document).on('mouseenter focus', '[data-tooltip-id]', this.onMouseOver);
    $(document).on('mouseleave blur', '[data-tooltip-id]', this.onMouseOut);
  }

  /**
   * @param {jQuery} event
   */
  onKeyDown(event) {
    if (event.key !== 'Escape') return;
    this.hide();
  }

  /**
   * Show a tooltip by [tooltip-id]
   * @param {jQuery} event
   */
  onMouseOver(event) {
    const $mouseoverEl = $(event.currentTarget);
    const id = $mouseoverEl.data('tooltip-id');
    // Cancel if id is already tabbed to and gets focused again (from notify etc)
    if (this._currentId === id && event.name === 'focusin') return;
    this._currentId = id;
    const tooltip = this.getTooltip(id);
    if (!tooltip?.get('_isEnabled')) return this.hide();
    this.show(tooltip, $mouseoverEl);
    $(document).on('scroll', this.onScroll);
  }

  /**
   * Cancel the last mouseover debounce
   */
  onMouseOut() {
    this.onMouseOver.cancel();
  }

  render() {
    this.$el.appendTo('body');
  }

  /**
   * @param {TooltipModel} tooltip
   * @param {jQuery} $mouseoverEl
   */
  show(tooltip, $mouseoverEl) {
    const tooltipItem = new TooltipItemView({
      model: tooltip,
      $target: $mouseoverEl,
      parent: this
    });
    this._tooltips.push(tooltipItem);
    this.$el.append(tooltipItem.$el);
  }

  /**
   * Hides and removes a specified tooltip or the last tooltip
   * @param {TooltipItemView} [tooltipItem]
   */
  hide(tooltipItem = null) {
    tooltipItem = tooltipItem ?? this._tooltips.pop();
    this.removeItem(tooltipItem);
    if (!tooltipItem) return;
    tooltipItem.remove();
  }

  /**
   * Removes references to a specified tooltip
   * @param {TooltipItemView} tooltipItem
   * @returns
   */
  removeItem(tooltipItem) {
    const currentIndex = this._tooltips.findIndex(item => tooltipItem === item);
    if (currentIndex === -1) return;
    this._tooltips.splice(currentIndex, 1);
  }

  /**
   * Register tooltip data
   * @param {Object} tooltipData
   * @param {boolean} tooltipData._isEnabled
   * @param {string} tooltipData._id Id of registered tooltip text
   * @param {string} tooltipData.text Text to be displayed
   */
  register(tooltipData) {
    if (!tooltipData._id) return logging.warn('Tooltip cannot be registered with no id');
    this._tooltipData[tooltipData._id] = new TooltipItemModel(tooltipData);
  }

  /**
   * Return the tooltip registration data
   * @param {string} id
   * @returns {TooltipModel}
   */
  getTooltip(id) {
    return this._tooltipData[id];
  }

}
