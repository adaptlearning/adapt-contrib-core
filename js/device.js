import Adapt from 'core/js/adapt';
import Bowser from 'bowser';
import _ from 'underscore';

class Device extends Backbone.Controller {

  initialize() {
    _.bindAll(this, 'onWindowResize', 'calculateResize');
    this.bowser = Bowser.parse(window.navigator.userAgent);
    this.$html = $('html');
    this.$window = $(window);
    this.touch = Modernizr.touchevents;
    this.screenWidth = this.getScreenWidth();
    this.screenHeight = this.getScreenHeight();
    this.setViewportHeight();
    this.browser = (this.bowser.browser.name || '').toLowerCase();
    this.version = (this.bowser.browser.version || '').toLowerCase();
    this.OS = this.getOperatingSystem().toLowerCase();
    this.osVersion = this.bowser.os.version || '';
    this.renderingEngine = this.getRenderingEngine();
    this.listenTo(Adapt, {
      'configModel:dataLoaded': this.onConfigDataLoaded,
      'navigationView:postRender': this.setNavigationHeight
    });
    const browser = this.browser.toLowerCase();
    // Convert 'msie' and 'internet explorer' to 'ie'.
    let browserString = browser.replace(/msie|internet explorer/, 'ie');
    browserString += ` version-${this.version} OS-${this.OS} ${this.getAppleDeviceType()}`;
    // Legacy bad code, missing space after getAppleDevice and string replace is not global
    browserString += browserString.replace('.', '-').toLowerCase();
    browserString += ` ${browserString.replace(/\./g, '-').toLowerCase()}`;
    browserString += ` pixel-density-${this.pixelDensity()}`;
    this.$html.addClass(browserString);
  }

  get orientation() {
    return (this.screenWidth >= this.screenHeight) ? 'landscape' : 'portrait';
  }

  get aspectRatio() {
    return this.screenWidth / this.screenHeight;
  }

  onConfigDataLoaded() {
    this.screenSize = this.checkScreenSize();
    this.$html.addClass('size-' + this.screenSize);
    if (this.orientation) {
      this.$html.addClass('orientation-' + this.orientation);
    }
    // As Adapt.config is available it's ok to bind the 'resize'.
    this.$window.on('resize orientationchange', this.onWindowResize);
  }

  /**
   * Returns an object of screen size names and em values
   * @returns {Object}
   */
  get screenSizes() {
    const screenSizes = { ...Adapt.config.get('screenSize') };
    const screenSizesList = Object.entries(screenSizes);
    const screensizeEmThreshold = 300;
    const baseFontSize = 16;
    for (const [name, value] of screenSizesList) {
      // Check to see if the screen size value is larger than the em threshold
      // If value is larger than em threshold, convert value (assumed px) to ems
      // Otherwise assume value is in ems
      screenSizes[name] = value > screensizeEmThreshold
        ? value / baseFontSize
        : value;
    }
    return screenSizes;
  }

  /**
   * Returns a boolean if the current screen size is equal to or above the named
   * screen size.
   * @param {string} name
   * @returns {boolean}
   */
  isScreenSizeMin(name) {
    return Boolean(window.matchMedia(`(min-width: ${this.screenSizes[name]}em)`)?.matches);
  }

  /**
   * Returns the calculated screen width name.
   * @returns {string} 'large', 'medium' or 'small'
   */
  checkScreenSize() {
    const screenSizesList = Object.entries(this.screenSizes);
    screenSizesList.sort((a, b) => a[1] - b[1]);
    const fontSize = parseFloat($('html').css('font-size'));
    const screenSizeEmWidth = (window.innerWidth / fontSize);
    const smallestScreenSize = screenSizesList[0][0];
    // Find the best sized screen size
    const screenSize = screenSizesList.reduce((screenSize, [name, value]) => {
      if (screenSizeEmWidth >= value) return name;
      return screenSize;
    }, smallestScreenSize);
    return screenSize;
  }

  getScreenWidth() {
    return this.isAppleDevice()
      ? this.getAppleScreenWidth()
      : window.innerWidth || this.$window.width();
  }

