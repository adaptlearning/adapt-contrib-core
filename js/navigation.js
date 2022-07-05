import Adapt from 'core/js/adapt';
import NavigationView from 'core/js/views/navigationView';

class NavigationController extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'adapt:preInitialize': this.addNavigationBar,
      'adapt:preInitialize device:resize': this.onDeviceResize
    });
  }

  addNavigationBar() {
    const adaptConfig = Adapt.course.get('_navigation');

    if (adaptConfig?._isDefaultNavigationDisabled) {
      Adapt.trigger('navigation:initialize');
      return;
    }

    Adapt.navigation = new NavigationView();// This should be triggered after 'app:dataReady' as plugins might want to manipulate the navigation
  }

  onDeviceResize() {
    const adaptConfig = Adapt.course.get('_navigation');
    if (!adaptConfig?._bottomOnSelector) return;
    const $html = $('html');
    const isBottomNavigation = $html.is(adaptConfig._bottomOnSelector);
    $html.toggleClass('is-nav-bottom', isBottomNavigation);
  }

}

export default new NavigationController();
