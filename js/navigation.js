import Adapt from 'core/js/adapt';
import NavigationView from 'core/js/views/navigationView';
import NavigationModel from './models/NavigationModel';

class NavigationController extends Backbone.Controller {

  initialize() {
    this.navigation = new NavigationView();
    this.listenTo(Adapt, 'adapt:preInitialize', this.addNavigationBar);
  }

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
