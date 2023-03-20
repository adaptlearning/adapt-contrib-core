import Adapt from 'core/js/adapt';
import offlineStorage from 'core/js/offlineStorage';
import logging from 'core/js/logging';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';

class Tracking extends Backbone.Controller {

  initialize() {
    this._config = {
      _requireContentCompleted: true,
      _requireAssessmentCompleted: false,
      _submitOnEveryAssessmentAttempt: false,
      _shouldSubmitScore: false
    };
    this._assessmentState = null;

    Adapt.once('configModel:dataLoaded', this.loadConfig.bind(this));
    Adapt.on('app:dataReady', this.setupEventListeners.bind(this));
  }

  setupEventListeners() {
    this.listenTo(Adapt, {
      'assessment:complete': this.onAssessmentComplete,
      'assessment:restored': this.onAssessmentRestored,
      'scoring:complete': this.onScoringComplete,
      'scoring:restored': this.onScoringRestored
    });

    if (this._config._requireContentCompleted) {
      this.listenTo(Adapt.course, 'change:_isComplete', this.checkCompletion);
    }
  }

  submitScore() {
    if (!this._config._shouldSubmitScore) return;
    offlineStorage.set('score', this._assessmentState.score, this._assessmentState.minScore, this._assessmentState.maxScore, this._assessmentState.isPercentageBased);
  }

  /**
   * Evaluate the course and assessment completion
   */
  checkCompletion() {
    const completionData = this.getCompletionData();
    if (completionData.status === COMPLETION_STATE.INCOMPLETE) return;
    const canRetry = completionData.assessment?.canRetry;
    if (!this._config._submitOnEveryAssessmentAttempt && completionData.status === COMPLETION_STATE.FAILED && canRetry) return;
    Adapt.trigger('tracking:complete', completionData);
    logging.debug('tracking:complete', completionData);
  }

  /**
   * The return value of this function should be passed to the trigger of 'tracking:complete'
   * @returns An object representing the user's course completion
   */
  getCompletionData() {
    const completionData = {
      status: COMPLETION_STATE.INCOMPLETE,
      assessment: null
    };

    if (this._config._requireContentCompleted && !Adapt.course.get('_isComplete')) return completionData;
    if (this._config._requireAssessmentCompleted) {
      if (!this._assessmentState) return completionData;
      const isPassed = this._assessmentState?.isPass ?? this._assessmentState?.isPassed;
      completionData.status = isPassed ? COMPLETION_STATE.PASSED : COMPLETION_STATE.FAILED;
      completionData.assessment = this._assessmentState;
      return completionData;
    }
    completionData.status = COMPLETION_STATE.COMPLETED;
    return completionData;
  }

  /**
   * Set the _config object to the values retrieved from config.json
   */
  loadConfig() {
    Object.assign(this._config, Adapt.config.get('_completionCriteria'));
    const newShouldSubmitScore = this._config._shouldSubmitScore;
    const legacyShouldSubmitScore = Adapt.config.get('_spoor')?._tracking?._shouldSubmitScore;
    // If the legacy property exists, use it for backward compatibility but warn in the console
    if (legacyShouldSubmitScore !== undefined) logging.deprecated('config.json:_spoor._tracking._shouldSubmitScore, please use only config.json:_completionCriteria._shouldSubmitScore');
    this._config._shouldSubmitScore = legacyShouldSubmitScore ?? newShouldSubmitScore ?? true;
  }

  onAssessmentComplete(assessmentState) {
    // stop listening to `scoring:complete` if using Scoring API assessment backward compatibility
    this.stopListening(Adapt, 'scoring:complete', this.onScoringComplete);
    this.onScoringComplete(assessmentState);
  }

  onScoringComplete(state) {
    this._assessmentState = state;
    this.submitScore();
    if (this._config._requireAssessmentCompleted) this.checkCompletion();
  }

  onAssessmentRestored(assessmentState) {
    this.onScoringRestored(assessmentState);
  }

  onScoringRestored(state) {
    if (this._assessmentState) return;
    this._assessmentState = state;
  }

}

const tracking = new Tracking();
export default tracking;
