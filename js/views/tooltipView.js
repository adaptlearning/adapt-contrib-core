import Adapt from 'core/js/adapt';
import { templates } from 'core/js/reactHelpers';
import React from 'react';
import ReactDOM from 'react-dom';

export default class TooltipView extends Backbone.View {

  className() {
    return 'tooltip__container';
  }

  initialize() {
    this._classSet = new Set(_.result(this, 'className').trim().split(/\s+/));
    this.listenTo(this.model, 'all', this.changed);
    this.listenTo(Adapt, 'device:changed', this.changed);
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
  }

  updateViewProperties() {
    const classesToAdd = _.result(this, 'className').trim().split(/\s+/);
    classesToAdd.forEach(i => this._classSet.add(i));
    const classesToRemove = [ ...this._classSet ].filter(i => !classesToAdd.includes(i));
    classesToRemove.forEach(i => this._classSet.delete(i));
    this._setAttributes({ ..._.result(this, 'attributes'), id: _.result(this, 'id') });
    this.$el.removeClass(classesToRemove).addClass(classesToAdd);
  }

}