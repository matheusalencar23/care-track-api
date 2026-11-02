import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// No CI, o semantic-release atualiza a versão do package.json antes de gerar
// a imagem, então em produção este valor é a versão publicada.
const readVersion = () => {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf-8"),
    ) as { version?: string };
    return packageJson.version ?? "unknown";
  } catch {
    return "unknown";
  }
};

export const APP_VERSION = readVersion();
