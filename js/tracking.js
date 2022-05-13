import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';

class Tracking extends Backbone.Controller {

  initialize() {
    this._config = {
      _requireContentCompleted: true,
      _requireAssessmentCompleted: false,
      _shouldSubmitScore: false
    };
    this._assessments = null;

    Adapt.once('configModel:dataLoaded', this.loadConfig.bind(this));
    Adapt.on('app:dataReady', this.setupEventListeners.bind(this));
  }

  setupEventListeners() {
    this.listenTo(Adapt, {
      'assessments:complete': this.onAssessmentsComplete,
      'assessments:restored': this.onAssessmentsRestored
    });

    // Check if completion requires completing all content.
    if (this._config._requireContentCompleted) {
      this.listenTo(Adapt.course, 'change:_isComplete', this.checkCompletion);
    }
  }

  submitScore() {
    if (!this._config._shouldSubmitScore) return;

    if (this._assessments.passmark.isScaled) {
      Adapt.offlineStorage.set('score', this._assessments.scaledScore, 0, 100);
    } else {
      Adapt.offlineStorage.set('score', this._assessments.score, this._assessments.minScore, this._assessments.maxScore);
    }
  }

  /**
   * Evaluate the course and assessment completion.
   */
  checkCompletion() {
    const completionData = this.getCompletionData();
    const status = completionData.status;
    if (status === COMPLETION_STATE.INCOMPLETE) return;
    if (status === COMPLETION_STATE.FAILED && this._assessments?.canRetry) return;
    Adapt.trigger('tracking:complete', completionData);
    Adapt.log.debug('tracking:complete', completionData);
  }

  /**
   * The return value of this function should be passed to the trigger of 'tracking:complete'.
   * @returns An object representing the user's course completion.
   */
  getCompletionData() {
    const completionData = {
      status: COMPLETION_STATE.INCOMPLETE,
      assessment: null
    };

    // Course complete is required.
    if (this._config._requireContentCompleted && !Adapt.course.get('_isComplete')) {
      // INCOMPLETE: course not complete.
      return completionData;
    }

    // Assessment completed required.
    if (this._config._requireAssessmentCompleted) {
      // INCOMPLETE: assessment is not complete.
      if (!this._assessments) return completionData;
      // PASSED/FAILED: assessment completed.
      completionData.status = this._assessments.isPassed ? COMPLETION_STATE.PASSED : COMPLETION_STATE.FAILED;
      completionData.assessment = this._assessments;
      return completionData;
    }

    // COMPLETED: criteria met, no assessment requirements.
    completionData.status = COMPLETION_STATE.COMPLETED;
    return completionData;
  }

  /**
   * Set the _config object to the values retrieved from config.json.
   */
  loadConfig() {
    this._config = Adapt.config.get('_completionCriteria') ?? this._config;
    const newShouldSubmitScore = this._config._shouldSubmitScore;
    const legacyShouldSubmitScore = Adapt.config.get('_spoor')?._tracking?._shouldSubmitScore;
    // If the legacy property exists, use it for backward compatibility but warn in the console
    if (legacyShouldSubmitScore !== undefined) logging.deprecated('config.json:_spoor._tracking._shouldSubmitScore, please use only config.json:_completionCriteria._shouldSubmitScore');
    this._config._shouldSubmitScore = legacyShouldSubmitScore ?? newShouldSubmitScore ?? true;
  }

  /**
   * Store the assessments state.
   * @param {object} assessments - The assessments set
   */
  onAssessmentsComplete(assessments) {
    this._assessments = assessments;
    this.submitScore();
    // Check if completion requires passing an assessment.
    if (this._config._requireAssessmentCompleted) this.checkCompletion();
  }

  /**
   * Restores the _assessments set object when an assessment is registered.
   * @param {object} assessments - The assessments set
   */
  onAssessmentsRestored(assessments) {
    this._assessments = assessments;
  }

}

Adapt.tracking = new Tracking();

export default Adapt.tracking;
