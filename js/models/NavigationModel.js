import LockingModel from 'core/js/models/lockingModel';

export default class NavigationModel extends LockingModel {

  defaults() {
    return {
      _navigationAlignment: 'top',
      _isBottomOnTouchDevices: false,
      _showLabel: false,
      _showLabelAtWidth: 'medium',
      _labelPosition: 'auto'
    };
  }

}
