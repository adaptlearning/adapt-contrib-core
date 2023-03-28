import Adapt from 'core/js/adapt';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';

const FIRST_PASS = 1;
const SECOND_PASS = 2;
const THIRD_PASS = 3;

export default class TooltipItemView extends Backbone.View {

  className() {
    return [
      'tooltip',
      this.model.get('isTargetFixedPosition') && 'is-fixed',
      this.model.get('tooltipClasses') || 'is-vertical-axis is-top is-middle is-arrow-middle',
      this.model.get('isShown') && 'is-shown',
      this.model.get('_classes')
    ].filter(Boolean).join(' ');
  }

  attributes () {
    return {
      id: `tooltip-${this.model.get('_id')}`,
      // Add calculated CSS variables to the element
      style: Object.entries(this.model.get('tooltipStyles') ?? {}).map(([name, value]) => `${name}: ${value};`).join(' ')
    };
  }

  updateViewProperties() {
    const classesToAdd = _.result(this, 'className').trim().split(/\s+/);
    classesToAdd.forEach(i => this._classSet.add(i));
    const classesToRemove = [ ...this._classSet ].filter(i => !classesToAdd.includes(i));
    classesToRemove.forEach(i => this._classSet.delete(i));
    this._setAttributes({ ..._.result(this, 'attributes'), id: _.result(this, 'id') });
    this.$el.removeClass(classesToRemove).addClass(classesToAdd);
  }

  initialize({ $target, parent }) {
    _.bindAll(this, 'onDeviceResize', 'onMouseOut', 'doSubsequentPasses');
    this._classSet = new Set(_.result(this, 'className').trim().split(/\s+/));
    this.$target = $target;
    this.parent = parent;
    this.$target.attr('aria-describedby', `tooltip-${this.model.get('_id')}`);
    this.model.set('ariaLabel', this.$target.attr('aria-label') || this.$target.find('.aria-label').text());
    this.listenTo(Adapt, 'device:resize', this.onDeviceResize);
    $(document).on('mouseleave blur', '[data-tooltip-id]', this.onMouseOut);
    this.doFirstPass();
    setTimeout(this.doSubsequentPasses, 17);
  }

  get environment() {
    // Determine if the navigation is bottom so tooltip doesn't overlap nav bar
    const navigationAlignment = Adapt.course.get('_navigation')?._navigationAlignment ?? 'top';
    const navHeight = $('.nav').outerHeight(true);
    const $target = this.$target;
    return {
      position: this.model.get('_position') || 'bottom right',
      isDisabled: $target.attr('aria-disabled') !== undefined || $target.hasClass('is-disabled') || $target.is(':disabled'),
      isTargetFixedPosition: Boolean(this.$target.add(this.$target.parents()).filter((index, el) => $(el).css('position') === 'fixed').length),
      isRTL: Adapt.config.get('_defaultDirection') === 'rtl',
      topNavOffset: navigationAlignment === 'top' ? navHeight : 0,
      bottomNavOffset: navigationAlignment === 'bottom' ? navHeight : 0,
      targetDOMRect: $target[0]?.getBoundingClientRect(),
      clientDOMRect: {
        width: parseInt(getComputedStyle(document.body).width),
        height: $('html')[0].clientHeight
      },
      tooltipDOMRect: this.$('.tooltip__body')[0]?.getBoundingClientRect(),
      arrowDOMRect: this.$('.tooltip__arrow')[0]?.getBoundingClientRect(),
      ariaHidden: (document.activeElement === this.$target[0])
    };
  }

  doFirstPass() {
    this.model.set('isShown', false);
    const environment = this.environment;
    const positions = position(environment, {}, FIRST_PASS);
    const {
      isDisabled,
      isTargetFixedPosition,
      ariaHidden
    } = environment;
    this.model.set({
      isDisabled,
      isTargetFixedPosition,
      ariaHidden,
      ...positions
    });
    this.render();
  }

