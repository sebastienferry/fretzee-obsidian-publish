# Fretzee Publish for Obsidian

Send selected Markdown notes or folders from Obsidian to Fretzee as **private drafts**. Review the files on the website, then explicitly publish to everyone or selected existing Fretzee accounts.

Obsidian owns all editing. This plugin does not automatically synchronize, publish, delete, rename or modify your notes. It is independent of the offline Fretzee diagram-rendering plugin.

## Status and requirements

Initial implementation, version 0.1.0. Requires Obsidian **1.11.4 or newer** for its public SecretStorage API, and a Fretzee Studio server implementing the `document-publication` API. The existing deployed Studio version does not gain these endpoints until its companion change is deployed.

The plugin declares desktop and mobile compatibility and uses public Obsidian APIs only. Actual in-app installation and mobile verification remain necessary before a stable release. This repository is not yet listed in Obsidian's community plugin directory.

## Build and install manually

```sh
npm ci
npm run build
npm test
npm run package
```

Extract `dist/fretzee-publish-0.1.0.zip` into a test vault's `.obsidian/plugins/` directory. Enable **Fretzee Publish** in Obsidian's community plugin settings. The installed plugin directory must contain `main.js`, `manifest.json`, `LICENSE` and `README.md`.

Start with a disposable test vault before connecting your real notes.

## Connect and send

1. Sign in to Fretzee and open **Documents → Connect Obsidian**.
2. Create an upload token and copy it while it is displayed. Tokens expire after 30 days and can be revoked immediately.
3. In Obsidian, open **Settings → Fretzee Publish**. Enter your Fretzee site origin, such as `https://dev.fretzee.com`. HTTP is permitted only on loopback hosts for development.
4. Paste the token and click **Save token**. It is stored in Obsidian SecretStorage, not plugin `data.json`. Its destination binding is also held inside SecretStorage.
5. Use **Fretzee Publish: Send current note as a private draft**, or right-click a note/folder and choose **Send to Fretzee as a private draft**.
6. Review the complete outgoing-file list and confirm **Send private draft**.
7. The plugin opens the private draft on Fretzee. Choose public or selected-account access, then publish explicitly.

Edit corrections in Obsidian and send the same path again. Fretzee creates a new private draft. Existing readers keep seeing the prior published version until you publish the update. Renaming a source path creates a separate source identity; there is no automatic withdrawal or deletion.

## What gets sent

- Visible supported files inside the selected folder, or the selected Markdown note.
- Direct non-Markdown attachments resolved by Obsidian's metadata cache, even when stored elsewhere in the vault.
- Original file bytes, with vault-relative paths normalized to Unicode NFC for consistent links.

Linked Markdown notes outside the selected scope, `.obsidian`, hidden files and unsupported file extensions are excluded. The outgoing-file confirmation is authoritative. The plugin never scans your computer outside the vault or downloads external URLs.

Supported attachment extensions include images, PDFs, text/JSON/CSV, audio/video, Guitar Pro and MusicXML. Sending an attachment does not imply web playback or support for the originating application's plugin syntax. Obsidian-specific renderers, Dataview queries and custom musical blocks are outside this initial publisher.

Limits: 200 files, 10 MiB per file, 20 MiB decoded content per send. Uploads use protocol v1 JSON with base64 file contents; bulk/presigned uploads can be added later.

## Credentials and privacy

Upload tokens can create private drafts only. They cannot read documents, publish, change reader permissions, or access diagram APIs. Keep your token private. Changing the destination requires explicitly saving a token for that origin. Forgetting a token locally does not revoke it on the server; use Fretzee's Revoke action as well.

Public publication is a separate owner-confirmed website action. Restricted publication grants access to existing Fretzee accounts without sending invitations or email messages.

## Development and specification

The plugin's OpenSpec capability lives under `openspec/`. The server contract and access-control rules live in [Fretzee Studio](https://github.com/sebastienferry/fretzee-studio), capability `document-publication`.

Validate specifications with `openspec validate --all --strict --no-interactive`.

## License

MIT. See [LICENSE](LICENSE). This repository contains original plugin code and depends on the public Obsidian SDK; Fretzee Studio's FSL source is not copied here.

## Integration verification

Against a disposable loopback Studio instance only:

```sh
FRETZEE_TEST_SITE=http://127.0.0.1:18081 FRETZEE_TEST_PASSWORD='<test-admin-password>' npm test
```

The fixture signs in as `admin@fretzee.com`, creates and revokes an upload token, sends an original Markdown source, verifies private access, then publishes a synthetic test document. It never connects to cloud dev or production. Native Obsidian desktop and mobile installation still requires a manual acceptance check.
