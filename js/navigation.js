/**
 * @file Navigation Controller - Bootstraps and exposes the navigation bar
 * @module core/js/navigation
 * @description Instantiates {@link module:core/js/views/navigationView NavigationView} and
 * starts it with a {@link module:core/js/models/NavigationModel NavigationModel} once course
 * data is ready. Exports the running `NavigationView` instance as `Adapt.navigation`.
 *
 * @example
 * import navigation from 'core/js/navigation';
 * navigation.addButton(myButtonView);
 */
import Adapt from 'core/js/adapt';
import NavigationView from 'core/js/views/navigationView';
import NavigationModel from './models/NavigationModel';

class NavigationController extends Backbone.Controller {

  initialize() {
    this.navigation = new NavigationView();
    this.listenTo(Adapt, 'adapt:preInitialize', this.addNavigationBar);
  }

  /**
   * Reads `_navigation` course config and starts the navigation bar, unless
   * `_isDefaultNavigationDisabled` is set, in which case only the
   * `navigation:initialize` event is fired so plugins can provide their own bar.
   * @fires navigation:initialize
   */
  addNavigationBar() {
    const adaptConfig = Adapt.course.get('_navigation');
    if (adaptConfig?._isDefaultNavigationDisabled) {
      Adapt.trigger('navigation:initialize');
      return;
    }
    this.navigation.start(new NavigationModel(adaptConfig));
  }

}

export default (Adapt.navigation = (new NavigationController()).navigation);
