import Adapt from 'core/js/adapt';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';

export default class TooltipView extends Backbone.View {

  className() {
    return 'tooltip__container';
  }

  /**
   * @param {TooltipModel} tooltip
   * @param {jQuery} $mouseoverEl
   */
  show(tooltip, $mouseoverEl) {
    this.model = tooltip;
    this.$target = $mouseoverEl;
    this.$target.attr('aria-describedby', `tooltip-${this.model.get('_id')}`);
    this.$el.addClass('is-loading is-shown');
    this.listenTo(Adapt, 'device:resize', this.onDeviceResize);
    this.listenTo(this.model, 'all', this.render);
    this.render();
    this.setEnviromentVars();
    this.position();
    this.$el.removeClass('is-loading');
  }

  setEnviromentVars() {
    // determine writing direction and set default
    const config = Adapt.config;
    this.writingDirection = config.get('_defaultDirection');

    // determine if the navigation is bottom so tooltip doesn't overlap nav bar
    const navigationAlignment = Adapt.course.get('_navigation')?._navigationAlignment;
    const navHeight = $('.nav').outerHeight(true);
    this.topNavOffset = navigationAlignment === 'top' ? navHeight : 0;
    this.bottomNavOffset = navigationAlignment === 'bottom' ? navHeight : 0;

    this.targetDOMRect = this.$target[0].getBoundingClientRect();

    // determine the width and height of the viewport available to the tooltip accounting for a 'no go border' and the nav bar
    this.unavailableBorder = 8;
    this.actualWidth = $('html')[0].clientWidth;
    this.actualHeight = $('html')[0].clientHeight;
    this.availableWidth = this.actualWidth - this.unavailableBorder;

    // determine the size of the tooltip
    const $tooltip = this.$('.tooltip');
    this.tooltipWidth = $tooltip.outerWidth();
    this.tooltipHeight = $tooltip.outerHeight();

    // determine position and size of tooltip arrow
    const $tooltipArrow = this.$('.has-arrow');
    this.arrowWidth = $tooltipArrow.width();
    this.arrowHeight = $tooltipArrow.height();
    if (!this.model.get('_arrowOffset')) this.model.set('_arrowOffset', $tooltipArrow.offset().left);
    this.arrowOffset = this.model.get('_arrowOffset');
    this.arrowPoint = (this.arrowWidth / 2) + this.arrowOffset;

    // offset the tooltip in the y-axis and adjust the tooltip in the x-axis to sit centrally on the tooltiped item
    this.offsetTooltipY = (5 + this.arrowHeight);
  }

  hide() {
    this.stopListening(this.model);
    this.stopListening(Adapt);
    this.model = null;
    this.$target = null;
    this.$el.removeClass('is-shown');
    if (this.$target) this.$target.removeAttr('aria-describedby');
  }

  render() {
    const Template = templates.tooltip;
    ReactDOM.render(<Template {...this.model.toJSON()} />, this.el);
  }

  onDeviceResize() {
    this.hide();
  }

  calcOffset(targetPosition, tooltipPosition) {
    const actualWidth = this.actualWidth;
    const availableWidth = this.availableWidth;
    const unavailableBorder = this.unavailableBorder;
    const targetDOMRect = this.targetDOMRect;
    const arrowPoint = this.arrowPoint;
    const offscreenLeft = Math.abs(targetDOMRect.left);
    const offscreenRight = Math.abs(actualWidth - targetDOMRect.right);
    const targetStart = 0;
    const targetMiddle = (targetDOMRect.width / 2);
    const targetEnd = targetDOMRect.width;

    if (targetPosition === 'start' || targetPosition === 'end') {
      if (targetDOMRect.left < unavailableBorder) return (unavailableBorder - targetDOMRect.left);
      if (targetDOMRect.right > availableWidth) return (availableWidth - targetDOMRect.left);
      if (tooltipPosition === 'left') return targetEnd;
      if (tooltipPosition === 'right') return targetStart;
    }
    // default targetPosition 'middle'
    const targetMiddleThreshold = targetMiddle - arrowPoint;
    if ((targetDOMRect.left < 0) && (targetMiddleThreshold < offscreenLeft + unavailableBorder)) return (offscreenLeft + unavailableBorder);
    if ((targetDOMRect.right > actualWidth) && (targetMiddleThreshold < offscreenRight + unavailableBorder)) return (availableWidth - targetDOMRect.left);
    if ((tooltipPosition === 'left')) return targetMiddle + arrowPoint;
    if ((tooltipPosition === 'right')) return targetMiddle - arrowPoint;

  }

  calcArrowFullwidth() {
    const actualWidth = this.actualWidth;
    const unavailableBorder = this.unavailableBorder;
    const targetDOMRect = this.targetDOMRect;
    const arrowWidth = this.arrowWidth;
    const arrowOffset = this.arrowOffset;

    const fullwidthOffset = (actualWidth > this.tooltipWidth) ? ((actualWidth - this.tooltipWidth) / 2) : unavailableBorder;
    const calcArrowOffset = targetDOMRect.left + (targetDOMRect.width / 2) - (arrowWidth / 2) - fullwidthOffset;
    if (targetDOMRect.left > 0 && (targetDOMRect.right < actualWidth)) return calcArrowOffset;
    if (targetDOMRect.left < 0) return arrowOffset;
    if (targetDOMRect.right > actualWidth) return (actualWidth - arrowOffset - arrowWidth - (unavailableBorder * 2));
  }

  parsePosition(position) {
    const y = position.includes('top')
      ? 'top'
      : 'bottom';
    const x = position.includes('left')
      ? 'left'
      : position.includes('right')
        ? 'right'
        : 'middle';
    return {
      x,
      y
    };
  }

