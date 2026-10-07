import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { readOwnerWorkbook } from "../src/utils/ownerImportFile";
import {
  guessOwnerMapping,
  mapOwnerSheet,
} from "../src/utils/ownerImportMapping";
const csv = new TextEncoder().encode(
  '\uFEFFProperty name,Property type,Price,Owner name,Phone,Location,URL\r\n"A, with balcony",Apartment,"RM 300,000",O\'Connor,0123456789,Shah Alam,https://example.com/1\r\n"Two\nlines",Land,200000,,+60123456789,Rawang,\r\n',
);
const parsed = readOwnerWorkbook(csv, "owners.csv");
assert.equal(parsed.length, 1, "CSV import must expose its data for review");
const sheet = parsed[0];
assert.equal(sheet.rows.length, 2);
const rows = mapOwnerSheet(sheet, guessOwnerMapping(sheet.headers));
assert.equal(rows[0].propertyName, "A, with balcony");
assert.equal(rows[0].noTel, "0123456789");
assert.equal(rows[1].propertyName, "Two\nlines");
assert.equal(rows[1].noTel, "+60123456789");
const declared = readOwnerWorkbook(
  new TextEncoder().encode(
    "sep=;\nproperty,name,with,commas;property_type;property_price\nHome;Apartment;100000",
  ),
  "semicolon.csv",
)[0];
assert.deepEqual(declared.headers, [
  "property,name,with,commas",
  "property_type",
  "property_price",
]);
assert.equal(declared.rows[0].line, 3);
assert.throws(
  () =>
    readOwnerWorkbook(
      new TextEncoder().encode(
        'property_name,property_type,property_price\n"Home" ,Apartment,100000',
      ),
      "spaces.csv",
    ),
  /quote/i,
);
assert.throws(
  () =>
    readOwnerWorkbook(
      new TextEncoder().encode(
        'property_name,property_type,property_price,owner_name\nOne,Apartment,100000,"A\nTwo,Apartment,200000,B',
      ),
      "malformed.csv",
    ),
  /quote/i,
  "Malformed quoting must not swallow the next listing",
);
const workbook = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  [
    "property_name",
    "property_type",
    "property_price",
    "no_tel",
    "property_link",
  ],
  ["Excel unit", "Apartment", 300000, 123456789, "Open ad"],
]);
ws.D2.z = "0000000000";
ws.E2.l = { Target: "https://example.com/excel" };
XLSX.utils.book_append_sheet(workbook, ws, "Owners");
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([["property_name"], ["Other"]]),
  "Other sheet",
);
for (const bookType of ["xlsx", "xls"] as const) {
  const sheets = readOwnerWorkbook(
    new Uint8Array(XLSX.write(workbook, { bookType, type: "array" })),
    `owners.${bookType}`,
  );
  assert.equal(sheets.length, 2);
  const mapped = mapOwnerSheet(sheets[0], guessOwnerMapping(sheets[0].headers));
  assert.equal(mapped[0].propertyPrice, "300000");
  assert.equal(mapped[0].noTel, "0123456789");
  assert.equal(mapped[0].propertyLink, "https://example.com/excel");
}
const huge = new TextEncoder().encode(
  "property_name\n" + Array(201).fill("Row").join("\n"),
);
for (const format of ["#,##0", "#,##0,"]) {
  ws.C2 = { t: "n", v: 300000.75, z: format };
  const numeric = readOwnerWorkbook(
    new Uint8Array(XLSX.write(workbook, { bookType: "xlsx", type: "array" })),
    "numeric.xlsx",
  )[0];
  assert.equal(
    mapOwnerSheet(numeric, guessOwnerMapping(numeric.headers))[0].propertyPrice,
    "300000.75",
    "Price must retain the stored number regardless of Excel display rounding/scaling",
  );
}
assert.match(readOwnerWorkbook(huge, "big.csv")[0].error!, /200/);
assert.throws(() => readOwnerWorkbook(csv, "wrong.pdf"), /CSV|Excel/);
assert.throws(
  () => readOwnerWorkbook(new Uint8Array(5 * 1024 * 1024 + 1), "large.xlsx"),
  /5 MB/,
);
ws.C2 = { t: "n", f: "1+2", v: 3 };
const formulas = readOwnerWorkbook(
  new Uint8Array(XLSX.write(workbook, { bookType: "xlsx", type: "array" })),
  "formula.xlsx",
);
assert.match(
  formulas[0].error!,
  /formula/i,
  "Formula results must not be silently imported as verified values",
);
assert.throws(
  () =>
    mapOwnerSheet(sheet, {
      propertyName: 0,
      propertyType: 1,
      propertyPrice: 1,
    }),
  /same column/i,
);
console.log(
  "PASS CSV/Excel parsing, quoted and multiline cells, phone formatting, hyperlink targets, mapping and limits",
);
