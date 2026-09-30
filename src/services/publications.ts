import type {
  PublicationChannel,
  PublicationInput,
  ListingPublication,
  PublicationSummary,
} from "../publications";
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response
    .json()
    .catch(() => ({ error: "Unable to reach the publication service." }));
  if (!response.ok)
    throw new Error(result.error || "Unable to save. Please try again.");
  return result.data;
}
export const fetchPublicationChannels = () =>
  request<PublicationChannel[]>("publication-channels");
export const savePublicationChannel = (
  id: number | null,
  input: { name?: string; archived?: boolean },
) =>
  request<PublicationChannel>(
    `publication-channels${id ? `/${id}` : ""}`,
    id ? "PATCH" : "POST",
    input,
  );
export const fetchListingPublications = (listingId: number) =>
  request<ListingPublication[]>(`listings/${listingId}/publications`);
export const importListingPublications = (listingId: number, items: PublicationInput[]) =>
  request<{links: ListingPublication[]; added: number; skipped: number}>(`listings/${listingId}/publications/import`, 'POST', {items});
export const saveListingPublication = (
  listingId: number,
  id: number | null,
  input: PublicationInput & {version?:number},
) =>
  request<ListingPublication>(
    `listings/${listingId}/publications${id ? `/${id}` : ""}`,
    id ? "PATCH" : "POST",
    input,
  );
export const deleteListingPublication = (listingId: number, id: number, version:number) =>
  request(`listings/${listingId}/publications/${id}`, "DELETE",{version});
export async function fetchPublicationSummaries(
  ids: number[],
): Promise<PublicationSummary[]> {
  const result: PublicationSummary[] = [];
  for (let offset = 0; offset < ids.length; offset += 200)
    result.push(
      ...(await request<PublicationSummary[]>(
        `publication-summaries?listingIds=${ids.slice(offset, offset + 200).join(",")}`,
      )),
    );
  return result;
}
