interface BaseResult<T, E> {
  /** `true` when the result is Ok */ readonly ok: boolean;
  /** `true` when the result is Err */ readonly err: boolean;

  /**
   * Returns the contained `Ok` value or a provided default.
   *
   *  (This is the `unwrap_or` in rust)
   */
  unwrapOr<T2>(val: T2): T | T2;

  /**
   * Returns the contained `Ok` value.
   * Because this function may throw, its use is generally discouraged.
   * Instead, prefer to handle the `Err` case explicitly.
   *
   * Throws if the value is an `Err`, with a message provided by the `Err`'s value.
   */
  unsafeUnwrap(): T;

  /**
   * Calls `mapper` if the result is `Ok`, otherwise returns the `Err` value of self.
   * This function can be used for control flow based on `Result` values.
   */
  andThen<T2>(mapper: (val: T) => Ok<T2>): Result<T2, E>;
  andThen<E2>(mapper: (val: T) => Err<E2>): Result<T, E | E2>;
  andThen<T2, E2>(mapper: (val: T) => Result<T2, E2>): Result<T2, E | E2>;
  andThen<T2, E2>(mapper: (val: T) => Result<T2, E2>): Result<T2, E | E2>;

  /**
   * Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a contained `Ok` value,
   * leaving an `Err` value untouched.
   *
   * This function can be used to compose the results of two functions.
   */
  map<U>(mapper: (val: T) => U): Result<U, E>;

  /**
   * Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a contained `Err` value,
   * leaving an `Ok` value untouched.
   *
   * This function can be used to pass through a successful result while handling an error.
   */
  mapErr<F>(mapper: (val: E) => F): Result<T, F>;
}

/**
 * Contains the error value
 */
export class ErrImpl<E> implements BaseResult<never, E> {
  /** An empty Err */
  static readonly EMPTY = new ErrImpl<void>(undefined);

  readonly ok!: false;
  readonly err!: true;
  readonly val!: E;

  private readonly _stack!: string;

  /** Additional data to add to error. */
  public additionalData: string[] = [];

  constructor(val: E) {
    if (!(this instanceof ErrImpl)) {
      return new ErrImpl(val);
    }

    this.ok = false;
    this.err = true;
    this.val = val;

    const stackLines = new Error().stack!.split("\n").slice(2);
    if (stackLines && stackLines.length > 0 && stackLines[0]?.includes("ErrImpl")) {
      stackLines.shift();
    }

    this._stack = stackLines.join("\n");
  }

  /**
   * Returns the contained `Ok` value or a provided default.
   *
   *  (This is the `unwrap_or` in rust)
   */
  unwrapOr<T2>(val: T2): T2 {
    return val;
  }

  /**
   * Returns the contained `Ok` value.
   * Because this function may throw, its use is generally discouraged.
   * Instead, prefer to handle the `Err` case explicitly.
   *
   * Throws if the value is an `Err`, with a message provided by the `Err`'s value.
   */
  unsafeUnwrap(): never {
    throw new Error(`Error UnsafeUnwrap "${this.val}" from stack "${this.stack}"`);
  }

  /**
   * Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a contained `Ok` value,
   * leaving an `Err` value untouched.
   *
   * This function can be used to compose the results of two functions.
   */
  map(_mapper: unknown): Err<E> {
    return this;
  }

  /**
   * Calls `mapper` if the result is `Ok`, otherwise returns the `Err` value of self.
   * This function can be used for control flow based on `Result` values.
   */
  andThen(_op: unknown): Err<E> {
    return this;
  }

  /**
   * Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a contained `Err` value,
   * leaving an `Ok` value untouched.
   *
   * This function can be used to pass through a successful result while handling an error.
   */
  mapErr<E2>(mapper: (err: E) => E2): Err<E2> {
    return Err(mapper(this.val));
  }

  /** Add data to the additional data. */
  addData(...data: string[]): this {
    this.additionalData.push(...data);
    return this;
  }

  get stack(): string | undefined {
    return `${this}\n${this._stack}`;
  }
}

// This allows Err to be callable - possible because of the es5 compilation target
export const Err = <T>(val: T): ErrImpl<T> => new ErrImpl<T>(val);
export type Err<E> = ErrImpl<E>;

