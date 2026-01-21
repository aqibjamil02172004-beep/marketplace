'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import supabase from '@/lib/supabaseClient';

type Step = 'form' | 'verify';

export default function SignUpPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [otp, setOtp] = useState(''); // the code user types
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const safeEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function onSubmitSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: safeEmail,
      password,
      options: {
        data: { full_name: name },
        // IMPORTANT: make sure this matches a route on your site
        // and is added in Supabase Auth > URL Configuration
        emailRedirectTo: `${window.location.origin}/signin`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Move to OTP step
    setStep('verify');
    setInfo(`We’ve sent a verification code to ${safeEmail}. Enter it below.`);
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const token = otp.trim();
    if (!token) {
      setError('Enter the code from your email.');
      return;
    }

    setLoading(true);

    // For signup verification use type: "signup"
    const { data, error } = await supabase.auth.verifyOtp({
      email: safeEmail,
      token,
      type: 'signup',
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If verification succeeded, user should be confirmed (and often signed in)
    // If not signed in, they can sign in normally.
    if (data?.session) {
      router.push('/');
    } else {
      router.push('/signin');
    }
  }

  async function resendCode() {
    setError(null);
    setInfo(null);

    setLoading(true);

    // Re-send OTP for signup
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: safeEmail,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo(`New code sent to ${safeEmail}.`);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="inline-block h-6 w-6 rounded-sm bg-gradient-to-br from-indigo-500 to-blue-600" />
          <span className="text-xl font-bold">Alvy</span>
        </div>

        {step === 'form' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Create your Alvy account</h1>
            <p className="text-sm text-gray-600">All fields are required</p>

            <form onSubmit={onSubmitSignUp} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Your name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First and last name"
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least six characters"
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Re-enter password</span>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {info && <p className="text-sm text-green-700">{info}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-md bg-yellow-400 px-4 py-2 font-semibold hover:bg-yellow-300 disabled:opacity-60"
              >
                {loading ? 'Creating…' : 'Continue'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              Already have an account?{' '}
              <Link href="/signin" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Verify your email</h1>
            <p className="text-sm text-gray-600">
              Enter the code we sent to <span className="font-medium">{safeEmail}</span>
            </p>

            <form onSubmit={onVerifyCode} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full rounded-md border px-3 py-2 text-lg tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {info && <p className="text-sm text-green-700">{info}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-md bg-yellow-400 px-4 py-2 font-semibold hover:bg-yellow-300 disabled:opacity-60"
              >
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={resendCode}
                disabled={loading}
                className="underline disabled:opacity-60"
              >
                Resend code
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setOtp('');
                  setError(null);
                  setInfo(null);
                }}
                className="underline"
              >
                Change email
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
