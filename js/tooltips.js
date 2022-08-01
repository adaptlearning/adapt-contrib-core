import Adapt from 'core/js/adapt';
import TooltipView from 'core/js/views/tooltipView';
import _ from 'underscore';
import TooltipModel from './models/TooltipModel';

/**
 Usage
  
 In course.json:
  
 "_tooltips": [
    {
      "_id": "drawer",
      "text": "This is the drawer"
    },
    {
      "_id": "menuItem",
      "text": "This is a menu item"
    }
  ]

  Use with any DOM element:

  <div data-tooltip-id="drawer"></div>
 */

class TooltipController extends Backbone.Controller {

  initialize() {
    _.bindAll(this, ['onMouseOver', 'onMouseOut']);
    this.listenTo(Adapt, 'adapt:preInitialize', this.addTooltipsView);
    this.model = new TooltipModel();
    $(document).on('mouseover', '[data-tooltip-id]', this.onMouseOver);
  }

  addTooltipsView() {
    this.tooltipsView = new TooltipView({model: this.model});
    this.tooltipsView.$el.appendTo('body');
  }

  show(id) {
    this.model.setActive(id);
    this.checkVisibility();
  }

  hide() {
    this.model.setActive(null);
  }

  checkVisibility() {
    this.tooltipsView.$el.appendTo('body');
  }

  onMouseOver(e) {
    const $target = $(e.currentTarget);
    const id = $target.data('tooltip-id');

    if (this.$currentTarget === $target) return;

    this.$currentTarget = $target;
    
    const targetBoundingRect = $target[0].getBoundingClientRect();

    this.$currentTarget.on('mouseout', this.onMouseOut);

    // put the tooltip in the top left of the viewport prior to render
    this.tooltipsView.$el.css({
      'left': `${$(window).scrollLeft()}px`,
      'top': `${$(window).scrollTop()}px`
    });

    // render the tooltip
    this.show(id);

    // calculate optimum position
    const availableWidth = $('html')[0].clientWidth;
    const availableHeight = $('html')[0].clientHeight;
    let tooltipsWidth = this.tooltipsView.$el.width();
    let tooltipsHeight = this.tooltipsView.$el.height();
    const scrollTop = $(window).scrollTop();
    const scrollLeft = $(window).scrollLeft();
    const canAlignTop = targetBoundingRect.top - tooltipsHeight >= 0;
    const canAlignBottom = targetBoundingRect.bottom + tooltipsHeight + scrollTop < availableHeight;
    const canAlignLeft = targetBoundingRect.left - tooltipsWidth >= 0;
    const canAlignRight = targetBoundingRect.right + tooltipsWidth + scrollLeft < availableWidth;
    const canAlignBottomRight = canAlignBottom && canAlignRight;
    const canAlignTopRight = canAlignTop && canAlignRight;
    const canAlignBottomLeft = canAlignBottom && canAlignLeft;
    const canAlignTopLeft = canAlignTop && canAlignLeft;

    const alignBottomRight = () => {
      console.log('alignBottomRight');
      this.tooltipsView.$el.css({
        'left': `${targetBoundingRect.right + scrollLeft}px`,
        'top': `${targetBoundingRect.bottom + scrollTop}px`
      });
    }

    const alignTopRight = () => {
      console.log('alignTopRight');
      this.tooltipsView.$el.css({
        'left': `${targetBoundingRect.right + scrollLeft}px`,
        'top': `${targetBoundingRect.top - tooltipsHeight + scrollTop}px`
      });
    }

    const alignBottomLeft = () => {
      console.log('alignBottomLeft');
      this.tooltipsView.$el.css({
        'left': `${targetBoundingRect.left - tooltipsWidth + scrollLeft}px`,
        'top': `${targetBoundingRect.bottom + scrollTop}px`
      });  
    }

    const alignTopLeft = () => {
      console.log('alignTopLeft');
      this.tooltipsView.$el.css({
        'left': `${targetBoundingRect.left - tooltipsWidth + scrollLeft}px`,
        'top': `${targetBoundingRect.top - tooltipsHeight + scrollTop}px`
      });
    }

    if (canAlignBottomRight) {
      alignBottomRight();
    } else if (canAlignTopRight) {
      alignTopRight();
    } else if (canAlignBottomLeft) {
      alignBottomLeft();
    } else if (canAlignTopLeft) {
      alignTopLeft();
    } else {
      // find the 'corner' with the most space
      const isTopPreferred = availableHeight - (targetBoundingRect.bottom + tooltipsHeight) < targetBoundingRect.top - tooltipsHeight;
      const isLeftPreferred = availableWidth - (targetBoundingRect.right + tooltipsWidth) < targetBoundingRect.left - tooltipsWidth;

      if (isTopPreferred) {
        isLeftPreferred ? alignTopLeft() : alignTopRight();
      } else {
        isLeftPreferred ? alignBottomLeft() : alignBottomRight();
      }
    }
  }

  onMouseOut(e) {
    const $target = $(e.currentTarget);

    if (this.$currentTarget[0] !== $target[0]) return;

    this.hide();
  }
}

export default new TooltipController();
