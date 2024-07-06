import type { Option } from "client/option";
import { None, Some } from "client/option";
import { AddAppCb } from "client/store";
import type { Token, TokenMatches, TokenizerFn } from "client/tokenizer/chinse_tokenizer";
import { CreateChineseTokenizer } from "client/tokenizer/chinse_tokenizer";
import type { Firestore } from "firebase/firestore";
import { addDoc, collection, doc, getFirestore, setDoc } from "firebase/firestore";
import { LitElement, TemplateResult, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

interface DileInputChangedDetail {
  name: string;
  value: string;
}

interface DileInputChangedEvent extends CustomEvent {
  detail: DileInputChangedDetail;
}

@customElement("creator-element")
export class CreatorElement extends LitElement {
  static styles = css`
    :host {
      --dile-modal-width: 90vw;
    }
    .u-full-height {
      height: 100%;
    }
  `;

  private db_?: Firestore;

  private tokenizer_: Option<TokenizerFn> = None;
  /** Hanzi input. */
  private hanzi_ = "";

  @state()
  private tokens_: Token[] = [];

  constructor() {
    super();

    AddAppCb(async (app) => {
      this.db_ = getFirestore(app);

      const createResult = await CreateChineseTokenizer();
      if (createResult.err) {
        console.error("ERROR CreateChineseTokenizer", createResult);
        return;
      }
      this.tokenizer_ = Some(createResult.safeUnwrap());
    });
  }

  protected async createHanzi() {
    console.log("called createHanzi");

    if (this.db_ === undefined) {
      return;
    }

    let success = true;
    const addPromise = await addDoc(collection(this.db_, "hanzi"), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hanzi: (this.shadowRoot?.getElementById("hanzi") as any).value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pinyin: (this.shadowRoot?.getElementById("pinyin") as any).value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text: (this.shadowRoot?.getElementById("prompt") as any).value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tone: (this.shadowRoot?.getElementById("tone") as any).value
    }).catch((err) => {
      console.error("error createHanzi", err);
      const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open("Failed when calling `addDoc` to firestore!", "error");
    });
    console.log("addPromise", addPromise);
    if (success) {
      const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open(
        `Added ${(this.shadowRoot?.getElementById("hanzi") as HTMLInputElement).value}!`,
        "success"
      );
    }
  }

  protected hanziInputChange(e: DileInputChangedEvent) {
    this.hanzi_ = e.detail.value;
    if (this.tokenizer_.some && this.hanzi_ !== "") {
      this.tokens_ = this.tokenizer_.safeValue()(this.hanzi_);
      console.log("hanziInputChange", this.tokens_);
      if (this.tokens_.length !== 1) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.shadowRoot?.getElementById("elmodal") as any | undefined)?.open();
    }
  }

  protected updateInput(pinyin: string, prompt: string, tone: number) {
    console.log("updateInput", pinyin, prompt, tone);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.shadowRoot?.getElementById("pinyin") as any).value = pinyin;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.shadowRoot?.getElementById("prompt") as any).value = prompt;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.shadowRoot?.getElementById("tone") as any).value = tone;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.shadowRoot?.getElementById("elmodal") as any | undefined)?.close();
  }

  protected getMatches(): TokenMatches[] {
    if (this.tokens_.length === 1) {
      return this.tokens_[0]?.matches ?? [];
    }
    return [];
  }

  protected render() {
    return html`<dile-modal class="modalbox" id="elmodal">
        <h2>Found the following examples:</h2>

        <ul>
          ${this.getMatches().map((matches): TemplateResult => {
            return html`<li>
              <dile-button
                @click="${() => {
                  this.updateInput(
                    matches.prettyPinyin,
                    matches.english,
                    parseInt(matches.pinyin[matches.pinyin.length - 1] ?? "4")
                  );
                }}"
                >Select ${matches.prettyPinyin}</dile-button
              >
              ${JSON.stringify(matches)}
            </li>`;
          })}
        </ul>
      </dile-modal>
      <dile-toast id="myToast" duration="1000"></dile-toast>
      <div class="u-full-height">
        <dile-card shadow-md title="Character Creator">
          <div id="quizContainer">
            <dile-input
              id="hanzi"
              name="hanzi"
              label="Hanzi"
              @element-changed="${this.hanziInputChange}"
            ></dile-input>
            <dile-input id="pinyin" name="pinyin" label="Pinyin"></dile-input>
            <dile-input id="prompt" name="prompt" label="Prompt"></dile-input>
            <dile-input id="tone" name="tone" label="Tone"></dile-input>
          </div>

          <div slot="footer">
            <dile-button @click="${this.createHanzi}">Create</dile-button>
          </div>
        </dile-card>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "creator-element": CreatorElement;
  }
}
