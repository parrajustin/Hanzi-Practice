import type { PropertyDeclaration, TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CharacterJson, StrokeData } from "hanzi-writer";
import HanziWriter from "hanzi-writer";
import type { Option } from "client/option";
import { None, Some } from "client/option";
import { FractionD } from "client/util/fraction";
import { Immutable, castImmutable, produce, castDraft } from "immer";
import { WrapPromise } from "client/util/wrap_promise";

export interface QuizDetail {
  // Strokes that had mistakes.
  strokeMistakes: number;
  // Percentage of strokes with mistakes.
  percentMistakes: FractionD;
}

enum QuizState {
  /** Default starting unknown state. */
  UnknownQuizState,
  /** Normal quiz state. User try quiz and results are retruned. */
  NormalQuiz,
  /** First state in gave up. User is informed of shape and made to try. */
  GaveUpInform,
  /** Second state in gave up. User has to put in character and get difficult at least 4. */
  GaveUpPractice,
  /** Some error happened. */
  ErrorState
}

interface QuizDataState {
  /** Old character the quiz started on. */
  oldCharacter: string;
  /** Hanzi char data. */
  charData: Option<{ char: string; loadedData: CharacterJson }>;
  /** The current stroke the user is on. */
  strokeNumber: number;
  /** Number of strokes user has done. */
  strokesDrawn: number;
  /** Number of strokes that have a mistake. */
  strokesThatHaveMistakes: number;
  /** The wanted quiz state. */
  wantQuizState: QuizState;
  /** The current quiz state. */
  quizState: QuizState;
  /** The error message if any. */
  errorMessage: string;
}

