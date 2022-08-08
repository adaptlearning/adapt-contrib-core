import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';

export default class TooltipView extends Backbone.View {

  attributes() {
    return {
      'aria-live': 'assertive'
    };
  }

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
    this.$el.addClass('is-loading is-shown');
    this.listenTo(this.model, 'all', this.render);
    this.render();
    this.position($mouseoverEl);
    this.$el.removeClass('is-loading');
  }

  hide() {
    this.stopListening(this.model);
    this.model = null;
    this.$target = null;
    this.$el.removeClass('is-shown');
  }

  render() {
    const Template = templates.tooltip;
    ReactDOM.render(<Template {...this.model.toJSON()} />, this.el);
  }

  position($mouseoverEl) {
    const targetBoundingRect = this.$target[0].getBoundingClientRect();
    
    const availableWidth = $('html')[0].clientWidth;
    const availableHeight = $('html')[0].clientHeight;
    const tooltipsWidth = this.$('.tooltip').width();
    const tooltipsHeight = this.$('.tooltip').height();
    
    const canAlignBottom = targetBoundingRect.bottom + tooltipsHeight < availableHeight;
    const canAlignRight = targetBoundingRect.right + tooltipsWidth < availableWidth;
    const canAlignBottomRight = canAlignBottom && canAlignRight;

    const isFixedPosition = Boolean($mouseoverEl.parents().add($mouseoverEl).filter((index, el) => $(el).css
    ('position') === 'fixed').length);
    const scrollOffsetTop = isFixedPosition ? 0 : $(window).scrollTop();
    const scrollOffsetLeft = isFixedPosition ? 0 : $(window).scrollLeft();

    this.model.set('_isFixedPosition', isFixedPosition);

    function getPosition() {
      if (!canAlignBottomRight) {
        // Find the 'corner' with the most space from the viewport edge
        const isTopPreferred = availableHeight - (targetBoundingRect.bottom + tooltipsHeight) < targetBoundingRect.top - tooltipsHeight;
        const isLeftPreferred = availableWidth - (targetBoundingRect.right + tooltipsWidth) < targetBoundingRect.left - tooltipsWidth;
        if (isTopPreferred && isLeftPreferred) {
          // Top left
          return {
            left: `${targetBoundingRect.left - tooltipsWidth + scrollOffsetLeft}px`,
            top: `${targetBoundingRect.top - tooltipsHeight + scrollOffsetTop}px`
          };
        }
        if (isTopPreferred) {
          // Top right
          return {
            left: `${targetBoundingRect.right + scrollOffsetLeft}px`,
            top: `${targetBoundingRect.top - tooltipsHeight + scrollOffsetTop}px`
          };
        }
        if (isLeftPreferred) {
          // Bottom left
          return {
            left: `${targetBoundingRect.left - tooltipsWidth + scrollOffsetLeft}px`,
            top: `${targetBoundingRect.bottom + scrollOffsetTop}px`
          };
        }
      }
      // Bottom right, default
      return {
        left: `${targetBoundingRect.right + scrollOffsetLeft}px`,
        top: `${targetBoundingRect.bottom + scrollOffsetTop}px`
      };
    }
    this.model.set(getPosition());
  }
}
