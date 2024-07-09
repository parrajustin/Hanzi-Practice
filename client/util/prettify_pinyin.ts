// Quick guide for typing Chinese pinyin on Mac OS X

// Tone 1 (flat) mā – Option + a, then hit a vowel key
// Tone 2 (rising) má – Option + e, then hit a vowel key
// Tone 3 (falling-rising) mǎ – Option + v, then hit a vowel key
// Tone 4 (falling) mà – Option + `, then hit a vowel key

// ǚ – Option + V, then hit V (submitted by QA)
// ǜ – Option + `, then hit V (submitted by QA)

const replacements = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  u: ["ū", "ú", "ǔ", "ù"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"]
};

const medials = ["i", "u", "ü"];

export function PrettifyPinyin(str: string) {
  str = str.replace("v", "ü");
  const syllables = str.split(" ");

  for (let i = 0; i < syllables.length; i++) {
    const syllable = syllables[i] as string;
    const tone = parseInt(syllable[syllable.length - 1] as string);

    if (tone <= 0 || tone > 5) {
      console.error("invalid tone number:", tone, "in", syllable);
    } else if (tone === 5) {
      syllables[i] = syllable.slice(0, syllable.length - 1);
    } else {
      for (let j = 0; j < syllable.length; j++) {
        const currentLetter = syllable[j] as "a" | "e" | "u" | "i" | "o" | "u";
        const nextLetter = syllable[j + 1] as "a" | "e" | "u" | "i" | "o" | "u" | undefined;

        // found a vowel
        if (replacements[currentLetter] != undefined) {
          let letterToReplace;

          // two consecutive vowels
          if (
            nextLetter != undefined &&
            replacements[nextLetter] != undefined &&
            medials.indexOf(currentLetter) >= 0
          ) {
            letterToReplace = nextLetter;
          } else {
            letterToReplace = currentLetter;
          }

          const replaced = syllable.replace(
            letterToReplace,
            replacements[letterToReplace][tone - 1] as string
          );
          syllables[i] = replaced.slice(0, replaced.length - 1);
          break;
        }
      }
    }
  }
  return syllables.join(" ");
}

export function ConstructOtherOptions(str: string): string[] {
  const charWithTones = new Set<string>();
  const mapOfTones = new Map<string, string[]>();
  const keys = Object.keys(replacements) as unknown as ("a" | "e" | "u" | "i" | "o" | "ü")[];
  for (const key of keys) {
    const tones = replacements[key];
    const allTones: string[] = [];
    allTones.push(key);
    for (const tone of tones) {
      charWithTones.add(tone);
      allTones.push(tone);
    }

    for (const tone of allTones) {
      const subAllTones = allTones.filter((t) => t !== tone);
      mapOfTones.set(tone, subAllTones);
    }
  }

  let charToReplace = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i] as string;
    const isNonToneVowel = (keys as string[]).indexOf(char) !== -1;
    const isToneVowel = charWithTones.has(char);

    const nextChar = str[i + 1] ?? "";
    const nextIsNonVowel = (keys as string[]).indexOf(nextChar) !== -1;
    const nextIsToneVowel = charWithTones.has(nextChar);
    const nextIsMedial = medials.indexOf(nextChar) >= 0;
    if (isToneVowel) {
      // The current character is a toned char.
      charToReplace = char;
      break;
    } else if (isNonToneVowel && !nextIsNonVowel && !nextIsToneVowel) {
      // The current character is non toned and the next is not a vowel.
      charToReplace = char;
      break;
    } else if (isNonToneVowel && !nextIsNonVowel && nextIsToneVowel) {
      // The next vowel has a tone move on.
      continue;
    } else if (isNonToneVowel && nextIsNonVowel && !nextIsToneVowel && !nextIsMedial) {
      // The next vowel doesn't have a tone, and isn't medial.
      charToReplace = char;
      break;
    } else {
      continue;
    }
  }

  const returnee: string[] = [];
  const tonesToReplaceWith = mapOfTones.get(charToReplace) ?? [];
  for (const tone of tonesToReplaceWith) {
    returnee.push(str.replace(charToReplace, tone));
  }
  return returnee;
}
