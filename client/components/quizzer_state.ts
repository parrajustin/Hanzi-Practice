import { None, Some, type Option } from "client/option";
import type { Hanzi, Review } from "client/store";
import type { IComputeReviewFactor } from "client/util/spaced_repetition";
import type { QuizDetail } from "./quiz";
import type { ActionTag, ReducerFunc, StateTag } from "client/util/state_reducer";
import { LogError } from "client/util/error";

interface DataFromStore {
  /** All user reviews. */
  reviews: Readonly<Review[]>;
  /** All hanzi characters. */
  hanzi: Readonly<Hanzi[]>;
}
export type DueCardType = [Hanzi, IComputeReviewFactor];
interface DueCardsState {
  /** The due cards from the system. */
  dueCardsFromSystem: DueCardType[];
  /** The currently being reviewed index from `dueCardsFromSystem`. */
  dueCardIndex: number;
}
interface InQuizState {
  /* Number of mistakes to get pinyin. */
  resultPinyin: Option<number>;
  /** The result of the hanzi quiz. */
  resultHanzi: Option<QuizDetail>;
}
interface DoneQuizState {
  /* Number of mistakes to get pinyin. */
  resultPinyin: Some<number>;
  /** The result of the hanzi quiz. */
  resultHanzi: Some<QuizDetail>;
}
export enum SubmissionState {
  NotSubmitting,
  IsSubmitting,
  FinishedSubmission
}
interface SumbissionState {
  /** If the submission is currently ongoing. */
  isSubmitting: SubmissionState;
}
interface UploadText {
  /* Text displayed in the upload modal. */
  uploadModalText: Option<string>;
}
interface ErrorState {
  /* Text displayed in the upload modal. */
  uploadModalText: Some<string>;
}

/** Inital starting state. Nothing really in state. */
export type StateInital = StateTag<"StateInital">;
/** State waiting on quiz data from firestore. */
export type StateWaitingQuizData = StateTag<"StateWaitingQuizData"> & DataFromStore;
/** State getting the due reviews necessary. */
export type StateGettingDueCards = StateTag<"StateGettingDueCards"> & DataFromStore & DueCardsState;
/** There are no cards due. */
export type StateNoCardsDue = StateTag<"StateNoCardsDue"> & DataFromStore;
/** Quiz state, waiting for quiz resutls. */
export type StateQuiz = StateTag<"StateQuiz"> & DataFromStore & DueCardsState & InQuizState;
/** Submission state, where we are waiting for a result to submit. */
export type StateSubmission = StateTag<"StateSubmission"> &
  DataFromStore &
  DueCardsState &
  DoneQuizState &
  UploadText &
  SumbissionState;
/** Submission failed state, used to display an error. */
export type StateSubmissionError = StateTag<"StateSubmissionError"> &
  DataFromStore &
  DueCardsState &
  DoneQuizState &
  ErrorState;
export type QuizzerState =
  | StateInital
  | StateWaitingQuizData
  | StateGettingDueCards
  | StateNoCardsDue
  | StateQuiz
  | StateSubmission
  | StateSubmissionError;

/* The data is being loaded externally. Switch to the loading data stage. */
export type ActionPromptStateWaitingQuizData = ActionTag<"ActionPromptStateWaitingQuizData">;
/* Data from external graph has been loaded. */
export type ActionLoadQuizData = ActionTag<"ActionLoadQuizData"> & {
  reviews: Review[];
  hanzi: Hanzi[];
};
/* Load the due cards. */
export type ActionLoadDueReviews = ActionTag<"ActionLoadDueReviews"> & DueCardsState;
/* Increment the due card index. */
export type ActionNextDueCards = ActionTag<"ActionNextDueCards">;
/* Set the pinyin mistakes data.  */
export type ActionPinyinResults = ActionTag<"ActionPinyinResults"> & { resultPinyin: number };
/* Set the hanzi quiz data. */
export type ActionHanziResults = ActionTag<"ActionHanziResults"> & { resultHanzi: QuizDetail };
export type ActionSetModalText = ActionTag<"ActionSetModalText"> & { modalText: string };
export type ActionSetIsSubmitting = ActionTag<"ActionSetIsSubmitting">;
export type ActionSetFinishedSubmitting = ActionTag<"ActionSetFinishedSubmitting">;
export type ActionFinishedSubmission = ActionTag<"ActionFinishedSubmission">;
export type ActionFailedSubmission = ActionTag<"ActionFailedSubmission"> & { error: string };
export type ActionResetQuiz = ActionTag<"ActionResetQuiz">;
export type QuizzerActions =
  | ActionPromptStateWaitingQuizData
  | ActionLoadQuizData
  | ActionLoadDueReviews
  | ActionNextDueCards
  | ActionPinyinResults
  | ActionHanziResults
  | ActionSetModalText
  | ActionSetIsSubmitting
  | ActionSetFinishedSubmitting
  | ActionFinishedSubmission
  | ActionFailedSubmission
  | ActionResetQuiz;

