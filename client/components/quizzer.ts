import { AddAppCb } from "client/store";
import type { IComputeReviewFactor } from "client/util/spaced_repetition";
import { SpacedRepetition } from "client/util/spaced_repetition";
import type { DocumentData, Firestore, DocumentReference, Timestamp } from "firebase/firestore";
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from "firebase/firestore";
import type { TemplateResult } from "lit";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { QuizDetail } from "./quiz";
import type { Option } from "client/option";
import { None, Some } from "client/option";
import type { PinyinDetail } from "./pinyin_selector";
import { Shuffle } from "client/util/shuffle";

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

type DueCardType = [Hanzi, IComputeReviewFactor];

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
  private dueCards_: DueCardType[] = [];
  @state()
  private dueCardIndex_ = 0;
  private oldDueCardIndex_ = -1;

  private finishedPinyinSelectorMistakes_: Option<number> = None;
  private finsihedHanziQuiz_: Option<QuizDetail> = None;

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
    const srs = this.spacedRepetitionSystem.getDueCards(this.hanziChars_, this.reviews_);
    Shuffle(srs);
    this.dueCards_ = srs as unknown as [Hanzi, IComputeReviewFactor][];
    console.log("dueCards", this.dueCards_);
  }

  protected async emitCompletion() {
    if (this.finsihedHanziQuiz_.none || this.finishedPinyinSelectorMistakes_.none) {
      return;
    }

    const hanziQuizDetail = this.finsihedHanziQuiz_.safeValue();

    const hanzi = (this.dueCards_[this.dueCardIndex_] as DueCardType)[0];
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
    if (hanziQuizDetail.percentMistakes.fraction < 1e-6) {
      difficulty = 5;
      style = "success";
    } else if (hanziQuizDetail.strokeMistakes === 1) {
      difficulty = 4;
      style = "success";
    } else if (hanziQuizDetail.percentMistakes.fraction < 0.25) {
      difficulty = 3;
      style = "neutral";
    } else if (hanziQuizDetail.percentMistakes.fraction < 0.5) {
      difficulty = 2;
      style = "neutral";
    } else if (hanziQuizDetail.percentMistakes.fraction < 0.75) {
      difficulty = 1;
    } else {
      difficulty = 0;
    }
    let maxDifficulty = 5;
    if (this.finishedPinyinSelectorMistakes_.safeValue() > 1) {
      maxDifficulty = 3;
    } else if (this.finishedPinyinSelectorMistakes_.safeValue() === 1) {
      maxDifficulty = 4;
    }
    difficulty = Math.min(difficulty, maxDifficulty);

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

  protected async onComplete(e: CustomEvent<QuizDetail>) {
    this.finsihedHanziQuiz_ = Some(e.detail);
    await this.emitCompletion();
  }

  protected async onCompletePinyin(e: CustomEvent<PinyinDetail>) {
    this.finishedPinyinSelectorMistakes_ = Some(e.detail.mistakes);
    await this.emitCompletion();
  }

  protected buildHanziQuiz(): TemplateResult {
    if (this.dueCards_.length === 0 || this.dueCardIndex_ === this.dueCards_.length) {
      return html`No cards due!`;
    }

    const todayNumber = this.spacedRepetitionSystem.getDay();
    const dueCardStruct = this.dueCards_[this.dueCardIndex_] as DueCardType;
    console.log("hanzi quiz cardstruct", dueCardStruct);
    const hanzi = dueCardStruct[0];
    if (hanzi === undefined) {
      return html`No card, found bug???`;
    }

    return html` <dile-toast id="errorToast" duration="100000"></dile-toast
      ><dile-toast id="myToast" duration="5000"></dile-toast>

      <dile-card shadow-md>
        <span>Due cards: ${this.dueCards_.length}</span>
        <span>No review: ${this.hanziChars_.length - this.dueCards_.length}</span>
        <span>|</span>
        <span>Card due ${dueCardStruct[1].dueDayNumber} today ${todayNumber}</span>
        <dile-rating value="${dueCardStruct[1].efactor}" disableChanges></dile-rating>
      </dile-card>
      <quiz-element
        character="${hanzi.hanzi}"
        prompt="${hanzi.text}"
        pinyin="${hanzi.pinyin}"
        tone="${hanzi.tone}"
        @onComplete="${this.onComplete}"
      ></quiz-element>
      <pinyin-selector-element
        pinyinLine="${hanzi.pinyin}"
        @onComplete="${this.onCompletePinyin}"
      ></pinyin-selector-element>`;
  }

  protected render() {
    if (this.oldDueCardIndex_ !== this.dueCardIndex_) {
      this.oldDueCardIndex_ = this.dueCardIndex_;
      this.finishedPinyinSelectorMistakes_ = None;
      this.finsihedHanziQuiz_ = None;
    }

    const quizlet = this.buildHanziQuiz();
    return html`<div>${quizlet}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quizzer-element": QuizzerElement;
  }
}
