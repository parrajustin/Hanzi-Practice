import type { Result, StatusResult } from "client/result";
import { Err, Ok } from "client/result";
import { PrettifyPinyin } from "../util/prettify_pinyin";
import { Trie } from "./trie";
import type { Option } from "client/option";
import { None, Some } from "client/option";

const CEDICT_PATH = "./cedict_1_0_ts_utf-8_mdbg_20240705_025126.txt";

export interface ChineseDictData {
  /** Traditional character. */
  traditional: string;
  /** Simplified Character */
  simplified: string;
  /** Pinyin with one numbers. */
  pinyin: string;
  /** Nice pinyin with tone accent. */
  prettyPinyin: string;
  /** english definition. */
  english: string;
}

export class Cedict {
  private simplified_ = new Trie<ChineseDictData>();
  private traditional_ = new Trie<ChineseDictData>();

  /** Load dictionary. */
  public async load(): Promise<StatusResult<"Failed to load dict">> {
    return (await this.fetchDictionary())
      .andThen((text) => {
        return Ok(text.split("\n"));
      })
      .andThen((lines) => {
        for (const line of lines) {
          // Skip empty lines or the comment lines.
          if (line.trim() === "" || line[0] === "#") {
            continue;
          }

          const entry = this.parseLine(line);
          if (entry == null || entry.none) {
            continue;
          }

          this.simplified_.push(entry.safeValue().simplified, entry.safeValue());
          this.traditional_.push(entry.safeValue().traditional, entry.safeValue());
        }
        return Ok(null);
      });
  }

  /** Get chinese data for a key. */
  public get(word: string, traditional = false): Option<ChineseDictData[]> {
    return traditional ? this.traditional_.get(word) : this.simplified_.get(word);
  }

  /** Get chinese data for a key and decendents. */
  public getAllValuesForKeyAndDecendents(
    word: string,
    traditional = false
  ): Option<ChineseDictData[]> {
    return traditional
      ? this.traditional_.getAllValuesForKeyAndDecendents(word)
      : this.simplified_.getAllValuesForKeyAndDecendents(word);
  }

  private parseLine(line: string): Option<ChineseDictData> {
    const match = line.match(/^(\S+)\s(\S+)\s\[([^\]]+)\]\s\/(.+)\//);
    if (match == null) {
      return None;
    }

    const [, traditional, simplified, pinyin, english] = match;

    const processedPinyin = (pinyin ?? "").replace(/u:/g, "ü");
    const prettyPinyin = PrettifyPinyin(processedPinyin);

    return Some({
      traditional: traditional ?? "",
      simplified: simplified ?? "",
      pinyin: processedPinyin,
      prettyPinyin,
      english: english ?? ""
    });
  }

  private fetchDictionary(): Promise<Result<string, "Failed to load dict">> {
    return new Promise((resolve) => {
      fetch(CEDICT_PATH)
        .then((payload) => payload.text())
        .then((text) => {
          resolve(Ok(text));
        })
        .catch((failure) => {
          console.error("Failed to load dict", failure);
          const err = Err<"Failed to load dict">("Failed to load dict");
          err.addData(`Error: ${failure}`);
          resolve(err);
        });
    });
  }
}
