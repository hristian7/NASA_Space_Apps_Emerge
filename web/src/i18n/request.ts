import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookieName } from "./locales";

export default getRequestConfig(async ({ locale: requested }) => {
  // `requested` is set when a caller asks for one language by name, as the
  // home page does to print the disclaimer in both. Otherwise the language
  // comes from the cookie the switch writes, so the choice survives a visit.
  let locale = defaultLocale;

  if (isLocale(requested)) {
    locale = requested;
  } else {
    const stored = (await cookies()).get(localeCookieName)?.value;
    if (isLocale(stored)) {
      locale = stored;
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
