import type { TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { CharacterJson, StrokeData } from "hanzi-writer";
import HanziWriter from "hanzi-writer";
import type { Option } from "client/option";
import { None, Some } from "client/option";
import { FractionD } from "client/util/fraction";
import type { Immutable } from "immer";
import { WrapPromise } from "client/util/wrap_promise";
import type {
  QuizActions,
  QuizStates,
  StateDone,
  StateError,
  StateGiveUpInfrom,
  StateGiveUpPractice
} from "./quiz_state";
import { QuizReducer } from "./quiz_state";
import { StateReducerController } from "client/util/state_reducer";
import { typeGuard } from "client/util/typeguard";

export interface QuizDetail {
  // Strokes that had mistakes.
  strokeMistakes: number;
  // Percentage of strokes with mistakes.
  percentMistakes: FractionD;
}

// export enum QuizState {
//   /** Default starting unknown state. */
//   UnknownQuizState,
//   /** Normal quiz state. User try quiz and results are retruned. */
//   NormalQuiz,
//   /** First state in gave up. User is informed of shape and made to try. */
//   GaveUpInform,
//   /** Second state in gave up. User has to put in character and get difficult at least 4. */
//   GaveUpPractice,
//   /** Some error happened. */
//   ErrorState
// }

// export interface QuizDataState {
//   /** Old character the quiz started on. */
//   oldCharacter: string;
//   /** Hanzi char data. */
//   charData: Option<{ char: string; loadedData: CharacterJson }>;
// /** The current stroke the user is on. */
// strokeNumber: number;
// /** Number of strokes user has done. */
// strokesDrawn: number;
// /** Number of strokes that have a mistake. */
// strokesThatHaveMistakes: number;
//   /** The wanted quiz state. */
//   wantQuizState: QuizState;
//   /** The current quiz state. */
//   quizState: QuizState;
//   /** The error message if any. */
//   errorMessage: string;
// }

/** State machine for the quiz element. */
export const quizStateMachine = new StateReducerController<QuizStates, QuizActions>(
  { state: "StateNoChar" },
  QuizReducer
);

@customElement("quiz-element")
export class QuizElement extends LitElement {
  static styles = css`
    :host {
      --dile-button-font-size: 3rem;
    }
    #main {
      width: 100%;
      height: 100%;
    }
    #drawing {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #drawing svg {
      outline: 1px solid black;
    }
  `;

  @state()
  private state: Immutable<QuizStates>;

  private maxDimension_ = 0;
  /** If a hanzi writer instance exists. */
  private writer_: Option<HanziWriter> = None;

  constructor() {
    super();
    quizStateMachine.addListener((quizState) => {
      this.state = quizState;

      if (quizState.state === "StateDone" && quizState.cameFromGaveUp) {
        // Otherwise return the default gave up on complete message.
        const options: CustomEventInit<QuizDetail> = {
          bubbles: true,
          composed: true,
          detail: {
            strokeMistakes: quizState.totalMistakes,
            percentMistakes: new FractionD(1.0)
          }
        };
        this.dispatchEvent(new CustomEvent<QuizDetail>("onComplete", options));
      } else if (quizState.state === "StateDone" && !quizState.cameFromGaveUp) {
        const options: CustomEventInit<QuizDetail> = {
          bubbles: true,
          composed: true,
          detail: {
            strokeMistakes: quizState.totalMistakes,
            percentMistakes: new FractionD(
              quizState.strokesThatHaveMistakes / quizState.charData.loadedData.strokes.length
            )
          }
        };
        this.dispatchEvent(new CustomEvent<QuizDetail>("onComplete", options));
      }
    }, /*includeInitalValue=*/ true);
    quizStateMachine.addAsyncListener(async (data) => {
      if (data.state === "StateLoadingChar" && !data.isLoadingChar) {
        quizStateMachine.applyAction({ action: "ActionSetIsLoadingCharJson" });
        const charData = await WrapPromise<CharacterJson, Error>(
          HanziWriter.loadCharacterData(data.character) as Promise<CharacterJson>
        );
        if (charData.err) {
          quizStateMachine.applyAction({
            action: "ActionSetError",
            errorText: `Failed call "loadCharacterData" with data "${charData.val}".`
          });
        } else if (this.state.state !== "StateNoChar" && this.state.character === data.character) {
          // Check in case if the character changed between loading the json and any change.
          quizStateMachine.applyAction({
            action: "ActionLoadCharacterJson",
            char: data.character,
            loadedData: charData.safeUnwrap()
          });
        }
      }
    });
  }

  /** Render the character steps. */
  private renderCharacterSteps() {
    if (this.state.state !== "StateQuiz") {
      return;
    }

    const renderFanningStrokes = (target: HTMLElement, strokes: string[]) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.width = "75px";
      svg.style.height = "75px";
      svg.style.border = "1px solid #EEE";
      svg.style.marginRight = "3px";
      target.appendChild(svg);
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

      // set the transform property on the g element so the character renders at 75x75
      const transformData = HanziWriter.getScalingTransform(75, 75);
      group.setAttributeNS(null, "transform", transformData.transform);
      svg.appendChild(group);

      strokes.forEach((strokePath) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttributeNS(null, "d", strokePath);
        // style the character paths
        path.style.fill = "#555";
        group.appendChild(path);
      });
    };

    const target = this.shadowRoot?.getElementById("strokesDiv") as HTMLDivElement;
    target.innerHTML = "";
    for (let i = 0; i < this.state.charData.loadedData.strokes.length; i++) {
      const strokesPortion = this.state.charData.loadedData.strokes.slice(0, i + 1);
      renderFanningStrokes(target, strokesPortion);
    }
  }

  /** Removes character steps if there is any. */
  private removeCharacterSteps() {
    const giveUpStrokes = this.shadowRoot?.getElementById("strokesDiv");
    if (giveUpStrokes !== null && giveUpStrokes !== undefined) {
      giveUpStrokes.innerHTML = "";
    }
  }

  /** When cleaning up a quiz writer it leaves behind an svg element. We need to remove it. */
  private removeOldWriterOutline() {
    const oldWriter = this.shadowRoot?.querySelector("svg g") as HTMLElement;
    if (oldWriter !== undefined && oldWriter !== null) {
      oldWriter.parentElement?.removeChild(oldWriter);
    }
  }

  async updated() {
    if (this.state.state === "StateDone") {
      return;
    }
    if (
      this.state.state !== "StateQuiz" &&
      this.state.state !== "StateGiveUpInform" &&
      this.state.state !== "StateGiveUpPractice"
    ) {
      // No update needed.
      this.removeCharacterSteps();
      this.removeOldWriterOutline();
      this.writer_ = this.writer_.andThen((v) => {
        v.cancelQuiz();
        return Some(v);
      });
      return;
    }
    if (!this.state.drawingTainted) {
      // We only need to continue if the drawing surface is tainted.
      return;
    }
    quizStateMachine.applyAction({ action: "ActionClearDrawingTaint" });
    console.log("running updated");

    // Clean up.
    this.removeCharacterSteps();
    this.removeOldWriterOutline();
    this.writer_ = this.writer_.andThen((v) => {
      v.cancelQuiz();
      return Some(v);
    });

    const normalOnMistake = (strokeData: StrokeData) => {
      quizStateMachine.applyAction({
        action: "ActionStrokeMistake",
        strokeNumber: strokeData.strokeNum
      });
    };
    const normalOnCorrect = () => {
      quizStateMachine.applyAction({
        action: "ActionStrokeCorrect"
      });
    };
    const normalOnComplete = (summary: { character: string; totalMistakes: number }) => {
      if (this.state.state === "StateNoChar") {
        quizStateMachine.applyAction({
          action: "ActionSetError",
          errorText: `Quiz complete but incorrect state "StateNoChar".`
        });
        return;
      }
      quizStateMachine.applyAction({
        action: "ActionNormalQuizDone",
        totalMistakes: summary.totalMistakes
      });
    };
    const nilCallback = () => {};
    const gaveUpInstructionOnComplete = () => {
      // On complete of the instruction mode go to practice.
      quizStateMachine.applyAction({ action: "ActionGaveUpInformPhaseDone" });
    };
    const gaveUpPracticeOnComplete = (summary: { character: string; totalMistakes: number }) => {
      if (this.state.state !== "StateGiveUpPractice") {
        // No update needed.
        return;
      }
      const percentMistakes = new FractionD(
        this.state.strokesThatHaveMistakes / this.state.charData.loadedData.strokes.length
      );
      if (percentMistakes.fraction > 0.25) {
        // If user failed to get 75% correct go back to instruction.
        quizStateMachine.applyAction({ action: "ActionGaveUpPracticeFailed" });
        return;
      }

      quizStateMachine.applyAction({
        action: "ActionGaveUpPracticeDone",
        totalMistakes: summary.totalMistakes
      });
    };

    //
    // SETUP WRITER.
    //

    const element = this.shadowRoot?.getElementById(
      "grid-background-target"
    ) as unknown as HTMLElement;
    this.writer_ = Some(
      HanziWriter.create(element, this.state.character, {
        width: this.maxDimension_,
        height: this.maxDimension_,
        showCharacter: false,
        showOutline: false,
        padding: 5
      })
    );
    let funcOnMistake = normalOnMistake;
    let funcOnCorrectStroke = normalOnCorrect;
    let funcOnComplete = normalOnComplete;
    switch (this.state.state) {
      case "StateQuiz":
        break;
      case "StateGiveUpInform":
        funcOnMistake = nilCallback;
        funcOnCorrectStroke = nilCallback;
        funcOnComplete = gaveUpInstructionOnComplete;
        break;
      case "StateGiveUpPractice":
        funcOnMistake = normalOnMistake;
        funcOnCorrectStroke = normalOnCorrect;
        funcOnComplete = gaveUpPracticeOnComplete;
        break;
    }
    this.writer_.safeValue().quiz({
      onMistake: funcOnMistake,
      onCorrectStroke: funcOnCorrectStroke,
      onComplete: funcOnComplete
    });
    if (this.state.state === "StateGiveUpInform") {
      this.writer_.safeValue().showOutline();
      this.renderCharacterSteps();
    } else {
      this.writer_.safeValue().hideOutline();
    }
  }

  /**
   * Creates the svg outline of the character.
   * @param maxDimension max dimension.
   * @returns the svg outline
   */
  protected createSvgOutline(maxDimension: number): TemplateResult {
    return html` <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${maxDimension}"
      height="${maxDimension}"
      id="grid-background-target"
    >
      <line x1="0" y1="0" x2="${maxDimension}" y2="${maxDimension}" stroke="#DDD" />
      <line x1="${maxDimension}" y1="0" x2="0" y2="${maxDimension}" stroke="#DDD" />
      <line
        x1="${maxDimension / 2}"
        y1="0"
        x2="${maxDimension / 2}"
        y2="${maxDimension}"
        stroke="#DDD"
      />
      <line
        x1="0"
        y1="${maxDimension / 2}"
        x2="${maxDimension}"
        y2="${maxDimension / 2}"
        stroke="#DDD"
      />
    </svg>`;
  }

  /** User has chosen to give up. Change state to represent that. */
  protected giveUp() {
    quizStateMachine.applyAction({ action: "ActionGaveUp" });
  }

  /** Resets the quiz state. */
  protected resetQuiz() {
    if (this.state.state === "StateNoChar") {
      return;
    }
    quizStateMachine.applyAction({
      action: "ActionSetQuizHanzi",
      character: this.state.character,
      pinyin: this.state.pinyin,
      prompt: this.state.prompt,
      tone: this.state.tone
    });
  }

  protected gaveUpRender(
    state: Immutable<StateGiveUpPractice> | Immutable<StateGiveUpInfrom> | Immutable<StateDone>
  ): TemplateResult {
    const svgOutline = this.createSvgOutline(this.maxDimension_);
    const hasCorrectStrokes = state.state === "StateGiveUpPractice";
    return html`
      <div id="main">
        <dile-card shadow-md title="Quiz">
          <div id="quizContainer">
            <span>${state.prompt}</span>
          </div>
          <div id="drawing">${svgOutline}</div>

          <div id="strokesDiv"></div>
          <div slot="footer">
            <dile-button @click="${this.resetQuiz}">Reset!</dile-button>
            <span>Gave up mode...</span>
            <span>Total Strokes ${state.charData.loadedData.strokes.length}</span>
            ${hasCorrectStrokes ? html`<span>Correct Strokes ${state.strokesDrawn}</span>` : html``}
          </div>
        </dile-card>
      </div>
    `;
  }

  protected errorRender(state: Immutable<StateError>): TemplateResult {
    return html`
      <div id="main">
        <dile-card shadow-md title="Quiz">
          <div id="quizContainer">
            <span>Failed to load the character ${state.character} error: ${state.errorText}</span>
          </div>

          <div slot="footer">
            <dile-button @click="${this.resetQuiz}">Try Reset?</dile-button>
          </div>
        </dile-card>
      </div>
    `;
  }

  protected render() {
    const w = Math.min(window.innerWidth, 960);
    const h = window.innerHeight;
    // Max dimension is the smallest of the 2 minus a number for padding of cards and whatnot.
    this.maxDimension_ = Math.min(w * 0.7, h);

    if (this.state.state === "StateNoChar" || this.state.state === "StateLoadingChar") {
      return html`<dile-spinner active></dile-spinner>`;
    }
    if (this.state.state === "StateError") {
      return this.errorRender(this.state);
    }
    if (
      this.state.state === "StateGiveUpInform" ||
      this.state.state === "StateGiveUpPractice" ||
      (this.state.state === "StateDone" && this.state.cameFromGaveUp)
    ) {
      return this.gaveUpRender(this.state);
    }

    let strokeCount = 0;
    if (this.state.charData) {
      strokeCount = this.state.charData.loadedData.strokes.length;
    }

    const svgOutline = this.createSvgOutline(this.maxDimension_);
    return html`
      <div id="main">
        <dile-card shadow-md title="Quiz">
          <div id="quizContainer">
            <span>${this.state.prompt}</span>
          </div>
          <div id="drawing">${svgOutline}</div>

          <div id="strokesDiv"></div>
          <div slot="footer">
            <dile-button @click="${this.giveUp}">Give up!</dile-button>
            <dile-button @click="${this.resetQuiz}">Reset!</dile-button>
            <span>Total Strokes ${strokeCount}</span>
            <span>Correct Strokes ${this.state.strokesDrawn}</span>
          </div>
        </dile-card>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quiz-element": QuizElement;
  }
}
