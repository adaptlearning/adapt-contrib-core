import Backbone from 'backbone';
import Adapt from 'core/js/adapt';

export default class TooltipModel extends Backbone.Model {

  defaults() {
    return {
      text:''
    };
  }

  setActive(id) {
    if (id === this.get('_activeId')) return;

    this.set('_activeId', id);
    
    if (!id) return;

    const tooltipData = Adapt.course.get('_tooltips');
    const data = tooltipData.find(tooltip => tooltip._id === id);

    if (!data) return;

    this.set(data);
  }
}
