import components from 'core/js/components';
import logging from 'core/js/logging';
import AdaptModel from 'core/js/models/adaptModel';

class ArticleModel extends AdaptModel {

  get _parent() {
    logging.deprecated('articleModel._parent, use articleModel.getParent() instead, parent models are defined by the JSON');
    return 'contentObjects';
  }

  get _siblings() {
    logging.deprecated('articleModel._siblings, use articleModel.getSiblings() instead, sibling models are defined by the JSON');
    return 'articles';
  }

  get _children() {
    logging.deprecated('articleModel._children, use articleModel.hasManagedChildren instead, child models are defined by the JSON');
    return 'blocks';
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'article';
  }

}

components.register('article', { model: ArticleModel });

export default ArticleModel;
