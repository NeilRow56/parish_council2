"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

export default function RegisterForm() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signUp.email({
      email,
      password,
      name: email, // simple default
    });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Registration failed.");
      return;
    }

    router.push("/auth/login?registered=1");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <form className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm" onSubmit={handleSubmit}>
        <h1 className="text-2xl font-semibold">Create account</h1>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-4">
          <input name="email" type="email" required placeholder="Email" className="w-full border px-3 py-2 rounded-md" />
          <input name="password" type="password" required placeholder="Password" className="w-full border px-3 py-2 rounded-md" />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full bg-zinc-950 text-white px-4 py-2 rounded-md"
        >
          {pending ? "Creating..." : "Create account"}
        </button>

        <p className="mt-4 text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