/**
 * Contains the success value
 */
export class OkImpl<T> implements BaseResult<T, never> {
  static readonly EMPTY = new OkImpl<void>(undefined);

  readonly ok!: true;
  readonly err!: false;
  readonly val!: T;

  constructor(val: T) {
    if (!(this instanceof OkImpl)) {
      return new OkImpl(val);
    }

    this.ok = true;
    this.err = false;
    this.val = val;
  }

  /**
   * Returns the contained `Ok` value or a provided default.
   *
   *  (This is the `unwrap_or` in rust)
   */
  unwrapOr(_val: unknown): T {
    return this.val;
  }

  /**
   * Returns the contained `Ok` value.
   * Because this function may throw, its use is generally discouraged.
   * Instead, prefer to handle the `Err` case explicitly.
   *
   * Throws if the value is an `Err`, with a message provided by the `Err`'s value.
   */
  unsafeUnwrap(): T {
    return this.val;
  }

  /**
   * Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a contained `Ok` value,
   * leaving an `Err` value untouched.
   *
   * This function can be used to compose the results of two functions.
   */
  map<T2>(mapper: (val: T) => T2): Ok<T2> {
    return Ok(mapper(this.val));
  }

  /**
   * Calls `mapper` if the result is `Ok`, otherwise returns the `Err` value of self.
   * This function can be used for control flow based on `Result` values.
   */
  andThen<T2>(mapper: (val: T) => Ok<T2>): Ok<T2>;
  andThen<E2>(mapper: (val: T) => Err<E2>): Result<T, E2>;
  andThen<T2, E2>(mapper: (val: T) => Result<T2, E2>): Result<T2, E2>;
  andThen<T2, E2>(mapper: (val: T) => Result<T2, E2>): Result<T2, E2> {
    return mapper(this.val);
  }

  /**
   * Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a contained `Err` value,
   * leaving an `Ok` value untouched.
   *
   * This function can be used to pass through a successful result while handling an error.
   */
  mapErr(_mapper: unknown): Ok<T> {
    return this;
  }

  /**
   * Returns the contained `Ok` value, but never throws.
   * Unlike `unwrap()`, this method doesn't throw and is only callable on an Ok<T>
   *
   * Therefore, it can be used instead of `unwrap()` as a maintainability safeguard
   * that will fail to compile if the error type of the Result is later changed to an error that can actually occur.
   *
   * (this is the `into_ok()` in rust)
   */
  safeUnwrap(): T {
    return this.val;
  }
}

// This allows Ok to be callable - possible because of the es5 compilation target
export const Ok = <T>(val: T): OkImpl<T> => new OkImpl<T>(val);
export type Ok<T> = OkImpl<T>;

export type Result<T, E> = Ok<T> | Err<E>;
/** A special type of result where we don't care about the ok result but just that it is ok or err. */
export type StatusResult<E> = Result<unknown, E>;

// export type ResultOkType<T extends Result<any, any>> =
//   T extends Ok<infer U> ? U : never;
// export type ResultErrType<T> = T extends Err<infer U> ? U : never;

// export type ResultOkTypes<T extends Result<any, any>[]> = {
//   [key in keyof T]: T[key] extends Result<infer U, any>
//     ? ResultOkType<T[key]>
//     : never;
// };
// export type ResultErrTypes<T extends Result<any, any>[]> = {
//   [key in keyof T]: T[key] extends Result<infer U, any>
//     ? ResultErrType<T[key]>
//     : never;
// };

export function isResult<T, E>(val: unknown): val is Result<T, E> {
  return val instanceof ErrImpl || val instanceof OkImpl;
}

/**
 * Checks if a result is an Ok.
 * @param val
 * @returns true if val is Ok.
 */
// deno-lint-ignore no-explicit-any
export function isOk<T>(val: any): val is Ok<T> {
  return isResult(val) && val.ok;
}

// deno-lint-ignore no-explicit-any
export function isErr(val: any): val is Err<unknown> {
  return isResult(val) && val.err;
}

// deno-lint-ignore no-explicit-any
export function isErrWithError<T, E>(val: any, error: E): val is ErrImpl<E> {
  return isResult(val) && val.err && val.val === error;
}
