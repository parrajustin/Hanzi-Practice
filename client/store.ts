import type { FirebaseApp } from "firebase/app";
import type { Option } from "./option";
import { None, Some } from "./option";

let app: FirebaseApp | undefined;

const callbacks: ((app: FirebaseApp) => Promise<void>)[] = [];

export async function SetApp(newApp: FirebaseApp): Promise<void> {
  app = newApp;
  for (const cb of callbacks) {
    await cb(app);
  }
}

export async function AddAppCb(cb: (app: FirebaseApp) => Promise<void>) {
  if (app !== undefined) {
    queueMicrotask(async () => {
      if (app !== undefined) {
        await cb(app);
      }
    });
  } else {
    callbacks.push(cb);
  }
}

export function GetApp(): Option<FirebaseApp> {
  if (app === undefined) {
    return None;
  }
  return Some(app);
}
