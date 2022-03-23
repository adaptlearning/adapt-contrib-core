import components from 'core/js/components';
import AdaptView from 'core/js/views/adaptView';

class BlockView extends AdaptView {

  className() {
    return [
      'block',
      this.model.get('_id'),
      this.model.get('_classes'),
      this.setVisibility(),
      this.setHidden(),
      (this.model.get('_isComplete') ? 'is-complete' : ''),
      (this.model.get('_isOptional') ? 'is-optional' : '')
    ].join(' ');
  }

}

Object.assign(BlockView, {
  childContainer: '.component__container',
  type: 'block',
  template: 'block'
});

components.register('block', { view: BlockView });

export default BlockView;
