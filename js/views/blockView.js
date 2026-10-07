/**
 * @file Block View - Renders a block within an article
 * @module core/js/views/blockView
 * @description Renders a block content object containing one or more components.
 * Registered as the 'block' component type. Components inside the block are
 * laid out according to each component's `_layout` attribute.
 */
import components from 'core/js/components';
import AdaptView from 'core/js/views/adaptView';

/**
 * @class BlockView
 * @classdesc View for block content objects. A block is a row-level grouping
 * within an article and contains one or more components. Registered as the
 * default 'block' component view. All rendering and child-view management is
 * provided by {@link module:core/js/views/adaptView~AdaptView}.
 * @extends AdaptView
 */
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
