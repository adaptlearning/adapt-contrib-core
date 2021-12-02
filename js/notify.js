import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import NotifyView from './views/notifyView';

export default (Adapt.notify = new NotifyView({model: new Backbone.Model()}));
