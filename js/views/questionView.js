/**
 * @file Question View - Base view for interactive question components
 * @module core/js/views/questionView
 * @description Base class for all Adapt question component views. Orchestrates the
 * full question lifecycle: setup, submission, marking, feedback display, answer
 * reset, and correct-answer reveal. Business logic is delegated to
 * {@link module:core/js/models/questionModel~QuestionModel} where available.
 * A backwards-compatibility layer (`ViewOnlyQuestionViewCompatibilityLayer`) supports
 * components that have not yet migrated question logic to a model.
 */
import Adapt from 'core/js/adapt';
import ComponentView from 'core/js/views/componentView';
import ButtonsView from 'core/js/views/buttonsView';
import BUTTON_STATE from 'core/js/enums/buttonStateEnum';
import a11y from 'core/js/a11y';
import log from 'core/js/logging';
import data from 'core/js/data';
import location from 'core/js/location';
import 'core/js/models/questionModel';

/**
 * @class QuestionView
 * @classdesc Base view for question components. Coordinates button state updates,
 * the submit pipeline (canSubmit → mark → score → feedback → updateButtons),
 * answer reset, and correct-answer reveal. Delegates to
 * {@link module:core/js/models/questionModel~QuestionModel} for business logic
 * where available; legacy view-only components are supported by
 * `ViewOnlyQuestionViewCompatibilityLayer`.
 * @extends ComponentView
 * @fires questionView:submitted
 * @fires questionView:showFeedback
 * @fires questionView:disabledFeedback
 * @fires questionView:showInstructionError
 * @fires questionView:recordInteraction
 */
class QuestionView extends ComponentView {

  className() {
    const canShowCorrectness = this.model.get('_canShowCorrectness');
    const canShowModelAnswer = this.model.get('_canShowModelAnswer');
    return [
      'component',
      'is-question',
      this.model.get('_component').toLowerCase(),
      this.model.get('_id'),
      this.model.get('_classes'),
      this.setVisibility(),
      'is-' + this.model.get('_layout'),
      (this.model.get('_isComplete') ? 'is-complete' : ''),
      (this.model.get('_isOptional') ? 'is-optional' : ''),
      (canShowCorrectness ? 'can-show-correctness' : ''),
      (canShowModelAnswer && !canShowCorrectness ? 'can-show-model-answer' : ''),
      (this.model.get('_canShowFeedback') ? 'can-show-feedback' : ''),
      (this.model.get('_canShowMarking') ? 'can-show-marking' : '')
    ].join(' ');
  }

  initialize(...args) {
    // Allow isInteractive to be used in jsx templates
    this.isInteractive = this.isInteractive.bind(this);
    super.initialize(...args);
  }

  /**
   * Used to determine whether the learner is allowed to interact with the question component or not.
   * @returns {Boolean}
   * @deprecated since v6.0.5 please use this.model.isInteractive, this.model.get('_shouldShowMarking') or this.model.shouldShowMarking
  */
  isInteractive() {
    log.deprecated('questionView.isInteractive please use this.model.isInteractive, this.model.get(\'_shouldShowMarking\') or this.model.shouldShowMarking');
    return this.model.isInteractive();
  }

  preRender() {
    this.listenTo(this.model, {
      'change:_isEnabled': this.onEnabledChanged,
      'question:refresh': this.refresh
    });

    // Checks to see if the question should be reset on revisit
    if (this.checkIfResetOnRevisit !== QuestionView.prototype.checkIfResetOnRevisit) {
      log.deprecated('QuestionView.checkIfResetOnRevisit, please use QuestionModel.checkIfResetOnRevisit');
    }
    this.checkIfResetOnRevisit();
    _.defer(() => this.ensureLegacyLifecycleState());
    // This method helps setup default settings on the model
    this._runModelCompatibleFunction('setupDefaultSettings');
    // Blank method for setting up questions before rendering
    this.setupQuestion();
  }

