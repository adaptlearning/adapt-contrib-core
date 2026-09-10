/**
 * @file QuestionModel - Abstract base model for all question components
 * @module core/js/models/questionModel
 * @description Abstract base model providing the full question lifecycle: setup, submission,
 * scoring, feedback, marking, and reset. Subclasses must implement {@link QuestionModel#canSubmit},
 * {@link QuestionModel#isCorrect}, {@link QuestionModel#isPartlyCorrect},
 * {@link QuestionModel#resetQuestion}, {@link QuestionModel#getResponse}, and
 * {@link QuestionModel#getResponseType}.
 *
 * **Known Issues & Improvements:**
 *   - `setScore` is deprecated but still called internally; callers should migrate to the `score`, `maxScore`, and `minScore` getters.
 *   - `getFeedback` handles both legacy and current config shapes, adding long-term maintenance complexity.
 */
import Adapt from 'core/js/adapt';
import components from 'core/js/components';
import ComponentModel from 'core/js/models/componentModel';
import BUTTON_STATE from 'core/js/enums/buttonStateEnum';
/**
 * @typedef {Object} ContextActivity
 * @property {string} id
 * @property {string} type
 * @property {string} title
 */

/**
 * @class QuestionModel
 * @classdesc Abstract base model for Adapt question components. Manages attempts, scoring,
 * button state, feedback, and context activities. Register concrete question types via
 * `components.register()` with a subclass of this model.
 * @extends ComponentModel
 */
class QuestionModel extends ComponentModel {

  defaults() {
    // Extend from the ComponentModel defaults
    return ComponentModel.resultExtend('defaults', {
      _isQuestionType: true,
      _shouldDisplayAttempts: false,
      _shouldShowMarking: false,
      _canShowCorrectness: false,
      _canShowModelAnswer: true,
      _canShowFeedback: true,
      _canShowMarking: true,
      _canSubmit: true,
      _isSubmitted: false,
      _isCorrectAnswerShown: false,
      _questionWeight: Adapt.config.get('_questionWeight'),
      _hasItemScoring: false,
      _items: []
    });
  }

  trackable() {
    return ComponentModel.resultExtend('trackable', [
      '_isSubmitted',
      '_score',
      '_isCorrect',
      '_attemptsLeft',
      '_isPartlyCorrect'
    ]);
  }

  trackableType() {
    return ComponentModel.resultExtend('trackableType', [
      Boolean,
      Number,
      Boolean,
      Number,
      Boolean
    ]);
  }

  lockedAttributes() {
    return ComponentModel.resultExtend('lockedAttributes', {
      _canSubmit: true
    });
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'question';
  }

  init() {
    /** @type {ContextActivity[]} */
    this._contextActivities = [];
    this.setupDefaultSettings();
    this.updateRawScore();
    super.init();
  }

  setupDefaultSettings() {
    // Not sure this is needed anymore, keeping to maintain API
    this.setupWeightSettings();
    this.setupButtonSettings();
    this.set('_shouldShowMarking', this.shouldShowMarking);
  }

  setupButtonSettings() {
    const globalButtons = Adapt.course.get('_buttons');

    // Check if  '_buttons' attribute exists and if not use the globally defined buttons.
    if (!this.has('_buttons')) {
      this.set('_buttons', globalButtons);
    } else {
      // Check all the components buttons.
      // If they are empty use the global defaults.
      const componentButtons = this.get('_buttons');

      for (const key in componentButtons) {
        if (typeof componentButtons[key] === 'object') {
          // Button text.
          if (!componentButtons[key].buttonText && globalButtons[key].buttonText) {
            componentButtons[key].buttonText = globalButtons[key].buttonText;
          }

          // ARIA labels.
          if (!componentButtons[key].ariaLabel && globalButtons[key].ariaLabel) {
            componentButtons[key].ariaLabel = globalButtons[key].ariaLabel;
          }
        }

        if (!componentButtons[key] && globalButtons[key]) {
          componentButtons[key] = globalButtons[key];
        }
      }
    }
  }

