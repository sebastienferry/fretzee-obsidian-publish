# Project memory

- This is the MIT document publisher, separate from the existing offline `fretzee-obsidian` renderer project.
- Obsidian is the only editor. Uploads are private drafts; the website owns explicit publication and audience selection.
- Credentials and their origin binding must stay in SecretStorage. Plugin data.json can sync between devices and is not a trusted place for the credential binding.
- SDK 1.14.4 exposes a base Plugin.settings property. Use `config` for this plugin's settings to avoid overriding it.
- Minimum supported Obsidian is 1.11.4 for SecretStorage. Do not install the plugin into the user's vault without an explicit request.
