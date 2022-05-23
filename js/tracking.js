import Adapt from 'core/js/adapt';
import offlineStorage from 'core/js/offlineStorage';
import logging from 'core/js/logging';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';

class Tracking extends Backbone.Controller {

  initialize() {
    this._config = {
      _requireContentCompleted: true,
      _requireAssessmentCompleted: false,
      _shouldSubmitScore: false
    };
    this._assessmentState = null;

    Adapt.once('configModel:dataLoaded', this.loadConfig.bind(this));
    Adapt.on('app:dataReady', this.setupEventListeners.bind(this));
  }

  setupEventListeners() {
    this.listenTo(Adapt, {
      'assessment:complete': this.onAssessmentComplete,
      'assessment:restored': this.onAssessmentRestored
    });

    // Check if completion requires completing all content.
    if (this._config._requireContentCompleted) {
      this.listenTo(Adapt.course, 'change:_isComplete', this.checkCompletion);
    }
  }

  /**
   * Store the assessment state.
   * @param {object} assessmentState - The object returned by Adapt.assessment.getState()
   */
  onAssessmentComplete(assessmentState) {
    this._assessmentState = assessmentState;

    this.submitScore();
    // Check if completion requires passing an assessment.
    if (this._config._requireAssessmentCompleted) {
      this.checkCompletion();
    }
  }

  submitScore() {
    if (!this._config._shouldSubmitScore) return;

    if (this._assessmentState.isPercentageBased) {
      offlineStorage.set('score', this._assessmentState.scoreAsPercent, 0, 100);
      return;
    }

    offlineStorage.set('score', this._assessmentState.score, this._assessmentState.minScore, this._assessmentState.maxScore);
  }

  /**
   * Restores the _assessmentState object when an assessment is registered.
   * @param {object} assessmentState - An object representing the overall assessment state
   */
  onAssessmentRestored(assessmentState) {
    this._assessmentState = assessmentState;
  }

  /**
   * Evaluate the course and assessment completion.
   */
  checkCompletion() {
    const completionData = this.getCompletionData();

    if (completionData.status === COMPLETION_STATE.INCOMPLETE) {
      return;
    }
    
    const canRetry = (completionData.assessment?.canRetry === true);
    if (completionData.status === COMPLETION_STATE.FAILED && canRetry) {
      return;
    }

    Adapt.trigger('tracking:complete', completionData);
    logging.debug('tracking:complete', completionData);
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
      if (!this._assessmentState) {
        // INCOMPLETE: assessment is not complete.
        return completionData;
      }

      // PASSED/FAILED: assessment completed.
      completionData.status = this._assessmentState.isPass ? COMPLETION_STATE.PASSED : COMPLETION_STATE.FAILED;
      completionData.assessment = this._assessmentState;

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

}

const tracking = new Tracking();
export default tracking;