  setupWeightSettings() {
    // Not needed as handled by model defaults, keeping to maintain API
  }

  /**
   * Override in subclasses to determine whether the learner may submit the question.
   * @returns {boolean} `true` if submission is allowed
   */
  canSubmit() {}

  checkCanSubmit() {
    this.set('_canSubmit', this.canSubmit(), { pluginName: 'adapt' });
  }

  updateAttempts() {
    const attemptsLeft = this.get('_attemptsLeft') || this.get('_attempts');

    this.set('_attemptsLeft', attemptsLeft - 1);
  }

  setQuestionAsSubmitted() {
    this.set({
      _isEnabled: false,
      _isSubmitted: true,
      _shouldShowMarking: this.shouldShowMarking
    });
  }

  markQuestion() {
    this.set({
      _isCorrect: this.isCorrect(),
      _isPartlyCorrect: this.isPartlyCorrect()
    });
    this.updateRawScore();
  }

  /**
   * Override in subclasses to evaluate whether the learner's answer is fully correct.
   * @returns {boolean} `true` if the answer is correct
   */
  isCorrect() {}

  /**
   * Override in subclasses to evaluate whether the learner's answer is partly correct.
   * @returns {boolean} `true` if the answer is partly correct
   */
  isPartlyCorrect() {}

  /**
   * Used to set the legacy _score property based upon the _questionWeight and correctness
   * @deprecated Please use get score, get maxScore and get minScore instead
   */
  setScore() {
    const questionWeight = this.get('_questionWeight');
    const answeredCorrectly = this.get('_isCorrect');
    const score = answeredCorrectly ? questionWeight : 0;
    this.set('_score', score);
  }

  updateRawScore() {
    this.set({
      _rawScore: this.score,
      _maxScore: this.maxScore,
      _minScore: this.minScore
    });
  }

  /**
   * Returns a numerical value between maxScore and minScore
   * @type {number}
   */
  get score() {
    return this.get('_isCorrect') ? this.maxScore : 0;
  }

  /**
   * @type {number}
   */
  get maxScore() {
    return this.get('_questionWeight');
  }

  /**
   * @type {number}
   */
  get minScore() {
    return 0;
  }

  checkQuestionCompletion() {
    const isComplete = (this.get('_isCorrect') || this.get('_attemptsLeft') === 0);

    if (isComplete) {
      this.setCompletionStatus();
    }

    return isComplete;
  }

  updateButtons() {
    const isInteractionComplete = this.get('_isInteractionComplete');
    const isCorrect = this.get('_isCorrect');
    const isEnabled = this.get('_isEnabled');
    const buttonState = this.get('_buttonState');
    const canShowModelAnswer = this.get('_canShowModelAnswer');
    const canShowCorrectness = this.get('_canShowCorrectness');

    if (isInteractionComplete) {

      if (isCorrect || (!canShowModelAnswer || canShowCorrectness)) {
        // Use correct instead of complete to signify button state
        this.set('_buttonState', BUTTON_STATE.CORRECT);

      } else {

        switch (buttonState) {
          case BUTTON_STATE.SUBMIT:
          case BUTTON_STATE.HIDE_CORRECT_ANSWER:
            this.set('_buttonState', BUTTON_STATE.SHOW_CORRECT_ANSWER);
            break;
          default:
            this.set('_buttonState', BUTTON_STATE.HIDE_CORRECT_ANSWER);
        }

      }

    } else {

      if (isEnabled) {
        this.set('_buttonState', BUTTON_STATE.SUBMIT);
      } else {
        this.set('_buttonState', BUTTON_STATE.RESET);
      }
    }

  }

