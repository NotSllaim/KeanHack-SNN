import { Mic2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../state/AuthContext.jsx";

export function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(form);
      } else {
        await login({ email: form.email, password: form.password });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f7f5ef] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center px-6 py-12 md:px-12">
        <div className="max-w-2xl">
          <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-md bg-meadow text-white">
            <Mic2 size={24} />
          </div>
          <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-normal text-ink md:text-6xl">
            Build a steadier voice for real conversations.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
            Practice live dialogue, difficult reading, and stronger phrasing with AI feedback that stays direct, useful, and encouraging.
          </p>
        </div>
      </section>

      <section className="flex items-center bg-white px-6 py-12 md:px-12">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
          <div>
            <p className="text-sm font-semibold text-meadow">{mode === "signup" ? "Create account" : "Welcome back"}</p>
            <h2 className="mt-1 text-3xl font-bold text-ink">{mode === "signup" ? "Start practicing" : "Log in"}</h2>
          </div>

          {mode === "signup" && (
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 outline-none focus:border-meadow"
                required
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 outline-none focus:border-meadow"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 outline-none focus:border-meadow"
              minLength={8}
              required
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            disabled={busy}
            className="w-full rounded-md bg-ink px-4 py-3 font-semibold text-white shadow-soft hover:bg-meadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
            className="text-sm font-semibold text-meadow hover:text-ink"
          >
            {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </form>
      </section>
    </main>
  );
}
