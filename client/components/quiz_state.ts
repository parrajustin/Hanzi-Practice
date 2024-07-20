import { LogError } from "client/util/error";
import type { ActionTag, ReducerFunc, StateTag } from "client/util/state_reducer";
import type { CharacterJson } from "hanzi-writer";

interface QuizData {
  /** The chinese character to draw. */
  character: string;
  prompt: string;
  /** The pinyin of the chinese character. */
  pinyin: string;
  /** The tone of the character. */
  tone: number;
}
interface IsLoadingCharData {
  /** If the hanzi dict data is loading. */
  isLoadingChar: boolean;
}
interface LoadedCharData {
  /** Hanzi char data. */
  charData: { char: string; loadedData: CharacterJson };
}
interface RunningQuizData {
  /** The current stroke the user is on. */
  strokeNumber: number;
  /** Number of strokes user has done. */
  strokesDrawn: number;
  /** Number of strokes that have a mistake. */
  strokesThatHaveMistakes: number;
}
interface ErrorData {
  /** Error text to display. */
  errorText: string;
}
interface DoneData {
  /** Total mistakes when drawing hanzi. */
  totalMistakes: number;
  /** If the done state is from the gave up instruction. */
  cameFromGaveUp: boolean;
}
interface QuizDrawingCheckData {
  /** If the drawing interface need to be done again. */
  drawingTainted: boolean;
}

export type StateNoChar = StateTag<"StateNoChar">;
export type StateLoadingChar = StateTag<"StateLoadingChar"> & QuizData & IsLoadingCharData;
export type StateQuiz = StateTag<"StateQuiz"> &
  QuizData &
  LoadedCharData &
  RunningQuizData &
  QuizDrawingCheckData;
export type StateGiveUpInform = StateTag<"StateGiveUpInform"> &
  QuizData &
  LoadedCharData &
  QuizDrawingCheckData;
export type StateGiveUpPractice = StateTag<"StateGiveUpPractice"> &
  QuizData &
  LoadedCharData &
  RunningQuizData &
  QuizDrawingCheckData;
export type StateDone = StateTag<"StateDone"> &
  QuizData &
  LoadedCharData &
  RunningQuizData &
  DoneData;
export type StateError = StateTag<"StateError"> & QuizData & ErrorData;
export type QuizStates =
  | StateNoChar
  | StateLoadingChar
  | StateQuiz
  | StateGiveUpInform
  | StateGiveUpPractice
  | StateDone
  | StateError;

export type ActionSetQuizHanzi = ActionTag<"ActionSetQuizHanzi"> & QuizData;
export type ActionSetIsLoadingCharJson = ActionTag<"ActionSetIsLoadingCharJson">;
export type ActionLoadCharacterJson = ActionTag<"ActionLoadCharacterJson"> & {
  char: string;
  loadedData: CharacterJson;
};
/** Sets that the user gave up this character. */
export type ActionGaveUp = ActionTag<"ActionGaveUp">;
/** Update stroke was correctly done. */
export type ActionStrokeCorrect = ActionTag<"ActionStrokeCorrect">;
/** Update a stroke mistake with the given stroke number.. */
export type ActionStrokeMistake = ActionTag<"ActionStrokeMistake"> & { strokeNumber: number };
/** Signify the normal quiz mode is done. */
export type ActionNormalQuizDone = ActionTag<"ActionNormalQuizDone"> & {
  totalMistakes: number;
};
/** Signify the user passed the inform phase of give up. */
export type ActionGaveUpInformPhaseDone = ActionTag<"ActionGaveUpInformPhaseDone">;
/** Signify that the gave up was completed successfully and move on to done. */
export type ActionGaveUpPracticeDone = ActionTag<"ActionGaveUpPracticeDone"> & {
  totalMistakes: number;
};
/** Signify that the practice failed and revert to inform phase. */
export type ActionGaveUpPracticeFailed = ActionTag<"ActionGaveUpPracticeFailed">;
/** Sets the error to display. */
export type ActionSetError = ActionTag<"ActionSetError"> & ErrorData;
/** Clear the drawing taint to signify the hanzi quiz has been recreated. */
export type ActionClearDrawingTaint = ActionTag<"ActionClearDrawingTaint">;
export type QuizActions =
  | ActionSetQuizHanzi
  | ActionSetIsLoadingCharJson
  | ActionLoadCharacterJson
  | ActionGaveUp
  | ActionStrokeCorrect
  | ActionStrokeMistake
  | ActionNormalQuizDone
  | ActionGaveUpInformPhaseDone
  | ActionGaveUpPracticeDone
  | ActionGaveUpPracticeFailed
  | ActionSetError
  | ActionClearDrawingTaint;

