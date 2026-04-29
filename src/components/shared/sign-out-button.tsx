"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
    router.push("/auth/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
    >
      Sign out
    </button>
  );
}
