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
  const setOfTones = new Set<string>();
  const mapOfTones = new Map<string, string[]>();
  const keys = Object.keys(replacements) as unknown as ("a" | "e" | "u" | "i" | "o" | "ü")[];
  for (const key of keys) {
    const allTones: string[] = [];
    const tones = replacements[key];
    allTones.push(key);
    setOfTones.add(key);
    for (const tone of tones) {
      allTones.push(tone);
      setOfTones.add(tone);
    }

    for (const tone of allTones) {
      const subAllTones = allTones.filter((t) => t !== tone);
      mapOfTones.set(tone, subAllTones);
    }
  }

  const returnee: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const currentChar = str[i] as string;
    if (!setOfTones.has(currentChar)) {
      continue;
    }

    const nextChar = str[i + 1];
    const nextHasVowl = nextChar !== undefined && setOfTones.has(nextChar);
    if (nextHasVowl) {
      continue;
    }

    const pre = str.slice(0, i);
    const after = str.slice(i + 1);
    for (const tone of mapOfTones.get(currentChar) ?? []) {
      returnee.push(`${pre}${tone}${after}`);
    }
    break;
  }
  return returnee;
}
