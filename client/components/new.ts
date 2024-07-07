import type { FirestoreHanziDocument } from "client/db/hanzi";
import type { Option } from "client/option";
import { None, Some } from "client/option";
import { AddAppCb } from "client/store";
import type { Token, TokenMatches, TokenizerFn } from "client/tokenizer/chinse_tokenizer";
import { CreateChineseTokenizer } from "client/tokenizer/chinse_tokenizer";
import type { Firestore } from "firebase/firestore";
import { addDoc, collection, getDocs, getFirestore } from "firebase/firestore";
import type { TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

interface DileInputChangedDetail {
  name: string;
  value: string;
}

interface DileInputChangedEvent extends CustomEvent {
  detail: DileInputChangedDetail;
}

interface ExtendedTokenMatches extends TokenMatches {
  /** If it already exists in the store. */
  existingEntry: boolean;
}

@customElement("creator-element")
export class CreatorElement extends LitElement {
  static styles = css`
    :host {
      --dile-modal-width: 90vw;
    }
  `;

  private db_?: Firestore;

  private tokenizer_: Option<TokenizerFn> = None;
  /** Hanzi input. */
  private hanzi_ = "";
  /** Existing hanzi with chars. */
  private existingHanzi_ = new Set<string>();

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

      const hanzi = await getDocs(collection(this.db_, "hanzi"));
      hanzi.forEach((result) => {
        const data = result.data() as FirestoreHanziDocument;
        this.existingHanzi_.add(`${data.hanzi}-${data.pinyin}`);
      });
    });
  }

  protected async createHanzi() {
    console.log("called createHanzi");

    if (this.db_ === undefined) {
      return;
    }

    let success = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hanzi = (this.shadowRoot?.getElementById("hanzi") as any).value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinyin = (this.shadowRoot?.getElementById("pinyin") as any).value;
    const addPromise = await addDoc(collection(this.db_, "hanzi"), {
      hanzi,
      pinyin,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text: (this.shadowRoot?.getElementById("prompt") as any).value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tone: (this.shadowRoot?.getElementById("tone") as any).value
    }).catch((err) => {
      console.error("error createHanzi", err);
      const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open("Failed when calling `addDoc` to firestore!", "error");
      success = false;
    });
    console.log("addPromise", addPromise);
    if (success) {
      const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open(
        `Added ${(this.shadowRoot?.getElementById("hanzi") as HTMLInputElement).value}!`,
        "success"
      );
      this.existingHanzi_.add(`${hanzi}-${pinyin}`);
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

  protected getMatches(): ExtendedTokenMatches[] {
    if (this.tokens_.length === 1) {
      return (
        this.tokens_[0]?.matches.map((v): ExtendedTokenMatches => {
          return {
            ...v,
            existingEntry: this.existingHanzi_.has(`${this.hanzi_}-${v.prettyPinyin}`)
          };
        }) ?? []
      );
    }
    return [];
  }

  protected render() {
    const getButton = (match: ExtendedTokenMatches) => {
      if (!match.existingEntry) {
        return html`<dile-button
          @click="${() => {
            this.updateInput(
              match.prettyPinyin,
              match.english,
              parseInt(match.pinyin[match.pinyin.length - 1] ?? "4")
            );
          }}"
          >Select ${match.prettyPinyin}</dile-button
        >`;
      }
      return html`(Already Added...)`;
    };
    const getText = (match: ExtendedTokenMatches) => {
      return html`<span style="margin: 5px">TonePinyin: ${match.pinyin}</span
        ><span style="margin: 5px">Pinyin: ${match.prettyPinyin}</span
        ><span style="margin: 5px">English: ${match.english}</span>`;
    };
    return html`<dile-modal class="modalbox" id="elmodal">
        <h2>Found the following examples:</h2>

        <ul>
          ${this.getMatches().map((matches): TemplateResult => {
            return html`<li>${getButton(matches)}${getText(matches)}</li>`;
          })}
        </ul>
      </dile-modal>
      <dile-toast id="myToast" duration="1000"></dile-toast>
      <div>
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
