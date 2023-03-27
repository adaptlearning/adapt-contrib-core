import Adapt from 'core/js/adapt';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';

const FIRST_PASS = 1;
const SECOND_PASS = 2;
const THIRD_PASS = 3;
const FOURTH_PASS = 4;

export default class TooltipItemView extends Backbone.View {

  className() {
    return [
      'tooltip__position',
      this.model.get('isTargetFixedPosition') && 'tooltip-fixed',
      this.model.get('tooltipClasses') || 'is-vertical-order is-top is-middle is-arrow-middle',
      this.model.get('isShown') && 'is-shown'
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
      tooltipDOMRect: this.$('.tooltip')[0]?.getBoundingClientRect(),
      arrowDOMRect: this.$('.has-arrow')[0]?.getBoundingClientRect(),
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
    this.model.set('hasLoaded', true);
    const multipassCache = {};
    // First pass - render at the requested orientation
    // Second pass - swap sides if necessary
    // Third pass - switch orientation and/or go into full width or full height
    // Fourth pass - snap to edge if required
    for (let pass = SECOND_PASS, l = FOURTH_PASS; pass <= l; pass++) {
      const { shouldNextPass } = multipassCache;
      const isFouthPass = (pass === FOURTH_PASS);
      if (isFouthPass && !shouldNextPass) break;
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
    this.stopListening(Adapt);
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
  position,
  isRTL
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
  const isVerticalFirst = (verticalIndex < horizontalIndex);
  const isHorizontalFirst = (verticalIndex > horizontalIndex);
  const isMiddleFirst = !isVerticalFirst && !isHorizontalFirst;
  const isInside = isMiddleFirst || positions.includes('inside');
  const isOutside = !isInside;
  let isLeft = positions.includes('left');
  let isRight = !isLeft && positions.includes('right');
  if (isRTL) {
    isLeft = !isLeft;
    isRight = !isRight;
  }
  const isMiddle = !isLeft && !isRight;
  const isTop = positions.includes('top');
  const isBottom = !isTop && positions.includes('bottom');
  const isCenter = !isTop && !isBottom;
  return {
    isOutside,
    isInside,
    isVerticalFirst,
    isHorizontalFirst,
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
    isVerticalFirst,
    isHorizontalFirst,
    isMiddleFirst,
    isLeft,
    isMiddle,
    isRight,
    isFullWidth = false,
    isTop,
    isCenter,
    isBottom,
    isFullHeight = false,
    isArrowStart,
    isArrowMiddle,
    isArrowEnd
  } = parseRelativePosition({
    position,
    isRTL
  });

  if (pass >= THIRD_PASS) {
    // Restore previous pass calculations for the next pass
    ({
      isOutside,
      isInside,
      isVerticalFirst,
      isHorizontalFirst,
      isMiddleFirst,
      isLeft,
      isMiddle,
      isRight,
      isFullWidth = false,
      isTop,
      isCenter,
      isBottom,
      isFullHeight = false
    } = multipassCache);
  }

  let isSnapTop = false;
  let isSnapLeft = false;
  let isSnapBottom = false;
  let isSnapRight = false;
  let isArrowSnap = false;

  const tooltipStyles = {};

  if (pass >= SECOND_PASS) {
    let shouldNextPass = false;
    // Convert DOMRect to DistanceRect (distances from edges instead of top left) https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
    const tooltipDistRect = convertToDistanceRect(tooltipDOMRect, clientDOMRect);
    const arrowDistRect = convertToDistanceRect(arrowDOMRect, clientDOMRect);
    // Constrain shapes to padding and, when target is not fixed position, the navigation bar
    const constrainedTargetDistRect = constrainDimensions(targetDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    const constrainedTooltipDistRect = constrainDimensions(tooltipDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    const constrainedArrowDistRect = constrainDimensions(arrowDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    // Is the tooltip overflowing at any constrained edge
    const isOverflowTop = (constrainedTooltipDistRect.top < 0);
    const isOverflowBottom = (constrainedTooltipDistRect.bottom < 0);
    const isOverflowLeft = (constrainedTooltipDistRect.left < 0);
    const isOverflowRight = (constrainedTooltipDistRect.right < 0);
    // Calculate the overall height and width of the tooltip and arrow according to the position
    const overallHeight = (isOutside && isVerticalFirst)
      ? constrainedTooltipDistRect.height + constrainedArrowDistRect.height + distance
      : constrainedTooltipDistRect.height;
    const overallWidth = (isOutside && isHorizontalFirst)
      ? constrainedTooltipDistRect.width + constrainedArrowDistRect.width + distance
      : constrainedTooltipDistRect.width;
    // Can the tooltip and arrow fit in the constrained height or width accordingly
    const canFitWidth = isVerticalFirst
      ? (overallWidth <= constrainedClientDistRect.width)
      : (overallWidth <= constrainedTargetDistRect.left || overallWidth <= constrainedTargetDistRect.right);
    const canFitHeight = isHorizontalFirst
      ? (overallHeight <= constrainedClientDistRect.height)
      : (overallHeight <= constrainedTargetDistRect.top || overallHeight <= constrainedTargetDistRect.bottom);
    // Swap sides in orientation when easy and possible
    const isVerticalSwap = canFitHeight && !isCenter && (isOverflowTop || isOverflowBottom);
    const isHorizontalSwap = canFitWidth && !isMiddle && (isOverflowLeft || isOverflowRight);
    const isSwap = (isVerticalSwap || isHorizontalSwap);
    if (pass === SECOND_PASS) {
      if (isSwap) {
        if (isVerticalSwap) [isTop, isBottom] = swapValues(isTop, isBottom);
        if (isHorizontalSwap) [isLeft, isRight] = swapValues(isLeft, isRight);
        shouldNextPass = true;
      }
    }
    // Find largest vertical/horizontal area
    const tooltipArea = (overallHeight * overallWidth);
    const maxVerticalArea = Math.max(constrainedTargetDistRect.top * constrainedClientDistRect.width, constrainedTargetDistRect.bottom * constrainedClientDistRect.width);
    const maxHorizontalArea = Math.max(constrainedTargetDistRect.left * constrainedClientDistRect.height, constrainedTargetDistRect.right * constrainedClientDistRect.height);
    const canFitInVerticalArea = tooltipArea < maxHorizontalArea;
    const canFitInHorizontalArea = tooltipArea < maxHorizontalArea;
    const isVerticalLarger = maxVerticalArea >= maxHorizontalArea;
    const isHorizontalLarger = maxHorizontalArea >= maxVerticalArea;
    const isLarge = (!canFitHeight || !canFitWidth);
    // Switch large tooltip orientation if advantageous
    //   or switch to full width or full height only
    if (pass === THIRD_PASS) {
      if (isLarge) { // Usually over-sized tooltips
        if (isVerticalFirst && !canFitInVerticalArea && isHorizontalLarger) {
          // Move from up/down to left/right
          [isVerticalFirst, isHorizontalFirst, isMiddleFirst] = [false, true, false];
          [isLeft, isRight] = [false, false];
          isLeft = (constrainedTargetDistRect.left >= constrainedTargetDistRect.right);
          isRight = (constrainedTargetDistRect.left <= constrainedTargetDistRect.right);
          isCenter = isMiddle;
          isMiddle = false;
          isFullHeight = true;
          shouldNextPass = true;
        } else if (isVerticalFirst && (canFitInVerticalArea || isVerticalLarger)) {
          // Fill into the largest available area top/bottom
          [isVerticalFirst, isHorizontalFirst, isMiddleFirst] = [true, false, false];
          [isTop, isCenter, isBottom] = [false, false, false];
          isFullWidth = true;
          isTop = (constrainedTargetDistRect.top >= constrainedTargetDistRect.bottom);
          isBottom = (constrainedTargetDistRect.top <= constrainedTargetDistRect.bottom);
          shouldNextPass = true;
        } else if (isHorizontalFirst && !canFitInHorizontalArea && isVerticalLarger) {
          // Move from left/right to up/down
          [isVerticalFirst, isHorizontalFirst, isMiddleFirst] = [true, false, false];
          [isTop, isBottom] = [false, false];
          isTop = (constrainedTargetDistRect.top >= constrainedTargetDistRect.bottom);
          isBottom = (constrainedTargetDistRect.top <= constrainedTargetDistRect.bottom);
          isMiddle = isCenter;
          isCenter = false;
          isFullWidth = true;
          shouldNextPass = true;
        } else if (isHorizontalFirst && (canFitInHorizontalArea || isHorizontalLarger)) {
          // Fill into the largest available area left/right
          [isVerticalFirst, isHorizontalFirst, isMiddleFirst] = [false, true, false];
          [isLeft, isMiddle, isRight] = [false, false, false];
          isFullHeight = true;
          isLeft = (constrainedTargetDistRect.left >= constrainedTargetDistRect.right);
          isRight = (constrainedTargetDistRect.left <= constrainedTargetDistRect.right);
          shouldNextPass = true;
        }
      } else if (!isLarge) { // Having scrolled target to edge of screen
        if (isHorizontalFirst && (isOverflowTop || isOverflowBottom)) {
          // Move from left/right to up/down
          [isVerticalFirst, isHorizontalFirst, isMiddleFirst] = [true, false, false];
          [isTop, isBottom] = [false, false];
          isTop = (constrainedTargetDistRect.top >= constrainedTargetDistRect.bottom);
          isBottom = (constrainedTargetDistRect.top <= constrainedTargetDistRect.bottom);
          isMiddle = isCenter;
          isCenter = false;
          shouldNextPass = true;
        }
        if (isVerticalFirst && (isOverflowLeft || isOverflowRight)) {
          // Move from up/down to left/right
          [isVerticalFirst, isHorizontalFirst, isMiddleFirst] = [false, true, false];
          [isLeft, isRight] = [false, false];
          isLeft = (constrainedTargetDistRect.left >= constrainedTargetDistRect.right);
          isRight = (constrainedTargetDistRect.left <= constrainedTargetDistRect.right);
          isCenter = isMiddle;
          isMiddle = false;
          shouldNextPass = true;
        }
      }
    }
    if (pass === FOURTH_PASS) {
      if (isVerticalFirst) {
        // Snap to left/right
        isSnapLeft = isOverflowLeft;
        isSnapRight = !isSnapLeft && isOverflowRight;
      }
      if (isHorizontalFirst) {
        // Snap to top/bottom
        isSnapTop = isOverflowTop;
        isSnapBottom = !isSnapTop && isOverflowBottom;
      }
      // Hide everything as the arrow has gone outside of the constrained area
      const isArrowOffscreen = (isVerticalFirst && (constrainedArrowDistRect.left < 0 || constrainedArrowDistRect.right < 0)) ||
        (isHorizontalFirst && (constrainedArrowDistRect.top < 0 || constrainedArrowDistRect.bottom < 0));
      isArrowSnap = isArrowOffscreen;
    }
    // Add the distance from the constrained edges to the CSS variables
    Object.assign(tooltipStyles, {
      '--adapt-tooltip-target-distance-left': `${constrainedTargetDistRect.left}px`,
      '--adapt-tooltip-target-distance-top': `${constrainedTargetDistRect.top}px`,
      '--adapt-tooltip-target-distance-right': `${constrainedTargetDistRect.right}px`,
      '--adapt-tooltip-target-distance-bottom': `${constrainedTargetDistRect.bottom}px`,
      '--adapt-tooltip-target-distance-height': `${constrainedTargetDistRect.height}px`,
      '--adapt-tooltip-target-distance-width': `${constrainedTargetDistRect.width}px`
    });
    if (pass >= 2) {
      // Keep the current calculations for the next pass
      Object.assign(multipassCache, {
        shouldNextPass,
        isOutside,
        isInside,
        isVerticalFirst,
        isHorizontalFirst,
        isMiddleFirst,
        isLeft,
        isMiddle,
        isRight,
        isFullWidth,
        isTop,
        isCenter,
        isBottom,
        isFullHeight
      });
    }
  }

  // Produce classes for styling the tooltip and arrow in the DOM
  const tooltipClasses = [
    isOutside && 'is-outside',
    isInside && 'is-inside',
    isArrowSnap && 'is-arrow-snap',
    isVerticalFirst && 'is-vertical-order',
    isHorizontalFirst && 'is-horizontal-order',
    isMiddleFirst && 'is-middle-order',
    isLeft && 'is-left',
    isMiddle && 'is-middle',
    isRight && 'is-right',
    isFullWidth && 'is-full-width',
    isSnapLeft && 'is-snap-left',
    isSnapRight && 'is-snap-right',
    isTop && 'is-top',
    isCenter && 'is-center',
    isBottom && 'is-bottom',
    isFullHeight && 'is-full-height',
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
