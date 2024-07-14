import type { Immutable, WritableDraft } from "immer";
import { castDraft, castImmutable, produce } from "immer";

type ListenerCallback<T> = (state: Immutable<T>) => void;

export class State<T> {
  private base_: T;
  private current_: Immutable<T>;

  private callbacks_ = new Set<ListenerCallback<T>>();
  private hasMicroTask_ = false;

  constructor(base: T) {
    this.base_ = base;
    this.current_ = castImmutable<T>(base);
  }

  /** Add a callback listener to the state. */
  public addListener(callback: ListenerCallback<T>): State<T> {
    this.callbacks_.add(callback);
    return this;
  }

  /** Remove a callback listener to the state. */
  public removeListner(callback: ListenerCallback<T>): State<T> {
    this.callbacks_.delete(callback);
    return this;
  }

  /** Applies the change to the state. */
  public applyChange(changeFunc: (state: WritableDraft<T>) => WritableDraft<T> | void): State<T> {
    const draft = castDraft(this.current_) as T;
    this.current_ = castImmutable(produce<T, WritableDraft<T>>(draft, changeFunc));

    if (!this.hasMicroTask_) {
      this.hasMicroTask_ = true;
      queueMicrotask(() => {
        this.hasMicroTask_ = false;
        for (const cb of this.callbacks_) {
          cb(this.current_);
        }
      });
    }

    return this;
  }

  /** Reset to the original base. */
  public resetToBase(): State<T> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.applyChange((_draft: WritableDraft<T>): WritableDraft<T> => {
      return this.base_ as WritableDraft<T>;
    });
    return this;
  }
}
