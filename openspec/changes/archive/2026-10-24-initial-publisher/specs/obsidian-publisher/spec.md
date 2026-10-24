## ADDED Requirements

### Requirement: Explicit private draft sending

The plugin SHALL send a selected Markdown note or folder and direct non-Markdown attachments only after a complete outgoing-file confirmation.

#### Scenario: Send a selected note

- **WHEN** the user confirms the selected note's package
- **THEN** the plugin sends original bytes to the configured Fretzee import endpoint
- **AND** it does not edit the vault, publish content or upload linked notes outside the selection

### Requirement: Scoped secret handling

The plugin SHALL keep upload tokens in Obsidian SecretStorage and SHALL require a matching configured destination origin before sending them.

#### Scenario: Change site origin

- **WHEN** the configured destination changes
- **THEN** the old credential cannot be sent until a token is explicitly saved for the new destination

### Requirement: Safe upload boundaries

The plugin SHALL exclude hidden files, reject unsafe paths and enforce the receiving API's documented upload limits before sending.

#### Scenario: Hidden attachment

- **WHEN** a selected note references a hidden vault file
- **THEN** the plugin does not include that file in the outgoing package
