"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { canEditUniversities } from "@/lib/permissions";

export function AdminEditButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const user = useAuth();
  if (!canEditUniversities(user.role)) return null;

  return (
    <Link
      href={href}
      className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
    >
      {label}
    </Link>
  );
}

export function AdminAddButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const user = useAuth();
  if (!canEditUniversities(user.role)) return null;

  return (
    <Link
      href={href}
      className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
    >
      {label}
    </Link>
  );
}
