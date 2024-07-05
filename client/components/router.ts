import { AddAppCb, GetApp } from "client/store";
import { getAuth } from "firebase/auth";
import type { TemplateResult } from "lit";
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

enum State {
  OnLogin,
  OnQuiz
}

@customElement("router-element")
export class RouterElement extends LitElement {
  static styles = css`
    :host {
      --dile-tab-text-color: #ccc;
      --dile-tab-background-color: transparent;
      --dile-tab-selected-text-color: #396;
      --dile-tab-selected-background-color: transparent;
      --dile-tab-selected-line-color: #396;
      --dile-tab-font-size: 2rem;
    }
    #router {
      width: 100%;
      height: 100%;
    }
  `;

  @state()
  private state_ = State.OnLogin;

  protected logInSuccess() {
    console.log("router-login");
    this.state_ = State.OnQuiz;
  }

  protected render() {
    AddAppCb(async (app) => {
      console.log("app cb", app);
      const auth = getAuth(app);
      await auth.authStateReady();
      if (auth.currentUser !== null) {
        console.log("user there!");
        this.state_ = State.OnQuiz;
      }
    });

    let route: TemplateResult;
    switch (this.state_) {
      case State.OnLogin:
        route = html`<login-element @logIn="${this.logInSuccess}"></login-element>`;
        break;
      case State.OnQuiz:
        route = html` <dile-tabs selectorId="selector1" selected="0">
            <dile-tab>Quiz</dile-tab>
            <dile-tab>New</dile-tab>
            <dile-tab>View</dile-tab>
          </dile-tabs>
          <hr />
          <dile-pages selectorId="selector1">
            <section name="quiz">
              <quizzer-element></quizzer-element>
            </section>
            <section name="new">
              <p>Page two...</p>
              Other page...
            </section>
            <section name="view">
              <viewer-element></viewer-element>
            </section>
          </dile-pages>`;
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
