import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const fileName = /^([a-z0-9-]+)\.([a-z]{2})\.json$/;

type Messages = Record<string, unknown>;

/**
 * The directory is read rather than listed here, so a namespace added by any
 * part of the team is checked without this file changing.
 */
function namespaceFiles(): { file: string; namespace: string; locale: string }[] {
  return readdirSync(messagesDir)
    .map((file) => ({ file, match: fileName.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => ({ file, namespace: match[1], locale: match[2] }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

function read(file: string): Messages {
  return JSON.parse(readFileSync(join(messagesDir, file), "utf8")) as Messages;
}

function flatten(value: Messages, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      return flatten(child as Messages, path);
    }
    return [path];
  });
}

function textAt(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Messages)[part], messages);
}

const files = namespaceFiles();
const namespaces = [...new Set(files.map((entry) => entry.namespace))].sort();
const locales = ["en", "bg"];

describe("message files", () => {
  it("exist, with no stray file names", () => {
    expect(files.length).toBeGreaterThan(0);
    const unexpected = readdirSync(messagesDir).filter((file) => !fileName.test(file));
    expect(unexpected).toEqual([]);
  });

  it.each(namespaces)("namespace %s has a file in every language", (namespace) => {
    const found = files.filter((entry) => entry.namespace === namespace).map((entry) => entry.locale);
    expect(found.sort()).toEqual([...locales].sort());
  });

  it.each(namespaces)("namespace %s carries the same keys in both languages", (namespace) => {
    const [first, second] = locales.map((locale) =>
      flatten(read(`${namespace}.${locale}.json`)).sort(),
    );
    expect(second).toEqual(first);
  });

  it.each(files.map((entry) => entry.file))("%s leaves no message empty", (file) => {
    const messages = read(file);
    for (const key of flatten(messages)) {
      const text = textAt(messages, key);
      expect(typeof text, key).toBe("string");
      expect((text as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it.each(files.map((entry) => entry.file))("%s uses no dashes that read as machine writing", (file) => {
    const raw = readFileSync(join(messagesDir, file), "utf8");
    expect(raw.includes("—"), "em dash").toBe(false);
    expect(raw.includes("–"), "en dash").toBe(false);
  });

  it.each(files.map((entry) => entry.file))("%s avoids official warning words", (file) => {
    const raw = readFileSync(join(messagesDir, file), "utf8").toLowerCase();
    // Specification section 9. These two never belong in our wording at all.
    for (const banned of ["red flag", "code red"]) {
      expect(raw.includes(banned), banned).toBe(false);
    }
    // "Warning" is banned as a label. Saying in a sentence that this is not an
    // official warning is exactly what section 9 asks for, so only short
    // standalone messages are checked.
    const messages = read(file);
    for (const key of flatten(messages)) {
      const text = String(textAt(messages, key)).trim();
      const words = text.split(/\s+/).length;
      if (words > 3) continue;
      expect(/\bwarning|предупреждени/i.test(text), `${key}: ${text}`).toBe(false);
    }
  });
});
