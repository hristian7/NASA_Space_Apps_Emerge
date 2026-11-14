"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName } from "./locales";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function setLocale(formData: FormData) {
  const submitted = formData.get("locale");
  const value = typeof submitted === "string" ? submitted : undefined;
  const locale = isLocale(value) ? value : defaultLocale;

  const store = await cookies();
  store.set(localeCookieName, locale, {
    path: "/",
    maxAge: oneYearInSeconds,
    sameSite: "lax",
  });

  revalidatePath("/");
}
