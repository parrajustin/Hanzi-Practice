import type { TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CharacterJson } from "hanzi-writer";
import HanziWriter from "hanzi-writer";
import type { Option } from "client/option";
import { None, Some } from "client/option";
import { FractionD } from "client/util/fraction";

export interface QuizDetail {
  // Strokes that had mistakes.
  strokeMistakes: number;
  // Percentage of strokes with mistakes.
  percentMistakes: FractionD;
}

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

  /** The old character. */
  private oldCharacter = "OLD___";

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

  /** Hanzi char data. */
  private charData_?: CharacterJson;
  /** Number of strokes user has done. */
  @state()
  private strokesDrawn_ = 0;
  /** If a hanzi writer instance exists. */
  private writer_: Option<HanziWriter> = None;
  /** Current stroke num. */
  private strokeNum_ = -1;
  /** Number of strokes that have a mistake. */
  private strokeThatHaveMistakes_ = 0;
  /** User chose to give up. */
  @state()
  private gaveUp_ = false;
  private setupGaveUp = false;

  async updated() {
    console.log("updated");
    if (
      this.writer_.some &&
      this.oldCharacter === this.character &&
      (!this.gaveUp_ || (this.gaveUp_ && this.setupGaveUp))
    ) {
      // No need to setup if:
      // - We are not in gave up mode, and old char === current char.
      // - We are in gave up mode, have already setup the mode, and old char === current char.
      return;
    }

    //
    // RESET WRITER.
    //

    // Reset if the new character is different.
    if (this.writer_.some && this.oldCharacter !== this.character) {
      console.log("Updated reset whole quiz");
      this.oldCharacter = this.character;
      this.strokeNum_ = -1;
      this.strokeThatHaveMistakes_ = 0;
      this.strokesDrawn_ = 0;
      this.writer_.safeValue().cancelQuiz();
      this.writer_ = None;
      const oldWriter = this.shadowRoot?.querySelector("svg g") as HTMLElement;
      oldWriter.parentElement?.removeChild(oldWriter);

      // reset giveup mode stuff.
      const giveUpStrokes = this.shadowRoot?.getElementById("strokesDiv") as HTMLDivElement;
      giveUpStrokes.innerHTML = "";
      this.gaveUp_ = false;
      this.setupGaveUp = false;
    }
    if (
      this.writer_.some &&
      this.oldCharacter === this.character &&
      this.gaveUp_ &&
      !this.setupGaveUp
    ) {
      console.log("Updated reset for giveup");
      this.oldCharacter = this.character;
      this.strokeNum_ = -1;
      this.strokeThatHaveMistakes_ = 0;
      this.strokesDrawn_ = 0;
      this.writer_.safeValue().cancelQuiz();
      this.writer_ = None;
      const oldWriter = this.shadowRoot?.querySelector("svg g") as HTMLElement;
      oldWriter.parentElement?.removeChild(oldWriter);

      // setup giveup mode.
      this.setupGaveUp = true;
    }
    this.oldCharacter = this.character;

    //
    // SETUP WRITER.
    //
    const container = this.shadowRoot?.querySelector("#quizContainer");
    if (container === null) {
      return;
    }

    const element = this.shadowRoot?.querySelector("svg") as unknown as HTMLElement;
    this.writer_ = Some(
      HanziWriter.create(element, this.character, {
        width: this.maxDimension_,
        height: this.maxDimension_,
        showCharacter: false,
        showOutline: false,
        padding: 5
      })
    );
    this.strokeNum_ = -1;
    this.strokeThatHaveMistakes_ = 0;
    this.writer_.safeValue().quiz({
      onMistake: (strokeData) => {
        console.log("Oh no! you made a mistake on stroke " + strokeData.strokeNum);
        console.log(
          "You've made " + strokeData.mistakesOnStroke + " mistakes on this stroke so far"
        );
        console.log("You've made " + strokeData.totalMistakes + " total mistakes on this quiz");
        console.log(
          "There are " + strokeData.strokesRemaining + " strokes remaining in this character"
        );
        this.strokesDrawn_++;
        if (this.strokeNum_ !== strokeData.strokeNum) {
          this.strokeNum_ = strokeData.strokeNum;
          this.strokeThatHaveMistakes_++;
        }
      },
      onCorrectStroke: (strokeData) => {
        console.log("Yes!!! You got stroke " + strokeData.strokeNum + " correct!");
        console.log("You made " + strokeData.mistakesOnStroke + " mistakes on this stroke");
        console.log("You've made " + strokeData.totalMistakes + " total mistakes on this quiz");
        console.log(
          "There are " + strokeData.strokesRemaining + " strokes remaining in this character"
        );
        this.strokesDrawn_++;
      },
      onComplete: (summaryData) => {
        console.log("You did it! You finished drawing " + summaryData.character);
        console.log("You made " + summaryData.totalMistakes + " total mistakes on this quiz");
        const options: CustomEventInit<QuizDetail> = {
          bubbles: true,
          composed: true,
          detail: {
            strokeMistakes: this.gaveUp_
              ? this.charData_?.strokes.length ?? 10
              : summaryData.totalMistakes,
            percentMistakes: new FractionD(
              this.gaveUp_
                ? 1.0
                : this.strokeThatHaveMistakes_ / (this.charData_?.strokes.length ?? 10)
            )
          }
        };
        this.dispatchEvent(new CustomEvent<QuizDetail>("onComplete", options));
      }
    });
    if (this.gaveUp_) {
      this.writer_.safeValue().showOutline();
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

  protected override async scheduleUpdate(): Promise<void> {
    const charData = await HanziWriter.loadCharacterData(this.character);
    if (charData) {
      this.charData_ = charData;
    }
    super.scheduleUpdate();
  }

  protected giveUp() {
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
    console.log("target giveup", target);
    if (this.charData_ !== undefined) {
      for (let i = 0; i < this.charData_.strokes.length; i++) {
        const strokesPortion = this.charData_.strokes.slice(0, i + 1);
        renderFanningStrokes(target, strokesPortion);
      }
    }
    this.gaveUp_ = true;
  }

  protected resetQuiz() {
    this.gaveUp_ = false;
    this.setupGaveUp = false;
    this.strokesDrawn_ = 0;
    this.oldCharacter = "____";
    this.strokeNum_ = -1;
    this.strokeThatHaveMistakes_ = 0;
  }

  protected render() {
    const w = Math.min(window.innerWidth, 960);
    const h = window.innerHeight;
    // Max dimension is the smallest of the 2 minus a number for padding of cards and whatnot.
    this.maxDimension_ = Math.min(w - 250, h);
    console.log("render", w, h, this.maxDimension_);

    let strokeCount = 0;
    if (this.charData_) {
      strokeCount = this.charData_.strokes.length;
    }

    const svgOutline = this.createSvgOutline(this.maxDimension_);
    return html`<div id="main">
      <dile-card shadow-md title="Quiz">
        <div id="quizContainer">
          <span>${this.prompt}</span>
        </div>
        <div id="drawing">${svgOutline}</div>

        <div id="strokesDiv"></div>
        <div slot="footer">
          <dile-button @click="${this.giveUp}">Give up!</dile-button>
          <dile-button @click="${this.resetQuiz}">Reset!</dile-button>
          ${this.gaveUp_ ? html`<span>Gave up mode...</span>` : html``}
          <span>Total Strokes ${strokeCount}</span>
          <span>Correct Strokes ${this.strokesDrawn_}</span>
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
