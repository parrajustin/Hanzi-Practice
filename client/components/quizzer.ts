import { AddAppCb } from "client/store";
import { SpacedRepetition } from "client/util/spaced_repetition";
import type { DocumentData, Firestore, DocumentReference, Timestamp } from "firebase/firestore";
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from "firebase/firestore";
import type { TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { QuizDetail } from "./quiz";

interface Review {
  id: string;
  char: DocumentReference<DocumentData, DocumentData>;
  cardId: string;
  difficulty: number;
  reviewed: Timestamp;
  timestamp: number;
  selfRef: DocumentReference<DocumentData, DocumentData>;
}

interface Hanzi {
  id: string;
  hanzi: string;
  pinyin: string;
  text: string;
  tone: number;
  selfRef: DocumentReference<DocumentData, DocumentData>;
}

@customElement("quizzer-element")
export class QuizzerElement extends LitElement {
  static styles = css`
    .u-full-height {
      height: 100%;
    }
  `;

  private db_?: Firestore;
  /** Spaced Repetition data. */
  private reviews_: Review[] = [];
  /** Hanzi character informations. */
  private hanziChars_: Hanzi[] = [];
  /** Hanzi character data. */
  private hanzi_ = new Map<string, Hanzi>();
  /** Spaced repetition system. */
  private spacedRepetitionSystem = new SpacedRepetition();

  @state()
  private dueCards_: Hanzi[] = [];
  @state()
  private dueCardIndex_ = 0;

  constructor() {
    super();

    AddAppCb(async (app) => {
      this.db_ = getFirestore(app);
      const querySnapshot = await getDocs(collection(this.db_, "status"));
      querySnapshot.forEach((result) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = result.data() as Review;
        this.reviews_.push({
          id: result.id,
          char: data.char,
          cardId: (data.char as DocumentReference<DocumentData, DocumentData>).id,
          difficulty: data.difficulty,
          reviewed: data.reviewed,
          timestamp: data.reviewed.toMillis(),
          selfRef: result.ref
        });
      });

      const hanzi = await getDocs(collection(this.db_, "hanzi"));
      hanzi.forEach((result) => {
        const data = result.data() as Hanzi;
        const charData = {
          id: result.id,
          hanzi: data.hanzi,
          pinyin: data.pinyin,
          text: data.text,
          tone: data.tone,
          selfRef: result.ref
        };
        this.hanziChars_.push(charData);
        this.hanzi_.set(result.id, charData);
      });

      console.log("loaded:", this.reviews_, this.hanzi_);
      this.identifyReview();
    });
  }

  protected identifyReview() {
    this.dueCards_ = this.spacedRepetitionSystem
      .getDueCards(this.hanziChars_, this.reviews_)
      .map((v) => v[0]) as unknown as Hanzi[];
    console.log("dueCards", this.dueCards_);
  }

  protected async onComplete(e: CustomEvent<QuizDetail>) {
    console.log("onComplete", e);
    const hanzi = this.dueCards_[this.dueCardIndex_];
    if (hanzi === undefined) {
      const toast = this.shadowRoot?.getElementById("errorToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open("Complete called but found no hanzi!?", "error");
      throw new Error("no hanzi found!");
    }
    if (this.db_ === undefined) {
      const toast = this.shadowRoot?.getElementById("errorToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open("No firestore db found!", "error");
      throw new Error("no db");
    }

    let style = "error";
    let difficulty = 0;
    if (e.detail.percentMistakes.fraction < 1e-6) {
      difficulty = 5;
      style = "success";
    } else if (e.detail.strokeMistakes === 1) {
      difficulty = 4;
      style = "success";
    } else if (e.detail.percentMistakes.fraction < 0.25) {
      difficulty = 3;
      style = "neutral";
    } else if (e.detail.percentMistakes.fraction < 0.5) {
      difficulty = 2;
      style = "neutral";
    } else if (e.detail.percentMistakes.fraction < 0.75) {
      difficulty = 1;
    } else {
      difficulty = 0;
    }

    const toastText = `Finished got: ${difficulty}`;
    const toast = this.shadowRoot?.getElementById("myToast") as HTMLElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (toast as any).open(toastText, style);
    setTimeout(() => {
      this.dueCardIndex_++;
    }, 5000);
    const addPromise = await addDoc(collection(this.db_, "status"), {
      char: hanzi.selfRef,
      difficulty,
      reviewed: serverTimestamp()
    }).catch((e) => {
      const toast = this.shadowRoot?.getElementById("errorToast") as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (toast as any).open("Failed when calling `addDoc` to firestore!", "error");
      throw new Error(e);
    });
    console.log("write review", addPromise);
  }

  protected buildHanziQuiz(): TemplateResult {
    if (this.dueCards_.length === 0 || this.dueCardIndex_ === this.dueCards_.length) {
      return html`No cards due!`;
    }

    const hanzi = this.dueCards_[this.dueCardIndex_];
    if (hanzi === undefined) {
      return html`No card found bug???`;
    }

    return html` <dile-toast id="errorToast" duration="100000"></dile-toast
      ><dile-toast id="myToast" duration="5000"></dile-toast>
      <quiz-element
        character="${hanzi.hanzi}"
        prompt="${hanzi.text}"
        pinyin="${hanzi.pinyin}"
        tone="${hanzi.tone}"
        @onComplete="${this.onComplete}"
      ></quiz-element>`;
  }

  protected render() {
    const quizlet = this.buildHanziQuiz();
    return html`<div class="u-full-height">${quizlet}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quizzer-element": QuizzerElement;
  }
}
