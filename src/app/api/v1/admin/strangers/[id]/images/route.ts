import { assertUuid, errors, json, preflight, readJson, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { addImage, IMAGE_TYPES, MAX_IMAGE_BYTES, removeImage } from "@/lib/strangers";

type Params = { id: string };

// POST /api/v1/admin/strangers/{id}/images  (multipart: file, slot = "main" | "gallery")
export const POST = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw errors.badRequest("Attach an image as 'file'.");
  if (!IMAGE_TYPES.includes(file.type)) throw errors.badRequest("Use a WebP, JPEG or PNG image.");
  if (file.size > MAX_IMAGE_BYTES) throw errors.badRequest("Image is larger than 3 MB.");
  const slot = form?.get("slot") === "gallery" ? "gallery" : "main";
  const stranger = await addImage(db, id, { bytes: await file.arrayBuffer(), type: file.type }, slot);
  if (!stranger) throw errors.notFound("Stranger");
  return json(req, { stranger }, 201);
});

// DELETE /api/v1/admin/strangers/{id}/images  { "url": "..." }
export const DELETE = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const body = await readJson(req);
  if (typeof body.url !== "string") throw errors.badRequest("'url' is required.");
  const stranger = await removeImage(db, id, body.url);
  if (!stranger) throw errors.notFound("Stranger");
  return json(req, { stranger });
});

export const OPTIONS = preflight;
