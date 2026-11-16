import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookieName, pickLocale } from "./locales";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ locale: requested }) => {
  // `requested` is set when a caller asks for one language by name, as the
  // About page does to print the disclaimer in both. Otherwise the cookie the
  // switch writes, then the browser's languages, then the visitor's country.
  let locale = defaultLocale;

  if (isLocale(requested)) {
    locale = requested;
  } else {
    const request = await headers();
    locale = pickLocale({
      stored: (await cookies()).get(localeCookieName)?.value,
      acceptLanguage: request.get("accept-language"),
      country: request.get("x-vercel-ip-country"),
    });
  }

  return { locale, messages: loadMessages(locale) };
});
