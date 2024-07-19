import type { FirestoreReviewDocument } from "client/db/review";
import { AddAppCb } from "client/store";
import type { DocumentData, DocumentReference, Firestore } from "firebase/firestore";
import { collection, deleteDoc, doc, getDocs, getFirestore } from "firebase/firestore";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { deleteIcon } from "../../third_party/icons/delete";
import type { Option } from "client/option";
import { None, Some } from "client/option";

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
  @state()
  private reviewDeletion_ = "";
  @state()
  private reviewDeletionInProgress_ = false;
  @state()
  private reviewError_: Option<string> = None;

  constructor() {
    super();
    console.log("Review VIEWER");

    AddAppCb(async (app, reviews, hanzi) => {
      this.db_ = getFirestore(app);

      hanzi.forEach((result) => {
        this.hanziChars_.set(result.id, result);
      });

      const localReviews: Review[] = [];
      reviews.forEach((result) => {
        const hanziElement = this.hanziChars_.get(result.char.id);
        if (hanziElement === undefined) {
          console.error("hanziElement missing: ", result.char.id);
          return;
        }

        localReviews.push({
          id: result.id,
          char: hanziElement.hanzi,
          pinyin: hanziElement.pinyin,
          cardId: result.char,
          difficulty: result.difficulty,
          timestamp: result.reviewed.toMillis(),
          selfRef: result.selfRef
        });
      });
      this.reviews_ = localReviews;
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

  protected deleteReview(ref: DocumentReference<DocumentData, DocumentData>) {
    this.reviewDeletionInProgress_ = true;
    this.reviewError_ = None;
    this.reviewDeletion_ = ref.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.shadowRoot?.getElementById("myModal") as any).open();
    if (this.db_ !== undefined) {
      deleteDoc(doc(collection(this.db_, "status"), ref.id))
        .then(() => {
          this.reviewDeletionInProgress_ = false;
        })
        .catch((error: unknown) => {
          this.reviewDeletionInProgress_ = false;
          this.reviewError_ = Some(`Failed deleteDoc for "${ref.id} due to "${error}"`);
        });
    } else {
      this.reviewDeletionInProgress_ = false;
      this.reviewError_ = Some(
        `Could not delete ${this.reviewDeletion_} becuse firestore not booted.`
      );
    }
  }

  protected render() {
    const conf = [
      { property: "id", header: "ID", hidden: false },
      { property: "char", header: "Hanzi", hidden: false },
      { property: "pinyin", header: "Pinyin", hidden: false },
      { property: "cardId", header: "CardId", hidden: true },
      { property: "difficulty", header: "Difficulty", hidden: false },
      { property: "timestamp", header: "Timestamp", hidden: false },
      { property: "selfRef", header: "DeleteBtn", hidden: false }
    ];
    const propertyOfTimestamp = (value: string) =>
      html`<div style="color: red;">${this.toIsoString(new Date(value))}</div>`;
    const deletionBtn = (value: DocumentReference<DocumentData, DocumentData>) =>
      html`<dile-button-icon
        @click="${() => {
          this.deleteReview(value);
        }}"
        .icon="${deleteIcon}"
      ></dile-button-icon>`;
    const modalBody = () => {
      if (this.reviewDeletionInProgress_) {
        return html`<dile-spinner active></dile-spinner>`;
      } else if (this.reviewError_.some) {
        return html`<p>Error: ${this.reviewError_}.</p>`;
      } else {
        return html`<p>Successfully deleted ${this.reviewDeletion_}.</p>`;
      }
    };
    return html`<lit-datatable sticky-header .data="${this.reviews_}" .conf="${conf}"
        ><lit-datatable-column
          column="${true}"
          property="timestamp"
          .html="${propertyOfTimestamp}"
        ></lit-datatable-column>
        <lit-datatable-column
          column="${true}"
          property="selfRef"
          .html="${deletionBtn}"
        ></lit-datatable-column>
      </lit-datatable>
      <dile-modal id="myModal" showCloseIcon blocking>
        <p>Deleting review "${this.reviewDeletion_}".</p>
        ${modalBody()}
      </dile-modal> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "review-veiwer-element": ReviewViewElement;
  }
}
