import type { DocumentData, DocumentReference, Timestamp } from "firebase/firestore";

export interface FirestoreReviewDocument {
  char: DocumentReference<DocumentData, DocumentData>;
  difficulty: number;
  reviewed: Timestamp;
}
