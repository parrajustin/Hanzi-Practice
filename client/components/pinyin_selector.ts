import { ConstructOtherOptions } from "client/util/prettify_pinyin";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface PinyinDetail {
  mistakes: number;
}

@customElement("pinyin-selector-element")
export class PinyinSelectorElement extends LitElement {
  static styles = css`
    :host {
      --dile-button-font-size: 3rem;
      --dile-button-padding-y: 1rem;
      --dile-button-padding-x: 1rem;
    }
    #quizContainer {
      display: flex;
    }
    .spacer {
      margin: 5px;
    }
  `;
  @property()
  pinyinLine: string = "";

  private wrongGuesses = 0;
  private oldLine = "";

  protected shuffle<T>(array: T[]) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex] as T,
        array[currentIndex] as T
      ];
    }
  }

  protected clickedBtn(id: string, wasCorrect: boolean) {
    if (wasCorrect) {
      const options: CustomEventInit<PinyinDetail> = {
        bubbles: true,
        composed: true,
        detail: {
          mistakes: this.wrongGuesses
        }
      };
      this.dispatchEvent(new CustomEvent<PinyinDetail>("onComplete", options));
      const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open(`Correct! Got "${this.wrongGuesses}" wrong guesses!`, "success");
    } else {
      this.wrongGuesses++;
      (this.shadowRoot?.getElementById(id) as HTMLElement).style.outline = "5px solid red";
      const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open(`Wrong pinyin choice ${id}!`, "error");
    }
  }

  protected render() {
    if (this.oldLine !== this.pinyinLine) {
      console.log("reset wrong");
      this.wrongGuesses = 0;
      this.oldLine = this.pinyinLine;
      const quizContainer = this.shadowRoot?.getElementById("quizContainer");
      if (quizContainer !== undefined && quizContainer !== null) {
        const nodes = quizContainer.querySelectorAll("dile-button") as NodeListOf<HTMLDivElement>;
        nodes.forEach((n) => {
          n.style.outline = "";
        });
      }
    }

    const pinyinList = this.pinyinLine.split(" ");
    if (pinyinList.length !== 1) {
      return html`<span>Failed due length of input? "${pinyinList}"</span>`;
    }
    const pinyin = pinyinList[0];
    if (pinyin === undefined) {
      return html`<span>No text from character "${pinyin}</span>`;
    }

    const otherOptions = ConstructOtherOptions(pinyin);
    const allOptions = [...otherOptions, pinyin];
    this.shuffle(allOptions);

    // const pinyinWithoutToneNum = this.charData_?.slice(0, text.length - 1);
    return html` <dile-card shadow-md title="Tone Selector">
        <div id="quizContainer">
          ${allOptions.map((o) => {
            return html`<dile-button
              class="spacer"
              id="${o}"
              @click="${() => this.clickedBtn(o, o === pinyin)}"
              >${o}</dile-button
            >`;
          })}
        </div>
      </dile-card>
      <dile-toast id="myToast" duration="5000"></dile-toast>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pinyin-selector-element": PinyinSelectorElement;
  }
}
