/**
 * Local images in `public/looks/` override remote URLs for the first N catalog rows.
 * Naming: img1 → first outfit (by sort order), img2 → second, … img100 → 100th.
 * Files img21–img100 reuse the same pixels as img1–img20 in rotation (see public/looks).
 */
export const MAX_LOCAL_LOOK_IMAGES = 100

/**
 * @template {{ imageUrl: string } & Record<string, unknown>} T
 * @param {T[]} items
 * @returns {T[]}
 */
export function applyLocalLookImages(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return items
  }

  return items.map((item, index) => {
    if (index >= MAX_LOCAL_LOOK_IMAGES) {
      return item
    }

    const slot = index + 1

    return {
      ...item,
      imageUrl: `/looks/img${slot}.png`,
    }
  })
}
