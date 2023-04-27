import Adapt from '../adapt';
import logging from '../logging';
import TooltipItemView from './TooltipItemView';
import TooltipItemModel from '../models/TooltipItemModel';
import a11y from '../a11y';

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
    $(document).on('focus', '[data-tooltip-id]', (...args) => {
      if (a11y.isForcedFocus) return;
      this.onMouseOver(...args);
    });
    $(document).on('mouseenter', '[data-tooltip-id]', this.onMouseOver);
    $(document).on('mouseleave blur', '[data-tooltip-id]', this.onMouseOut);
  }

  get config() {
    return {
      _position: 'outside bottom middle right',
      ...Adapt.course.get('_tooltips')
    };
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
    if (!a11y.isFocusable($mouseoverEl)) return;
    const id = $mouseoverEl.data('tooltip-id');
    // Cancel if id is already tabbed to and gets focused again (from notify etc)
    if (this._currentId === id && event.name === 'focusin') return;
    this._currentId = id;
    const tooltip = this.getTooltip(id);
    if (!tooltip?.get('_isEnabled')) return this.hide();
    if (event.ctrlKey && this.config._allowTest) {
      this.showTest(tooltip, $mouseoverEl);
    } else {
      this.show(tooltip, $mouseoverEl);
    }
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

  /**
   * @param {object} tooltip
   * @param {jQuery} $mouseoverEl
   */
  showTest(tooltip, $target) {
    const produce = (parts) => {
      const lastIndex = (parts.length - 1);
      const partIndex = new Array(parts.length).fill(0);
      const tooltips = [];
      const json = tooltip.toJSON();
      while (true) {
        const position = parts.map((part, index) => part[partIndex[index]]).join(' ');
        tooltips.push(new TooltipItemModel({
          ...json,
          disabledText: `D ${position}`,
          text: `T ${position}`,
          _position: position,
          _classes: 'test'
        }));
        for (let i = lastIndex; i >= 0; i--) {
          partIndex[i] += 1;
          if (partIndex[i] < parts[i].length) break;
          if (i === 0) break;
          partIndex[i] = 0;
        }
        if (partIndex[0] >= parts[0].length) break;
      }
      tooltips.forEach(model => {
        const tooltipItem = new TooltipItemView({
          model,
          $target,
          parent: this
        });
        this._tooltips.push(tooltipItem);
        this.$el.append(tooltipItem.$el);
      });
    };

    const areaOutside = ['outside'];
    const areaInside = ['inside'];
    const arrowPosition = ['middle', 'start', 'end', ''];
    const vertical = ['middle', 'top', 'bottom', ''];
    const horizontal = ['middle', 'right', 'left', ''];
    const partsVertical = [areaOutside, vertical, arrowPosition, horizontal];
    const partsHorizontal = [areaOutside, horizontal, arrowPosition, vertical];
    const partsVerticalInside = [areaInside, vertical, arrowPosition, horizontal];
    const partsHorizontalInside = [areaInside, horizontal, arrowPosition, vertical];
    produce(partsVertical);
    produce(partsHorizontal);
    produce(partsVerticalInside);
    produce(partsHorizontalInside);
  }
}
