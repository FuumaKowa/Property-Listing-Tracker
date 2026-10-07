import { validateOwnerListing, type OwnerListingInput } from "./ownerListing";
import { normalizePropertyType } from "./server/n8n/validation";

export const OWNER_IMPORT_LIMIT = 200;
export const OWNER_IMPORT_FIELDS = [
  ["propertyName", "Property name / address", true],
  ["propertyType", "Property type", true],
  ["propertyPrice", "Price", true],
  ["location", "Location", false],
  ["ownerName", "Owner name", false],
  ["noTel", "Phone", false],
  ["propertyLink", "Property link", false],
  ["status", "Status", false],
  ["seedingStatus", "Seeding stage", false],
] as const;
export type OwnerImportField = (typeof OWNER_IMPORT_FIELDS)[number][0];
export type OwnerImportRaw = Partial<Record<OwnerImportField, string>>;
export type OwnerImportInput = OwnerListingInput & {
  seedingStatus: "IFU1" | "IFU2" | "IFU3" | null;
};
export type OwnerImportChoice = "new" | "skip" | "append";
export interface OwnerImportRow {
  row: number;
  kind: "new" | "duplicate" | "invalid";
  input?: OwnerImportInput;
  error?: string;
  matches: { id?: number; row?: number; name: string }[];
}
export interface OwnerImportResult {
  added: number;
  skipped: number;
  skippedRows: number[];
  createdIds: number[];
}

export function normalizeOwnerImport(value: unknown): OwnerImportInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid row.");
  const raw = value as Record<string, unknown>;
  const input: Record<string, string> = {};
  for (const [key, label] of OWNER_IMPORT_FIELDS) {
    const v = raw[key];
    if (v !== undefined && typeof v !== "string")
      throw new Error(`${label} must be text.`);
    input[key] = (v as string | undefined)?.trim() || "";
  }
  let price = input.propertyPrice.replace(/^RM\s*/i, "");
  if (price.includes(",")) {
    if (!/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(price))
      throw new Error("Price has invalid thousands separators.");
    price = price.replace(/,/g, "");
  }
  const status = input.status
    ? input.status[0].toUpperCase() + input.status.slice(1).toLowerCase()
    : "Unlisted";
  const stage = input.seedingStatus.toUpperCase();
  if (stage && !["IFU1", "IFU2", "IFU3"].includes(stage))
    throw new Error("Seeding stage must be IFU1, IFU2 or IFU3.");
  return {
    ...validateOwnerListing({
      ...input,
      propertyPrice: price,
      propertyType: normalizePropertyType(input.propertyType),
      status,
      ownerName: input.ownerName || "Not captured",
      noTel: input.noTel || "Not captured",
    }),
    seedingStatus: (stage as OwnerImportInput["seedingStatus"]) || null,
  };
}
