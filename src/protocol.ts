/** Version-one upload contract; it can create private drafts only. */
export const LIMITS = {
  files: 200,
  fileBytes: 10 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
} as const;
export interface UploadFile {
  path: string;
  content: string;
}
export interface Upload {
  schema: 1;
  sourceKey: string;
  title: string;
  entry: string;
  files: UploadFile[];
}
export interface VaultFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
}
export interface Source {
  files(): VaultFile[];
  attachments(note: VaultFile): VaultFile[];
  read(file: VaultFile): Promise<ArrayBuffer>;
}
const supported = new Set(
  "md markdown png jpg jpeg gif webp avif svg pdf txt json mp3 wav ogg m4a mp4 webm gp gp3 gp4 gp5 gpx musicxml mxl csv".split(
    " ",
  ),
);
export function safePath(raw: string): string {
  const value = raw.normalize("NFC");
  if (
    !value ||
    new TextEncoder().encode(value).length > 512 ||
    value.startsWith("/") ||
    /[\\:\p{Cc}]/u.test(value) ||
    value.split("/").some((part) => !part || part.startsWith("."))
  )
    throw new Error("Only visible vault-relative paths can be sent.");
  return value;
}
export const isMarkdown = (file: VaultFile): boolean =>
  /^(md|markdown)$/iu.test(file.extension);
function eligible(file: VaultFile): boolean {
  try {
    safePath(file.path);
    return supported.has(file.extension.toLowerCase());
  } catch {
    return false;
  }
}
export function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(text);
}
/** Collects selected files plus direct non-Markdown attachments without modifying the vault. */
export async function prepareUpload(
  source: Source,
  selection: { path: string; title: string; folder: boolean },
  vaultId: string,
): Promise<Upload> {
  const selected = selection.path === "/" ? "" : selection.path;
  if (selected) safePath(selected);
  const files = source
    .files()
    .filter(
      (file) =>
        eligible(file) &&
        (selection.folder
          ? !selected || file.path.startsWith(selected + "/")
          : file.path === selected),
    );
  const notes = files.filter(isMarkdown);
  if (!notes.length)
    throw new Error(
      "Select a Markdown note or a folder containing Markdown notes.",
    );
  const included = new Map(files.map((file) => [safePath(file.path), file]));
  for (const note of notes)
    for (const file of source.attachments(note))
      if (!isMarkdown(file) && eligible(file))
        included.set(safePath(file.path), file);
  if (included.size > LIMITS.files)
    throw new Error(`A draft can contain at most ${LIMITS.files} files.`);
  const candidates = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const entry =
    candidates.find((file) =>
      /^(index|readme)\.(md|markdown)$/iu.test(file.name),
    ) || candidates[0];
  let total = 0;
  const result: UploadFile[] = [];
  for (const [path, file] of [...included].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const content = await source.read(file);
    total += content.byteLength;
    if (content.byteLength > LIMITS.fileBytes || total > LIMITS.totalBytes)
      throw new Error("The draft exceeds 10 MiB per file or 20 MiB in total.");
    result.push({ path, content: base64(content) });
  }
  return {
    schema: 1,
    sourceKey: `${vaultId}:${selected || "/"}`.normalize("NFC"),
    title: selection.title.trim().slice(0, 200),
    entry: safePath(entry.path),
    files: result,
  };
}
export function siteOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Enter the Fretzee site origin without credentials, a path or query parameters.",
    );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("Use HTTPS, or HTTP on localhost for development.");
  return url.origin;
}
export type Transport = (request: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ status: number; json: unknown }>;
/** Upload credentials are sent only to the chosen origin's import endpoint. */
export async function sendDraft(
  origin: string,
  token: string,
  upload: Upload,
  transport: Transport,
): Promise<{ id: string; reviewPath: string }> {
  const site = siteOrigin(origin);
  if (!/^fup_[a-f0-9]{32}$/u.test(token))
    throw new Error("Configure a valid Fretzee upload token.");
  const response = await transport({
    url: `${site}/api/v1/documents/import`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upload),
  });
  if (response.status !== 201)
    throw new Error(
      response.status === 401
        ? "The upload token is expired, revoked or invalid."
        : response.status === 429
          ? "Too many sends. Wait a moment before retrying."
          : `Fretzee rejected the draft (HTTP ${response.status}).`,
    );
  const data = response.json as { id?: unknown; reviewPath?: unknown };
  if (
    typeof data.id !== "string" ||
    !/^doc_[a-f0-9]{32}$/u.test(data.id) ||
    data.reviewPath !== `/documents/${data.id}`
  )
    throw new Error("Fretzee returned an invalid draft reference.");
  return { id: data.id, reviewPath: data.reviewPath };
}

/** Binds the credential inside SecretStorage, independently of synced plugin settings. */
export function storedToken(raw: string | null, origin: string): string {
  if (!raw) throw new Error("Configure an upload token in plugin settings.");
  const credential = JSON.parse(raw) as { origin?: unknown; token?: unknown };
  if (
    credential.origin !== siteOrigin(origin) ||
    typeof credential.token !== "string" ||
    !/^fup_[a-f0-9]{32}$/u.test(credential.token)
  )
    throw new Error(
      "Save an upload token for this Fretzee site in plugin settings.",
    );
  return credential.token;
}
