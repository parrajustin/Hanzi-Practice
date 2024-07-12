/* eslint-disable no-console */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import {
  getAuth,
  setPersistence,
  signInWithPopup,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  signInWithEmailAndPassword
} from "firebase/auth";
import { GetApp } from "client/store";
import { accountIcon } from "../../third_party/icons/account";

@customElement("login-element")
export class LoginElement extends LitElement {
  static styles = css`
    p {
      color: green;
    }
  `;

  protected passLogin() {
    const emailElem = this.shadowRoot?.querySelector("#email") as HTMLInputElement;
    const passwordElem = this.shadowRoot?.querySelector("#password") as HTMLInputElement;

    const email = emailElem.value;
    const pass = passwordElem.value;
    console.log("pass login", email, pass);

    const app = GetApp();
    if (app.none) {
      throw new Error("App undefined...");
    }

    const auth = getAuth(app.safeValue());
    setPersistence(auth, indexedDBLocalPersistence)
      .then(() => {
        // In memory persistence will be applied to the signed in Google user
        // even though the persistence was set to 'none' and a page redirect
        // occurred.
        return signInWithEmailAndPassword(auth, email, pass);
      })
      .then(() => {
        console.log("logged in!");
        const options = {
          bubbles: true,
          composed: true
        };
        this.dispatchEvent(new CustomEvent("logIn", options));
      })
      .catch((error) => {
        console.error("googleLogin error", error);
        throw new Error(error);
      });
  }

  protected googleLogin() {
    console.log("googleLogin");
    const app = GetApp();
    console.log(app);
    if (app.none) {
      throw new Error("App undefined...");
    }

    console.log("1");
    const auth = getAuth(app.safeValue());
    console.log("2");
    setPersistence(auth, indexedDBLocalPersistence)
      .then(() => {
        console.log("3");
        const provider = new GoogleAuthProvider();
        // In memory persistence will be applied to the signed in Google user
        // even though the persistence was set to 'none' and a page redirect
        // occurred.
        return signInWithPopup(auth, provider);
      })
      .then(() => {
        console.log("logged in!");
        const options = {
          bubbles: true,
          composed: true
        };
        this.dispatchEvent(new CustomEvent("logIn", options));
      })
      .catch((error) => {
        console.error("googleLogin error", error);
        throw new Error(error);
      });
  }

  protected render() {
    return html`<div>
      <dile-card shadow-md title="Login">
        <div>
          <dile-input id="email" name="email" label="Email"></dile-input>
          <dile-input id="password" name="password" label="Password" type="password"></dile-input>
        </div>

        <div slot="footer">
          <dile-button @click="${this.passLogin}">Login!</dile-button>
        </div>
      </dile-card>
      </br>
      <dile-button-icon @click="${this.googleLogin}" .icon="${accountIcon}">Google Login</dile-button-icon>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "login-element": LoginElement;
  }
}
