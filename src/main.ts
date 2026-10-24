import {
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  requestUrl,
  type App,
  type TAbstractFile,
} from "obsidian";
import {
  prepareUpload,
  sendDraft,
  siteOrigin,
  storedToken,
  type Source,
  type Upload,
} from "./protocol";

interface Settings {
  site: string;
  vaultId: string;
  tokenOrigin: string;
}
class ConfirmSend extends Modal {
  constructor(
    app: App,
    private upload: Upload,
    private submit: () => Promise<void>,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText("Send a private draft to Fretzee");
    this.contentEl.createEl("p", {
      text: `${this.upload.title}: ${this.upload.files.length} files. Review the complete outgoing list below. Nothing is published automatically.`,
    });
    const list = this.contentEl.createEl("ul");
    for (const file of this.upload.files)
      list.createEl("li", { text: file.path });
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText("Send private draft")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            try {
              await this.submit();
              this.close();
            } catch (error) {
              new Notice(
                error instanceof Error
                  ? error.message
                  : "The draft could not be sent.",
              );
              button.setDisabled(false);
            }
          }),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

/** Sends selected source files only; web publication is a separate owner action. */
export default class FretzeePublish extends Plugin {
  config!: Settings;
  private sending = false;
  async onload(): Promise<void> {
    const stored = (await this.loadData()) as Partial<Settings> | null;
    this.config = {
      site: stored?.site || "",
      vaultId: stored?.vaultId || crypto.randomUUID(),
      tokenOrigin: stored?.tokenOrigin || "",
    };
    await this.saveData(this.config);
    this.addSettingTab(new PublishSettings(this.app, this));
    this.addCommand({
      id: "send-active-note",
      name: "Send current note as a private draft",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !/^(md|markdown)$/iu.test(file.extension)) return false;
        if (!checking) void this.prepare(file);
        return true;
      },
    });
    this.addCommand({
      id: "open-documents",
      name: "Open Fretzee documents",
      callback: () => {
        try {
          window.open(
            siteOrigin(this.config.site) + "/documents",
            "_blank",
            "noopener",
          );
        } catch {
          new Notice("Configure the Fretzee site in plugin settings.");
        }
      },
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (
          file instanceof TFolder ||
          (file instanceof TFile && /^(md|markdown)$/iu.test(file.extension))
        )
          menu.addItem((item) =>
            item
              .setTitle("Send to Fretzee as a private draft")
              .setIcon("upload")
              .onClick(() => {
                void this.prepare(file);
              }),
          );
      }),
    );
  }
  secretId(): string {
    return `fretzee-publish-${this.config.vaultId}`;
  }
  private async prepare(selected: TAbstractFile): Promise<void> {
    if (this.sending) {
      new Notice("A draft is already being prepared or sent.");
      return;
    }
    this.sending = true;
    try {
      const origin = siteOrigin(this.config.site);
      if (this.config.tokenOrigin !== origin)
        throw new Error(
          "Save an upload token for this Fretzee site in plugin settings.",
        );
      const token = storedToken(
        this.app.secretStorage.getSecret(this.secretId()),
        origin,
      );
      const source: Source = {
        files: () => this.app.vault.getFiles(),
        attachments: (note) => {
          const file = this.app.vault.getFileByPath(note.path);
          if (!file) return [];
          const cache = this.app.metadataCache.getFileCache(file);
          return [...(cache?.links || []), ...(cache?.embeds || [])]
            .map((link) =>
              this.app.metadataCache.getFirstLinkpathDest(
                link.link.split("#")[0],
                note.path,
              ),
            )
            .filter((item): item is TFile => item instanceof TFile);
        },
        read: (file) => {
          const entry = this.app.vault.getFileByPath(file.path);
          if (!entry) throw new Error(`File unavailable: ${file.path}`);
          return this.app.vault.readBinary(entry);
        },
      };
      const upload = await prepareUpload(
        source,
        {
          path: selected.path,
          title:
            selected instanceof TFile
              ? selected.basename
              : selected.name || this.app.vault.getName(),
          folder: selected instanceof TFolder,
        },
        this.config.vaultId,
      );
      new ConfirmSend(this.app, upload, async () => {
        if (
          this.config.tokenOrigin !== origin ||
          siteOrigin(this.config.site) !== origin
        )
          throw new Error("The destination changed. Prepare the draft again.");
        const result = await sendDraft(
          origin,
          token,
          upload,
          async (options) => {
            const response = await requestUrl({ ...options, throw: false });
            return { status: response.status, json: response.json };
          },
        );
        new Notice("Private draft sent. Review and publish it in Fretzee.");
        window.open(origin + result.reviewPath, "_blank", "noopener");
      }).open();
    } catch (error) {
      new Notice(
        error instanceof Error
          ? error.message
          : "The draft could not be prepared.",
      );
    } finally {
      this.sending = false;
    }
  }
}
class PublishSettings extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: FretzeePublish,
  ) {
    super(app, plugin);
  }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Fretzee Publish" });
    containerEl.createEl("p", {
      text: "Create an upload token in Fretzee → Documents. It can send private drafts only. Publication and audience selection happen on the website.",
    });
    new Setting(containerEl)
      .setName("Fretzee site")
      .setDesc("HTTPS site origin. Local HTTP is supported for development.")
      .addText((text) =>
        text
          .setPlaceholder("https://dev.fretzee.com")
          .setValue(this.plugin.config.site)
          .onChange(async (value) => {
            this.plugin.config.site = value.trim();
            await this.plugin.saveData(this.plugin.config);
          }),
      );
    let credential = "";
    new Setting(containerEl)
      .setName("Upload token")
      .setDesc(
        "Stored using Obsidian SecretStorage; never saved to plugin data.json.",
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
        text.onChange((value) => {
          credential = value.trim();
        });
      })
      .addButton((button) =>
        button.setButtonText("Save token").onClick(async () => {
          try {
            const origin = siteOrigin(this.plugin.config.site);
            if (!/^fup_[a-f0-9]{32}$/u.test(credential))
              throw new Error("Enter a valid Fretzee upload token.");
            this.plugin.app.secretStorage.setSecret(
              this.plugin.secretId(),
              JSON.stringify({ origin, token: credential }),
            );
            this.plugin.config.tokenOrigin = origin;
            await this.plugin.saveData(this.plugin.config);
            credential = "";
            new Notice("Upload token saved.");
            this.display();
          } catch (error) {
            new Notice(
              error instanceof Error
                ? error.message
                : "Token could not be saved.",
            );
          }
        }),
      );
    new Setting(containerEl)
      .setName("Forget upload token")
      .setDesc(
        "Also revoke the token in Fretzee if you no longer want it to work.",
      )
      .addButton((button) =>
        button.setButtonText("Forget token").onClick(async () => {
          this.app.secretStorage.setSecret(this.plugin.secretId(), "");
          this.plugin.config.tokenOrigin = "";
          await this.plugin.saveData(this.plugin.config);
          new Notice("Upload token forgotten on this device.");
        }),
      );
  }
}