  /**
   * Toggles the `is-disabled` CSS class on the component widget and calls
   * `disableQuestion` or `enableQuestion` in response to `_isEnabled` changing.
   * @param {Backbone.Model} model - The question model
   * @param {boolean} changedAttribute - The new value of `_isEnabled`
   * @returns {void}
   */
  onEnabledChanged(model, changedAttribute) {

    // If isEnabled == false add disabled class
    // else remove disabled class
    if (!changedAttribute) {
      this.$('.component__widget').addClass('is-disabled');
      this.disableQuestion();
    } else {
      this.$('.component__widget').removeClass('is-disabled');
      this.enableQuestion();
    }

  }

  /**
   * Called when the question is disabled (e.g. during submit or after completion).
   * Override in component views to prevent learner interaction.
   * @protected
   * @returns {void}
   */
  disableQuestion() {}

  /**
   * Called when the question is re-enabled (e.g. after a reset).
   * Override in component views to restore learner interaction.
   * @protected
   * @returns {void}
   */
  enableQuestion() {}

  /**
   * Used to check if the question should reset on revisit
   * @deprecated since core v6.0.1 Please use QuestionModel.checkIfResetOnRevisit
   */
  checkIfResetOnRevisit() {
    const canReset = (this.model.get('_canReset') !== false);
    const isResetOnRevisit = this.model.get('_isResetOnRevisit');
    // If reset is enabled set defaults
    // Call blank method for question to handle
    if (!canReset || !isResetOnRevisit) return;
    // Skip if calling the empty function definition
    if (this.resetQuestionOnRevisit === QuestionView.prototype.resetQuestionOnRevisit) return;
    // Warn if using a legacy resetQuestionOnRevisit
    log.deprecated('QuestionView.resetQuestionOnRevisit, please QuestionModel.reset');
    // Defer is added to allow the component to render
    _.defer(() => {
      this.resetQuestionOnRevisit(isResetOnRevisit);
    });
  }

  /**
   * Ensure the view is in the correct state on first render
   * @private
   */
  ensureLegacyLifecycleState() {
    if (this.model.get('_isSubmitted')) {
      this.onHideCorrectAnswerClicked();
      return;
    }
    this.onResetClicked();
  }

  /**
   * Used by the question to reset the question when revisiting the component
   * @param {string} type
   * @deprecated since core v6.0.1 Please use QuestionModel.reset
   */
  resetQuestionOnRevisit(type) {}

  /**
   * Override this method to perform question-specific setup before rendering.
   * Prefer this over overriding `preRender` in question components.
   * @protected
   * @returns {void}
   */
  setupQuestion() {}

  // Calls default methods to setup after the question is rendered
  postRender() {
    this.addButtonsView();
    this.onQuestionRendered();
  }

  /**
   * Creates a {@link module:core/js/views/buttonsView~ButtonsView} and attaches
   * it to `.btn__container`. Listens for `buttons:stateUpdate` to drive the
   * question state machine.
   * @returns {void}
   */
  addButtonsView() {
    this.buttonsView = new ButtonsView({ model: this.model, el: this.$('.btn__container') });

    this.listenTo(this.buttonsView, 'buttons:stateUpdate', this.onButtonStateUpdate);

  }

  /**
   * Routes a {@link module:core/js/enums/buttonStateEnum~BUTTON_STATE} value
   * from `ButtonsView` to the appropriate question handler method.
   * @param {string} buttonState - A `BUTTON_STATE` enum value
   * @returns {void}
   */
  onButtonStateUpdate(buttonState) {

    switch (buttonState) {
      case BUTTON_STATE.SUBMIT:
        this.onSubmitClicked();
        break;
      case BUTTON_STATE.RESET:
        this.onResetClicked();
        break;
      case BUTTON_STATE.SHOW_CORRECT_ANSWER:
        this.onShowCorrectAnswerClicked();
        break;
      case BUTTON_STATE.HIDE_CORRECT_ANSWER:
        this.onHideCorrectAnswerClicked();
        break;
      case BUTTON_STATE.SHOW_FEEDBACK:
        this.showFeedback();
        break;
    }

  }

