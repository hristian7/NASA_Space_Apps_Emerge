export const looks = ["ember", "field", "ops"] as const;

export type Look = (typeof looks)[number];

export const defaultLook: Look = "ember";

/** Query parameter that switches the look, and the key the choice is kept under. */
export const lookParam = "d";
export const lookStorageKey = "emerge-look";

export function isLook(value: string | null | undefined): value is Look {
  return value !== null && value !== undefined && (looks as readonly string[]).includes(value);
}

/**
 * Runs before first paint, so a remembered look never flashes the default.
 * Kept as a string because it is inlined into the document head.
 */
export const lookBootScript = `(function(){try{var ok=${JSON.stringify(looks)};var p=new URLSearchParams(location.search).get(${JSON.stringify(lookParam)});var k=${JSON.stringify(lookStorageKey)};var v=null;if(p&&ok.indexOf(p)>=0){v=p;try{localStorage.setItem(k,p)}catch(e){}}else{try{var s=localStorage.getItem(k);if(s&&ok.indexOf(s)>=0)v=s}catch(e){}}if(v)document.documentElement.setAttribute("data-look",v)}catch(e){}})();`;
