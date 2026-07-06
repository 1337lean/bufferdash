"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions";

function LoginButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>;
}

export default function LoginPage() {
  const [state, action] = useFormState(loginAction, {});

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <span className="brand-mark">&gt;_</span>
          Buffer<span>Dash</span>
        </div>
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Sign in to your dashboard</h1>
          <p>Analytics, security, and VPS health for buffer.lol and any site you add.</p>
        </div>
        <form action={action} className="stack-form">
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <LoginButton />
          {state.error && <p className="form-error">{state.error}</p>}
        </form>
      </section>
    </main>
  );
}