  /**
   * Called after the question has been rendered and the buttons view created.
   * Override in component views for any post-render DOM setup, equivalent to
   * `postRender` for presentational components.
   * @protected
   * @returns {void}
   */
  onQuestionRendered() {}

  /**
   * Runs the full submission pipeline: validates input, records attempts, marks
   * the question, calculates score, checks completion, shows marking and feedback,
   * updates button state, and triggers `questionView:submitted`.
   * @fires questionView:submitted
   * @fires questionView:showFeedback
   * @fires questionView:disabledFeedback
   * @fires questionView:showInstructionError
   * @fires questionView:recordInteraction
   * @returns {void}
   */
  onSubmitClicked() {
    // canSubmit is setup in questions and should return a boolean
    // If the question stops the user form submitting - show instruction error
    // and give a blank method, onCannotSubmit to the question
    const canSubmit = this._runModelCompatibleFunction('canSubmit');

    this.model.toggleClass('has-error', !canSubmit);

    if (!canSubmit) {
      this.showInstructionError();
      this.onCannotSubmit();
      return;
    }

    this.stopRendering();

    // Used to update the amount of attempts the question has
    this._runModelCompatibleFunction('updateAttempts');

    // Used to set attributes on the model after being submitted
    // Also adds a class of submitted
    this._runModelCompatibleFunction('setQuestionAsSubmitted');

    // Used to store the users answer for later
    // This is a blank method given to the question
    this._runModelCompatibleFunction('storeUserAnswer');

    // Used to set question as correct:true/false
    // Calls isCorrect which is blank for the question
    // to fill out and return a boolean
    this._runModelCompatibleFunction('markQuestion', 'isCorrect');

    // Used by the question to set the score on the model
    this._runModelCompatibleFunction('setScore');

    // Used to check if the question is complete
    // Triggers setCompletionStatus and adds class to widget
    this._runModelCompatibleFunction('checkQuestionCompletion');

    // Used by the question to display markings on the component
    if (this.model.shouldShowMarking) {
      this.showMarking();
    }

    // Used to setup the feedback by checking against
    // question isCorrect or isPartlyCorrect
    this._runModelCompatibleFunction('setupFeedback');

    // Used to trigger an event so plugins can display feedback
    // Do this before updating the buttons so that the focus can be
    // shifted immediately
    this.showFeedback();

    // Force height re-calculations before the submit button
    // becomes disabled.
    $(window).resize();

    // Used to update buttonsView based upon question state
    // Update buttons happens before showFeedback to preserve tabindexes and after setupFeedback to allow buttons to use feedback attribute
    this._runModelCompatibleFunction('updateButtons');

    this.startRendering();
    this.changed();

    this.model.onSubmitted();
    this.onSubmitted();
    Adapt.trigger('questionView:submitted', this);

    this.recordInteraction();
  }

  /**
   * Fires the `questionView:showInstructionError` event so plugins (e.g. tutor)
   * can display a validation message when the learner tries to submit without
   * making a selection.
   * @fires questionView:showInstructionError
   * @returns {void}
   */
  showInstructionError() {
    Adapt.trigger('questionView:showInstructionError', this);
  }

  /**
   * Called when `canSubmit` returns false (e.g. no answer selected).
   * Override in component views to provide additional validation feedback.
   * @protected
   * @returns {void}
   */
  onCannotSubmit() {}

  /**
   * Called after a successful submission has been fully processed.
   * Override in component views for any post-submit UI updates.
   * @protected
   * @returns {void}
   */
  onSubmitted() {}

