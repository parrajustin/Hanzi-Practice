import type { FirestoreReviewDocument } from "client/db/review";
import { AddAppCb } from "client/store";
import type { DocumentData, DocumentReference, Firestore } from "firebase/firestore";
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

interface Review {
  /** Review firestore id. */
  id: string;
  /** The hanzi the review is for. */
  char: string;
  /** The pinyin the review is for. */
  pinyin: string;
  /** The hanzi id in firestore. */
  cardId: DocumentReference<DocumentData, DocumentData>;
  /** The assigned difficult for this review. */
  difficulty: number;
  /** The timestamp for this rivew. */
  timestamp: number;
  /** The self ref for this review. */
  selfRef: DocumentReference<DocumentData, DocumentData>;
}

@customElement("review-veiwer-element")
export class ReviewViewElement extends LitElement {
  static styles = css`
    .u-full-height {
      height: 100%;
    }
  `;

  private db_?: Firestore;
  /** Hanzi character informations. */
  private hanziChars_ = new Map<string, Hanzi>();
  /** Spaced Repetition data. */
  @state()
  private reviews_: Review[] = [];

  constructor() {
    super();
    console.log("Review VIEWER");

    AddAppCb(async (app) => {
      this.db_ = getFirestore(app);

      const hanzi = await getDocs(collection(this.db_, "hanzi"));
      hanzi.forEach((result) => {
        const data = result.data() as Hanzi;
        const charData = {
          id: result.id,
          hanzi: data.hanzi,
          pinyin: data.pinyin,
          text: data.text,
          tone: data.tone
        };
        this.hanziChars_.set(result.id, charData);
      });
      console.log("Review hanzi: ", this.hanziChars_);

      const reviews: Review[] = [];
      const querySnapshot = await getDocs(collection(this.db_, "status"));
      querySnapshot.forEach((result) => {
        const data = result.data() as FirestoreReviewDocument;
        const hanziElement = this.hanziChars_.get(data.char.id);
        if (hanziElement === undefined) {
          console.error("hanziElement missing: ", data.char.id);
          return;
        }

        reviews.push({
          id: result.id,
          char: hanziElement.hanzi,
          pinyin: hanziElement.pinyin,
          cardId: data.char,
          difficulty: data.difficulty,
          timestamp: data.reviewed.toMillis(),
          selfRef: result.ref
        });
      });
      this.reviews_ = reviews;
      this.reviews_.sort((a, b) => b.timestamp - a.timestamp);
      console.log("reviews loaded: ", this.reviews_);
    });
  }

  protected toIsoString(date: Date) {
    const tzo = -date.getTimezoneOffset(),
      dif = tzo >= 0 ? "+" : "-",
      pad = (num: number) => {
        return (num < 10 ? "0" : "") + num;
      };

    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes()) +
      ":" +
      pad(date.getSeconds()) +
      dif +
      pad(Math.floor(Math.abs(tzo) / 60)) +
      ":" +
      pad(Math.abs(tzo) % 60)
    );
  }

  protected render() {
    const conf = [
      { property: "id", header: "ID", hidden: true },
      { property: "char", header: "Hanzi", hidden: false },
      { property: "pinyin", header: "Pinyin", hidden: false },
      { property: "cardId", header: "CardId", hidden: true },
      { property: "difficulty", header: "Difficulty", hidden: false },
      { property: "timestamp", header: "Timestamp", hidden: false },
      { property: "selfRef", header: "SelfRef", hidden: true }
    ];
    const propertyOfTimestamp = (value: string) =>
      html`<div style="color: red;">${this.toIsoString(new Date(value))}</div>`;
    return html`<lit-datatable sticky-header .data="${this.reviews_}" .conf="${conf}"
      ><lit-datatable-column
        column="${true}"
        property="timestamp"
        .html="${propertyOfTimestamp}"
      ></lit-datatable-column>
    </lit-datatable>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "review-veiwer-element": ReviewViewElement;
  }
}
