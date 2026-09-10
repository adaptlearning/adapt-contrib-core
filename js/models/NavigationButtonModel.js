/**
 * @file Navigation Button Model - Stores configuration for a single navigation button
 * @module core/js/models/NavigationButtonModel
 */
import LockingModel from 'core/js/models/lockingModel';

/**
 * @class NavigationButtonModel
 * @classdesc Holds display and behaviour config for one button in the navigation bar.
 * Consumed by {@link module:core/js/views/NavigationButtonView NavigationButtonView}.
 */
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
