# Design

Use public Obsidian vault, metadata cache, requestUrl and SecretStorage APIs. Require Obsidian 1.11.4 or later. Plugin settings contain only the site origin, a generated vault ID and credential origin. Credentials never enter data.json or upload payloads.

Protocol v1 sends unchanged file bytes as base64, preserving NFC-normalized relative paths. Include only the selected scope and direct non-Markdown attachments; do not traverse linked notes or hidden paths. Confirm every outgoing path before sending. The plugin has no publish, delete or automatic synchronization operation. Site changes invalidate the credential origin binding until a token is saved for the new destination.
