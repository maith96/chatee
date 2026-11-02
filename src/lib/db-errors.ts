/** A column or table from a newer schema version doesn't exist yet (schema.sql not re-run). */
export function isMissingSchema(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "42703" || code === "PGRST204" || code === "PGRST205" || code === "42P01";
}
