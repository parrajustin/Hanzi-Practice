import type { FirebaseApp } from "firebase/app";
import type { Option } from "./option";
import { None, Some } from "./option";
import type { DocumentData, DocumentReference, Timestamp } from "firebase/firestore";
import { collection, getDocs, getFirestore, onSnapshot, query } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export interface Review {
  id: string;
  char: DocumentReference<DocumentData, DocumentData>;
  cardId: string;
  difficulty: number;
  reviewed: Timestamp;
  timestamp: number;
  selfRef: DocumentReference<DocumentData, DocumentData>;
}

export interface Hanzi {
  id: string;
  hanzi: string;
  pinyin: string;
  text: string;
  tone: number;
  selfRef: DocumentReference<DocumentData, DocumentData>;
}

let app: FirebaseApp | undefined;
const reviews: Review[] = [];
const reviewIds = new Set<string>();
const hanzi: Hanzi[] = [];
const hanziIds = new Set<string>();

export type AppCallback = (app: FirebaseApp, reviews: Review[], hanzi: Hanzi[]) => Promise<void>;
const callbacks: AppCallback[] = [];

async function UpdateCallbacks() {
  console.log("UpdateCallbacks", hanzi, reviews);
  for (const cb of callbacks) {
    await cb(app as FirebaseApp, reviews, hanzi);
  }
}

export async function SetApp(newApp: FirebaseApp): Promise<void> {
  console.log("SET APP");
  app = newApp;
  const auth = getAuth(app);
  auth.onAuthStateChanged(async (auth) => {
    if (auth === null) {
      return;
    }

    const firestore = getFirestore(app as FirebaseApp);
    const querySnapshot = await getDocs(collection(firestore, "status"));
    querySnapshot.forEach((result) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data() as Review;
      reviews.push({
        id: result.id,
        char: data.char,
        cardId: (data.char as DocumentReference<DocumentData, DocumentData>).id,
        difficulty: data.difficulty,
        reviewed: data.reviewed,
        timestamp: data.reviewed.toMillis(),
        selfRef: result.ref
      });
      reviewIds.add(result.id);
    });

    const hanziSnapshot = await getDocs(collection(firestore, "hanzi"));
    hanziSnapshot.forEach((result) => {
      const data = result.data() as Hanzi;
      const charData = {
        id: result.id,
        hanzi: data.hanzi,
        pinyin: data.pinyin,
        text: data.text,
        tone: data.tone,
        selfRef: result.ref
      };
      hanzi.push(charData);
      hanziIds.add(result.id);
    });

    await UpdateCallbacks();

    const q = query(collection(firestore, "hanzi"));
    onSnapshot(q, async (querySnapshot) => {
      querySnapshot.forEach((doc) => {
        if (hanziIds.has(doc.id)) {
          return;
        }
        console.log("haniz snapshot", doc.data());
        const data = doc.data() as Hanzi;
        const charData = {
          id: doc.id,
          hanzi: data.hanzi,
          pinyin: data.pinyin,
          text: data.text,
          tone: data.tone,
          selfRef: doc.ref
        };
        hanzi.push(charData);
        hanziIds.add(doc.id);
      });
      await UpdateCallbacks();
    });

    const queryReviews = query(collection(firestore, "status"));
    onSnapshot(queryReviews, async (querySnapshot) => {
      querySnapshot.forEach((doc) => {
        if (doc.metadata.hasPendingWrites || reviewIds.has(doc.id)) {
          return;
        }
        const data = doc.data() as Review;
        console.log("Adding new review: ", data);
        reviews.push({
          id: doc.id,
          char: data.char,
          cardId: (data.char as DocumentReference<DocumentData, DocumentData>).id,
          difficulty: data.difficulty,
          reviewed: data.reviewed,
          timestamp: data.reviewed.toMillis(),
          selfRef: doc.ref
        });
        reviewIds.add(doc.id);
      });
      await UpdateCallbacks();
    });
  });
}

export async function AddAppCb(cb: AppCallback) {
  callbacks.push(cb);
  if (app !== undefined) {
    queueMicrotask(async () => {
      if (app !== undefined) {
        await cb(app, reviews, hanzi);
      }
    });
  }
}

export function GetApp(): Option<FirebaseApp> {
  if (app === undefined) {
    return None;
  }
  return Some(app);
}
