import { readSession as verify, type SessionClaims } from "./session";
import { getUser } from "./users";
export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
 return verify(token, async id => getUser(id));
}
