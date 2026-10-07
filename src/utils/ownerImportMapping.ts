import {
  OWNER_IMPORT_FIELDS,
  type OwnerImportField,
  type OwnerImportRaw,
} from "../ownerImport";
import type { OwnerImportSheet } from "./ownerImportFile";
export type OwnerMapping = Partial<Record<OwnerImportField, number>>;
export function guessOwnerMapping(headers: string[]): OwnerMapping {
  const aliases: Record<OwnerImportField, string[]> = {
    propertyName: [
      "propertyname",
      "propertyaddress",
      "addressproperty",
      "property",
      "address",
      "title",
    ],
    propertyType: ["propertytype", "type"],
    propertyPrice: ["propertyprice", "price", "askingprice"],
    location: ["location", "area", "city"],
    ownerName: ["ownername", "owner", "name"],
    noTel: [
      "notel",
      "phone",
      "tel",
      "telephone",
      "phonenumber",
      "contactnumber",
    ],
    propertyLink: ["propertylink", "url", "link", "listingurl"],
    status: ["status", "listingstatus"],
    seedingStatus: [
      "seedingstatus",
      "statusseeding",
      "seedingstage",
      "seeding",
    ],
  };
  const mapping: OwnerMapping = {};
  for (const [field] of OWNER_IMPORT_FIELDS) {
    const index = headers.findIndex((h) =>
      aliases[field].includes(h.toLowerCase().replace(/[^a-z0-9]/g, "")),
    );
    if (index !== -1) mapping[field] = index;
  }
  return mapping;
}
export function mapOwnerSheet(
  sheet: OwnerImportSheet,
  mapping: OwnerMapping,
): OwnerImportRaw[] {
  if (sheet.error) throw new Error(sheet.error);
  const selected = Object.values(mapping).filter(
    (i): i is number => i !== undefined && i >= 0,
  );
  if (new Set(selected).size !== selected.length)
    throw new Error("Do not map the same column to two fields.");
  for (const [key, label, required] of OWNER_IMPORT_FIELDS)
    if (required && (mapping[key] === undefined || mapping[key]! < 0))
      throw new Error(`Choose a column for ${label}.`);
  return sheet.rows.map((row) =>
    Object.fromEntries(
      OWNER_IMPORT_FIELDS.map(([key]) => {
        const index = mapping[key];
        const value =
          index === undefined || index < 0
            ? ""
            : key === "propertyPrice" && row.numbers[index] !== undefined
              ? row.numbers[index]
              : key === "propertyLink"
                ? row.links[index] || row.values[index] || ""
                : row.values[index] || "";
        return [key, value];
      }),
    ),
  );
}
