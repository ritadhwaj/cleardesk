import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../store/auth";

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("uploader@cleardesk.dev");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.access_token, data.role, data.full_name);
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow w-96 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">ClearDesk</h1>
        <p className="text-sm text-slate-500">Multi-agent document verification desk</p>
        <input className="w-full border rounded-lg p-2" value={email}
               onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full border rounded-lg p-2" type="password" value={password}
               onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full bg-slate-800 text-white rounded-lg py-2">Sign in</button>
      </form>
    </div>
  );
}
