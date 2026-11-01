import { authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { checkBirthdate, recordAdultConfirmation } from "@/lib/age";

// POST /api/v1/me/age  { "birthdate": "YYYY-MM-DD" }
// Confirms the user is 18+. Only the confirmation is stored, never the birthdate.
export const POST = route(async (req) => {
  const { db, user } = await authenticate(req, { requireAdult: false });
  const body = await readJson(req);
  const check = checkBirthdate(typeof body.birthdate === "string" ? body.birthdate : "");
  if (!check.ok) throw errors.badRequest(check.message);
  await recordAdultConfirmation(db, user.id);
  return json(req, { adult_confirmed: true });
});
export const OPTIONS = preflight;
