import Adapt from 'core/js/adapt';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';
import logging from '../logging';

const FIRST_PASS = 1;
const SECOND_PASS = 2;
const THIRD_PASS = 3;

export default class TooltipItemView extends Backbone.View {

  className() {
    return [
      'tooltip',
      this.model.get('isTargetFixedPosition') && 'is-fixed',
      this.model.get('tooltipClasses') || 'is-vertical-axis is-arrow-middle is-bottom is-middle',
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
      position: this.model.get('_position') || 'outside bottom middle right',
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
 * Extract the offset, distance and padding properties from the css
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
  function fixConditions(positions, item1, item2, type) {
    positions = positions.slice(0);
    const indexOf1 = positions.indexOf(item1);
    const indexOf2 = positions.indexOf(item2);
    let has1 = (indexOf1 !== -1);
    let has2 = (indexOf2 !== -1);
    let assume3 = false;
    let specifiedAtIndex = null;
    if (has1 && has2) {
      const isItem1 = (has1 < has2);
      specifiedAtIndex = isItem1 ? indexOf1 : indexOf2;
      has1 = isItem1;
      has2 = !isItem1;
    } else if (has1) {
      specifiedAtIndex = indexOf1;
    } else if (has2) {
      specifiedAtIndex = indexOf2;
    } else {
      assume3 = true;
    }
    if (specifiedAtIndex !== null) {
      positions[specifiedAtIndex] = type;
      positions = positions.filter((item, index) => {
        if (index <= specifiedAtIndex) return true;
        return (item !== item1 && item !== item2);
      });
    }
    const hasSpecified = (has1 || has2);
    return [positions, has1, has2, assume3, hasSpecified, specifiedAtIndex];
  }
  position = position.toLowerCase().split(' ').filter(Boolean).join(' ');
  let positions = position.split(' ');
  let isArrowStart = null;
  let isArrowEnd = null;
  let isArrowMiddle = null;
  let isTop = null;
  let isCenter = null;
  let isBottom = null;
  let isLeft = null;
  let isMiddle = null;
  let isRight = null;
  let isOutside = null;
  let isInside = null;
  let isAreaAuto = null;
  let hasArrowSpecified = null;
  let hasVerticalSpecified = null;
  let verticalIndex = null;
  let hasHorizontalSpecified = null;
  let horizontalIndex = null;
  [
    positions,
    isOutside,
    isInside,
    isAreaAuto
  ] = fixConditions(positions, 'outside', 'inside', 'area');
  if (isAreaAuto) positions.unshift('area');
  [
    positions,
    isArrowStart,
    isArrowEnd,
    isArrowMiddle,
    hasArrowSpecified
  ] = fixConditions(positions, 'start', 'end', 'arrow');
  [
    positions,
    isTop,
    isBottom,
    isCenter,
    hasVerticalSpecified,
    verticalIndex
  ] = fixConditions(positions, 'top', 'bottom', 'vertical');
  [
    positions,
    isLeft,
    isRight,
    isMiddle,
    hasHorizontalSpecified,
    horizontalIndex
  ] = fixConditions(positions, 'left', 'right', 'horizontal');
  if (positions.length > 4) {
    positions.length = 4;
  }
  if (positions.length < 4) {
    const start = positions.length;
    positions.length = 4;
    positions.fill('auto', start);
  }
  let specifiedCount = [
    hasArrowSpecified,
    hasHorizontalSpecified,
    hasVerticalSpecified
  ].reduce((sum, bool) => sum + (bool ? 1 : 0), 0);
  // Fill in any missing values and types
  let wasVerticalFilled = false;
  let wasHorizontalFilled = false;
  let wasArrowFilled = false;
  while (true) {
    let isAuto = false;
    const indexOfMiddle = positions.indexOf('middle');
    const indexOfAuto = positions.indexOf('auto');
    const hasMiddleSpecified = (indexOfMiddle !== -1);
    const hasAutoSpecified = (indexOfAuto !== -1);
    let indexOf;
    let hasValue = false;
    if (hasMiddleSpecified && hasAutoSpecified) {
      isAuto = indexOfAuto < indexOfMiddle;
      indexOf = isAuto ? indexOfAuto : indexOfMiddle;
      hasValue = true;
    } else if (hasAutoSpecified) {
      isAuto = true;
      indexOf = indexOfAuto;
      hasValue = true;
    } else if (hasMiddleSpecified) {
      isAuto = false;
      indexOf = indexOfMiddle;
      hasValue = true;
    }
    if (!hasValue) break;
    const requiresHorizontal = (!hasHorizontalSpecified && !wasHorizontalFilled);
    const requiresVertical = (!hasVerticalSpecified && !wasVerticalFilled);
    const requiresArrow = (!hasArrowSpecified && !wasArrowFilled);
    const shouldArrow = (requiresArrow && (specifiedCount === 1 || specifiedCount === 0 || (!requiresHorizontal && !requiresVertical)));
    const shouldHorizontal = (!shouldArrow && requiresHorizontal);
    const shouldVertical = (!shouldHorizontal && !shouldArrow && requiresVertical);
    if (shouldHorizontal) {
      positions[indexOf] = 'horizontal';
      if (isAuto) wasHorizontalFilled = true;
      else hasHorizontalSpecified = true;
      horizontalIndex = indexOf;
    } else if (shouldArrow) {
      positions[indexOf] = 'arrow';
      if (isAuto) wasArrowFilled = true;
      else hasArrowSpecified = true;
    } else if (shouldVertical) {
      positions[indexOf] = 'vertical';
      if (isAuto) wasVerticalFilled = true;
      else hasVerticalSpecified = true;
      verticalIndex = indexOf;
    }
    if (!isAuto) specifiedCount += 1;
  }
  // Calculate the axis
  const isVerticalAxis = (verticalIndex < horizontalIndex);
  const isHorizontalAxis = (horizontalIndex < verticalIndex);
  const isInsideMiddleCenter = ((isVerticalAxis && isCenter) || (isHorizontalAxis && isMiddle));
  if (isAreaAuto) {
    isOutside = !isInsideMiddleCenter;
    isInside = !isOutside;
  }
  if (isOutside && isVerticalAxis && isCenter) {
    // Illogic correction, outside vertical center isn't a place
    isTop = true;
    isCenter = false;
    logging.info(`tooltips: "${position}"(${positions.join(' ')}) is not a valid location, assuming side 'top'`);
  } else if (isOutside && isHorizontalAxis && isMiddle) {
    // Illogic correction, outside horizontal middle isn't a place
    isLeft = true;
    isMiddle = false;
    logging.info(`tooltips: "${position}"(${positions.join(' ')}) is not a valid location, assuming side 'left'`);
  }
  // Apply sensible flow and arrow defaults
  const shouldSensibleDefaults = (specifiedCount === 2);
  if (shouldSensibleDefaults) {
    // Outside arrow is following flow if unspecified
    if (isOutside && !hasArrowSpecified && isVerticalAxis && hasVerticalSpecified) {
      isArrowMiddle = false;
      isArrowEnd = isRight;
      isArrowStart = !isArrowEnd;
    }
    if (isOutside && !hasArrowSpecified && isHorizontalAxis && hasHorizontalSpecified) {
      isArrowMiddle = false;
      isArrowEnd = isBottom;
      isArrowStart = !isArrowEnd;
    }
    // Inside arrow is opposite flow if unspecified
    if (isInside && !hasArrowSpecified && isVerticalAxis && hasVerticalSpecified) {
      isArrowMiddle = false;
      isArrowEnd = !isRight;
      isArrowStart = !isArrowEnd;
    }
    if (isInside && !hasArrowSpecified && isHorizontalAxis && hasHorizontalSpecified) {
      isArrowMiddle = false;
      isArrowEnd = !isBottom;
      isArrowStart = !isArrowEnd;
    }
    // Outside flow is following arrow if unspecified
    if (isOutside && !hasHorizontalSpecified && isVerticalAxis && hasArrowSpecified && !isArrowMiddle) {
      isMiddle = false;
      isRight = !isArrowStart;
      isLeft = !isRight;
    }
    if (isOutside && !hasVerticalSpecified && isHorizontalAxis && hasArrowSpecified && !isArrowMiddle) {
      isCenter = false;
      isBottom = !isArrowStart;
      isTop = !isBottom;
    }
    // Inside flow is opposite to arrow if unspecified
    if (isInside && !hasHorizontalSpecified && isVerticalAxis && hasArrowSpecified && !isArrowMiddle) {
      isMiddle = false;
      isRight = isArrowStart;
      isLeft = !isRight;
    }
    if (isInside && !hasVerticalSpecified && isHorizontalAxis && hasArrowSpecified && !isArrowMiddle) {
      isCenter = false;
      isBottom = isArrowStart;
      isTop = !isBottom;
    }
  }
  return {
    isOutside,
    isInside,
    isVerticalAxis,
    isHorizontalAxis,
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
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
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
 * Three-pass positioning function which takes the dom rectangles of the
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

  // Convert target DOMRect to DistanceRect
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

  // Convert the position string into some initial positioning variables
  let {
    isOutside,
    isInside,
    isVerticalAxis,
    isHorizontalAxis,
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
    // Convert DOMRect to DistanceRect
    const tooltipDistRect = convertToDistanceRect(tooltipDOMRect, clientDOMRect);
    const arrowDistRect = convertToDistanceRect(arrowDOMRect, clientDOMRect);
    // Constrain shapes to padding and, when target is not fixed position, the navigation bar
    const constrainedTargetDistRect = constrainDimensions(targetDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    const constrainedTooltipDistRect = constrainDimensions(tooltipDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    const constrainedArrowDistRect = constrainDimensions(arrowDistRect, viewPortPadding, isTargetFixedPosition, topNavOffset, bottomNavOffset);
    // Calculate the overall height and width of the tooltip and arrow according to the axis
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
    // Usually over-sized tooltips can't fit in the available height or width at the current shape
    const isBadShape = (!canFitHeightLength || !canFitWidthLength);
    // If the arrow and tooltip have fallen offscreen on their axis
    //   or if the tooltip can't fit onto the axis
    //   and there is more space on the other axis
    const isSwapAxis = (isArrowOffscreen && isHorizontalAxis && isOverflowVertical) ||
      (isArrowOffscreen && isVerticalAxis && isOverflowHorizontal) ||
      (isHorizontalAxis && !canFitInHorizontalArea && isVerticalAreaLarger) ||
      (isVerticalAxis && !canFitInVerticalArea && isHorizontalAreaLarger);
    // Break from height or width constraint
    //   If the axis is being swapped and the shape can't fit in its available area
    //    this is usually because of having too much text and a width constraint
    //   If the shape currently can't fit in its axis, but it can fit in the available area
    //     because its css width is contained
    const isFillArea = (isSwapAxis && isBadShape) ||
      (isVerticalAxis && isOverflow && isBadShape && (canFitInVerticalArea || isVerticalAreaLarger)) ||
      (isHorizontalAxis && isOverflow && isBadShape && (canFitInHorizontalArea || isHorizontalAreaLarger));

    if (pass === SECOND_PASS && (isBadShape || isOverflow)) {
      if (isSwapAxis) {
        // Move from left/right to up/down or from up/down to left/right
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
        // Switch to fitting top/bottom side
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
        // Switch to fitting left / right side
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

  // Add target, viewport and scroll positioning variables to CSS to allow positioning in LESS
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
