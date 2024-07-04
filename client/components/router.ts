import { AddAppCb, GetApp } from "client/store";
import { getAuth } from "firebase/auth";
import type { TemplateResult } from "lit";
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

enum State {
  OnLogin,
  OnDraw
}

@customElement("router-element")
export class RouterElement extends LitElement {
  static styles = css`
    #router {
      width: 100%;
      height: 100%;
    }
  `;

  @state()
  private state_ = State.OnLogin;

  protected logInSuccess() {
    console.log("router-login");
    this.state_ = State.OnDraw;
  }

  protected render() {
    AddAppCb(async (app) => {
      console.log("app cb", app);
      const auth = getAuth(app);
      await auth.authStateReady();
      if (auth.currentUser !== null) {
        console.log('user there!');
        this.state_ = State.OnDraw;
      }
    });

    let route: TemplateResult;
    switch (this.state_) {
      case State.OnLogin:
        route = html`<login-element @logIn="${this.logInSuccess}"></login-element>`;
        break;
      case State.OnDraw:
        route = html`<quiz-element character="车"></quiz-element>`;
        break;
    }

    return html`<div id="router">${route}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "router-element": RouterElement;
  }
}
