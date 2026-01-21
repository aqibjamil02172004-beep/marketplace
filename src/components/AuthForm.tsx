"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

type Mode = "signin" | "signup";
type Step = "form" | "verify";

export default function AuthForm() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const safeEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    try {
      setLoading(true);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: safeEmail,
          password,
          options: {
            // not used for OTP itself, but fine to keep for fallback flows
            emailRedirectTo: `${window.location.origin}/signin`,
          },
        });
        if (error) throw error;

        setStep("verify");
        setMsg(`We sent a verification code to ${safeEmail}.`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: safeEmail,
          password,
        });
        if (error) throw error;

        setMsg("Signed in!");
        // ✅ no reload — refresh Next.js and navigate
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    try {
      setLoading(true);

      const token = otp.trim();
      if (!token) throw new Error("Enter the code from your email.");

      const { data, error } = await supabase.auth.verifyOtp({
        email: safeEmail,
        token,
        type: "signup",
      });

      if (error) throw error;

      // Supabase often returns a session immediately after verify
      if (data?.session) {
        setMsg("Verified & signed in!");
        router.push("/");
        router.refresh();
      } else {
        // If no session came back, user may still need to sign in
        setMsg("Verified! Now sign in.");
        setMode("signin");
        setStep("form");
        setOtp("");
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setMsg(null);
    try {
      setLoading(true);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: safeEmail,
      });
      if (error) throw error;
      setMsg(`New code sent to ${safeEmail}.`);
    } catch (err: any) {
      setMsg(err?.message ?? "Could not resend code");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setMsg(null);
    try {
      setLoading(true);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Account</h2>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setStep("form");
            setOtp("");
            setMsg(null);
          }}
          className="text-sm underline"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>

      {step === "form" && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <input
            className="w-full rounded border p-2"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border p-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button disabled={loading} className="rounded bg-black px-3 py-2 text-white disabled:opacity-60">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={verifyCode} className="mt-3 space-y-3">
          <div className="text-sm text-gray-600">
            Enter the code sent to <span className="font-medium">{safeEmail}</span>
          </div>
          <input
            className="w-full rounded border p-2 text-lg tracking-widest"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <div className="flex gap-3">
            <button disabled={loading} className="rounded bg-black px-3 py-2 text-white disabled:opacity-60">
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button type="button" onClick={resendCode} disabled={loading} className="underline disabled:opacity-60">
              Resend code
            </button>
          </div>
        </form>
      )}

      {msg && <p className="mt-2 text-sm">{msg}</p>}

      <button onClick={signOut} className="mt-3 text-sm underline disabled:opacity-60" disabled={loading}>
        Sign out
      </button>
    </div>
  );
}
