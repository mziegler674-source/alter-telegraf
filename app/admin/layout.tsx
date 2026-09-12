import "server-only";

import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifySession(token);

  if (!session) {
    redirect("/login");
  }

  return children;
}