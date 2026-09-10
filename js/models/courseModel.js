/**
 * @file Course Model - Top-level course data model
 * @module core/js/models/courseModel
 * @description Data model for the course root node. Extends {@link module:core/js/models/menuModel~MenuModel}
 * to represent the top-level course container. Registered as the 'course' component type.
 */

import components from 'core/js/components';
import logging from 'core/js/logging';
import MenuModel from 'core/js/models/menuModel';

/**
 * @class CourseModel
 * @classdesc Top-level course data model. Represents the root course node in the Adapt
 * content hierarchy. The course is the parent of all content objects and has no parent
 * of its own. Extends {@link module:core/js/models/menuModel~MenuModel} with course-specific
 * type identification.
 * @extends MenuModel
 */
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
