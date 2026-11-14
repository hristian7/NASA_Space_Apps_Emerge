import { describe, expect, it } from "vitest";
import bg from "../messages/bg.json";
import en from "../messages/en.json";

type Messages = Record<string, unknown>;

function flatten(value: Messages, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      return flatten(child as Messages, path);
    }
    return [path];
  });
}

describe("message files", () => {
  it("carry exactly the same keys in both languages", () => {
    const enKeys = flatten(en as Messages).sort();
    const bgKeys = flatten(bg as Messages).sort();
    expect(bgKeys).toEqual(enKeys);
  });

  it("leave no message empty", () => {
    for (const messages of [en, bg] as Messages[]) {
      for (const key of flatten(messages)) {
        const text = key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Messages)[part],
            messages,
          );
        expect(typeof text, key).toBe("string");
        expect((text as string).trim().length, key).toBeGreaterThan(0);
      }
    }
  });
});
