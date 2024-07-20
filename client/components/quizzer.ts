import { AddAppCb } from "client/store";
import { SpacedRepetition } from "client/util/spaced_repetition";
import type { Firestore } from "firebase/firestore";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import type { TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { quizStateMachine, type QuizDetail } from "./quiz";
import type { PinyinDetail } from "./pinyin_selector";
import { Shuffle } from "client/util/shuffle";
import type { Immutable } from "immer";
import type {
  DueCardType,
  QuizzerActions,
  StateInital,
  StateQuiz,
  StateSubmission,
  StateWaitingQuizData,
  QuizzerState
} from "./quizzer_state";
import { QuizzerReducer, SubmissionState } from "./quizzer_state";
import { typeGuard } from "client/util/typeguard";
import { StateReducerController } from "client/util/state_reducer";
import { WrapPromise } from "client/util/wrap_promise";

@customElement("quizzer-element")
export class QuizzerElement extends LitElement {
  static styles = css`
    .u-full-height {
      height: 100%;
    }
    .myModalCustomized {
      font-family: "Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", "Lucida Sans", Arial,
        sans-serif;
      --dile-modal-border-radius: 0;
      --dile-modal-content-background-color: #303030;
      --dile-modal-width: 80vw;
      --dile-modal-min-width: 100px;
      --dile-modal-content-shadow-color: #ddd;
      --dile-modal-background-color: #fff;
      --dile-modal-animation-duration: 1s;
      --dile-modal-close-icon-right: 5px;
      --dile-modal-close-icon-color: yellow;
      color: #fff;
    }
    .myModalCustomized p {
      color: #f66;
      font-size: 0.9em;
      margin: 10px 0;
      text-transform: uppercase;
    }
  `;

  private db_?: Firestore;
  /** Spaced repetition system. */
  private spacedRepetitionSystem = new SpacedRepetition();

  public stateMachine = new StateReducerController<QuizzerState, QuizzerActions>(
    { state: "StateInital" },
    QuizzerReducer
  );

  @state()
  private state: Immutable<QuizzerState>;

  constructor() {
    super();

    this.stateMachine.addListener((data) => {
      this.state = data;
      console.log("quizzer state change", data);

      // Go from inital state to loading state.
      if (typeGuard<StateInital>(data, data.state === "StateInital")) {
        this.stateMachine.applyAction({ action: "ActionPromptStateWaitingQuizData" });
        AddAppCb(async (app, reviews, hanzi) => {
          this.db_ = getFirestore(app);
          this.stateMachine.applyAction({ action: "ActionLoadQuizData", reviews, hanzi });
        });
      }
      // We are in the loading data stage and we have data!
      if (typeGuard<StateWaitingQuizData>(data, data.state === "StateGettingDueCards")) {
        // Change to the identify cards stage.
        const srs = this.spacedRepetitionSystem.getDueCards(data.hanzi, data.reviews);
        Shuffle(srs);
        this.stateMachine.applyAction({
          action: "ActionLoadDueReviews",
          dueCardIndex: 0,
          dueCardsFromSystem: srs as DueCardType[]
        });
      }

      if (data.state === "StateQuiz") {
        const quizState = quizStateMachine.getCurrentState();
        const dueCardStruct = data.dueCardsFromSystem[data.dueCardIndex] as DueCardType;
        const hanzi = dueCardStruct[0];
        if (quizState.state === "StateNoChar" || quizState.character !== hanzi.hanzi) {
          quizStateMachine.applyAction({
            action: "ActionSetQuizHanzi",
            character: hanzi.hanzi,
            pinyin: hanzi.pinyin,
            prompt: hanzi.text,
            tone: hanzi.tone
          });
        }
      }
    }, /*includeInitalValue=*/ true);

    // Update quiz states.
    this.stateMachine.addAsyncListener(async (data) => {
      // If are submitting the current review.
      if (
        typeGuard<StateSubmission>(data, data.state === "StateSubmission") &&
        !data.isSubmitting
      ) {
        console.log("tryEmitCompletion");
        await this.tryEmitCompletion();
      }
    });
  }

  /** Tries to send completion if both parts of the quiz are good. */
  protected async tryEmitCompletion() {
    if (this.state.state !== "StateSubmission") {
      // Only continue if this is quiz state.
      return;
    }
    if (this.state.resultHanzi.none || this.state.resultPinyin.none) {
      // Only continue if there are results for both.
      return;
    }
    this.stateMachine.applyAction({ action: "ActionSetIsSubmitting" });
    // Update state to submitting review.
    const hanziQuizDetail = this.state.resultHanzi.safeValue();

    const hanziReviewed = (
      this.state.dueCardsFromSystem[this.state.dueCardIndex] as DueCardType
    )[0];
    if (hanziReviewed === undefined) {
      this.stateMachine.applyAction({
        action: "ActionFailedSubmission",
        error: `Couldn't find hanzi being reviewed index "${this.state.dueCardIndex}" out of due cards "${this.state.dueCardsFromSystem.length}".`
      });
      return;
    }
    if (this.db_ === undefined) {
      this.stateMachine.applyAction({
        action: "ActionFailedSubmission",
        error: `No firestore "db" found.`
      });
      return;
    }

    let difficulty = 0;
    if (hanziQuizDetail.percentMistakes.fraction < 1e-6) {
      difficulty = 5;
    } else if (hanziQuizDetail.strokeMistakes === 1) {
      difficulty = 4;
    } else if (hanziQuizDetail.percentMistakes.fraction < 0.25) {
      difficulty = 3;
    } else if (hanziQuizDetail.percentMistakes.fraction < 0.5) {
      difficulty = 2;
    } else if (hanziQuizDetail.percentMistakes.fraction < 0.75) {
      difficulty = 1;
    } else {
      difficulty = 0;
    }
    let maxDifficulty = 5;
    if (this.state.resultPinyin.safeValue() > 1) {
      maxDifficulty = 3;
    } else if (this.state.resultPinyin.safeValue() === 1) {
      maxDifficulty = 4;
    }
    const finalDifficulty = Math.min(difficulty, maxDifficulty);

    const finishText = `Final result "${finalDifficulty}" out of 5. Got score "${difficulty}" on hanzi and the following mistakes on pinyin "${this.state.resultPinyin.safeValue()}".`;
    this.stateMachine.applyAction({ action: "ActionSetModalText", modalText: finishText });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modalElement = this.shadowRoot?.getElementById("uploadModal") as any;
    modalElement.open();

    const addDocResult = await WrapPromise(
      addDoc(collection(this.db_, "status"), {
        char: hanziReviewed.selfRef,
        difficulty: finalDifficulty,
        reviewed: serverTimestamp()
      })
    );
    if (addDocResult.err) {
      this.stateMachine.applyAction({
        action: "ActionFailedSubmission",
        error: JSON.stringify(addDocResult)
      });
    } else {
      this.stateMachine.applyAction({ action: "ActionSetFinishedSubmitting" });
    }
  }

  protected closeDileSubmission() {
    if (this.state.state === "StateSubmissionError") {
      this.stateMachine.applyAction({ action: "ActionResetQuiz" });
    } else if (this.state.state === "StateSubmission") {
      // Set finished to go back to quiz state.
      this.stateMachine.applyAction({ action: "ActionFinishedSubmission" });
      // Now increment the due card.
      this.stateMachine.applyAction({ action: "ActionNextDueCards" });
    }
  }

  protected async onCompleteQuiz(e: CustomEvent<QuizDetail>) {
    if (
      typeGuard<StateQuiz>(this.state, this.state.state === "StateQuiz") &&
      this.state.resultHanzi.none
    ) {
      this.stateMachine.applyAction({
        action: "ActionHanziResults",
        resultHanzi: e.detail
      });
    }
  }

  protected async onCompletePinyin(e: CustomEvent<PinyinDetail>) {
    if (
      typeGuard<StateQuiz>(this.state, this.state.state === "StateQuiz") &&
      this.state.resultPinyin.none
    ) {
      this.stateMachine.applyAction({
        action: "ActionPinyinResults",
        resultPinyin: e.detail.mistakes
      });
    }
  }

  protected buildHanziQuiz(): TemplateResult {
    if (this.state.state !== "StateQuiz" && this.state.state !== "StateSubmission") {
      return html`Not on quiz state.`;
    }
    const todayNumber = this.spacedRepetitionSystem.getDay();
    const dueCardStruct = this.state.dueCardsFromSystem[this.state.dueCardIndex] as DueCardType;
    const hanzi = dueCardStruct[0];
    if (hanzi === undefined) {
      return html`No card, found bug???`;
    }

    return html`
      <dile-card shadow-md>
        <span>Due cards: ${this.state.dueCardsFromSystem.length}</span>
        <span> No review: ${this.state.hanzi.length - this.state.dueCardsFromSystem.length} </span>
        <span>|</span>
        <span>Card due ${dueCardStruct[1].dueDayNumber} today ${todayNumber}</span>
        <dile-rating value="${dueCardStruct[1].efactor}" disableChanges></dile-rating>
      </dile-card>
      <quiz-element
        character="${hanzi.hanzi}"
        prompt="${hanzi.text}"
        pinyin="${hanzi.pinyin}"
        tone="${hanzi.tone}"
        @onComplete="${this.onCompleteQuiz}"
      ></quiz-element>
      <pinyin-selector-element
        pinyinLine="${hanzi.pinyin}"
        @onComplete="${this.onCompletePinyin}"
      ></pinyin-selector-element>
    `;
  }

  protected render() {
    if (this.state.state === "StateInital") {
      return html`<span>In starting state.... please wait...</span>`;
    }

    if (this.state.state === "StateWaitingQuizData") {
      return html`<dile-spinner active></dile-spinner>`;
    }

    if (this.state.state === "StateNoCardsDue") {
      return html`
        <dile-card shadow-md>
          <span>0 cards due, Nice!</span>
        </dile-card>
      `;
    }

    const quizlet = this.buildHanziQuiz();
    const getUploadModalTitle = () => {
      return this.state.state === "StateSubmission" ? html`Submitting Review` : html`Error!`;
    };
    const getUploadModalText = () => {
      if (this.state.state === "StateSubmission" && this.state.uploadModalText.some) {
        return html`<span>${this.state.uploadModalText.safeValue()}</span>`;
      } else if (this.state.state === "StateSubmissionError" && this.state.uploadModalText.some) {
        return html`<span>${this.state.uploadModalText.safeValue()}</span>`;
      } else {
        return html`No text...`;
      }
    };
    const getModalFooter = () => {
      if (this.state.state === "StateSubmissionError") {
        return html`<dile-button
          @click="${() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modalElement = this.shadowRoot?.getElementById("uploadModal") as any;
            modalElement.close();
          }}"
          >Exit Error</dile-button
        >`;
      }
      if (
        this.state.state === "StateSubmission" &&
        this.state.isSubmitting === SubmissionState.IsSubmitting
      ) {
        return html`<dile-spinner active></dile-spinner>`;
      } else if (
        this.state.state === "StateSubmission" &&
        this.state.isSubmitting === SubmissionState.FinishedSubmission
      ) {
        return html`<dile-button
          @click="${() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modalElement = this.shadowRoot?.getElementById("uploadModal") as any;
            modalElement.close();
          }}"
          >Exit Submission</dile-button
        >`;
      }
      return html``;
    };
    return html`
      <dile-modal
        id="uploadModal"
        class="myModalCustomized"
        blocking
        @dile-modal-closed="${this.closeDileSubmission}"
      >
        <p>${getUploadModalTitle()}</p>
        <div>${getUploadModalText()}</div>
        <div>${getModalFooter()}</div>
      </dile-modal>
      <div>${quizlet}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quizzer-element": QuizzerElement;
  }
}
