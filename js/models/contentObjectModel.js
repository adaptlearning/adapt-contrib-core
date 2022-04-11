import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';
import AdaptModel from 'core/js/models/adaptModel';

export default class ContentObjectModel extends AdaptModel {

  get _parent() {
    logging.deprecated('contentObjectModel._parent, use contentObjectModel.getParent() instead, parent models are defined by the JSON');
    const isParentCourse = (this.get('_parentId') === Adapt.course.get('_id'));
    if (isParentCourse) {
      return 'course';
    }
    return 'contentObjects';
  }

  get _siblings() {
    logging.deprecated('contentObjectModel._siblings, use contentObjectModel.getSiblings() instead, sibling models are defined by the JSON');
    return 'contentObjects';
  }

  get _children() {
    logging.deprecated('contentObjectModel._children, use contentObjectModel.hasManagedChildren instead, child models are defined by the JSON');
    return null;
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'contentobject';
  }

}
