// src/app/auth/register/page.tsx

import { registerAction } from "../actions";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <form
        action={registerAction}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">Create account</h1>

        <div className="mt-6 space-y-4">
          <input
            name="parishCouncilName"
            placeholder="Parish council name"
            required
            className="w-full rounded-md border px-3 py-2"
          />

          <input
            name="name"
            placeholder="Your name"
            required
            className="w-full rounded-md border px-3 py-2"
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-md border px-3 py-2"
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            minLength={10}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-zinc-950 px-4 py-2 text-white"
        >
          Register
        </button>

        <p className="mt-4 text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-zinc-950">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
