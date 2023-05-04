import ComponentModel from 'core/js/models/componentModel';
import data from '../data';

class ComponentMenuModel extends ComponentModel {

  setupModel() {
    this.setupChildListeners();
    this.init();
    _.defer(() => {
      this.checkCompletionStatus();
      this.checkInteractionCompletionStatus();
      this.checkLocking();
      this.checkVisitedStatus();
      this.setupTrackables();
    });
  }

  getChildren() {
    if (this._childrenCollection) {
      return this._childrenCollection;
    }

    const parentContentObject = this.findAncestor('contentobject');
    const id = parentContentObject.get('_id');
    // Look up child by _parentId from data
    const children = data.filter(model => model.get('_parentId') === id && model.isTypeGroup('contentobject'));
    const childrenCollection = new Backbone.Collection(children);

    this.setChildren(childrenCollection);
    return this._childrenCollection;
  }

}

export default ComponentMenuModel;
