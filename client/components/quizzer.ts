import { AddAppCb } from "client/store";
import { SpacedRepetition } from "client/util/spaced_repetition";
import type { DocumentData, Firestore, DocumentReference, Timestamp } from "firebase/firestore";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { LitElement, TemplateResult, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

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
          tone: data.tone
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

  protected buildHanziQuiz(): TemplateResult {
    if (this.dueCards_.length === 0) {
      return html`No cards due!`;
    }

    const hanzi = this.dueCards_[this.dueCardIndex_];
    if (hanzi === undefined) {
      return html`No card found bug???`;
    }

    return html`<quiz-element
      character="${hanzi.hanzi}"
      prompt="${hanzi.text}"
      pinyin="${hanzi.pinyin}"
      tone="${hanzi.tone}"
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
