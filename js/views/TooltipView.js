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
    this.position();
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

  position() {
    const targetBoundingRect = this.$target[0].getBoundingClientRect();
    // Calculate optimum position
    const availableWidth = $('html')[0].clientWidth;
    const availableHeight = $('html')[0].clientHeight;
    const tooltipsWidth = this.$('.tooltip').width();
    const tooltipsHeight = this.$('.tooltip').height();
    const scrollTop = $(window).scrollTop();
    const scrollLeft = $(window).scrollLeft();
    const canAlignBottom = targetBoundingRect.bottom + tooltipsHeight < availableHeight;
    const canAlignRight = targetBoundingRect.right + tooltipsWidth < availableWidth;
    const canAlignBottomRight = canAlignBottom && canAlignRight;
    function getPosition() {
      if (!canAlignBottomRight) {
        // Find the 'corner' with the most space from the viewport edge
        const isTopPreferred = availableHeight - (targetBoundingRect.bottom + tooltipsHeight) < targetBoundingRect.top - tooltipsHeight;
        const isLeftPreferred = availableWidth - (targetBoundingRect.right + tooltipsWidth) < targetBoundingRect.left - tooltipsWidth;
        if (isTopPreferred && isLeftPreferred) {
          // Top left
          return {
            left: `${targetBoundingRect.left - tooltipsWidth + scrollLeft}px`,
            top: `${targetBoundingRect.top - tooltipsHeight + scrollTop}px`
          };
        }
        if (isTopPreferred) {
          // Top right
          return {
            left: `${targetBoundingRect.right + scrollLeft}px`,
            top: `${targetBoundingRect.top - tooltipsHeight + scrollTop}px`
          };
        }
        if (isLeftPreferred) {
          // Bottom left
          return {
            left: `${targetBoundingRect.left - tooltipsWidth + scrollLeft}px`,
            top: `${targetBoundingRect.bottom + scrollTop}px`
          };
        }
      }
      // Bottom right, default
      return {
        left: `${targetBoundingRect.right + scrollLeft}px`,
        top: `${targetBoundingRect.bottom + scrollTop}px`
      };
    }
    this.model.set(getPosition());
  }
}
