import { NextRequest } from "next/server";

// Verifie le header Authorization: Bearer <CRON_SECRET> pose par Vercel Cron.
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}
