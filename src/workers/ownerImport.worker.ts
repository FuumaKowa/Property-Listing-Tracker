import { readOwnerWorkbook } from "../utils/ownerImportFile";
self.onmessage = (event: MessageEvent<{ bytes: Uint8Array; name: string }>) => {
  try {
    self.postMessage({
      sheets: readOwnerWorkbook(event.data.bytes, event.data.name),
    });
  } catch (e) {
    self.postMessage({
      error: (e as Error).message || "Unable to read this file.",
    });
  }
};