  /**
   * Build a feedback configuration object for the current question state.
   * Handles both legacy config shapes (`feedback.correct` string / `_partlyCorrect` / `_incorrect`)
   * and the current shape (`_correct`, `_partlyCorrectFinal`, `_incorrectFinal`, etc.).
   * @param {Object} [feedback] - Feedback config; defaults to `this.get('_feedback')`
   * @returns {{ title: string, body: string, _classes: string, isAltTitle: boolean, _graphic?: Object, _imageAlignment?: string }}
   */
  getFeedback(feedback = this.get('_feedback')) {
    if (!feedback) return {};

    const isFinal = (this.get('_attemptsLeft') === 0);
    const isCorrect = this.get('_isCorrect');
    const correctness = isCorrect
      ? 'correct'
      : this.isPartlyCorrect()
        ? 'partlyCorrect'
        : 'incorrect';

    const isLegacyConfig = (typeof feedback.correct === 'string') ||
      (typeof feedback._partlyCorrect === 'object') ||
      (typeof feedback._incorrect === 'object');

    const getLegacyConfigObject = () => {
      const subPart = isFinal ? 'final' : 'notFinal';
      return {
        body: (
          isCorrect
            ? feedback.correct
            : feedback[`_${correctness}`]?.[subPart] ||
              feedback[`_${correctness}`]?.final ||
              feedback._incorrect?.final
        ) || ''
      };
    };

    const getConfigObject = () => {
      const subPart = isFinal ? 'Final' : 'NotFinal';
      return (
        isCorrect
          ? feedback._correct
          : feedback[`_${correctness}${subPart}`] ||
            feedback[`_${correctness}Final`] ||
            feedback._incorrectFinal
      ) || {};
    };

    const altFeedbackTitle = Adapt.course.get('_globals')._accessibility.altFeedbackTitle;
    const hasTitle = Boolean(feedback.title || this.get('title'));
    const isAltTitle = Boolean(feedback.altTitle) || (!hasTitle && altFeedbackTitle);
    const title = (feedback.altTitle || feedback.title || this.get('title') || altFeedbackTitle || '');

    const feedbackConfig = {
      isAltTitle,
      title: Handlebars.compile(title)(this.toJSON()),
      _classes: feedback._classes,
      ...(isLegacyConfig
        ? getLegacyConfigObject()
        : getConfigObject()
      )
    };

    if (feedbackConfig._graphic?._src && !feedbackConfig._imageAlignment) {
      feedbackConfig._imageAlignment = 'right';
    }

    return feedbackConfig;
  }

  setupFeedback() {
    if (!this.has('_feedback')) return;
    const { title = '', body = '' } = this.getFeedback();

    this.set({
      feedbackTitle: Handlebars.compile(title)(this.toJSON()),
      feedbackMessage: Handlebars.compile(body)(this.toJSON())
    });
  }

  /**
   * Used to determine whether the learner is allowed to interact with the question component or not.
   * @return {Boolean}
   */
  isInteractive() {
    return !this.get('_isComplete') || (this.get('_isEnabled') && !this.get('_isSubmitted'));
  }

  checkIfResetOnRevisit() {
    super.checkIfResetOnRevisit();
    // Setup button view state
    this.set('_buttonState', this.get('_isInteractionComplete')
      ? BUTTON_STATE.HIDE_CORRECT_ANSWER
      : BUTTON_STATE.SUBMIT
    );
  }

  /**
   * Reset the model to let the user have another go (not the same as attempts)
   * @param {string} [type] 'hard' resets _isComplete and _isInteractionComplete, 'soft' resets _isInteractionComplete only.
   * @param {boolean} [canReset] Defaults to this.get('_canReset')
   * @returns {boolean}
   */
  reset(type = 'hard', canReset = this.get('_canReset')) {
    const wasReset = super.reset(type, canReset);
    if (!wasReset) return false;
    const attempts = this.get('_attempts');
    this.set({
      _attemptsLeft: attempts,
      _isCorrect: undefined,
      _isPartlyCorrect: undefined,
      _isCorrectAnswerShown: false,
      _isSubmitted: false,
      _buttonState: BUTTON_STATE.SUBMIT,
      _shouldShowMarking: this.shouldShowMarking
    });
    this._contextActivities = [];
    return true;
  }

