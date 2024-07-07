/** The hanzi document schema in firestore. */
export interface FirestoreHanziDocument {
  /** The acutal hanzi. */
  hanzi: string;
  /** The pretty pinyin value. (tone integrated) */
  pinyin: string;
  /** The english text prompt/definition. */
  text: string;
  /** The tone of the character. */
  tone: number;
}
