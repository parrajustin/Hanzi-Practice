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

export async function AddAppCb(cb: (app: FirebaseApp) => Promise<void>): Promise<void> {
  callbacks.push(cb);
  if (app !== undefined) {
    await cb(app);
  }
}

export function GetApp(): Option<FirebaseApp> {
  if (app === undefined) {
    return None;
  }
  return Some(app);
}
