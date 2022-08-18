import 'core/js/wait';
import 'core/js/deprecated.js';
import 'core/js/components';
import 'core/js/templates';
import 'core/js/fixes';
import 'core/js/offlineStorage';
import 'core/js/tracking';
import 'core/js/models/lockingModel';
import 'core/js/helpers';
import Handlebars from 'handlebars';
import $ from 'jquery';

$('body').append(Handlebars.templates.loading());
