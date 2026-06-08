/**
 * @file Start Controller - Manages course start location and routing behavior
 * @module core/js/startController
 * @description Singleton service that controls where learners begin the course based on
 * `_start` configuration in course.json. Supports conditional start pages, forced routing,
 * and return-to-start functionality.
 *
 * **Architecture:**
 * - Singleton controller extending Backbone.Controller
 * - Loads `_start` configuration from Adapt.course model
 * - Coordinates with router service for navigation
 * - Coordinates with data service for model lookups
 * - Manages session state to prevent duplicate start location logic
 *
 * **Configuration (_start in course.json):**
 * ```json
 * {
 *   "_isEnabled": true,
 *   "_force": false,
 *   "_id": "co-05",
 *   "_startIds": [
 *     {
 *       "_id": "co-10",
 *       "_skipIfComplete": true,
 *       "_className": ".brand-a"
 *     }
 *   ]
 * }
 * ```
 *
 * **Start Location Resolution:**
 * 1. Check if `_isEnabled` is true (if false, use default routing)
 * 2. Check `_startIds` array for conditional start pages
 * 3. For each start ID, check `_className` against html element
 * 4. Skip start ID if `_skipIfComplete` is true and content is complete
 * 5. Use first matching start ID, or fall back to `_id`
 * 6. If `_force` is true, ignore URL hash and use start location
 *
 * **Use Cases:**
 * - Role-based start pages (different entry points for different learner types)
 * - Continuation from last incomplete page
 * - Device-specific start pages (mobile vs desktop)
 * - Language-specific entry points
 *
 * **Public Events Triggered:**
 * This service responds to events but doesn't trigger custom events.
 *
 * **Public Events Listened To:**
 * - `adapt:start` - Framework starting, set initial location
 * - `navigation:returnToStart` - User clicked return-to-start button
 *
 * @example
 * import startController from 'core/js/startController';
 *
 * Adapt.trigger('navigation:returnToStart');
 */
import Adapt from 'core/js/adapt';
import LockingModel from 'core/js/models/lockingModel';
import router from 'core/js/router';
import data from 'core/js/data';

/**
 * @typedef {Object} StartIdConfig
 * @property {string} _id - Content object ID to use as start location
 * @property {boolean} [_skipIfComplete=false] - Skip this start location if content is complete
 * @property {string} [_className] - CSS selector to match against html element
 */

/**
 * @typedef {Object} StartConfiguration
 * @property {boolean} _isEnabled - Whether start location control is enabled
 * @property {boolean} [_force=false] - Force start location ignoring URL hash
 * @property {string} _id - Default start content object ID
 * @property {Array<StartIdConfig>} [_startIds] - Conditional start location configurations
 * @property {boolean} [_isMenuDisabled=false] - Prevent navigation to root menu when _isEnabled
 */

/**
 * @class StartController
 * @classdesc Controller managing course start location based on _start configuration.
 * Singleton instance exported as `startController`. Do not instantiate directly.
 * @extends {Backbone.Controller}
 */
class StartController extends Backbone.Controller {

  initialize(...args) {
    super.initialize(...args);
    this._isSessionInProgress = false;
    this.model = null;
    this.setupListeners();
  }

