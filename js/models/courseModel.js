import components from 'core/js/components';
import logging from 'core/js/logging';
import MenuModel from 'core/js/models/menuModel';

class CourseModel extends MenuModel {

  get _parent() {
    logging.deprecated('courseModel._parent, use courseModel.getParent() instead, parent models are defined by the JSON');
    return null;
  }

  get _siblings() {
    logging.deprecated('courseModel._siblings, use courseModel.getSiblings() instead, sibling models are defined by the JSON');
    return null;
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'course';
  }

}

components.register('course', { model: CourseModel });

export default CourseModel;
