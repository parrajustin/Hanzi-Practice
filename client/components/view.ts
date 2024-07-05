import { AddAppCb } from "client/store";
import type { Firestore } from "firebase/firestore";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

interface Hanzi {
  id: string;
  hanzi: string;
  pinyin: string;
  text: string;
  tone: number;
}

@customElement("viewer-element")
export class ViewElement extends LitElement {
  static styles = css`
    .u-full-height {
      height: 100%;
    }
  `;

  private db_?: Firestore;
  /** Hanzi character informations. */
  @state()
  private hanziChars_: Hanzi[] = [];

  constructor() {
    super();
    console.log("VIEWER");

    AddAppCb(async (app) => {
      this.db_ = getFirestore(app);

      const hanzi = await getDocs(collection(this.db_, "hanzi"));
      const hanziChars: Hanzi[] = [];
      hanzi.forEach((result) => {
        const data = result.data() as Hanzi;
        const charData = {
          id: result.id,
          hanzi: data.hanzi,
          pinyin: data.pinyin,
          text: data.text,
          tone: data.tone
        };
        hanziChars.push(charData);
      });

      console.log("ViewElement loaded:", hanziChars);
      this.hanziChars_ = hanziChars;
    });
  }
  protected render() {
    const conf = [
      { property: "id", header: "ID", hidden: true },
      { property: "hanzi", header: "Hanzi", hidden: false },
      { property: "pinyin", header: "Pinyin", hidden: false },
      { property: "text", header: "Text", hidden: false },
      { property: "tone", header: "Tone", hidden: false }
    ];
    return html`<lit-datatable
      sticky-header
      .data="${this.hanziChars_}"
      .conf="${conf}"
    ></lit-datatable>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "viewer-element": ViewElement;
  }
}
