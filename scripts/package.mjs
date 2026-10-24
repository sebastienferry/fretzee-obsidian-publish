import { mkdir, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/fretzee-publish", { recursive: true });
for (const file of ["main.js", "manifest.json", "LICENSE", "README.md"])
  await copyFile(file, `dist/fretzee-publish/${file}`);
execFileSync("zip", ["-qr", "fretzee-publish-0.1.0.zip", "fretzee-publish"], {
  cwd: "dist",
});
