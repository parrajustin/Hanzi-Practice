import type { Immutable, WritableDraft } from "immer";
import { castDraft, castImmutable, produce } from "immer";

type ListenerCallback<T> = (state: Immutable<T>) => void;
type AsyncListenerCallback<T> = (state: Immutable<T>) => Promise<void>;

/** Controller state. */
export class StateController<T> {
  private base_: T;
  /** Current state held. */
  private current_: Immutable<T>;
  /** Callbacks listeners waiting. */
  private callbacks_ = new Set<ListenerCallback<T>>();
  private asyncCallbacks_ = new Set<AsyncListenerCallback<T>>();
  /** If there is a micro task already scheduled. */
  private hasMicroTask_ = false;

  constructor(base: T) {
    this.base_ = base;
    this.current_ = castImmutable<T>(base);
  }

  /** Add a callback listener to the state. If `includeInitalValue` is true the current value will always be published. */
  public addListener(
    callback: ListenerCallback<T>,
    includeInitalValue = false
  ): StateController<T> {
    this.callbacks_.add(callback);
    if (includeInitalValue) {
      callback(this.current_);
    }
    return this;
  }

  public addAsyncListener(callback: AsyncListenerCallback<T>): StateController<T> {
    this.asyncCallbacks_.add(callback);
    return this;
  }

  /** Remove a callback listener to the state. */
  public removeListner(callback: ListenerCallback<T>): StateController<T> {
    this.callbacks_.delete(callback);
    return this;
  }

  /** Applies the change to the state. */
  public applyChange(
    changeFunc: (state: WritableDraft<T>) => WritableDraft<T> | void
  ): StateController<T> {
    const draft = castDraft(this.current_) as T;
    this.current_ = castImmutable(produce<T, WritableDraft<T>>(draft, changeFunc));

    if (!this.hasMicroTask_) {
      this.hasMicroTask_ = true;
      queueMicrotask(async () => {
        this.hasMicroTask_ = false;
        for (const cb of this.callbacks_) {
          cb(this.current_);
        }
        for (const asyncCB of this.asyncCallbacks_) {
          queueMicrotask(async () => {
            await asyncCB(this.current_);
          });
        }
      });
    }

    return this;
  }

  /** Reset to the original base. */
  public resetToBase(): StateController<T> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.applyChange((_draft: WritableDraft<T>): WritableDraft<T> => {
      return this.base_ as WritableDraft<T>;
    });
    return this;
  }
}
