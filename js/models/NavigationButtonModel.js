import LockingModel from 'core/js/models/lockingModel';

export default class NavigationButtonModel extends LockingModel {

  defaults() {
    return {
      _id: '',
      _classes: '',
      _iconClasses: '',
      _order: 0,
      _event: '',
      _showLabel: null,
      _role: 'button',
      ariaLabel: '',
      text: '{{ariaLabel}}'
    };
  }

}
