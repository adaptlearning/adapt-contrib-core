/**
 * @file Article View - Renders an article within a page
 * @module core/js/views/articleView
 * @description Renders an article content object containing one or more blocks.
 * Registered as the 'article' component type. Provides standard Adapt class
 * composition including visibility, hidden, complete, and optional state flags.
 */
import components from 'core/js/components';
import AdaptView from 'core/js/views/adaptView';

/**
 * @class ArticleView
 * @classdesc View for article content objects. An article is a top-level grouping
 * within a page and contains one or more blocks. Registered as the default 'article'
 * component view. All rendering and child-view management is provided by
 * {@link module:core/js/views/adaptView~AdaptView}.
 * @extends AdaptView
 */
class ArticleView extends AdaptView {

  className() {
    return [
      'article',
      this.model.get('_id'),
      this.model.get('_classes'),
      this.setVisibility(),
      this.setHidden(),
      (this.model.get('_isComplete') ? 'is-complete' : ''),
      (this.model.get('_isOptional') ? 'is-optional' : '')
    ].join(' ');
  }

}

Object.assign(ArticleView, {
  childContainer: '.block__container',
  type: 'article',
  template: 'article'
});

components.register('article', { view: ArticleView });

export default ArticleView;
