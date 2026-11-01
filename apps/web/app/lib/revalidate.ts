import type { ShouldRevalidateFunctionArgs } from "react-router";

const PHOTO = /^#photo-\d+$/;

/**
 * Opening or closing a picture («#photo-N») changes only the hash; nothing
 * on the page changed, so no data is fetched (and it works offline).
 */
export function skipForPhotoViewer({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (
    !formMethod &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search === nextUrl.search &&
    (PHOTO.test(currentUrl.hash) || PHOTO.test(nextUrl.hash))
  )
    return false;
  return defaultShouldRevalidate;
}
