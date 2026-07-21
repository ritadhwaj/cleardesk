import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import ThemeToggle from "../components/ThemeToggle";
import SkylineScene from "../components/SkylineScene";
import ConstellationField from "../components/ConstellationField";

export default function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
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
      navigate("/", { replace: true });   // always start a fresh session at the dashboard
    } catch {
      setError("Invalid credentials — try the demo logins below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      {/* Deep indigo gradient + right border: this panel is the brand "constant" —
          identical in both themes and clearly distinct from the dark app background. */}
      <div className="hidden lg:flex flex-col justify-between text-white p-12 relative overflow-hidden
                      bg-gradient-to-br from-[#0a1128] via-[#16204a] to-[#0a1128]
                      border-r border-white/10
                      shadow-[inset_-24px_0_48px_-32px_rgba(0,0,0,0.6)]">

        {/* interactive floating node network — behind the text, reacts to hover */}
        <ConstellationField />

        <div className="relative z-10 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
            <ShieldCheck size={24} />
          </span>
          <span className="text-xl font-bold tracking-tight">ClearDesk</span>
        </div>
        {/* text gets a soft backdrop so it stays readable over the network */}
        <div className="relative z-10 space-y-5 max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight
                         [text-shadow:0_2px_24px_rgba(10,17,40,0.9)]">
            Two AI agents argue over every document.
            <span className="text-blue-400"> You make the call.</span>
          </h1>
          <p className="text-slate-300 leading-relaxed [text-shadow:0_1px_16px_rgba(10,17,40,0.9)]">
            A Doc Agent extracts and documents. An adversarial Audit Agent blind-reads and
            challenges. Every claim is evidence-linked; every decision stays human.
          </p>
        </div>
        <p className="relative z-10 text-xs text-slate-400">KYC · Loan Applications · Tax Filing</p>
      </div>

      {/* Form panel — animated skyline behind, glass card in front */}
      <div className="relative flex items-center justify-center p-5 sm:p-8 overflow-y-auto">
        <SkylineScene />
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <form onSubmit={submit}
              className="relative z-10 w-full max-w-sm space-y-5 animate-fade-up
                         bg-white/80 dark:bg-slate-950/75 backdrop-blur-xl
                         rounded-3xl p-8 border border-white/50 dark:border-slate-700/50
                         shadow-2xl transition-colors duration-700">
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
            <p>admin@cleardesk.dev — superuser (all actions)</p>
          </div>
        </form>
      </div>
    </div>
  );
}
