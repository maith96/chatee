import { authenticate, errors } from "./api";
import { isAdmin } from "./feedback";

/** Like authenticate(), but only for admins (see the admins table). */
export async function authenticateAdmin(req: Request) {
  const session = await authenticate(req);
  if (!(await isAdmin(session.db))) throw errors.forbidden("Only admins can do this.");
  return session;
}