  /**
   * Delegates to `model.setQuestionAsSubmitted()` and adds the `is-submitted`
   * CSS class to the component widget.
   * @returns {void}
   */
  setQuestionAsSubmitted() {
    this.model.setQuestionAsSubmitted();
    this.$('.component__widget').addClass('is-submitted');
  }

  /**
   * Override in component views to display answer marking (e.g. ticks and
   * crosses) on the question after submission or when showing the user answer.
   * @protected
   * @returns {void}
   */
  showMarking() {}

  /**
   * Delegates to `model.checkQuestionCompletion()` and adds `is-complete` and
   * `show-user-answer` CSS classes to the component widget when the question
   * is complete.
   * @returns {void}
   */
  checkQuestionCompletion() {

    const isComplete = this.model.checkQuestionCompletion();

    if (isComplete) {
      this.$('.component__widget').addClass('is-complete show-user-answer');
    }

  }

  /**
   * Fires `questionView:recordInteraction` unless `_recordInteraction` is
   * explicitly set to `false` on the model. Called at the end of
   * `onSubmitClicked` to allow tracking plugins (e.g. SCORM) to record the
   * learner's interaction.
   * @fires questionView:recordInteraction
   * @returns {void}
   */
  recordInteraction() {
    if (this.model.get('_recordInteraction') === true || !this.model.has('_recordInteraction')) {
      Adapt.trigger('questionView:recordInteraction', this);
    }
  }

  /**
   * Triggers feedback display if `_canShowFeedback` is true, otherwise signals
   * that feedback is disabled. Can be called by plugins to re-trigger feedback.
   * @fires questionView:showFeedback
   * @fires questionView:disabledFeedback
   * @returns {void}
   */
  showFeedback() {

    if (this.model.get('_canShowFeedback')) {
      Adapt.trigger('questionView:showFeedback', this);
    } else {
      Adapt.trigger('questionView:disabledFeedback', this);
    }

  }

  /**
   * Resets the question to its pre-submission state: clears submitted classes,
   * restores the stored user answer, re-evaluates canSubmit, and updates button
   * state. When called after the view is ready, shifts focus to the first
   * tabbable element for accessibility.
   * @returns {void}
   */
  onResetClicked() {
    this.setQuestionAsReset();

    this._runModelCompatibleFunction('resetUserAnswer');

    this.model.checkCanSubmit();

    this._runModelCompatibleFunction('updateButtons');

    // onResetClicked is called as part of the checkIfResetOnRevisit
    // function and as a button click. if the view is already rendered,
    // then the button was clicked, focus on the first tabbable element
    if (!this.model.get('_isReady')) return;
    // Attempt to get the current page location
    const currentModel = data.findById(location._currentId);
    // Make sure the page is ready
    if (!currentModel?.get('_isReady')) return;
    this.focusAfterReset();
  }

  setQuestionAsReset() {
    this.model.setQuestionAsReset();
    this.resetQuestion();
    this.$('.component__widget').removeClass('is-submitted');
  }

  focusAfterReset() {
    // Focus on the first readable item in this element
    a11y.focusNext(this.$el);
  }

  /**
   * Override in component views to reset the visual state of the question
   * (e.g. deselect items). Called when the reset button is clicked — this is a
   * UI-only reset, not a full model reset.
   * @protected
   * @returns {void}
   */
  resetQuestion() {}

  /**
   * Re-evaluates button state and optionally re-renders marking. Called in
   * response to the `question:refresh` model event. Defers `buttonsView.refresh`
   * to allow any pending DOM updates to complete first.
   * @returns {void}
   */
  refresh() {
    this.model.set('_buttonState', this.model.getButtonState());

    if (this.model.shouldShowMarking) {
      this.showMarking();
    }

    if (this.buttonsView) {
      _.defer(this.buttonsView.refresh.bind(this.buttonsView));
    }
  }

