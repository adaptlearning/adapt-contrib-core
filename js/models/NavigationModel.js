/**
 * @file Navigation Model - Stores navigation bar layout configuration
 * @module core/js/models/NavigationModel
 */
import LockingModel from 'core/js/models/lockingModel';

/**
 * @class NavigationModel
 * @classdesc Holds `_navigation` course config used by
 * {@link module:core/js/views/navigationView NavigationView} to control alignment,
 * label visibility, and touch-device positioning of the navigation bar.
 */
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
