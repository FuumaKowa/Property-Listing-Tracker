import { OwnerListing, OwnerListingInput } from "../ownerListing";
import type {
  OwnerImportRaw,
  OwnerImportRow,
  OwnerImportChoice,
  OwnerImportResult,
} from "../ownerImport";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/owner-listings${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Unable to access owner listings. Please try again.");
  }
  if (!response.ok)
    throw new Error(body.error || "Unable to save owner listing.");
  return body.data as T;
}

export const fetchOwnerListings = () => request<OwnerListing[]>("");
export const previewOwnerImport = (rows: OwnerImportRaw[]) =>
  request<{ rows: OwnerImportRow[] }>("/import", {
    method: "POST",
    body: JSON.stringify({ mode: "preview", rows }),
  });
export const commitOwnerImport = (
  rows: OwnerImportRaw[],
  choices: OwnerImportChoice[],
  importId: string,
) =>
  request<OwnerImportResult>("/import", {
    method: "POST",
    body: JSON.stringify({ mode: "commit", rows, choices, importId }),
  });
export const saveOwnerListing = (input: OwnerListingInput, id?: number) =>
  request<OwnerListing>(id === undefined ? "" : `/${id}`, {
    method: id === undefined ? "POST" : "PATCH",
    body: JSON.stringify(input),
  });
export const deleteOwnerListing = (id: number, version: number) =>
  request<void>(`/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ version }),
  });
export interface OwnerAssignmentSettings {
  rules: {
    key: string;
    agentLabel: string;
    areas: string[];
    userId: number | null;
  }[];
  agents: { id: number; name: string }[];
}
export interface OwnerEvent {
  id: number;
  action: string;
  actorName: string;
  note: string | null;
  createdAt: string;
  previousAgent: string | null;
  assignedAgent: string | null;
  seedingStatus: string | null;
  status: string | null;
}
export const saveOwnerActivity = (
  id: number,
  input: {
    version: number;
    seedingStatus?: string | null;
    status?: string;
    note?: string;
  },
) =>
  request<OwnerListing>(`/${id}/activity`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const assignOwnerListing = (
  id: number,
  version: number,
  agentId: number | null | "auto",
) =>
  request<OwnerListing>(`/${id}/assignment`, {
    method: "POST",
    body: JSON.stringify({ version, agentId }),
  });
export const fetchOwnerHistory = (id: number) =>
  request<OwnerEvent[]>(`/${id}/history`);
export async function ownerAssignmentSettings(input?: {
  key: string;
  userId: number | null;
}): Promise<OwnerAssignmentSettings> {
  const r = await fetch("/api/owner-assignment-settings", {
    method: input ? "PATCH" : "GET",
    headers: { "Content-Type": "application/json" },
    body: input ? JSON.stringify(input) : undefined,
  });
  const body = await r.json();
  if (!r.ok)
    throw new Error(body.error || "Unable to load assignment settings.");
  return input ? ownerAssignmentSettings() : body.data;
}
