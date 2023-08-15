import Adapt from 'core/js/adapt';
import components from 'core/js/components';
import ComponentModel from 'core/js/models/componentModel';
import BUTTON_STATE from 'core/js/enums/buttonStateEnum';

class QuestionModel extends ComponentModel {

  /// ///
  // Setup question types
  /// /

  // Used to set model defaults
  defaults() {
    // Extend from the ComponentModel defaults
    return ComponentModel.resultExtend('defaults', {
      _isQuestionType: true,
      _shouldDisplayAttempts: false,
      _shouldShowMarking: false,
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

  // Extend from the ComponentModel trackable
  trackable() {
    return ComponentModel.resultExtend('trackable', [
      '_isSubmitted',
      '_score',
      '_isCorrect',
      '_attemptsLeft'
    ]);
  }

  trackableType() {
    return ComponentModel.resultExtend('trackableType', [
      Boolean,
      Number,
      Boolean,
      Number
    ]);
  }

  /**
   * Returns a string of the model type group.
   * @returns {string}
   */
  getTypeGroup() {
    return 'question';
  }

  init() {
    this.setupDefaultSettings();
    this.setLocking('_canSubmit', true);
    this.updateRawScore();
    super.init();
  }

  // Calls default methods to setup on questions
  setupDefaultSettings() {
    // Not sure this is needed anymore, keeping to maintain API
    this.setupWeightSettings();
    this.setupButtonSettings();
  }

  // Used to setup either global or local button text
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

  // Used to setup either global or local question weight/score
  setupWeightSettings() {
    // Not needed as handled by model defaults, keeping to maintain API
  }

  /// ///
  // Submit process
  /// /

  // Use to check if the user is allowed to submit the question
  // Maybe the user has to select an item?
  canSubmit() {}

  checkCanSubmit() {
    this.set('_canSubmit', this.canSubmit(), { pluginName: 'adapt' });
  }

  // Used to update the amount of attempts the user has left
  updateAttempts() {
    const attemptsLeft = this.get('_attemptsLeft') || this.get('_attempts');

    this.set('_attemptsLeft', attemptsLeft - 1);
  }

  // Used to set _isEnabled and _isSubmitted on the model
  setQuestionAsSubmitted() {
    this.set({
      _isEnabled: false,
      _isSubmitted: true,
      _shouldShowMarking: this.shouldShowMarking
    });
  }

  // Sets _isCorrect:true/false based upon isCorrect method below
  markQuestion() {
    this.set({
      _isCorrect: this.isCorrect(),
      _isPartlyCorrect: this.isPartlyCorrect()
    });
    this.updateRawScore();
  }

  // Should return a boolean based upon whether to question is correct or not
  isCorrect() {}

  // Used by the question to determine if the question is incorrect or partly correct
  // Should return a boolean
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

  // Checks if the question should be set to complete
  // Calls setCompletionStatus and adds complete classes
  checkQuestionCompletion() {
    const isComplete = (this.get('_isCorrect') || this.get('_attemptsLeft') === 0);

    if (isComplete) {
      this.setCompletionStatus();
    }

    return isComplete;
  }

  // Updates buttons based upon question state by setting
  // _buttonState on the model which buttonsView listens to
  updateButtons() {
    const isInteractionComplete = this.get('_isInteractionComplete');
    const isCorrect = this.get('_isCorrect');
    const isEnabled = this.get('_isEnabled');
    const buttonState = this.get('_buttonState');
    const canShowModelAnswer = this.get('_canShowModelAnswer');

    if (isInteractionComplete) {

      if (isCorrect || !canShowModelAnswer) {
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

    const feedbackConfig = {
      altTitle: feedback.altTitle ||
        Adapt.course.get('_globals')._accessibility.altFeedbackTitle ||
        '',
      title: feedback.title ||
        '',
      _classes: feedback._classes,
      ...(isLegacyConfig
        ? getLegacyConfigObject()
        : getConfigObject()
      )
    };

    if (feedbackConfig?._graphic?._src && !feedbackConfig?._imageAlignment) {
      feedbackConfig._imageAlignment = 'right';
    }

    return feedbackConfig;
  }

  // Used to setup the correct, incorrect and partly correct feedback
  setupFeedback() {
    if (!this.has('_feedback')) return;
    const { altTitle = '', title = '', body = '' } = this.getFeedback();
    this.set({
      altFeedbackTitle: Handlebars.compile(altTitle)(this.toJSON()),
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
    return true;
  }

  // Reset question for subsequent attempts
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

  refresh() {
    this.trigger('question:refresh');
  }

  getButtonState() {
    if (this.get('_isCorrect')) {
      return BUTTON_STATE.CORRECT;
    }

    if (this.get('_attemptsLeft') === 0) {
      return this.get('_canShowModelAnswer') ? BUTTON_STATE.SHOW_CORRECT_ANSWER : BUTTON_STATE.INCORRECT;
    }

    return this.get('_isSubmitted') ? BUTTON_STATE.RESET : BUTTON_STATE.SUBMIT;
  }

  // Returns an object specific to the question type, e.g. if the question
  // is a 'choice' this should contain an object with:
  // - correctResponsesPattern[]
  // - choices[]
  getInteractionObject() {
    return {};
  }

  // Returns a string detailing how the user answered the question.
  getResponse() {}

  // Returns a string describing the type of interaction: "choice" and "matching" supported (see scorm wrapper)
  getResponseType() {}

  /**
   * Called at the end of the onSubmitClicked view function.
   */
  onSubmitted() {
    // Stores the current attempt state
    if (this.get('_shouldStoreAttempts')) this.addAttemptObject();
    this.set('_shouldShowMarking', this.shouldShowMarking);
  }

  /** @type {boolean} */
  get shouldShowMarking() {
    return (!this.isInteractive() && this.get('_canShowMarking') && this.get('_isInteractionComplete'));
  }

}

// This abstract model needs to registered to support deprecated view-only questions
components.register('question', { model: QuestionModel });

export default QuestionModel;
