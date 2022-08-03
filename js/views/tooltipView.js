import Adapt from 'core/js/adapt';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';

export default class TooltipView extends Backbone.View {

  attributes() {
    return {
      'aria-live':  'assertive'
    };
  }

  className() {
    return 'tooltip__container';
  }

  initialize(options) {
    this.$target = options.target;
    this._classSet = new Set(_.result(this, 'className').trim().split(/\s+/));
    this.listenTo(this.model, 'all', this.changed);
    this.listenTo(Adapt, 'device:changed', this.changed);
  }

  attach(method, ...args) {
    this.$el[method](...args);
    this.changed();
  }

  changed(eventName = null) {
    if (typeof eventName === 'string' && eventName.startsWith('bubble')) {
      // Ignore bubbling events as they are outside of this view's scope
      return;
    }
    const props = {
      // Add view own properties, bound functions etc
      ...this,
      // Add model json data
      ...this.model.toJSON(),
      // Add globals
      _globals: Adapt.course.get('_globals')
    };
    const Template = templates.tooltip;
    this.updateViewProperties();
    ReactDOM.render(<Template {...props} />, this.el);
    this.position();
  }

  updateViewProperties() {
    const classesToAdd = _.result(this, 'className').trim().split(/\s+/);
    classesToAdd.forEach(i => this._classSet.add(i));
    const classesToRemove = [ ...this._classSet ].filter(i => !classesToAdd.includes(i));
    classesToRemove.forEach(i => this._classSet.delete(i));
    this._setAttributes({ ..._.result(this, 'attributes'), id: _.result(this, 'id') });
    this.$el.removeClass(classesToRemove).addClass(classesToAdd);
  }

  position() {
    const targetBoundingRect = this.$target[0].getBoundingClientRect();

    // put the tooltip in the top left of the viewport
    this.$el.css({
      'left': `${$(window).scrollLeft()}px`,
      'top': `${$(window).scrollTop()}px`
    });

    // calculate optimum position
    const availableWidth = $('html')[0].clientWidth;
    const availableHeight = $('html')[0].clientHeight;
    let tooltipsWidth = this.$el.width();
    let tooltipsHeight = this.$el.height();
    const scrollTop = $(window).scrollTop();
    const scrollLeft = $(window).scrollLeft();
    const canAlignTop = targetBoundingRect.top - tooltipsHeight >= 0;
    const canAlignBottom = targetBoundingRect.bottom + tooltipsHeight < availableHeight;
    const canAlignLeft = targetBoundingRect.left - tooltipsWidth >= 0;
    const canAlignRight = targetBoundingRect.right + tooltipsWidth < availableWidth;
    const canAlignBottomRight = canAlignBottom && canAlignRight;
    const canAlignTopRight = canAlignTop && canAlignRight;
    const canAlignBottomLeft = canAlignBottom && canAlignLeft;
    const canAlignTopLeft = canAlignTop && canAlignLeft;

    const alignBottomRight = () => {
      //console.log('alignBottomRight');
      this.$el.css({
        'left': `${targetBoundingRect.right + scrollLeft}px`,
        'top': `${targetBoundingRect.bottom + scrollTop}px`
      });
    }

    const alignTopRight = () => {
      //console.log('alignTopRight');
      this.$el.css({
        'left': `${targetBoundingRect.right + scrollLeft}px`,
        'top': `${targetBoundingRect.top - tooltipsHeight + scrollTop}px`
      });
    }

    const alignBottomLeft = () => {
      //console.log('alignBottomLeft');
      this.$el.css({
        'left': `${targetBoundingRect.left - tooltipsWidth + scrollLeft}px`,
        'top': `${targetBoundingRect.bottom + scrollTop}px`
      });  
    }

    const alignTopLeft = () => {
      //console.log('alignTopLeft');
      this.$el.css({
        'left': `${targetBoundingRect.left - tooltipsWidth + scrollLeft}px`,
        'top': `${targetBoundingRect.top - tooltipsHeight + scrollTop}px`
      });
    }

    if (canAlignBottomRight) return alignBottomRight();
    if (canAlignTopRight) return alignTopRight();
    if (canAlignBottomLeft) return alignBottomLeft();
    if (canAlignTopLeft) return alignTopLeft();
    
    // find the 'corner' with the most space
    const isTopPreferred = availableHeight - (targetBoundingRect.bottom + tooltipsHeight) < targetBoundingRect.top - tooltipsHeight;
    const isLeftPreferred = availableWidth - (targetBoundingRect.right + tooltipsWidth) < targetBoundingRect.left - tooltipsWidth;

    if (isTopPreferred && isLeftPreferred) alignTopLeft();
    if (isTopPreferred) return alignTopRight();
    if (isLeftPreferred) return alignBottomLeft();
    alignBottomRight();
  }
}