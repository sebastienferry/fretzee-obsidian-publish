import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { prepareUpload, sendDraft, type Source } from "../src/protocol.ts";

const site = process.env.FRETZEE_TEST_SITE;
test(
  "plugin protocol interoperates with a disposable Studio server",
  { skip: !site },
  async () => {
    assert.ok(
      site && /^http:\/\/127\.0\.0\.1:\d+$/u.test(site),
      "Integration tests require a disposable loopback server",
    );
    const login = await fetch(`${site}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@fretzee.com",
        password: process.env.FRETZEE_TEST_PASSWORD,
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const headers = { "Content-Type": "application/json", Cookie: cookie };
    const response = await fetch(`${site}/api/v1/documents/tokens`, {
      method: "POST",
      headers,
      body: JSON.stringify({ label: "Protocol integration" }),
    });
    assert.equal(response.status, 201);
    const credential = (await response.json()) as {
      token: string;
      metadata: { id: string };
    };
    try {
      const note = {
        path: "Music/index.md",
        name: "index.md",
        basename: "index",
        extension: "md",
      };
      const original =
        "---\ntitle: Protocol test\n---\n# Source from Obsidian\n\nExact UTF-8: Café\n";
      const source: Source = {
        files: () => [note],
        attachments: () => [],
        read: async () => new TextEncoder().encode(original).buffer,
      };
      const upload = await prepareUpload(
        source,
        { path: "Music", title: "Protocol integration", folder: true },
        randomUUID(),
      );
      const result = await sendDraft(
        site,
        credential.token,
        upload,
        async (request) => {
          const response = await fetch(request.url, request);
          return { status: response.status, json: await response.json() };
        },
      );
      assert.equal(result.reviewPath, `/documents/${result.id}`);
      assert.equal(
        (await fetch(`${site}/api/v1/documents/view?id=${result.id}`)).status,
        404,
      );
      const file = `${site}/api/v1/documents/file?${new URLSearchParams({ id: result.id, path: note.path, draft: "1" })}`;
      const draft = await fetch(file, { headers: { Cookie: cookie } });
      assert.equal(draft.status, 200);
      assert.equal(await draft.text(), original);
      const manifest = await fetch(
        `${site}/api/v1/documents/view?id=${result.id}&draft=1`,
        { headers: { Cookie: cookie } },
      );
      const detail = (await manifest.json()) as {
        document: { draftRevision: string };
      };
      const publish = await fetch(`${site}/api/v1/documents/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: result.id,
          revision: detail.document.draftRevision,
          visibility: "public",
          confirmed: true,
        }),
      });
      assert.equal(publish.status, 200);
      const published = await fetch(file.replace("&draft=1", ""));
      assert.equal(published.status, 200);
      assert.equal(await published.text(), original);
      console.log(`Reader fixture: ${site}/publications/${result.id}`);
    } finally {
      assert.equal(
        (
          await fetch(
            `${site}/api/v1/documents/tokens?id=${credential.metadata.id}`,
            { method: "DELETE", headers },
          )
        ).status,
        200,
      );
    }
  },
);
