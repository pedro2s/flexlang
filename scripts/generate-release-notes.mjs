#!/usr/bin/env node
// Gera o corpo da GitHub Release no estilo Bun (instalar/atualizar/notas/contribuidores),
// adaptado para distribuição via npm. Ver .docs/v1/rfcs/rfc-010-release-cicd-npm-publish.md.
//
// Espera rodar dentro de um job do GitHub Actions disparado por push de tag `vX.Y.Z`:
//   env: GITHUB_REF_NAME, GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_OUTPUT

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const PACKAGE_NAME = "@flexlang/cli";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

function loadCodenames() {
  try {
    return JSON.parse(readFileSync("codenames.json", "utf-8"));
  } catch {
    return {};
  }
}

function previousTag(currentTag) {
  const tags = sh("git tag --sort=-creatordate").split("\n").filter(Boolean);
  const idx = tags.indexOf(currentTag);
  return idx >= 0 && idx + 1 < tags.length ? tags[idx + 1] : null;
}

async function resolveContributors(repo, token, range) {
  const shas = range
    ? sh(`git log ${range} --format=%H`).split("\n").filter(Boolean)
    : sh("git log --format=%H").split("\n").filter(Boolean);

  const logins = new Set();
  const fallbackNames = new Set();

  for (const sha of shas) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.author?.login) {
        logins.add(data.author.login);
      } else if (data.commit?.author?.name) {
        fallbackNames.add(data.commit.author.name);
      }
    } catch {
      // Um commit que falhe a resolução não deve derrubar a release inteira.
      fallbackNames.add(sh(`git log -1 --format=%an ${sha}`));
    }
  }

  return { logins: [...logins].sort(), fallbackNames: [...fallbackNames].sort() };
}

async function main() {
  const tag = process.env.GITHUB_REF_NAME;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const githubOutput = process.env.GITHUB_OUTPUT;

  if (!tag || !repo || !token) {
    console.error("Faltando GITHUB_REF_NAME, GITHUB_REPOSITORY ou GITHUB_TOKEN no ambiente.");
    process.exit(1);
  }

  const version = tag.replace(/^v/, "");
  const [major, minor] = version.split(".");
  const minorKey = `${major}.${minor}`;

  const codenames = loadCodenames();
  const codename = codenames[minorKey];

  const title = codename ? `FlexLang ${tag} "${codename}"` : `FlexLang ${tag}`;

  const prevTag = previousTag(tag);
  const range = prevTag ? `${prevTag}..${tag}` : null;
  const { logins, fallbackNames } = await resolveContributors(repo, token, range);

  const mentions = logins.map((l) => `@${l}`);
  const contributorCount = logins.length + fallbackNames.length;
  const contributorLines = [
    ...mentions,
    ...fallbackNames, // colaboradores sem handle de GitHub resolvido entram pelo nome do commit
  ].join(" ");

  const anchor = version.replace(/\./g, "");
  const changelogUrl = `https://github.com/${repo}/blob/main/CHANGELOG.md#${anchor}`;

  const body = `## Instalar o FlexLang ${version}

\`\`\`bash
npm install -g ${PACKAGE_NAME}@${version}
\`\`\`

Ou use via \`npx\`, sem instalar globalmente:

\`\`\`bash
npx ${PACKAGE_NAME}@${version}
\`\`\`

## Atualizar

\`\`\`bash
npm install -g ${PACKAGE_NAME}@latest
\`\`\`

Leia as notas completas em [CHANGELOG.md](${changelogUrl})

## Agradecimentos

Obrigado ${contributorCount === 1 ? "ao" : "aos"} ${contributorCount} colaborador${contributorCount === 1 ? "" : "es"} desta versão!

${contributorLines}
`;

  writeFileSync("release-notes.md", body, "utf-8");

  if (githubOutput) {
    appendFileSync(githubOutput, `title=${title}\n`, "utf-8");
  }

  console.log(`Notas de release geradas para ${tag} (${contributorCount} colaboradores).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