  getScreenHeight() {
    return this.isAppleDevice()
      ? this.getAppleScreenHeight()
      : window.innerHeight || this.$window.height();
  }

  setViewportHeight() {
    document.documentElement.style.setProperty('--adapt-viewport-height', `${window.innerHeight}px`);
  }

  setNavigationHeight() {
    document.documentElement.style.setProperty('--adapt-navigation-height', `${$('.nav').height()}px`);
  }

  getOperatingSystem() {
    let os = this.bowser.os.name.toLowerCase() || '';

    if (os === '') {
      // Fall back to using navigator.platform in case Bowser can't detect the OS.
      const platform = navigator.platform.toLowerCase();
      const match = platform.match(/win|mac|linux/);
      if (match) os = match[0];
      // Set consistency with the Bowser flags.
      if (os === 'win') os = 'windows';
      if (!os) os = '';
    }

    if (!os) os = 'platformunknown';

    return os;
  }

  getRenderingEngine() {
    return this.bowser.engine.name || '';
  }

  onWindowResize() {
    if (this.hasWindowResized) return;
    requestAnimationFrame(this.calculateResize);
    this.hasWindowResized = true;
  }

  calculateResize() {
    this.hasWindowResized = false;
    // Calculate the screen properties.
    const previousWidth = this.screenWidth;
    const previousHeight = this.screenHeight;
    this.screenWidth = this.getScreenWidth();
    this.screenHeight = this.getScreenHeight();
    this.setViewportHeight();
    this.setNavigationHeight();

    if (previousWidth === this.screenWidth && previousHeight === this.screenHeight) {
      // Do not trigger a change if the viewport hasn't actually changed.  Scrolling on iOS will trigger a resize.
      return;
    }

    if (this.orientation) {
      this.$html.toggleClass('orientation-landscape', this.orientation === 'landscape');
      this.$html.toggleClass('orientation-portrait', this.orientation === 'portrait');
    }

    const newScreenSize = this.checkScreenSize();
    if (newScreenSize !== this.screenSize) {
      this.screenSize = newScreenSize;
      const screenSizes = this.screenSizes;
      for (const name in screenSizes) {
        if (name === this.screenSize) continue;
        this.$html.removeClass(`size-${name}`);
      }
      this.$html.toggleClass(`size-${this.screenSize}`, true);
      Adapt.trigger('device:changed', this.screenSize);
    }

    Adapt.trigger('device:preResize device:resize device:postResize', this.screenWidth);
  }

  isAppleDevice() {
    return (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) || (navigator.userAgent.match(/Mac/) && navigator?.maxTouchPoints > 2);
  }

  get shouldReportInvertedAppleScreenSize() {
    const windowRatio = (window.innerWidth / window.innerHeight);
    const screenRatio = (window.screen.width / window.screen.height);
    const isWindowPortrait = (windowRatio < 1);
    const isScreenPortrait = (screenRatio < 1);
    const isDeviceBadlyReportingScreenOrientation = (isWindowPortrait !== isScreenPortrait);
    return isDeviceBadlyReportingScreenOrientation;
  }

  getAppleScreenWidth() {
    return this.shouldReportInvertedAppleScreenSize ? window.screen.height : window.screen.width;
  }

  getAppleScreenHeight() {
    return this.shouldReportInvertedAppleScreenSize ? window.screen.width : window.screen.height;
  }

  getAppleDeviceType() {
    const platformType = this.bowser.platform.type?.toLowerCase() || '';
    const browserName = this.bowser.browser.name?.toLowerCase() || '';
    const isIPhone = (platformType === 'mobile' && browserName === 'safari');
    const isIPad = (platformType === 'tablet' && browserName === 'safari');
    if (isIPhone) return 'iphone';
    if (isIPad) return 'ipad';
    return '';
  }

  pixelDensity() {
    const pixelDensity = (window.devicePixelRatio || 1);

    if (pixelDensity >= 3) {
      return 'ultra-high';
    } else if (pixelDensity >= 2) {
      return 'high';
    } else if (pixelDensity >= 1.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

}

const device = new Device();
export default device;