function LogStateError(action: QuizzerActions, state: QuizzerState) {
  LogError(
    `[Quizzer State] Attempted action ${JSON.stringify(action)} from ${JSON.stringify(state)}.`
  );
}
function LoadQuizData<
  T extends Exclude<QuizzerState, StateInital> = Exclude<QuizzerState, StateInital>
>(action: ActionLoadQuizData, state: T): T {
  return { ...state, reviews: action.reviews, hanzi: action.hanzi };
}
const initalStateReducer = (
  action: QuizzerActions,
  state: StateInital
): StateWaitingQuizData | StateInital => {
  switch (action.action) {
    case "ActionPromptStateWaitingQuizData":
      return { state: "StateWaitingQuizData", reviews: [], hanzi: [] };
    case "ActionLoadQuizData":
    case "ActionLoadDueReviews":
    case "ActionNextDueCards":
    case "ActionPinyinResults":
    case "ActionHanziResults":
    case "ActionSetModalText":
    case "ActionSetIsSubmitting":
    case "ActionSetFinishedSubmitting":
    case "ActionFinishedSubmission":
    case "ActionFailedSubmission":
    case "ActionResetQuiz":
      LogStateError(action, state);
      return state;
  }
};
const loadDataStateReducer = (
  action: QuizzerActions,
  state: StateWaitingQuizData
): StateGettingDueCards | StateWaitingQuizData => {
  switch (action.action) {
    case "ActionPromptStateWaitingQuizData":
      LogStateError(action, state);
      return state;
    case "ActionLoadQuizData":
      return {
        state: "StateGettingDueCards",
        reviews: action.reviews,
        hanzi: action.hanzi,
        dueCardIndex: -1,
        dueCardsFromSystem: []
      };
    case "ActionLoadDueReviews":
    case "ActionNextDueCards":
    case "ActionPinyinResults":
    case "ActionHanziResults":
    case "ActionSetModalText":
    case "ActionSetIsSubmitting":
    case "ActionSetFinishedSubmitting":
    case "ActionFinishedSubmission":
    case "ActionFailedSubmission":
    case "ActionResetQuiz":
      LogStateError(action, state);
      return state;
  }
};
const StateGettingDueCardsStateReducer = (
  action: QuizzerActions,
  state: StateGettingDueCards
): StateNoCardsDue | StateQuiz | StateGettingDueCards => {
  switch (action.action) {
    case "ActionPromptStateWaitingQuizData":
      LogStateError(action, state);
      return state;
    case "ActionLoadQuizData":
      // When loading data from firestore, just load it.
      return LoadQuizData(action, state);
    case "ActionLoadDueReviews":
      // When loading due review, if there is no due cards go to the specific state.
      if (action.dueCardsFromSystem.length === 0) {
        return { state: "StateNoCardsDue", reviews: state.reviews, hanzi: state.hanzi };
      } else {
        return {
          state: "StateQuiz",
          reviews: state.reviews,
          hanzi: state.hanzi,
          dueCardIndex: action.dueCardIndex,
          dueCardsFromSystem: action.dueCardsFromSystem,
          resultHanzi: None,
          resultPinyin: None
        };
      }
    case "ActionNextDueCards": {
      const nextIndex = state.dueCardIndex + 1;
      if (nextIndex >= state.dueCardsFromSystem.length) {
        return { state: "StateNoCardsDue", reviews: state.reviews, hanzi: state.hanzi };
      } else {
        return {
          state: "StateQuiz",
          reviews: state.reviews,
          hanzi: state.hanzi,
          dueCardIndex: nextIndex,
          dueCardsFromSystem: state.dueCardsFromSystem,
          resultHanzi: None,
          resultPinyin: None
        };
      }
    }
    case "ActionPinyinResults":
    case "ActionHanziResults":
    case "ActionSetModalText":
    case "ActionSetIsSubmitting":
    case "ActionSetFinishedSubmitting":
    case "ActionFinishedSubmission":
    case "ActionFailedSubmission":
    case "ActionResetQuiz":
      LogStateError(action, state);
      return state;
  }
};
const quizStateReducer = (
  action: QuizzerActions,
  state: StateQuiz
): StateQuiz | StateNoCardsDue | StateSubmission => {
  switch (action.action) {
    case "ActionPromptStateWaitingQuizData":
      LogStateError(action, state);
      return state;
    case "ActionLoadQuizData":
      return LoadQuizData(action, state);
    case "ActionLoadDueReviews":
      LogStateError(action, state);
      return state;
    case "ActionNextDueCards": {
      const nextIndex = state.dueCardIndex + 1;
      if (nextIndex >= state.dueCardsFromSystem.length) {
        return { state: "StateNoCardsDue", reviews: state.reviews, hanzi: state.hanzi };
      } else {
        return {
          state: "StateQuiz",
          reviews: state.reviews,
          hanzi: state.hanzi,
          dueCardIndex: nextIndex,
          dueCardsFromSystem: state.dueCardsFromSystem,
          resultHanzi: None,
          resultPinyin: None
        };
      }
    }
    case "ActionPinyinResults":
      if (state.resultHanzi.some) {
        return {
          ...state,
          state: "StateSubmission",
          resultPinyin: Some(action.resultPinyin),
          resultHanzi: state.resultHanzi,
          isSubmitting: SubmissionState.NotSubmitting,
          uploadModalText: None
        };
      } else {
        return {
          ...state,
          state: "StateQuiz",
          resultPinyin: Some(action.resultPinyin)
        };
      }
    case "ActionHanziResults":
      if (state.resultPinyin.some) {
        return {
          ...state,
          state: "StateSubmission",
          resultPinyin: state.resultPinyin,
          resultHanzi: Some(action.resultHanzi),
          isSubmitting: SubmissionState.NotSubmitting,
          uploadModalText: None
        };
      } else {
        return {
          ...state,
          state: "StateQuiz",
          resultHanzi: Some(action.resultHanzi)
        };
      }
    case "ActionSetModalText":
    case "ActionSetIsSubmitting":
    case "ActionSetFinishedSubmitting":
    case "ActionFinishedSubmission":
    case "ActionFailedSubmission":
    case "ActionResetQuiz":
      LogStateError(action, state);
      return state;
  }
};
const submissionStateReducer = (
  action: QuizzerActions,
  state: StateSubmission
): StateQuiz | StateSubmission | StateSubmissionError => {
  switch (action.action) {
    case "ActionPromptStateWaitingQuizData":
      LogStateError(action, state);
      return state;
    case "ActionLoadQuizData":
      return LoadQuizData(action, state);
    case "ActionLoadDueReviews":
    case "ActionNextDueCards":
    case "ActionPinyinResults":
    case "ActionHanziResults":
      LogStateError(action, state);
      return state;
    case "ActionSetModalText":
      return {
        ...state,
        state: "StateSubmission",
        uploadModalText: Some(action.modalText)
      };
    case "ActionSetIsSubmitting":
      return {
        ...state,
        state: "StateSubmission",
        isSubmitting: SubmissionState.IsSubmitting
      };
    case "ActionSetFinishedSubmitting":
      return {
        ...state,
        state: "StateSubmission",
        isSubmitting: SubmissionState.FinishedSubmission
      };
    case "ActionFinishedSubmission":
      return {
        state: "StateQuiz",
        resultHanzi: None,
        resultPinyin: None,
        reviews: state.reviews,
        hanzi: state.hanzi,
        dueCardIndex: state.dueCardIndex,
        dueCardsFromSystem: state.dueCardsFromSystem
      };
    case "ActionFailedSubmission":
      return {
        state: "StateSubmissionError",
        resultHanzi: state.resultHanzi,
        resultPinyin: state.resultPinyin,
        reviews: state.reviews,
        hanzi: state.hanzi,
        uploadModalText: Some(action.error),
        dueCardIndex: state.dueCardIndex,
        dueCardsFromSystem: state.dueCardsFromSystem
      };
    case "ActionResetQuiz":
      LogStateError(action, state);
      return state;
  }
};
const submissionErrorStateReducer = (
  action: QuizzerActions,
  state: StateSubmissionError
): StateQuiz | StateSubmissionError => {
  switch (action.action) {
    case "ActionPromptStateWaitingQuizData":
      LogStateError(action, state);
      return state;
    case "ActionLoadQuizData":
      return LoadQuizData(action, state);
    case "ActionLoadDueReviews":
    case "ActionNextDueCards":
    case "ActionPinyinResults":
    case "ActionHanziResults":
    case "ActionSetModalText":
    case "ActionSetIsSubmitting":
    case "ActionSetFinishedSubmitting":
    case "ActionFinishedSubmission":
    case "ActionFailedSubmission":
      LogStateError(action, state);
      return state;
    case "ActionResetQuiz":
      return {
        state: "StateQuiz",
        resultHanzi: None,
        resultPinyin: None,
        reviews: state.reviews,
        hanzi: state.hanzi,
        dueCardIndex: state.dueCardIndex,
        dueCardsFromSystem: state.dueCardsFromSystem
      };
  }
};

export const QuizzerReducer: ReducerFunc<QuizzerState, QuizzerActions> = (action, state) => {
  switch (state.state) {
    case "StateInital":
      return initalStateReducer(action, state);
    case "StateWaitingQuizData":
      return loadDataStateReducer(action, state);
    case "StateGettingDueCards":
      return StateGettingDueCardsStateReducer(action, state);
    case "StateNoCardsDue":
      LogStateError(action, state);
      return state;
    case "StateQuiz":
      return quizStateReducer(action, state);
    case "StateSubmission":
      return submissionStateReducer(action, state);
    case "StateSubmissionError":
      return submissionErrorStateReducer(action, state);
  }
};