  doSubsequentPasses() {
    if (!this.model) return;
    this.model.set('hasLoaded', true);
    const multipassCache = {};
    // First pass - render at the requested position
    // Second pass - if needed, swap sides, switch axis and/or fill area
    // Third pass - snap to edges if overflowing
    for (let pass = SECOND_PASS, l = THIRD_PASS; pass <= l; pass++) {
      const environment = this.environment;
      const positions = position(this.environment, multipassCache, pass);
      const {
        isDisabled,
        isTargetFixedPosition,
        ariaHidden
      } = environment;
      this.model.set({
        isDisabled,
        isTargetFixedPosition,
        ariaHidden,
        ...positions
      });
      this.render();
    }
    this.model.set('isShown', true);
    this.render();
  }

  render() {
    if (!this.model) return;
    const Template = templates.tooltip;
    this.updateViewProperties();
    ReactDOM.render(<Template {...this.model.toJSON()} />, this.el);
  }

  onDeviceResize() {
    this.remove();
  }

  onMouseOut() {
    this.remove();
  }

  remove() {
    if (this.$el.hasClass('test')) return;
    this.stopListening(Adapt);
    $(document).off('mouseleave blur', '[data-tooltip-id]', this.onMouseOut);
    this.model?.set('isShown', false);
    this.render();
    this.model = null;
    this.$target = null;
    if (this.$target) this.$target.removeAttr('aria-describedby');
    const rem = super.remove.bind(this);
    // Remove the node from the DOM after a time
    setTimeout(() => {
      rem();
      this.parent.removeItem(this);
    }, 1000);
  }

}

/**
 * Extract the distance and padding properties from the css
 * @returns {Object}
 */
function fetchCSSVariables () {
  const computed = getComputedStyle(document.documentElement);
  return {
    offset: lengthToPx('@tooltip-offset', computed.getPropertyValue('--adapt-tooltip-offset')),
    distance: lengthToPx('@tooltip-distance', computed.getPropertyValue('--adapt-tooltip-distance')),
    viewPortPadding: lengthToPx('@tooltip-viewport-padding', computed.getPropertyValue('--adapt-tooltip-viewport-padding'))
  };
};

/**
 * Convert px and rem string values to a pixel number from css
 * @param {string} name The name of the css property
 * @param {string} length The value of the css property with units
 * @returns {number}
 */
function lengthToPx (name, length) {
  const unit = String(length).replaceAll(/[\d.]+/g, '').trim();
  const value = parseFloat(length);
  if (unit === 'rem') return value * parseInt(getComputedStyle(document.body).fontSize);
  if (unit === 'px') return value;
  throw new Error(`Cannot convert ${name} ${length} to pixels`);
};

/**
 * Parse the position property for inside/outside top/right/left/right/middle top/right/left/right/middle start/middle/end
 * @param {Object} options
 * @param {string} position
 * @param {boolean} isRTL
 * @returns {Object}
 */
function parseRelativePosition ({
  position
}) {
  const positions = position.split(' ');
  const isArrowStart = positions.includes('start');
  const isArrowEnd = !isArrowStart && positions.includes('end');
  const isArrowMiddle = !isArrowStart && !isArrowEnd;
  const verticalIndex = Math.min(...['top', 'bottom']
    .map(v => positions.indexOf(v))
    .filter(v => v !== -1));
  const horizontalIndex = Math.min(...['left', 'right']
    .map(v => positions.indexOf(v))
    .filter(v => v !== -1));
  const isVerticalAxis = (verticalIndex < horizontalIndex);
  const isHorizontalAxis = (verticalIndex > horizontalIndex);
  const isMiddleFirst = !isVerticalAxis && !isHorizontalAxis;
  const isInside = isMiddleFirst || positions.includes('inside');
  const isOutside = !isInside;
  const isLeft = positions.includes('left');
  const isRight = !isLeft && positions.includes('right');
  const isMiddle = !isLeft && !isRight;
  const isTop = positions.includes('top');
  const isBottom = !isTop && positions.includes('bottom');
  const isCenter = !isTop && !isBottom;
  return {
    isOutside,
    isInside,
    isVerticalAxis,
    isHorizontalAxis,
    isMiddleFirst,
    isLeft,
    isMiddle,
    isRight,
    isTop,
    isCenter,
    isBottom,
    isArrowStart,
    isArrowMiddle,
    isArrowEnd
  };
};

/**
 * Converts the DOMRect into a css-like distance from edge rectangle object
 * @param {DOMRect} DOMRect
 * @param {DOMRect} clientDOMRect
 * @returns {Object}
 */
