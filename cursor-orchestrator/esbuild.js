const esbuild = require('esbuild');
const path = require('path');

/**
 * Bundle extension host: entry extension.ts + src/** to dist/extension.js.
 * Externalize 'vscode' (provided by VS Code at runtime).
 * @returns {Promise<void>}
 */
async function build() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'extension.ts')],
    bundle: true,
    outfile: path.join(__dirname, 'dist', 'extension.js'),
    platform: 'node',
    target: 'node18',
    external: ['vscode'],
    sourcemap: true,
    minify: false,
  });
}

build().catch((err) => {
  process.stderr.write(err.stack);
  process.exit(1);
});
