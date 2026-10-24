# Initial Fretzee publisher

## Why

The owner wants to edit exclusively in Obsidian and send notes/folders for private review and explicit publication on Fretzee.

## What Changes

- Add explicit note and folder sends, a complete outgoing-file confirmation and direct non-Markdown attachment collection.
- Store upload-only credentials in SecretStorage and bind them to the configured site origin.
- Keep all vault content unchanged and avoid background sync or automatic publication.

## Capabilities

### New Capabilities

- `obsidian-publisher`: One-way private draft upload.

## Impact

New public MIT plugin, protocol tests, installable package and documentation. Studio's document-publication OpenSpec capability defines the receiving API.
