import Adapt from 'core/js/adapt';
import NavigationView from 'core/js/views/navigationView';
import device from './device';

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
    const $html = $('html');
    $html.addClass('is-nav-top');
    let navigationAlignment = adaptConfig?._navigationAlignment ?? 'top';
    const isBottomOnTouchDevices = (device.touch && adaptConfig?._isBottomOnTouchDevices);
    if (isBottomOnTouchDevices) navigationAlignment = 'bottom';
    $html.removeClass('is-nav-top').addClass('is-nav-' + navigationAlignment);
  }

}

export default new NavigationController();