type ReadonlyState = Immutable<QuizDataState>;
const DEFAULT_STATE: ReadonlyState = castImmutable<QuizDataState>({
  oldCharacter: "__OLD__",
  charData: None,
  strokeNumber: -1,
  strokesDrawn: 0,
  strokesThatHaveMistakes: 0,
  wantQuizState: QuizState.NormalQuiz,
  quizState: QuizState.UnknownQuizState,
  errorMessage: ""
});

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
  static properties = {
    character: { type: String },
    prompt: { type: String },
    pinyin: { type: String },
    tone: { type: Number }
  };
  /**
   * The chinese character to draw.
   */
  @property({
    type: String
  })
  character: string = "";

  @property()
  prompt?: string;

  /**
   * The pinyin of the chinese character.
   */
  @property()
  pinyin?: string;

  /**
   * The tone of the character.
   */
  @property()
  tone?: number;

  private maxDimension_ = 0;
  @state()
  state: ReadonlyState = DEFAULT_STATE;
  /** If a hanzi writer instance exists. */
  private writer_: Option<HanziWriter> = None;

  /** Render the character steps. */
  private renderCharacterSteps() {
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
    if (this.state.charData.some) {
      for (let i = 0; i < this.state.charData.safeValue().loadedData.strokes.length; i++) {
        const strokesPortion = this.state.charData.safeValue().loadedData.strokes.slice(0, i + 1);
        renderFanningStrokes(target, strokesPortion);
      }
    } else {
      this.state = castImmutable<ReadonlyState>(
        produce<QuizDataState>(castDraft(this.state), (base) => {
          base.wantQuizState = QuizState.ErrorState;
          base.errorMessage = `Error: trying to render "renderCharacterSteps" but no char data!`;
        })
      );
    }
  }

  /** Removes character steps if there is any. */
  private removeCharacterSteps() {
    const giveUpStrokes = this.shadowRoot?.getElementById("strokesDiv") as HTMLDivElement;
    giveUpStrokes.innerHTML = "";
  }

  /** When cleaning up a quiz writer it leaves behind an svg element. We need to remove it. */
  private removeOldWriterOutline() {
    const oldWriter = this.shadowRoot?.querySelector("svg g") as HTMLElement;
    if (oldWriter !== undefined && oldWriter !== null) {
      oldWriter.parentElement?.removeChild(oldWriter);
    }
  }

  async updated() {
    if (
      this.state.quizState === this.state.wantQuizState &&
      this.state.oldCharacter === this.character
    ) {
      // No update needed.
      return;
    }

    // Clean up.
    this.removeCharacterSteps();
    this.removeOldWriterOutline();
    this.writer_ = this.writer_.andThen((v) => {
      v.cancelQuiz();
      return Some(v);
    });

    const resetStroke = produce<QuizDataState>((base: QuizDataState) => {
      base.strokeNumber = -1;
      base.strokesThatHaveMistakes = 0;
      base.strokesDrawn = 0;
    });

    const normalOnMistake = (strokeData: StrokeData) => {
      this.state = castImmutable<ReadonlyState>(
        produce<QuizDataState>(castDraft(this.state), (base) => {
          base.strokesDrawn++;
          if (base.strokeNumber !== strokeData.strokeNum) {
            base.strokeNumber = strokeData.strokeNum;
            base.strokesThatHaveMistakes++;
          }
        })
      );
    };
    const normalOnCorrect = () => {
      this.state = castImmutable<ReadonlyState>(
        produce<QuizDataState>(castDraft(this.state), (base) => {
          base.strokesDrawn++;
        })
      );
    };
    const normalOnComplete = (summary: { character: string; totalMistakes: number }) => {
      const options: CustomEventInit<QuizDetail> = {
        bubbles: true,
        composed: true,
        detail: {
          strokeMistakes: summary.totalMistakes,
          percentMistakes: new FractionD(
            this.state.strokesThatHaveMistakes /
              this.state.charData.andThen((val) => Some(val.loadedData.strokes.length)).valueOr(10)
          )
        }
      };
      this.dispatchEvent(new CustomEvent<QuizDetail>("onComplete", options));
    };
    const gaveUpInstructionOnComplete = () => {
      // On complete of the instruction mode go to practice.
      this.state = castImmutable<ReadonlyState>(
        produce<QuizDataState>(resetStroke(castDraft(this.state)), (base) => {
          base.wantQuizState = QuizState.GaveUpPractice;
        })
      );
    };
    const gaveUpPracticeOnComplete = () => {
      const percentMistakes = new FractionD(
        this.state.strokesThatHaveMistakes /
          this.state.charData.andThen((val) => Some(val.loadedData.strokes.length)).valueOr(10)
      );
      if (percentMistakes.fraction > 0.25) {
        // If user failed to get 75% correct go back to instruction.
        this.state = castImmutable<ReadonlyState>(
          produce<QuizDataState>(resetStroke(castDraft(this.state)), (base) => {
            base.wantQuizState = QuizState.GaveUpInform;
          })
        );
        return;
      }

      // Otherwise return the default gave up on complete message.
      const options: CustomEventInit<QuizDetail> = {
        bubbles: true,
        composed: true,
        detail: {
          strokeMistakes: this.state.charData
            .andThen((val) => Some(val.loadedData.strokes.length))
            .valueOr(100),
          percentMistakes: new FractionD(1.0)
        }
      };
      this.dispatchEvent(new CustomEvent<QuizDetail>("onComplete", options));
    };

    //
    // SETUP WRITER.
    //

    const element = this.shadowRoot?.getElementById(
      "grid-background-target"
    ) as unknown as HTMLElement;
    this.writer_ = Some(
      HanziWriter.create(element, this.character, {
        width: this.maxDimension_,
        height: this.maxDimension_,
        showCharacter: false,
        showOutline: false,
        padding: 5
      })
    );
    let funcOnComplete = normalOnComplete;
    switch (this.state.wantQuizState) {
      case QuizState.UnknownQuizState:
        funcOnComplete = () => {};
        break;
      case QuizState.ErrorState:
      case QuizState.NormalQuiz:
        break;
      case QuizState.GaveUpInform:
        funcOnComplete = gaveUpInstructionOnComplete;
        break;
      case QuizState.GaveUpPractice:
        funcOnComplete = gaveUpPracticeOnComplete;
        break;
    }
    this.writer_.safeValue().quiz({
      onMistake: normalOnMistake,
      onCorrectStroke: normalOnCorrect,
      onComplete: funcOnComplete
    });
    if (this.state.wantQuizState === QuizState.GaveUpInform) {
      this.writer_.safeValue().showOutline();
      this.renderCharacterSteps();
    } else {
      this.writer_.safeValue().hideOutline();
    }
    this.state = castImmutable<ReadonlyState>(
      produce<QuizDataState>(resetStroke(castDraft(this.state)), (base) => {
        base.quizState = base.wantQuizState;
        base.oldCharacter = this.character;
      })
    );
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

  protected override async scheduleUpdate(): Promise<void> {
    // Only try to load the hanzi char data if we haven't already or if the old char does not equal the new char.
    if (
      this.state.wantQuizState !== QuizState.ErrorState &&
      (this.state.charData.none || this.state.charData.safeValue().char != this.character)
    ) {
      const charData = await WrapPromise<CharacterJson, Error>(
        HanziWriter.loadCharacterData(this.character) as Promise<CharacterJson>
      );
      if (charData.ok) {
        this.state = castImmutable<ReadonlyState>(
          produce<QuizDataState>(castDraft(this.state), (base) => {
            base.charData = Some({ char: this.character, loadedData: charData.safeUnwrap() });
          })
        );
      } else {
        this.state = castImmutable<ReadonlyState>(
          produce<QuizDataState>(castDraft(this.state), (base) => {
            base.wantQuizState = QuizState.ErrorState;
            base.errorMessage = `Error: ${charData.val}`;
          })
        );
      }
    }
    super.scheduleUpdate();
  }

  /** User has chosen to give up. Change state to represent that. */
  protected giveUp() {
    this.state = castImmutable<ReadonlyState>(
      produce<QuizDataState>(castDraft(this.state), (base) => {
        base.wantQuizState = QuizState.GaveUpInform;
      })
    );
  }

  /** Gets if the current quiz state is one where the user gave up. */
  protected isGaveUpQuizState(quizState: QuizState): boolean {
    switch (quizState) {
      case QuizState.UnknownQuizState:
        return false;
      case QuizState.NormalQuiz:
        return false;
      case QuizState.GaveUpInform:
        return true;
      case QuizState.GaveUpPractice:
        return true;
      case QuizState.ErrorState:
        return false;
    }
  }

  /** Resets the quiz state. */
  protected resetQuiz() {
    this.state = castImmutable<ReadonlyState>(
      produce<QuizDataState>(castDraft(DEFAULT_STATE), (base): QuizDataState => {
        return base;
      })
    );
  }

  protected render() {
    const w = Math.min(window.innerWidth, 960);
    const h = window.innerHeight;
    // Max dimension is the smallest of the 2 minus a number for padding of cards and whatnot.
    this.maxDimension_ = Math.min(w - 250, h);

    let strokeCount = 0;
    if (this.state.charData.some) {
      strokeCount = this.state.charData.safeValue().loadedData.strokes.length;
    }

    const svgOutline = this.createSvgOutline(this.maxDimension_);
    return this.state.quizState !== QuizState.ErrorState
      ? html`<div id="main">
          <dile-card shadow-md title="Quiz">
            <div id="quizContainer">
              <span>${this.prompt}</span>
            </div>
            <div id="drawing">${svgOutline}</div>

            <div id="strokesDiv"></div>
            <div slot="footer">
              <dile-button @click="${this.giveUp}">Give up!</dile-button>
              <dile-button @click="${this.resetQuiz}">Reset!</dile-button>
              ${this.isGaveUpQuizState(this.state.quizState)
                ? html`<span>Gave up mode...</span>`
                : html``}
              <span>Total Strokes ${strokeCount}</span>
              <span>Correct Strokes ${this.state.strokesDrawn}</span>
            </div>
          </dile-card>
        </div>`
      : html`<div id="main">
          <dile-card shadow-md title="Quiz">
            <div id="quizContainer">
              <span
                >Failed to load the character ${this.character} error:
                ${this.state.errorMessage}</span
              >
            </div>

            <div id="strokesDiv"></div>
            <div slot="footer">
              <dile-button @click="${this.resetQuiz}">Try Reset?</dile-button>
            </div>
          </dile-card>
        </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quiz-element": QuizElement;
  }
}
