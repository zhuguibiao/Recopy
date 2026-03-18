/**
 * Cloudflare Pages Function — Release Download Proxy
 *
 * Redirects to the latest release assets, using Gitee as primary source
 * (fast & accessible in mainland China) with GitHub as fallback.
 *
 * Routes:
 *   /download/macos     → latest macOS ARM (Apple Silicon) DMG
 *   /download/macos-x64 → latest macOS Intel DMG
 *   /download/windows   → latest Windows x64 installer
 */

const GITEE_REPO = 'shiqkuangsan/Recopy';
const GITHUB_REPO = 'shiqkuangsan/Recopy';
const GITEE_API = `https://gitee.com/api/v5/repos/${GITEE_REPO}/releases/latest`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

const PLATFORM_MAP = {
  'macos':     '_aarch64.dmg',
  'macos-arm': '_aarch64.dmg',
  'macos-x64': '_x64.dmg',
  'windows':   '_x64-setup.exe',
};

/**
 * Try to find the download URL from a release source.
 * Returns the browser_download_url of the matching asset, or null.
 */
async function findAssetUrl(apiUrl, suffix, headers) {
  try {
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Recopy-Download-Proxy/1.0', ...headers },
      cf: { cacheTtl: 300 },
    });
    if (!res.ok) return null;

    const release = await res.json();
    const assets = release.assets || [];
    const asset = assets.find((a) => a.name.endsWith(suffix));
    return asset ? asset.browser_download_url : null;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const platform = context.params.platform;
  const suffix = PLATFORM_MAP[platform];

  if (!suffix) {
    return new Response(
      JSON.stringify({
        error: 'Invalid platform',
        valid: ['macos', 'macos-x64', 'windows'],
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. Try Gitee first (no auth needed, fast in China)
  const giteeUrl = await findAssetUrl(GITEE_API, suffix, {});

  if (giteeUrl) {
    return Response.redirect(giteeUrl, 302);
  }

  // 2. Fallback to GitHub
  const githubUrl = await findAssetUrl(GITHUB_API, suffix, {
    'Accept': 'application/vnd.github.v3+json',
  });

  if (githubUrl) {
    return Response.redirect(githubUrl, 302);
  }

  // 3. Last resort: redirect to GitHub releases page
  return Response.redirect(
    `https://github.com/${GITHUB_REPO}/releases/latest`,
    302
  );
}
