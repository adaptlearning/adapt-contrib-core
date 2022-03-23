import components from 'core/js/components';
import AdaptView from 'core/js/views/adaptView';

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
