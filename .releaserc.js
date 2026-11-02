export default {
  branches: ["master"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    // Só atualiza a versão do package.json no workspace do CI (vai para a
    // imagem Docker); não publica no npm nem faz commit
    ["@semantic-release/npm", { npmPublish: false }],
    "@semantic-release/github",
  ],
};
