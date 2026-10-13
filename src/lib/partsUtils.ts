import type { PhotoData, AdditionalPart } from '@/types/report';

/**
 * Get sub-parts associated with a specific photo.
 * Matches ONLY by photoId — each photo has its own sub-parts,
 * independent of PN. This prevents duplication when multiple photos share the same PN.
 */
export function getSubPartsForPhoto(
  photo: PhotoData,
  additionalParts: AdditionalPart[]
): AdditionalPart[] {
  return additionalParts.filter(ap =>
    ap.photoId && photo.id && ap.photoId === photo.id
  );
}

/**
 * Check if a photo has any sub-parts with actual data (PN or partName filled).
 */
export function photoHasSubPartData(photo: PhotoData, additionalParts: AdditionalPart[]): boolean {
  return getSubPartsForPhoto(photo, additionalParts).some(ap => ap.pn || ap.partName);
}

/**
 * Check if a photo should appear in the parts table.
 * Either has a PN filled, or has sub-parts with data.
 */
export function photoShouldBeInPartsTable(photo: PhotoData, additionalParts: AdditionalPart[]): boolean {
  return !!photo.pn || photoHasSubPartData(photo, additionalParts);
}

/**
 * Get the display PN for a photo in the parts table.
 * Returns '+++++' if no PN but has sub-parts, otherwise returns the actual PN.
 */
export function getDisplayPn(photo: PhotoData, additionalParts: AdditionalPart[]): string {
  if (photo.pn) return photo.pn;
  if (photoHasSubPartData(photo, additionalParts)) return '+++++';
  return '';
}

/**
 * Get the set of additional part IDs that have been matched to photos.
 * Used to find orphan parts that don't belong to any photo.
 */
export function getMatchedSubPartIds(photos: PhotoData[], additionalParts: AdditionalPart[]): Set<string> {
  const matched = new Set<string>();
  photos.forEach(photo => {
    getSubPartsForPhoto(photo, additionalParts).forEach(ap => matched.add(ap.id));
  });
  return matched;
}

/**
 * Get orphan sub-parts (not associated with any photo via photoId).
 * Only includes parts that have actual data (PN or partName).
 */
export function getOrphanSubParts(photos: PhotoData[], additionalParts: AdditionalPart[]): AdditionalPart[] {
  const matchedIds = getMatchedSubPartIds(photos, additionalParts);
  return additionalParts.filter(ap => !matchedIds.has(ap.id) && (ap.pn || ap.partName));
}
