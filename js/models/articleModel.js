/**
 * @file Article Model - Article data model
 * @module core/js/models/articleModel
 * @description Data model for article content. Extends
 * {@link module:core/js/models/adaptModel~AdaptModel} to represent articles in the
 * Adapt content hierarchy. Articles are children of content objects (pages) and
 * parents of blocks. Registered as the 'article' component type.
 */

import components from 'core/js/components';
import logging from 'core/js/logging';
import AdaptModel from 'core/js/models/adaptModel';

/**
 * @class ArticleModel
 * @classdesc Data model for an article. Articles are mid-level content containers
 * in the Adapt hierarchy, sitting between content objects (pages) and blocks.
 * Each article holds one or more blocks.
 * @extends AdaptModel
 */
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
