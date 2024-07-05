import type { Result } from "client/result";
import { Ok } from "client/result";
import type { ChineseDictData } from "./cedict";
import { Cedict } from "./cedict";

const chinesePunctuation = [
  "·",
  "×",
  "—",
  "‘",
  "’",
  "“",
  "”",
  "…",
  "、",
  "。",
  "《",
  "》",
  "『",
  "』",
  "【",
  "】",
  "！",
  "（",
  "）",
  "，",
  "：",
  "；",
  "？"
];

// {
//   "text": "是",
//   "traditional": "是",
//   "simplified": "是",
//   "position": { "offset": 1, "line": 1, "column": 2 },
//   "matches": [
//     {
//       "pinyin": "shi4",
//       "pinyinPretty": "shì",
//       "english": "is/are/am/yes/to be"
//     }
//   ]
// },

export interface TokenMatches {
  // Pinyin with number tones ex: shi4.
  pinyin: string;
  // Pinyin with integrated tone ex: shì.
  prettyPinyin: string;
  // English definition.
  english: string;
}

export interface Token {
  // Text input.
  text: string;
  // Traditional version of the string.
  traditional: string;
  // Simplified version of the string.
  simplified: string;
  // Position in the text.
  position: {
    offset: number;
    line: number;
    column: number;
  };
  matches: TokenMatches[];
}

export type TokenizerFn = (text: string) => Token[];

/** Loaded chinse dictionary instance. */
const CHINSE_DICTIONARY = new Cedict();

export async function CreateChineseTokenizer(): Promise<
  Result<TokenizerFn, "Failed to load dict">
> {
  // Get chinse dictionary and load it.
  const dictResult = await CHINSE_DICTIONARY.load();

  console.log("CreateChineseTokenizer", dictResult, CHINSE_DICTIONARY);
  if (dictResult.err) {
    return dictResult;
  }

  return Ok((input: string): Token[] => {
    const processedText = Array.from(input.replace(/\r/g, ""));

    const result: Token[] = [];
    let i = 0;
    let [offset, line, column] = [0, 1, 1];
    let simplifiedPreference = 0;
    let traditionalPreference = 0;

    const pushToken = (word: string) => {
      const simplifiedEntries = CHINSE_DICTIONARY.get(word, false).valueOr([]);
      const traditionalEntries = CHINSE_DICTIONARY.get(word, true).valueOr([]);

      let entries: ChineseDictData[] = [];

      if (simplifiedEntries.length === 0 && traditionalEntries.length > 0) {
        entries = traditionalEntries;
        traditionalPreference++;
      } else if (simplifiedEntries.length > 0 && traditionalEntries.length === 0) {
        entries = simplifiedEntries;
        simplifiedPreference++;
      } else if (simplifiedPreference < traditionalPreference) {
        entries = traditionalEntries;
      } else {
        entries = simplifiedEntries;
      }

      result.push({
        text: word,
        traditional: entries[0] ? entries[0].traditional : word,
        simplified: entries[0] ? entries[0].simplified : word,

        position: {
          offset,
          line,
          column
        },

        matches: entries.map(({ pinyin, prettyPinyin, english }) => ({
          pinyin,
          prettyPinyin,
          english
        }))
      });

      const wordArr = Array.from(word);
      const lastLineBreakIndex = word.lastIndexOf("\n");

      i += wordArr.length;
      offset += word.length;
      line += wordArr.filter((x) => x === "\n").length;
      column = lastLineBreakIndex >= 0 ? word.length - lastLineBreakIndex : column + word.length;
    };

    while (i < processedText.length) {
      // Try to match two or more characters

      if (i !== processedText.length - 1) {
        const getTwo = processedText.slice(i, i + 2).join("");
        const simplifiedEntries = CHINSE_DICTIONARY.getAllValuesForKeyAndDecendents(
          getTwo,
          false
        ).valueOr<ChineseDictData[]>([]);
        const traditionalEntries = CHINSE_DICTIONARY.getAllValuesForKeyAndDecendents(
          getTwo,
          true
        ).valueOr<ChineseDictData[]>([]);
        let foundWord = null;
        let foundEntries = null;

        for (const entries of [traditionalEntries, simplifiedEntries]) {
          for (const entry of entries) {
            const matchText = entries === traditionalEntries ? entry.traditional : entry.simplified;
            const word = processedText.slice(i, i + Array.from(matchText).length).join("");

            if (
              matchText === word &&
              (foundWord == null || Array.from(word).length > Array.from(foundWord).length)
            ) {
              foundWord = word;
              foundEntries = entries;
            }
          }
        }

        if (foundWord != null) {
          pushToken(foundWord);

          if (foundEntries === simplifiedEntries) {
            simplifiedPreference++;
          } else if (foundEntries === traditionalEntries) {
            traditionalPreference++;
          }

          continue;
        }
      }

      // If it fails, match one character

      const character = processedText[i] as string;
      const isChinese = (character: string): boolean =>
        chinesePunctuation.includes(character) ||
        CHINSE_DICTIONARY.get(character, false).valueOr([]).length > 0 ||
        CHINSE_DICTIONARY.get(character, true).valueOr([]).length > 0;

      if (isChinese(character) || character.match(/\s/) != null) {
        pushToken(character);
        continue;
      }

      // Handle non-Chinese characters

      let end = i + 1;

      for (; end < processedText.length; end++) {
        if ((processedText[end] ?? "").match(/\s/) != null || isChinese(processedText[end] ?? "")) {
          break;
        }
      }

      const word = processedText.slice(i, end).join("");
      pushToken(word);
    }

    return result;
  });
}