function convertToDistanceRect (
  DOMRect,
  clientDOMRect
) {
  return {
    top: DOMRect.top,
    left: DOMRect.left,
    right: (clientDOMRect.width - DOMRect.right),
    bottom: (clientDOMRect.height - DOMRect.bottom),
    width: DOMRect.width,
    height: DOMRect.height
  };
};

/**
 * Inverts booleans for left and right if isRTL
 * @param {boolean} bool
 * @param {boolean} isRTL
 * @returns {boolean}
 */
function invertRTL(bool, isRTL) {
  if (!isRTL) return bool;
  return !bool;
}

/**
 * Adjusts the distanceRect such that the viewPort padding and navoffsets are
 * appropriately removed, leaving the space in which to render the tooltips
 * @param {Object} distanceRect
 * @param {number} viewPortPadding
 * @param {boolean} isTargetFixedPosition
 * @param {number} topNavOffset
 * @param {number} bottomNavOffset
 * @returns {Object}
 */
function constrainDimensions (
  distanceRect,
  viewPortPadding,
  isTargetFixedPosition,
  topNavOffset,
  bottomNavOffset
) {
  return {
    top: distanceRect.top - viewPortPadding - (isTargetFixedPosition ? 0 : topNavOffset),
    left: distanceRect.left - viewPortPadding,
    right: distanceRect.right - viewPortPadding,
    bottom: distanceRect.bottom - viewPortPadding - (isTargetFixedPosition ? 0 : bottomNavOffset),
    width: distanceRect.width,
    height: distanceRect.height
  };
};

/**
 * Swaps the two values supplied, returning an array of the values
 * @param {any} a
 * @param {any} b
 * @returns {[any, any]}
 */
function swapValues (a, b) {
  return [b, a];
};

/**
 * Returns the window scrollTop and scrollLeft
 * @param {Object} options
 * @param {boolean} isTargetFixedPosition
 * @returns {Object}
 */
function calculateScrollOffset ({
  isTargetFixedPosition
}) {
  const scrollOffsetTop = isTargetFixedPosition ? 0 : $(window).scrollTop();
  const scrollOffsetLeft = isTargetFixedPosition ? 0 : $(window).scrollLeft();
  return {
    scrollOffsetLeft,
    scrollOffsetTop
  };
};

/**
 * Four-pass positioning function which takes the dom rectangles of the
 * target, client, tooltip and arrow, along with whether the target element
 * is fixed positioned, the course is rtl, the navigation bar offsets and a
 * position string and returns the appropriate sizes and classes for the tooltip
 * and it's positioning elements
 *
 * This algorithm overlays the target element and positions the arrow and tooltip
 * around the target element overlay.
 * @param {Object} env
 * @param {boolean} env.isTargetFixedPosition
 * @param {string} env.position
 * @param {boolean} env.isRTL
 * @param {number} env.topNavOffset
 * @param {number} env.bottomNavOffset
 * @param {Object} env.targetDOMRect
 * @param {Object} env.clientDOMRect
 * @param {Object} env.tooltipDOMRect
 * @param {Object} env.arrowDOMRect
 * @param {Object} multipassCache
 * @param {number} pass
 * @returns
 */