function LogStateError(action: QuizActions, state: QuizStates) {
  LogError(
    `[Quizzer State] Attempted action ${JSON.stringify(action)} from ${JSON.stringify(state)}.`
  );
}

type ActionsWithoutSetQuizHanzi = Exclude<QuizActions, ActionSetQuizHanzi>;
const noCharReducer = (
  action: ActionsWithoutSetQuizHanzi,
  state: StateNoChar
): StateNoChar | StateLoadingChar => {
  switch (action.action) {
    case "ActionSetIsLoadingCharJson":
    case "ActionLoadCharacterJson":
    case "ActionGaveUp":
    case "ActionStrokeCorrect":
    case "ActionStrokeMistake":
    case "ActionNormalQuizDone":
    case "ActionGaveUpInformPhaseDone":
    case "ActionGaveUpPracticeDone":
    case "ActionGaveUpPracticeFailed":
    case "ActionSetError":
    case "ActionClearDrawingTaint":
      LogStateError(action, state);
      return state;
  }
};
const loadingCharReducer = (
  action: ActionsWithoutSetQuizHanzi,
  state: StateLoadingChar
): StateLoadingChar | StateQuiz => {
  switch (action.action) {
    case "ActionSetIsLoadingCharJson":
      return {
        ...state,
        isLoadingChar: true
      };
    case "ActionLoadCharacterJson":
      return {
        state: "StateQuiz",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: { char: action.char, loadedData: action.loadedData },
        strokeNumber: -1,
        strokesDrawn: 0,
        strokesThatHaveMistakes: 0,
        drawingTainted: true
      };
    case "ActionGaveUp":
    case "ActionStrokeCorrect":
    case "ActionStrokeMistake":
    case "ActionNormalQuizDone":
    case "ActionGaveUpInformPhaseDone":
    case "ActionGaveUpPracticeDone":
    case "ActionGaveUpPracticeFailed":
    case "ActionSetError":
    case "ActionClearDrawingTaint":
      LogStateError(action, state);
      return state;
  }
};
const quizStateReducer = (
  action: ActionsWithoutSetQuizHanzi,
  state: StateQuiz
): StateQuiz | StateDone | StateGiveUpInform => {
  switch (action.action) {
    case "ActionSetIsLoadingCharJson":
    case "ActionLoadCharacterJson":
      LogStateError(action, state);
      return state;
    case "ActionGaveUp":
      return {
        state: "StateGiveUpInform",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        drawingTainted: true
      };
    case "ActionStrokeCorrect":
      return {
        state: "StateQuiz",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        strokeNumber: state.strokeNumber,
        strokesDrawn: state.strokesDrawn + 1,
        strokesThatHaveMistakes: state.strokesThatHaveMistakes,
        drawingTainted: state.drawingTainted
      };
    case "ActionStrokeMistake": {
      let strokeNumber = state.strokeNumber;
      let strokesThatHaveMistakes = state.strokesThatHaveMistakes;
      if (state.strokeNumber !== action.strokeNumber) {
        strokeNumber = action.strokeNumber;
        strokesThatHaveMistakes += 1;
      }
      return {
        state: "StateQuiz",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        strokeNumber,
        strokesDrawn: state.strokesDrawn + 1,
        strokesThatHaveMistakes,
        drawingTainted: state.drawingTainted
      };
    }
    case "ActionNormalQuizDone":
      return {
        ...state,
        state: "StateDone",
        totalMistakes: action.totalMistakes,
        cameFromGaveUp: false
      };
    case "ActionGaveUpInformPhaseDone":
    case "ActionGaveUpPracticeDone":
    case "ActionGaveUpPracticeFailed":
    case "ActionSetError":
      LogStateError(action, state);
      return state;
    case "ActionClearDrawingTaint":
      return {
        ...state,
        drawingTainted: false
      };
  }
};
const gaveUpInformReducer = (
  action: ActionsWithoutSetQuizHanzi,
  state: StateGiveUpInform
): StateGiveUpInform | StateGiveUpPractice => {
  switch (action.action) {
    case "ActionSetIsLoadingCharJson":
    case "ActionLoadCharacterJson":
    case "ActionGaveUp":
    case "ActionStrokeCorrect":
    case "ActionStrokeMistake":
    case "ActionNormalQuizDone":
      LogStateError(action, state);
      return state;
    case "ActionGaveUpInformPhaseDone":
      return {
        state: "StateGiveUpPractice",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        strokeNumber: -1,
        strokesDrawn: 0,
        strokesThatHaveMistakes: 0,
        drawingTainted: true
      };
    case "ActionGaveUpPracticeDone":
    case "ActionGaveUpPracticeFailed":
    case "ActionSetError":
      LogStateError(action, state);
      return state;
    case "ActionClearDrawingTaint":
      return {
        ...state,
        drawingTainted: false
      };
  }
};
const gaveUpPracticeReducer = (
  action: ActionsWithoutSetQuizHanzi,
  state: StateGiveUpPractice
): StateGiveUpInform | StateGiveUpPractice | StateDone => {
  switch (action.action) {
    case "ActionSetIsLoadingCharJson":
    case "ActionLoadCharacterJson":
    case "ActionGaveUp":
      LogStateError(action, state);
      return state;
    case "ActionStrokeCorrect":
      return {
        state: "StateGiveUpPractice",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        strokeNumber: state.strokeNumber,
        strokesDrawn: state.strokesDrawn + 1,
        strokesThatHaveMistakes: state.strokesThatHaveMistakes,
        drawingTainted: state.drawingTainted
      };
    case "ActionStrokeMistake": {
      let strokeNumber = state.strokeNumber;
      let strokesThatHaveMistakes = state.strokesThatHaveMistakes;
      if (state.strokeNumber !== action.strokeNumber) {
        strokeNumber = action.strokeNumber;
        strokesThatHaveMistakes += 1;
      }
      return {
        state: "StateGiveUpPractice",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        strokeNumber,
        strokesDrawn: state.strokesDrawn + 1,
        strokesThatHaveMistakes,
        drawingTainted: state.drawingTainted
      };
    }
    case "ActionNormalQuizDone":
    case "ActionGaveUpInformPhaseDone":
      LogStateError(action, state);
      return state;
    case "ActionGaveUpPracticeDone":
      return {
        state: "StateDone",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        strokeNumber: state.strokeNumber,
        strokesDrawn: state.strokesDrawn,
        strokesThatHaveMistakes: state.strokesThatHaveMistakes,
        totalMistakes: action.totalMistakes,
        cameFromGaveUp: true
      };
    case "ActionGaveUpPracticeFailed":
      return {
        state: "StateGiveUpInform",
        character: state.character,
        pinyin: state.pinyin,
        prompt: state.prompt,
        tone: state.tone,
        charData: state.charData,
        drawingTainted: true
      };
    case "ActionSetError":
      LogStateError(action, state);
      return state;
    case "ActionClearDrawingTaint":
      return {
        ...state,
        drawingTainted: false
      };
  }
};

export const QuizReducer: ReducerFunc<QuizStates, QuizActions> = (action, state) => {
  if (action.action === "ActionSetQuizHanzi") {
    return {
      state: "StateLoadingChar",
      character: action.character,
      prompt: action.prompt,
      pinyin: action.pinyin,
      tone: action.tone,
      isLoadingChar: false
    };
  }
  switch (state.state) {
    case "StateNoChar":
      return noCharReducer(action, state);
    case "StateLoadingChar":
      return loadingCharReducer(action, state);
    case "StateQuiz":
      return quizStateReducer(action, state);
    case "StateGiveUpInform":
      return gaveUpInformReducer(action, state);
    case "StateGiveUpPractice":
      return gaveUpPracticeReducer(action, state);
    case "StateDone":
      LogStateError(action, state);
      return state;
    case "StateError":
      LogStateError(action, state);
      return state;
  }
};
