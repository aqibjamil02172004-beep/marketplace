"use client";
import { useState } from "react";
import  supabase  from "@/lib/supabaseClient";

export default function AuthForm() {
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Signup successful. Check your email to verify (if required), then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg("Signed in!");
        location.reload();
      }
    } catch (err:any) {
      setMsg(err.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    location.reload();
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Account</h2>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-sm underline">
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <input className="w-full rounded border p-2" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="w-full rounded border p-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="rounded bg-black px-3 py-2 text-white">{mode === "signin" ? "Sign in" : "Sign up"}</button>
      </form>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <button onClick={signOut} className="mt-3 text-sm underline">Sign out</button>
    </div>
  );
}
