import type { Result } from "client/result";
import { Err, Ok } from "client/result";

/** Wraps the given promise into a result type. No erros should be propogated. */
export async function WrapPromise<T, E = unknown>(promise: Promise<T>): Promise<Result<T, E>> {
  return new Promise<Result<T, E>>((resolve) => {
    promise
      .then((v) => {
        resolve(Ok(v));
      })
      .catch((e) => {
        resolve(Err(e));
      });
  });
}
