# Fretzee Publish engineering instructions

- This repository is public and MIT licensed. Do not copy Fretzee Studio's FSL source into it.
- Author code, documentation and commit messages in English.
- Obsidian is the only authoring tool. Explicit commands send private drafts; the plugin never publishes or deletes remote content automatically.
- Use public Obsidian APIs only. Store credentials in SecretStorage, never plugin data.json or a vault note.
- Never send hidden files or linked notes outside the selected scope automatically.
- Keep protocol v1 compatible with Studio's OpenSpec document-publication capability.
- Work on a feature branch. Run npm run build, npm test and openspec validate --all --strict --no-interactive before committing.
