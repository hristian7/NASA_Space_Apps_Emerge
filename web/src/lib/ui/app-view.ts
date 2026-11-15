/**
 * Which view the shell opens, read from the address bar.
 *
 *   v=f        Forecast
 *   v=h        History
 *   no v       Forecast, the main view; except a link that names a place
 *              (`sel=`), which is a share link from before Forecast came
 *              first, when no `v` meant History, so it still opens History.
 *
 * The shell writes the view back explicitly on arrival and on every switch,
 * so links copied from now on always carry `v`.
 */
export type AppView = "history" | "forecast";

export const viewParam = "v";

export function viewFromSearch(search: string): AppView {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = params.get(viewParam);
  if (value === "f") return "forecast";
  if (value === "h") return "history";
  return params.has("sel") ? "history" : "forecast";
}

export function viewValue(view: AppView): "f" | "h" {
  return view === "forecast" ? "f" : "h";
}