function position (
  {
    isTargetFixedPosition,
    position,
    isRTL,
    topNavOffset,
    bottomNavOffset,
    targetDOMRect,
    clientDOMRect,
    tooltipDOMRect,
    arrowDOMRect
  } = {},
  multipassCache,
  pass
) {

  // Fetch the CSS variable values for distance and viewport padding
  const {
    offset,
    distance,
    viewPortPadding
  } = fetchCSSVariables();

  // Convert DOMRect to DistanceRect (distances from edges instead of top left) https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
  const targetDistRect = convertToDistanceRect(targetDOMRect, clientDOMRect);
  // Constrain shapes to padding and, when target is not fixed position, the navigation bar
  const constrainedClientDistRect = {
    width: (clientDOMRect.width - (viewPortPadding * 2)),
    height: (clientDOMRect.height - (viewPortPadding * 2)) -
      (isTargetFixedPosition
        ? 0
        : topNavOffset + bottomNavOffset
      )
  };

  // Convert the position string and isRTL boolean into some initial positioning variables
  let {
    isOutside,
    isInside,
    isVerticalAxis,
    isHorizontalAxis,
    isMiddleFirst,
    isLeft,
    isMiddle,
    isRight,
    isFillWidth = false,
    isTop,
    isCenter,
    isBottom,
    isFillHeight = false,
    isArrowStart,
    isArrowMiddle,
    isArrowEnd
  } = parseRelativePosition({
    position
  });

  if (pass >= THIRD_PASS) {
    // Restore previous pass calculations for the next pass
    ({
      isOutside,
      isInside,
      isVerticalAxis,
      isHorizontalAxis,
      isMiddleFirst,
      isLeft,
      isMiddle,
      isRight,
      isFillWidth = false,
      isTop,
      isCenter,
      isBottom,
      isFillHeight = false
    } = multipassCache);
  }

  let isSnapTop = false;
  let isSnapLeft = false;
  let isSnapBottom = false;
  let isSnapRight = false;
  let isArrowSnap = false;

  const tooltipStyles = {};

  if (pass >= SECOND_PASS) {
    // Convert DOMRect to DistanceRect (distances from edges instead of top left) https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
    const tooltipDistRect = convertToDistanceRect(tooltipDOMRect, clientDOMRect);
    const arrowDistRect = convertToDistanceRect(arrowDOMRect, clientDOMRect);
    // Constrain shapes to padding and, when target is not fixed position, the navigation bar
    const constrainedTargetDistRect = constrainDimensions(targetDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    const constrainedTooltipDistRect = constrainDimensions(tooltipDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    const constrainedArrowDistRect = constrainDimensions(arrowDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    // Calculate the overall height and width of the tooltip and arrow according to the position
    const overallHeight = (isOutside && isVerticalAxis)
      ? constrainedTooltipDistRect.height + constrainedArrowDistRect.height + distance
      : constrainedTooltipDistRect.height;
    const overallWidth = (isOutside && isHorizontalAxis)
      ? constrainedTooltipDistRect.width + constrainedArrowDistRect.width + distance
      : constrainedTooltipDistRect.width;
    // Is the tooltip overflowing at any constrained edge
    const isOverflowTop = (constrainedTooltipDistRect.top < 0);
    const isOverflowBottom = (constrainedTooltipDistRect.bottom < 0);
    const isOverflowLeft = (constrainedTooltipDistRect.left < 0);
    const isOverflowRight = (constrainedTooltipDistRect.right < 0);
    const isOverflowHorizontal = (isOverflowLeft || isOverflowRight);
    const isOverflowVertical = (isOverflowTop || isOverflowBottom);
    const isOverflow = (isOverflowHorizontal || isOverflowVertical);
    // Find largest vertical and horizontal areas
    const tooltipArea = (overallHeight * overallWidth);
    const topArea = constrainedTargetDistRect.top * constrainedClientDistRect.width;
    const bottomArea = constrainedTargetDistRect.bottom * constrainedClientDistRect.width;
    const leftArea = (constrainedTargetDistRect.left * constrainedClientDistRect.height);
    const rightArea = (constrainedTargetDistRect.right * constrainedClientDistRect.height);
    const maxHorizontalArea = Math.max(leftArea, rightArea);
    const maxVerticalArea = Math.max(topArea, bottomArea);
    const isVerticalAreaLarger = (maxVerticalArea >= maxHorizontalArea);
    const isHorizontalAreaLarger = (maxHorizontalArea >= maxVerticalArea);
    // Can the tooltip and arrow fit in the constrained height or width accordingly
    const canFitWidthLength = isVerticalAxis
      ? (overallWidth <= constrainedClientDistRect.width)
      : (overallWidth <= constrainedTargetDistRect.left || overallWidth <= constrainedTargetDistRect.right);
    const canFitHeightLength = isHorizontalAxis
      ? (overallHeight <= constrainedClientDistRect.height)
      : (overallHeight <= constrainedTargetDistRect.top || overallHeight <= constrainedTargetDistRect.bottom);
    const canFitInLeftArea = (tooltipArea < leftArea);
    const canFitInRightArea = (tooltipArea < rightArea);
    const canFitInTopArea = (tooltipArea < topArea);
    const canFitInBottomArea = (tooltipArea < bottomArea);
    const canFitInVerticalArea = (tooltipArea < maxVerticalArea);
    const canFitInHorizontalArea = (tooltipArea < maxHorizontalArea);
    // Check if the arrow is offscreen
    const isArrowOffscreen = (isVerticalAxis && (constrainedArrowDistRect.left < offset || constrainedArrowDistRect.right < offset)) ||
        (isHorizontalAxis && (constrainedArrowDistRect.top < offset || constrainedArrowDistRect.bottom < offset));
    // Usually over-sized tooltips, can't fit in the available height or width at the current shape
    const isBadShape = (!canFitHeightLength || !canFitWidthLength);
    // If the arrow and tooltip have fallen offscreen on their axis
    //   or if the tooltip can't fit onto the axis and there is more space on the
    //   other axis
    const isSwapAxis = (isArrowOffscreen && isHorizontalAxis && isOverflowVertical) ||
      (isArrowOffscreen && isVerticalAxis && isOverflowHorizontal) ||
      (isHorizontalAxis && !canFitInHorizontalArea && isVerticalAreaLarger) ||
      (isVerticalAxis && !canFitInVerticalArea && isHorizontalAreaLarger);
    // Break from height or width constraint
    //   If the axis is being swapped and the shape can't fit in its available area
    //    this isusually because of having too much text and being width constrained
    //   If the shape currently can't fit in its axis, but it can fit in the available area
    //     this is because its css width is contained
    const isFillArea = (isSwapAxis && isBadShape) ||
      (isVerticalAxis && isOverflow && isBadShape && (canFitInVerticalArea || isVerticalAreaLarger)) ||
      (isHorizontalAxis && isOverflow && isBadShape && (canFitInHorizontalArea || isHorizontalAreaLarger));

    if (pass === SECOND_PASS && (isBadShape || isOverflow)) {
      if (isSwapAxis) {
        // Move from left/right to up/down or from up/down to left/right
        // Make full screen if required
        [isVerticalAxis, isHorizontalAxis] = swapValues(isVerticalAxis, isHorizontalAxis);
        if (isCenter) {
          // Rotate vertical center around to horizontal middle
          [isMiddle, isLeft, isRight] = [true, false, false];
          [isBottom, isTop, isCenter] = [true, false, false];
        }
      }
      if (isFillArea) {
        // Fill into the largest available area top/bottom full width or left/right full height
        if (isVerticalAxis) isFillWidth = true;
        if (isHorizontalAxis) isFillHeight = true;
      }
      const isSwapVerticalSide = !(isHorizontalAxis && canFitInHorizontalArea) &&
        ((isFillArea && !((isTop && canFitInTopArea) || (isBottom && canFitInBottomArea))) ||
        (!isFillArea && ((isBottom && isOverflowBottom) || (isTop && isOverflowTop))));
      if (isSwapVerticalSide && isFillArea && (canFitInTopArea || canFitInBottomArea)) {
        // Switch to fitting side
        isTop = !canFitInBottomArea;
        isBottom = canFitInBottomArea;
      } else if (isSwapVerticalSide) {
        // Largest of top / bottom
        isTop = (constrainedTargetDistRect.top >= constrainedTargetDistRect.bottom);
        isBottom = (constrainedTargetDistRect.top < constrainedTargetDistRect.bottom);
      }
      const isSwapHorizontalSide = !(isVerticalAxis && canFitInVerticalArea) &&
        ((isFillArea && !((isLeft && canFitInLeftArea) || (isRight && canFitInRightArea))) ||
        (!isFillArea && ((isLeft && isOverflowLeft) || (isRight && isOverflowRight))));
      if (isSwapHorizontalSide && isFillArea && (canFitInLeftArea || canFitInRightArea)) {
        // Switch to fitting side
        isLeft = invertRTL(!canFitInRightArea, isRTL);
        isRight = invertRTL(canFitInRightArea, isRTL);
      } else if (isSwapHorizontalSide) {
        // Largest of left / right
        isLeft = invertRTL(constrainedTargetDistRect.left >= constrainedTargetDistRect.right, isRTL);
        isRight = invertRTL(constrainedTargetDistRect.left < constrainedTargetDistRect.right, isRTL);
      } else if (isSwapAxis) {
        // As axis has rotated, needs rtl inverting
        isLeft = invertRTL(isLeft, isRTL);
        isRight = invertRTL(isRight, isRTL);
      }
      if (isSwapVerticalSide || isSwapHorizontalSide || isSwapAxis) {
        isMiddle = (!isLeft && !isRight);
        isCenter = (!isTop && !isBottom);
      }
    }
    if (pass === THIRD_PASS) {
      if (isVerticalAxis) {
        // Snap to left/right
        isSnapLeft = isOverflowLeft;
        isSnapRight = !isSnapLeft && isOverflowRight;
      }
      if (isHorizontalAxis) {
        // Snap to top/bottom
        isSnapTop = isOverflowTop;
        isSnapBottom = !isSnapTop && isOverflowBottom;
      }
      isArrowSnap = isArrowOffscreen;
    }
    // Add the distance from the constrained edges to the CSS variables
    Object.assign(tooltipStyles, {
      '--adapt-tooltip-target-distancetoedge-left': `${constrainedTargetDistRect.left}px`,
      '--adapt-tooltip-target-distancetoedge-top': `${constrainedTargetDistRect.top}px`,
      '--adapt-tooltip-target-distancetoedge-right': `${constrainedTargetDistRect.right}px`,
      '--adapt-tooltip-target-distancetoedge-bottom': `${constrainedTargetDistRect.bottom}px`,
      '--adapt-tooltip-target-distancetoedge-height': `${constrainedTargetDistRect.height}px`,
      '--adapt-tooltip-target-distancetoedge-width': `${constrainedTargetDistRect.width}px`
    });
    if (pass >= 2) {
      // Keep the current calculations for the next pass
      Object.assign(multipassCache, {
        isOutside,
        isInside,
        isVerticalAxis,
        isHorizontalAxis,
        isMiddleFirst,
        isLeft,
        isMiddle,
        isRight,
        isFillWidth,
        isTop,
        isCenter,
        isBottom,
        isFillHeight
      });
    }
  }

  // Produce classes for styling the tooltip and arrow in the DOM
  const tooltipClasses = [
    isOutside && 'is-outside',
    isInside && 'is-inside',
    isArrowSnap && 'is-arrow-snap',
    isVerticalAxis && 'is-vertical-axis',
    isHorizontalAxis && 'is-horizontal-axis',
    isMiddleFirst && 'is-middle-axis',
    isLeft && 'is-left',
    isMiddle && 'is-middle',
    isRight && 'is-right',
    isFillWidth && 'is-fill-width',
    isSnapLeft && 'is-snap-left',
    isSnapRight && 'is-snap-right',
    isTop && 'is-top',
    isCenter && 'is-center',
    isBottom && 'is-bottom',
    isFillHeight && 'is-fill-height',
    isSnapTop && 'is-snap-top',
    isSnapBottom && 'is-snap-bottom',
    isArrowStart && 'is-arrow-start',
    isArrowMiddle && 'is-arrow-middle',
    isArrowEnd && 'is-arrow-end'
  ].filter(Boolean).join(' ');

  const {
    scrollOffsetLeft,
    scrollOffsetTop
  } = calculateScrollOffset({
    isTargetFixedPosition
  });

  // Add positioning variables to CSS to allow positioning in LESS
  Object.assign(tooltipStyles, {
    '--adapt-tooltip-viewport-constrained-height': `${constrainedClientDistRect.height}px`,
    '--adapt-tooltip-viewport-constrained-width': `${constrainedClientDistRect.width}px`,
    '--adapt-tooltip-scroll-top': `${scrollOffsetTop}px`,
    '--adapt-tooltip-scroll-left': `${scrollOffsetLeft}px`,
    '--adapt-tooltip-target-position-top': `${targetDistRect.top}px`,
    '--adapt-tooltip-target-position-left': `${targetDistRect.left}px`,
    '--adapt-tooltip-target-position-width': `${targetDistRect.width}px`,
    '--adapt-tooltip-target-position-height': `${targetDistRect.height}px`
  });

  return {
    tooltipClasses,
    tooltipStyles
  };

};
