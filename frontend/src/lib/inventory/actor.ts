import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, readSession } from "./session";
import { getUser } from "./users";
import { isIntranetRequest } from "./network";
import { SYSTEM_ACTOR, type Actor } from "./audit";

/**
 * Who is making the current request.
 *
 * Read from `next/headers` rather than passed down, so a route handler signs
 * its entry with the same identity the page was rendered for and no caller can
 * hand the log a name of its own choosing.
 */
export async function currentActor(): Promise<Actor> {
  try {
    const [store, head] = await Promise.all([cookies(), headers()]);
    const session = await readSession(store.get(SESSION_COOKIE)?.value);
    if (!session) return SYSTEM_ACTOR;

    const user = getUser(session.userId);
    const origin = isIntranetRequest(head.get("host")) ? "red local" : "esta computadora";

    return {
      id: session.userId,
      name: user?.name ?? `Usuario ${session.userId}`,
      role: user?.role ?? session.role,
      origin,
    };
  } catch {
    return SYSTEM_ACTOR;
  }
}