  setupListeners() {
    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart,
      'navigation:returnToStart': this.returnToStartLocation
    });
  }

  loadCourseData() {
    this.model = new LockingModel(Adapt.course.get('_start'));
  }

  /**
   * Sets the initial course navigation location based on _start configuration.
   * On first call, updates browser history without triggering navigation.
   * On subsequent calls (language change), navigates to start location.
   *
   * **Behavior:**
   * - First call: Uses history.replaceState to update URL without navigation
   * - Subsequent calls: Uses router.navigate to trigger full navigation
   * - Respects _isEnabled flag (falls back to default routing if disabled)
   *
   * @private
   */
  setStartLocation() {
    if (!this._isSessionInProgress) {
      this._isSessionInProgress = true;
      if (!this.isEnabled()) return;
      return window.history.replaceState('', '', this.getStartHash());
    }
    // ensure we can return to the start page even if it is completed
    const hash = this.isEnabled() ? this.getStartHash(false) : '#/';
    router.navigate(hash, { trigger: true, replace: true });
  }

  /**
   * Navigates back to the course start location.
   * Resets `_skipIfComplete` flags to ensure completed start pages are accessible.
   * Can be triggered via event or button click.
   *
   * **Triggering Methods:**
   * - Event: `Adapt.trigger('navigation:returnToStart')`
   * - Button: Add `data-event="returnToStart"` to navigation button
   * - Direct: `startController.returnToStartLocation()`
   *
   * @example
   * Adapt.trigger('navigation:returnToStart');
   *
   * @example
   * startController.returnToStartLocation();
   */
  returnToStartLocation() {
    const startIds = this.model.get('_startIds');
    if (startIds) {
      startIds.forEach(startId => (startId._skipIfComplete = false));
    }
    window.location.hash = this.getStartHash(true);
  }

  /**
   * Calculates the URL hash for the course start location.
   * Determines whether to use configured start location or existing URL hash.
   *
   * **Resolution Logic:**
   * 1. Get start ID from getStartId() (handles conditional start pages)
   * 2. Check if URL already has a hash (learner bookmarked a page)
   * 3. If alwaysForce=true or _force=true, ignore existing hash
   * 4. If start ID exists and should be used, return `#/id/{startId}`
   * 5. Otherwise return existing hash or `#/` (default menu)
   *
   * @param {boolean} [alwaysForce=false] - Ignore existing URL hash and force start location
   * @returns {string} URL hash string (e.g., '#/id/co-05' or '#/')
   * @example
   * const hash = startController.getStartHash();
   *
   * @example
   * const hash = startController.getStartHash(true);
   */
  getStartHash(alwaysForce) {
    const startId = this.getStartId();
    const isRouteSpecified = window.location.href.indexOf('#') > -1;
    const shouldForceStartId = alwaysForce || this.model.get('_force');
    const shouldNavigateToStartId = startId && (!isRouteSpecified || shouldForceStartId);
    if (shouldNavigateToStartId && startId !== Adapt.course.get('_id')) return `#/id/${startId}`;
    // If there's a route specified in location.hash, use that - otherwise go to main menu
    return window.location.hash || '#/';
  }

  isEnabled() {
    return Boolean(this.model?.get('_isEnabled'));
  }

  /**
   * Resolves the actual start content ID based on conditional logic.
   * Evaluates `_startIds` array to find first matching start location.
   *
   * **Resolution Process:**
   * 1. Start with default `_id` from _start configuration
   * 2. If `_startIds` array exists, evaluate each entry in order:
   *    - Check if content model exists (skip if not found)
   *    - Check if `_skipIfComplete` is true and content is complete (skip if so)
   *    - Check if `_className` matches html element (use if matches or no className)
   *    - Use first matching ID and stop evaluation
   * 3. Return resolved start ID
   *
   * **Conditional Start Page Examples:**
   * - Role-based: `_className: ".role-manager"` for managers
   * - Device-based: `_className: ".size-small"` for mobile
   * - Continuation: `_skipIfComplete: true` to skip completed intro
   *
   * @returns {string} Content model ID to use as start location
   * @example
   * const startId = startController.getStartId();
   * router.navigate(`#/id/${startId}`, { trigger: true });
   */
  getStartId() {
    let startId = this.model.get('_id');
    const startIds = this.model.get('_startIds');
    if (!startIds?.length) return startId;
    const $html = $('html');
    for (let i = 0, l = startIds.length; i < l; i++) {
      const item = startIds[i];
      const className = item._className;
      const skipIfComplete = item._skipIfComplete;
      const model = data.findById(item._id);
      if (!model) {
        console.log('startController: cannot find id', item._id);
        continue;
      }
      if (skipIfComplete && model.get('_isComplete')) continue;
      if (!className || $html.is(className) || $html.hasClass(className)) {
        // See https://github.com/adaptlearning/adapt_framework/issues/1843
        startId = item._id;
        break;
      }
    }
    return startId;
  }

  onAdaptStart() {
    this.loadCourseData();
    this.setStartLocation();
  }

}

const startController = new StartController();
export default startController;