  position() {
    const targetDOMRect = this.targetDOMRect;

    const topNavOffset = this.topNavOffset;
    const bottomNavOffset = this.bottomNavOffset;

    const unavailableBorder = this.unavailableBorder;

    const actualHeight = this.actualHeight;
    const availableWidth = this.availableWidth;

    const availableHeight = actualHeight - unavailableBorder - bottomNavOffset;
    const unavailableLeft = unavailableBorder;
    const unavailableTop = unavailableBorder + topNavOffset;

    const tooltipWidth = this.tooltipWidth;
    const tooltipHeight = this.tooltipHeight;

    const offsetTooltipY = this.offsetTooltipY;

    const targetPlacement = this.model.get('_placement') || 'middle';

    // determine bounds of tooltip in each position
    const leftStartPoint = targetDOMRect.left - tooltipWidth + this.calcOffset(targetPlacement, 'left');
    const middleStartPoint = targetDOMRect.left + (targetDOMRect.width / 2) - (tooltipWidth / 2);
    const middleEndPoint = middleStartPoint + tooltipWidth;
    const rightStartPoint = targetDOMRect.left + this.calcOffset(targetPlacement, 'right');
    const rightEndPoint = rightStartPoint + tooltipWidth;
    const topStartPoint = targetDOMRect.top - offsetTooltipY - tooltipHeight;
    const bottomStartPoint = targetDOMRect.bottom + offsetTooltipY;
    const bottomEndPoint = bottomStartPoint + tooltipHeight;

    // check if  endpoints fall within the available viewing area
    const canAlignTop = topStartPoint > unavailableTop;
    const canAlignBottom = bottomEndPoint < availableHeight;
    const canAlignLeft = leftStartPoint > unavailableLeft;
    const canAlignRight = rightEndPoint < availableWidth;
    const canAlignMiddleLeft = middleStartPoint > unavailableLeft;
    const canAlignMiddleRight = middleEndPoint < availableWidth;

    const position = this.calcPosition({
      leftStartPoint,
      middleStartPoint,
      rightStartPoint,
      topStartPoint,
      bottomStartPoint,
      canAlignTop,
      canAlignBottom,
      canAlignLeft,
      canAlignRight,
      canAlignMiddleLeft,
      canAlignMiddleRight
    });
    this.model.set(position);
  };

  calcPosition({
    leftStartPoint,
    middleStartPoint,
    rightStartPoint,
    topStartPoint,
    bottomStartPoint,
    canAlignTop,
    canAlignBottom,
    canAlignLeft,
    canAlignRight,
    canAlignMiddleLeft,
    canAlignMiddleRight
  }) {

    // determine if the button is fixed position so the tooltip stays with the button if the user scrolls (and focus event)
    const isFixedPosition = Boolean(this.$target.parents().add(this.$target).filter((index, el) => $(el).css('position') === 'fixed').length);
    const scrollOffsetTop = isFixedPosition ? 0 : $(window).scrollTop();
    const scrollOffsetLeft = isFixedPosition ? 0 : $(window).scrollLeft();
    this.model.set('_isFixedPosition', isFixedPosition);

    const canAlignMiddle = (canAlignMiddleLeft && canAlignMiddleRight);
    const cantAlignX = !canAlignLeft && !canAlignMiddle && !canAlignRight;

    const isRTL = this.writingDirection === 'rtl';
    let defaultPosition = this.model.get('_position');
    defaultPosition = defaultPosition || 'bottom right';

    let tooltipPosition = null;
    let arrowPosition = null;
    let arrowPositionCalc = null;
    let left = null;
    let top = null;

    const { x, y } = this.parsePosition(defaultPosition);
    let isLeft = x === 'left';
    const isMiddle = x === 'middle';
    let isRight = x === 'right';
    const isTop = y === 'top';
    const isBottom = y === 'bottom';

    if (isRTL) { isLeft = !isLeft; isRight = !isRight; }

    if ((isRight && canAlignRight) || (isLeft && !canAlignLeft) || (isMiddle && !canAlignLeft)) {
      tooltipPosition = 'is-right';
      arrowPosition = 'is-left';
      left = `${scrollOffsetLeft + rightStartPoint}px`;
    }

    if ((isLeft && canAlignLeft) || (isRight && !canAlignRight) || (isMiddle && !canAlignRight)) {
      tooltipPosition = 'is-left';
      arrowPosition = 'is-right';
      left = `${scrollOffsetLeft + leftStartPoint}px`;
    }

    if ((isMiddle && canAlignMiddle) || (!canAlignRight && !canAlignLeft && canAlignMiddle)) {
      tooltipPosition = 'is-middle';
      arrowPosition = 'is-middle';
      left = `${scrollOffsetLeft + middleStartPoint}px`;
    }

    if (cantAlignX) {
      tooltipPosition = 'is-full-width';
      arrowPosition = 'is-calc';
      arrowPositionCalc = { left: this.calcArrowFullwidth() };
      left = `${scrollOffsetLeft + ((this.actualWidth > this.tooltipWidth) ? ((this.actualWidth - this.tooltipWidth) / 2) : this.unavailableBorder)}px`;
      topStartPoint = this.targetDOMRect.top - this.offsetTooltipY;
    }

    if ((isTop && canAlignTop) || (isBottom && !canAlignBottom)) {
      tooltipPosition += ' is-top';
      arrowPosition += ' is-bottom';
      top = `${scrollOffsetTop + topStartPoint}px`;
    }

    if ((isBottom && canAlignBottom) || (isTop && !canAlignTop)) {
      tooltipPosition += ' is-bottom';
      arrowPosition += ' is-top';
      top = `${scrollOffsetTop + bottomStartPoint}px`;
    }

    return {
      tooltipPosition,
      arrowPosition,
      arrowPositionCalc,
      left,
      top
    };
  }

}
