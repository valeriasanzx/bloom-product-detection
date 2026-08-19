/**
 * Pattern: normalize social post URLs so ingest is idempotent.
 *
 * Illustrative rewrite from the Bloom Nutrition UGC detection pipeline.
 *
 * The same post gets submitted as a share link, a copied address bar URL,
 * and something with a tracking query attached. Without normalizing first,
 * the duplicate check misses and the tracker double-counts.
 */

function normalizeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    u.hash = "";                                   // fragments never identify a post
    const path = u.pathname.replace(/\/+$/, "");   // trailing slashes are noise
    return u.origin + path + (u.search || "");
  } catch {
    return raw.trim(); // not a URL — let the caller's validation reject it
  }
}

/** Best-effort creator handle from the URL, for when metadata scraping fails. */
function handleFromUrl(url) {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/^\/@([^/]+)/); // e.g. tiktok.com/@creator/video/123
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

module.exports = { normalizeUrl, handleFromUrl };
