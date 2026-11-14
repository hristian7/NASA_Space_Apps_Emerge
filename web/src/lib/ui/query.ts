/**
 * Query-string edits that keep what is already there exactly as typed.
 * `URLSearchParams` would re-encode the separators the selection uses, so the
 * address bar would stop being readable.
 */
function parts(search: string): string[] {
  return search.replace(/^\?/, "").split("&").filter((part) => part !== "");
}

function without(search: string, key: string): string[] {
  return parts(search).filter((part) => part !== key && !part.startsWith(`${key}=`));
}

export function setQueryParam(search: string, key: string, value: string): string {
  const kept = [...without(search, key), `${key}=${value}`];
  return `?${kept.join("&")}`;
}

export function removeQueryParam(search: string, key: string): string {
  const kept = without(search, key);
  return kept.length === 0 ? "" : `?${kept.join("&")}`;
}
