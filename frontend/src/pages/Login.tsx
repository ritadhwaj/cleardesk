import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import ThemeToggle from "../components/ThemeToggle";

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
      <div className="relative flex items-center justify-center p-8">
        <div className="absolute top-6 right-6"><ThemeToggle /></div>
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 animate-fade-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck size={20} />
            </span>
            <span className="text-xl font-bold">ClearDesk</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight h-page">Welcome back</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to the verification desk</p>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</span>
              <input className="input mt-1.5 w-full"
                     value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</span>
              <input type="password" className="input mt-1.5 w-full"
                     value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </div>
          {error && <p className="text-sm text-red-600 animate-fade-in">{error}</p>}
          <button className="btn btn-primary w-full py-3" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div className="card p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600 dark:text-slate-300">Demo accounts (password: demo1234)</p>
            <p>uploader@cleardesk.dev — submits documents</p>
            <p>reviewer@cleardesk.dev — approves cases</p>
          </div>
        </form>
      </div>
    </div>
  );
}
