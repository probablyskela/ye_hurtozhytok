/**
 * A form's fields as URL search params, skipping empty ones. React Router's
 * setSearchParams reads a plain object, so a FormData passed straight in
 * becomes empty params; this converts it first.
 */
export function searchFrom(form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form))
    if (typeof value === "string" && value.trim()) params.set(key, value);
  return params;
}
