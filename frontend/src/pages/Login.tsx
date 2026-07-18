import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../store/auth";

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("uploader@cleardesk.dev");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.access_token, data.role, data.full_name);
    } catch {
      setError("Invalid credentials — try the demo logins below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-950 text-white p-12
                      bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_50%)]">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
            <ShieldCheck size={24} />
          </span>
          <span className="text-xl font-bold tracking-tight">ClearDesk</span>
        </div>
        <div className="space-y-5 max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Two AI agents argue over every document.
            <span className="text-blue-400"> You make the call.</span>
          </h1>
          <p className="text-slate-400 leading-relaxed">
            A Doc Agent extracts and documents. An adversarial Audit Agent blind-reads and
            challenges. Every claim is evidence-linked; every decision stays human.
          </p>
        </div>
        <p className="text-xs text-slate-500">KYC · Loan Applications · Tax Filing</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 animate-fade-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck size={20} />
            </span>
            <span className="text-xl font-bold">ClearDesk</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to the verification desk</p>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</span>
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm
                                focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400
                                transition-shadow"
                     value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</span>
              <input type="password"
                     className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm
                                focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400
                                transition-shadow"
                     value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </div>
          {error && <p className="text-sm text-red-600 animate-fade-in">{error}</p>}
          <button className="btn btn-primary w-full py-3" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div className="card p-4 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600">Demo accounts (password: demo1234)</p>
            <p>uploader@cleardesk.dev — submits documents</p>
            <p>reviewer@cleardesk.dev — approves cases</p>
          </div>
        </form>
      </div>
    </div>
  );
}
