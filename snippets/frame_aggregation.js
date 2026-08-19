/**
 * Pattern: aggregate object detections across sampled video frames.
 *
 * Illustrative rewrite from the Bloom Nutrition UGC detection pipeline.
 * Contains no company code, credentials, or model identifiers.
 *
 * The idea: a product may be on screen for only a moment, so no single
 * frame is authoritative. Sample the whole video, union the detections,
 * and rank by the best confidence each class ever achieved.
 */

const MIN_CONFIDENCE = 0.8;
const BATCH_SIZE = 5;

/**
 * @param {string[]} framePaths  Frames sampled from the video (e.g. FFmpeg at 0.5 fps)
 * @param {(path: string) => Promise<Array<{class: string, confidence: number}>>} detect
 * @returns {Promise<{products: string[], primary: string|null, confidence: number, framePath: string|null}>}
 */
async function aggregateDetections(framePaths, detect) {
  // class → highest confidence seen anywhere in the video
  const bestByClass = new Map();
  let primaryFrame = null;
  let primaryConfidence = 0;

  for (let i = 0; i < framePaths.length; i += BATCH_SIZE) {
    const batch = framePaths.slice(i, i + BATCH_SIZE);

    // One bad frame must not sink the whole post — resolve failures to [].
    const results = await Promise.all(
      batch.map((framePath) =>
        detect(framePath)
          .then((predictions) => ({ framePath, predictions }))
          .catch(() => ({ framePath, predictions: [] }))
      )
    );

    for (const { framePath, predictions } of results) {
      for (const p of predictions) {
        if (p.confidence < MIN_CONFIDENCE) continue; // floor, not a best guess

        if (p.confidence > (bestByClass.get(p.class) ?? 0)) {
          bestByClass.set(p.class, p.confidence);
        }
        // Track the single best frame overall, to use as the thumbnail.
        if (p.confidence > primaryConfidence) {
          primaryConfidence = p.confidence;
          primaryFrame = framePath;
        }
      }
    }
  }

  if (bestByClass.size === 0) {
    // Deliberately returns "nothing found" rather than a low-confidence guess.
    return { products: [], primary: null, confidence: 0, framePath: null };
  }

  const ranked = [...bestByClass.entries()].sort((a, b) => b[1] - a[1]);

  return {
    products: ranked.map(([cls]) => cls),
    primary: ranked[0][0],
    confidence: ranked[0][1],
    framePath: primaryFrame,
  };
}

module.exports = { aggregateDetections, MIN_CONFIDENCE };
