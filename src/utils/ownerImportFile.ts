import * as XLSX from "xlsx";
import { OWNER_IMPORT_LIMIT } from "../ownerImport";

// SheetJS tolerates broken CSV quotes. Reject them before a malformed field can
// absorb subsequent listings. Valid quoted multiline fields remain supported.
function validateCsv(text: string, declaredSeparator?: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    }
    if (!quoted && ch in counts) counts[ch]++;
    if (
      !quoted &&
      (ch === "\n" || ch === "\r") &&
      Object.values(counts).some(Boolean)
    )
      break;
  }
  const separator =
    declaredSeparator ||
    Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  let state: "start" | "text" | "quoted" | "closed" = "start";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state === "quoted") {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else state = "closed";
      }
      continue;
    }
    if (ch === separator || ch === "\n" || ch === "\r") {
      state = "start";
      continue;
    }
    if (state === "closed") {
      throw new Error(
        "Invalid CSV quote: unexpected text after a quoted field. Save a fresh CSV from Excel.",
      );
    }
    if (ch === '"') {
      if (state !== "start")
        throw new Error(
          "Invalid CSV quote inside an unquoted field. Save a fresh CSV from Excel.",
        );
      state = "quoted";
    } else state = "text";
  }
  if (state === "quoted")
    throw new Error("Unclosed CSV quote. Correct the file before importing.");
  return separator;
}
export interface OwnerImportSheet {
  name: string;
  headers: string[];
  rows: {
    line: number;
    values: string[];
    links: Record<number, string>;
    numbers: Record<number, string>;
  }[];
  error?: string;
}
export function readOwnerWorkbook(
  bytes: Uint8Array,
  name: string,
): OwnerImportSheet[] {
  if (bytes.byteLength > 5 * 1024 * 1024)
    throw new Error("Choose a file smaller than 5 MB.");
  if (!/\.(xlsx|xls|csv)$/i.test(name))
    throw new Error("Choose an Excel (.xlsx or .xls) or CSV file.");
  const csv = /\.csv$/i.test(name);
  let content: Uint8Array | string = bytes;
  let separator: string | undefined;
  let lineOffset = 0;
  if (csv) {
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Save this file as CSV UTF-8, then try again.");
    }
    const declaration = /^sep=([,;\t])\r?\n/i.exec(content);
    if (declaration) {
      content = content.slice(declaration[0].length);
      lineOffset = 1;
    }
    separator = validateCsv(content, declaration?.[1]);
  } else if (
    !(bytes[0] === 0x50 && bytes[1] === 0x4b) &&
    !(bytes[0] === 0xd0 && bytes[1] === 0xcf)
  ) {
    throw new Error(
      "This is not a supported Excel workbook. Save it as .xlsx or CSV.",
    );
  }
  const workbook = XLSX.read(content, {
    type: csv ? "string" : "array",
    raw: true,
    FS: separator,
    cellFormula: true,
    cellHTML: false,
    cellNF: true,
    sheetRows: OWNER_IMPORT_LIMIT + 2,
  });
  if (workbook.SheetNames.length > 20)
    throw new Error("Use a workbook with at most 20 sheets.");
  const result = workbook.SheetNames.map((name) => {
    const sheet: OwnerImportSheet = { name, headers: [], rows: [] };
    const ws = workbook.Sheets[name];
    if (!ws?.["!ref"]) return { ...sheet, error: "This sheet is empty." };
    const range = XLSX.utils.decode_range(ws["!fullref"] || ws["!ref"]!);
    if (range.e.c >= 60)
      return { ...sheet, error: "Use at most 60 columns per sheet." };
    if (range.e.r >= OWNER_IMPORT_LIMIT + 1)
      return {
        ...sheet,
        error:
          "Use at most 200 data rows plus a header. Split this sheet into smaller files.",
      };
    for (let r = range.s.r; r <= range.e.r; r++) {
      const values: string[] = [],
        links: Record<number, string> = {},
        numbers: Record<number, string> = {};
      for (let c = 0; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell?.f)
          sheet.error =
            "This sheet contains a formula. Paste values only into a copy before importing.";
        if (cell?.t === "e")
          sheet.error =
            "This sheet contains an Excel error. Correct it before importing.";
        let v = cell?.w ?? String(cell?.v ?? "");
        if (cell?.t === "n") {
          if (
            !Number.isFinite(cell.v) ||
            Math.abs(cell.v) > Number.MAX_SAFE_INTEGER
          )
            sheet.error =
              "A numeric cell cannot be read precisely. Store large amounts as text.";
          numbers[c] = String(cell.v);
        }
        // General/scientific display must not turn long phone numbers into an exponent.
        if (cell?.t === "n" && /e[+-]\d+/i.test(v)) {
          if (Number.isSafeInteger(cell.v)) v = String(cell.v);
          else
            sheet.error =
              "A numeric cell cannot be read precisely. Store phone numbers and large amounts as text.";
        }
        values.push(v.trim());
        if (cell?.l?.Target) links[c] = cell.l.Target;
      }
      if (!values.some(Boolean) && !Object.keys(numbers).length) continue;
      if (!sheet.headers.length)
        sheet.headers = values.map((v, i) => v || `Column ${i + 1}`);
      else
        sheet.rows.push({ line: r + 1 + lineOffset, values, links, numbers });
    }
    if (!sheet.rows.length)
      sheet.error ||= "No data rows were found below the header.";
    return sheet;
  });
  if (!result.length) throw new Error("No sheets were found.");
  return result;
}