  /**
   * Handles the show-correct-answer button press. Updates DOM state classes,
   * refreshes buttons, then calls `showCorrectAnswer`.
   * @returns {void}
   */
  onShowCorrectAnswerClicked() {
    this.setQuestionAsShowCorrect();

    this._runModelCompatibleFunction('updateButtons');

    this.showCorrectAnswer();
  }

  setQuestionAsShowCorrect() {
    this.$('.component__widget')
      .addClass('is-submitted show-correct-answer')
      .removeClass('show-user-answer');
  }

  /**
   * Override in component views to display the correct answer. Also sets
   * `_isCorrectAnswerShown` to `true` on the model.
   * @protected
   * @returns {void}
   */
  showCorrectAnswer() {
    this.model.set('_isCorrectAnswerShown', true);
  }

  /**
   * Handles the hide-correct-answer button press. Updates DOM state classes,
   * refreshes buttons, then calls `hideCorrectAnswer`.
   * @returns {void}
   */
  onHideCorrectAnswerClicked() {
    this.setQuestionAsHideCorrect();

    this._runModelCompatibleFunction('updateButtons');

    this.hideCorrectAnswer();
  }

  setQuestionAsHideCorrect() {
    this.$('.component__widget')
      .addClass('is-submitted show-user-answer')
      .removeClass('show-correct-answer');
  }

  /**
   * Override in component views to restore the learner's submitted answer
   * after the correct answer has been shown. Should use the values stored by
   * `storeUserAnswer`. Also sets `_isCorrectAnswerShown` to `false` on the model.
   * @protected
   * @returns {void}
   */
  hideCorrectAnswer() {
    this.model.set('_isCorrectAnswerShown', false);
  }

  /**
   * Returns the time elapsed (in seconds) between when the question became
   * available and the learner's first response. Override in component views to
   * provide a measured value for SCORM interaction tracking.
   * @returns {number|null} Latency in seconds, or `null` if not measured
   */
  getLatency() {
    return null;
  }

  /**
   * Dispatches a named method call to the question model. Overridden in
   * `ViewOnlyQuestionViewCompatibilityLayer` to redirect to view-only
   * implementations when the component has not yet migrated to a model.
   * @param {string} name - Method name to call on the model
   * @param {string} [lookForViewOnlyFunction] - Alternative method name to check for a view override
   * @returns {*} Return value from the delegated method
   * @private
   */
  // This function is overridden if useQuestionModeOnly: false. see below.
  _runModelCompatibleFunction(name, lookForViewOnlyFunction) {
    return this.model[name](); // questionModel Only
  }
}

QuestionView._isQuestionType = true;

/* BACKWARDS COMPATIBILITY SECTION
* This section below is only for compatibility between the separated questionView+questionModel and the old questionView
* Remove this section in when all components use questionModel and there is no need to have model behaviour in the questionView
*/

class ViewOnlyQuestionViewCompatibilityLayer extends QuestionView {

  /* All of these functions have been moved to the questionModel.js file.
    * On the rare occasion that they have not been overridden by the component and
          that they call the view only questionView version,
          these functions are included as redirects to the new Question Model.
          It is very unlikely that these are needed but they are included to ensure compatibility.
    * If you need to override these in your component you should now make and register a component model.
    * Please remove them from your question component's view.
  */

  /**
   * Returns an object describing the learner's interaction for SCORM/xAPI reporting.
   * @returns {Object} Interaction object specific to the question type
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#getInteractionObject} instead
   */
  // Returns an object specific to the question type.
  getInteractionObject() {
    log.deprecated('QuestionView.getInteractionObject, please use QuestionModel.getInteractionObject');
    return this.model.getInteractionObject();
  }

  /**
   * Returns a string describing how the learner answered the question.
   * @returns {string} The learner's response
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#getResponse} instead
   */
  // Retturns a string detailing how the user answered the question.
  getResponse() {
    log.deprecated('QuestionView.getResponse, please use QuestionModel.getResponse');
    return this.model.getResponse();
  }

