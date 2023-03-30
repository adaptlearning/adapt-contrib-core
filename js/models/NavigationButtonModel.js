import LockingModel from 'core/js/models/lockingModel';

export default class NavigationButtonModel extends LockingModel {

  defaults() {
    return {
      _id: '',
      _order: 0,
      _event: '',
      text: '{{ariaLabel}}'
    };
  }

}
