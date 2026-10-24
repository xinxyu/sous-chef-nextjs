import { getCurrentUserId, isUuid } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/db";
import { json } from "@/lib/http";
import { findUserById } from "@/lib/users";

export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!isUuid(userId)) return json({ user: null });
  try {
    const user = await withDb((sql) => findUserById(sql, userId));
    return json({ user: user ? publicUser(user) : null });
  } catch (e) {
    console.error("Error loading current user:", e);
    return json({ user: null });
  }
}
