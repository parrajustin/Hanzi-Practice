import { None, Some, type Option } from "client/option";

interface TrieIndex<T> {
  [key: string]: TrieData<T>;
}

interface TrieData<T> {
  values: T[];
  index: TrieIndex<T>;
}

export class Trie<T> {
  public content: TrieData<T> = { values: [], index: {} };

  /**
   * Gets the key object for a given key.
   * @param key key to look for
   * @param create if new entries should be created
   * @returns Trie data
   */
  getKeyObject(key: string, create = false): Option<TrieData<T>> {
    key = key.toString();

    const chars = key === "" ? [key] : Array.from(key);
    let obj: TrieData<T> = this.content;

    for (const char of chars) {
      if (obj.index[char] === undefined) {
        if (create) {
          obj.index[char] = { values: [], index: {} };
        } else {
          return None;
        }
      }

      obj = obj.index[char] as TrieData<T>;
    }

    return Some(obj);
  }

  /**
   * Get the trie data for a given key.
   * @param key key to look for
   * @returns the data if any
   */
  get(key: string): Option<T[]> {
    return this.getKeyObject(key).andThen((val) => Some(val.values));
  }

  /**
   * For a given key get the values of it and all decendents.
   * @param key
   * @returns
   */
  getAllValuesForKeyAndDecendents(key: string): Option<T[]> {
    const inner = (key: string): Option<T[]> => {
      const data = this.getKeyObject(key);
      if (data.none) {
        return data;
      }
      const result = data.safeValue().values;

      for (const decendant in data.safeValue().index) {
        const innnerData = inner(key + decendant);
        if (innnerData.none) {
          continue;
        }
        result.push(...innnerData.safeValue());
      }

      return Some(result);
    };

    return inner(key);
  }

  /**
   * Pushes data to the trie.
   * @param key
   * @param value
   */
  push(key: string, value: T) {
    const keyObj = this.getKeyObject(key, /*create=*/ true);

    if (keyObj.some && !keyObj.safeValue().values.includes(value)) {
      keyObj.safeValue().values.push(value);
    }
  }
}
