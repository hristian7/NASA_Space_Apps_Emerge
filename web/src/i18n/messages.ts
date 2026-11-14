import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "./locales";

/** `<namespace>.<locale>.json`, for example `shell.bg.json`. */
const fileName = /^([a-z0-9-]+)\.([a-z]{2})\.json$/;

export const messagesDir = join(process.cwd(), "messages");

/**
 * The directory is read rather than listed in code, so a stream that adds a
 * new `<namespace>.<locale>.json` file needs no change here. `next.config.ts`
 * keeps the directory in the deployed output for the same reason.
 */
export function messageFiles(): { file: string; namespace: string; locale: string }[] {
  return readdirSync(messagesDir)
    .map((file) => ({ file, match: fileName.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => ({ file, namespace: match[1], locale: match[2] }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * A file may name its own namespace inside itself, as `report.en.json` does
 * with a single `report` key holding everything. Both shapes are accepted and
 * both end up under the file's namespace, so neither side has to change when
 * one part of the team writes a self-naming file and another writes a flat one.
 */
function unwrap(namespace: string, parsed: Record<string, unknown>): unknown {
  const keys = Object.keys(parsed);
  const only = keys.length === 1 && keys[0] === namespace ? parsed[namespace] : null;
  return only !== null && typeof only === "object" && !Array.isArray(only) ? only : parsed;
}

const cache = new Map<string, Record<string, unknown>>();

export function loadMessages(locale: Locale): Record<string, unknown> {
  // Cached only in a built app, so an edit during development shows up.
  const cached = process.env.NODE_ENV === "production" ? cache.get(locale) : undefined;
  if (cached !== undefined) return cached;

  const merged: Record<string, unknown> = {};
  for (const entry of messageFiles()) {
    if (entry.locale !== locale) continue;
    const text = readFileSync(join(messagesDir, entry.file), "utf8");
    merged[entry.namespace] = unwrap(
      entry.namespace,
      JSON.parse(text) as Record<string, unknown>,
    );
  }

  cache.set(locale, merged);
  return merged;
}