  /**
   * Returns a string describing the interaction type (e.g. `"choice"` or
   * `"matching"`) for SCORM wrapper compatibility.
   * @returns {string} The interaction type
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#getResponseType} instead
   */
  getResponseType() {
    log.deprecated('QuestionView.getResponseType, please use QuestionModel.getResponseType');
    return this.model.getResponseType();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupDefaultSettings} instead
   */
  // Calls default methods to setup on questions
  setupDefaultSettings() {
    log.deprecated('QuestionView.setupDefaultSettings, please use QuestionModel.setupDefaultSettings');
    return this.model.setupDefaultSettings();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupButtonSettings} instead
   */
  // Used to setup either global or local button text
  setupButtonSettings() {
    log.deprecated('QuestionView.setupButtonSettings, please use QuestionModel.setupButtonSettings');
    return this.model.setupButtonSettings();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupWeightSettings} instead
   */
  // Used to setup either global or local question weight/score
  setupWeightSettings() {
    log.deprecated('QuestionView.setupWeightSettings, please use QuestionModel.setupWeightSettings');
    return this.model.setupWeightSettings();
  }

  /**
   * Returns whether the learner's current selection is valid for submission.
   * @returns {boolean}
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#canSubmit} instead
   */
  // Use to check if the user is allowed to submit the question
  // Maybe the user has to select an item?
  canSubmit() {
    log.deprecated('QuestionView.canSubmit, please use QuestionModel.canSubmit');
    return this.model.canSubmit();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#updateAttempts} instead
   */
  // Used to update the amount of attempts the user has left
  updateAttempts() {
    log.deprecated('QuestionView.updateAttempts, please use QuestionModel.updateAttempts');
    return this.model.updateAttempts();
  }

  /**
   * Stores the learner's current answer for later retrieval (e.g. when
   * toggling between user answer and correct answer views).
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#storeUserAnswer} instead
   */
  // This is important for returning or showing the users answer
  // This should preserve the state of the users answers
  storeUserAnswer() {
    log.deprecated('QuestionView.storeUserAnswer, please use QuestionModel.storeUserAnswer');
    return this.model.storeUserAnswer();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#resetUserAnswer} instead
   */
  // Used by the question view to reset the stored user answer
  resetUserAnswer() {
    log.deprecated('QuestionView.resetUserAnswer, please use QuestionModel.resetUserAnswer');
    return this.model.resetUserAnswer();
  }

  /**
   * Sets `_isCorrect` on the model based on `isCorrect()`, then calculates
   * raw, max, and min scores. Falls back to `model.markQuestion()` when not
   * in view-only compatible mode.
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#markQuestion} instead
   */
  // Sets _isCorrect:true/false based upon isCorrect method below
  markQuestion() {

    if (this._isInViewOnlyCompatibleMode('isCorrect')) {

      if (this.isCorrect()) {
        this.model.set('_isCorrect', true);
      } else {
        this.model.set('_isCorrect', false);
      }

      this.model.set({
        _rawScore: this.model.get('_isCorrect') ? this.model.get('_questionWeight') : 0,
        _maxScore: this.model.get('_questionWeight'),
        _minScore: 0
      });

    } else {
      return this.model.markQuestion();
    }
  }

  /**
   * Returns whether the learner's answer is correct.
   * @returns {boolean}
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#isCorrect} instead
   */
  // Should return a boolean based upon whether to question is correct or not
  isCorrect() {
    log.deprecated('QuestionView.isCorrect, please use QuestionModel.isCorrect');
    return this.model.isCorrect();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setScore} instead
   */
  // Used to set the score based upon the _questionWeight
  setScore() {
    log.deprecated('QuestionView.setScore, please use QuestionModel.setScore');
    return this.model.setScore();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#updateButtons} instead
   */
  // Updates buttons based upon question state by setting
  // _buttonState on the model which buttonsView listens to
  updateButtons() {
    log.deprecated('QuestionView.updateButtons, please use QuestionModel.updateButtons');
    return this.model.updateButtons();
  }

  /**
   * Sets up the appropriate feedback (correct, partly correct, or incorrect)
   * based on the question outcome. Uses view-based feedback methods when in
   * view-only compatible mode, otherwise delegates to `model.setupFeedback()`.
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupFeedback} instead
   */
  // Used to setup the correct, incorrect and partly correct feedback
  setupFeedback() {

    if (this._isInViewOnlyCompatibleMode('isPartlyCorrect')) {

      // Use view based feedback where necessary
      if (this.model.get('_isCorrect')) {
        this._runModelCompatibleFunction('setupCorrectFeedback');
      } else if (this.isPartlyCorrect()) {
        this._runModelCompatibleFunction('setupPartlyCorrectFeedback');
      } else {
        this._runModelCompatibleFunction('setupIncorrectFeedback');
      }

    } else {
      // Use model based feedback
      this.model.setupFeedback();
    }

  }

  /**
   * Returns whether the learner's answer is partly correct.
   * @returns {boolean}
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#isPartlyCorrect} instead
   */
  // Used by the question to determine if the question is incorrect or partly correct
  // Should return a boolean
  isPartlyCorrect() {
    log.deprecated('QuestionView.isPartlyCorrect, please use QuestionModel.isPartlyCorrect');
    return this.model.isPartlyCorrect();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupCorrectFeedback} instead
   */
  setupCorrectFeedback() {
    log.deprecated('QuestionView.setupCorrectFeedback, please use QuestionModel.setupCorrectFeedback');
    return this.model.setupCorrectFeedback();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupPartlyCorrectFeedback} instead
   */
  setupPartlyCorrectFeedback() {
    log.deprecated('QuestionView.setupPartlyCorrectFeedback, please use QuestionModel.setupPartlyCorrectFeedback');
    return this.model.setupPartlyCorrectFeedback();
  }

  /**
   * @deprecated Use {@link module:core/js/models/questionModel~QuestionModel#setupIncorrectFeedback} instead
   */
  setupIncorrectFeedback() {
    log.deprecated('QuestionView.setupIncorrectFeedback, please use QuestionModel.setupIncorrectFeedback');
    return this.model.setupIncorrectFeedback();
  }

  // Helper functions for compatibility layer
  _runModelCompatibleFunction(name, lookForViewOnlyFunction) {
    if (this._isInViewOnlyCompatibleMode(name, lookForViewOnlyFunction)) {
      return this[name](); // questionView
    } else {
      return this.model[name](); // questionModel
    }
  }

  _isInViewOnlyCompatibleMode(name, lookForViewOnlyFunction) {
    // return false uses the model function questionModel
    // return true uses the view only function questionView

    const checkForFunction = (lookForViewOnlyFunction || name);

    // if the function does NOT exist on the view at all, use the model only
    if (!this.constructor.prototype[checkForFunction]) return false; // questionModel

    // if the function DOES exist on the view and MATCHES the compatibility function above, use the model only
    const hasCompatibleVersion = (Object.prototype.hasOwnProperty.call(ViewOnlyQuestionViewCompatibilityLayer.prototype, checkForFunction));
    const usingCompatibleVersion = (this.constructor.prototype[checkForFunction] === ViewOnlyQuestionViewCompatibilityLayer.prototype[checkForFunction]);
    if (hasCompatibleVersion && usingCompatibleVersion) {
      switch (checkForFunction) {
        case 'setupFeedback':
        case 'markQuestion':
          return true; // questionView
      }
      return false; // questionModel
    }

    // if the function DOES exist on the view and does NOT match the compatibility function above, use the view function
    return true; // questionView
  }

};

// return question view class extended with the compatibility layer
export default ViewOnlyQuestionViewCompatibilityLayer;

/* END OF BACKWARDS COMPATIBILITY SECTION */
