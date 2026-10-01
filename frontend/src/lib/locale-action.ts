"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, isLocale } from "./i18n";

/** Remembers the visitor's language for a year. */
export async function setLocaleCookie(value: string) {
  if (!isLocale(value)) return;
  const store = await cookies();
  store.set(LANG_COOKIE, value, {
    path: "/",
    maxAge: LANG_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