  setQuestionAsReset() {
    this.set({
      _isEnabled: true,
      _isSubmitted: false,
      _shouldShowMarking: this.shouldShowMarking
    });
    this.resetQuestion();
  }

  /**
   * Used by the question view to reset the options of the component.
   * This is triggered when the reset button is clicked so it shouldn't be a full reset.
   */
  resetQuestion() {}

  /**
   * Trigger a `question:refresh` event to prompt the view to re-render.
   */
  refresh() {
    this.trigger('question:refresh');
  }

  /**
   * Return the appropriate `BUTTON_STATE` value for the current question state.
   * @returns {string} A value from {@link module:core/js/enums/buttonStateEnum|BUTTON_STATE}
   */
  getButtonState() {
    if (this.get('_isCorrect')) {
      return BUTTON_STATE.CORRECT;
    }

    if (this.get('_attemptsLeft') === 0) {
      const canShowModelAnswer = this.get('_canShowModelAnswer');
      const canShowCorrectness = this.get('_canShowCorrectness');
      return canShowModelAnswer && !canShowCorrectness
        ? BUTTON_STATE.SHOW_CORRECT_ANSWER
        : BUTTON_STATE.INCORRECT;
    }

    return this.get('_isSubmitted') ? BUTTON_STATE.RESET : BUTTON_STATE.SUBMIT;
  }

  /**
   * Override in subclasses to return SCORM interaction data for `cmi.interactions`.
   * @returns {{ correctResponsesPattern: string[], choices?: Array<{id: string, description: string}> }}
   */
  getInteractionObject() {
    return {};
  }

  /**
   * Add a `ContextActivity` for the content object ancestors associated with the question
   */
  addContentObjectContextActivities() {
    // SCORM doesn't necessarily need course context as implied in reports (exclude via spoor)
    this.getAncestorModels()
      .reverse()
      .filter(model => model.isTypeGroup('contentobject'))
      .forEach(model => {
        const id = model.get('_id');
        const type = model.get('_type');
        const title = model.get('title') || model.get('displayTitle');
        this.addContextActivity(id, type, title);
      });
  }

  /**
   * Add a `ContextActivity` to the collection
   * @param {string} id - The content object's `_id`
   * @param {string} type - The content object's `_type` (e.g. `'page'`, `'menu'`)
   * @param {string} title - The content object's display title
   */
  addContextActivity(id, type, title) {
    const entry = {
      id,
      type,
      title
    };
    const index = this.contextActivities.findIndex(activity => activity.id === id);
    const isIncluded = index !== -1;
    if (isIncluded) {
      this.contextActivities[index] = entry;
      return;
    }
    this.contextActivities.push(entry);
  }

  /**
   * Returns the `ContextActivity` collection for the question
   * @returns {ContextActivity[]}
   */
  get contextActivities() {
    return this._contextActivities;
  }

  /**
   * Override in subclasses to return the learner's answer as a string for SCORM reporting.
   * @returns {string}
   */
  getResponse() {}

  /**
   * Override in subclasses to return the SCORM interaction type string (e.g. `'choice'`, `'matching'`).
   * @returns {string}
   */
  getResponseType() {}

  /**
   * Called at the end of the onSubmitClicked view function.
   */
  onSubmitted() {
    // Stores the current attempt state
    if (this.get('_shouldStoreAttempts')) this.addAttemptObject();
    this.set('_shouldShowMarking', this.shouldShowMarking);
    this.addContentObjectContextActivities();
  }

  /** @type {boolean} */
  get shouldShowMarking() {
    return (!this.isInteractive() && this.get('_canShowMarking') && this.get('_isInteractionComplete'));
  }

}

// This abstract model needs to registered to support deprecated view-only questions
components.register('question', { model: QuestionModel });

export default QuestionModel;
