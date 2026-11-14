import { describe, expect, it } from "vitest";
import bg from "../../messages/report.bg.json";
import en from "../../messages/report.en.json";
import {
  GLOSSARY_TERMS,
  UNIT_MODES,
} from "../../src/components/report/lib/constants";

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

function read(messages: Messages, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Messages)?.[part],
      messages,
    );
}

describe("report message files", () => {
  it("sit under one report namespace, so a merge keeps the keys", () => {
    expect(Object.keys(en)).toEqual(["report"]);
    expect(Object.keys(bg)).toEqual(["report"]);
  });

  it("carry exactly the same keys in both languages", () => {
    expect(flatten(bg as Messages).sort()).toEqual(
      flatten(en as Messages).sort(),
    );
  });

  it("leave no message empty", () => {
    for (const messages of [en, bg] as Messages[]) {
      for (const key of flatten(messages)) {
        const text = read(messages, key);
        expect(typeof text, key).toBe("string");
        expect((text as string).trim().length, key).toBeGreaterThan(0);
      }
    }
  });

  it("use the same placeholders in both languages", () => {
    for (const key of flatten(en as Messages)) {
      const names = (text: string) =>
        (text.match(/\{\w+\}/g) ?? []).slice().sort();
      expect(names(read(bg as Messages, key) as string), key).toEqual(
        names(read(en as Messages, key) as string),
      );
    }
  });

  it("name every unit mode and every glossary term", () => {
    for (const messages of [en, bg] as Messages[]) {
      for (const mode of UNIT_MODES) {
        expect(typeof read(messages, `report.unit.${mode}.label`)).toBe(
          "string",
        );
        expect(typeof read(messages, `report.unit.${mode}.short`)).toBe(
          "string",
        );
      }
      for (const term of GLOSSARY_TERMS) {
        expect(typeof read(messages, `report.glossary.${term}.term`)).toBe(
          "string",
        );
        expect(typeof read(messages, `report.glossary.${term}.text`)).toBe(
          "string",
        );
      }
    }
  });

  it("never uses an official warning word as a label (section 9)", () => {
    const banned = [
      "warning",
      "red flag",
      "code red",
      "предупреждение",
      "червен код",
    ];
    for (const messages of [en, bg] as Messages[]) {
      for (const key of flatten(messages)) {
        const text = (read(messages, key) as string).toLowerCase();
        for (const word of banned) {
          expect(text.includes(word), `${key} contains "${word}"`).toBe(false);
        }
      }
    }
  });

  it("carries no dash that reads as machine-written prose", () => {
    for (const messages of [en, bg] as Messages[]) {
      for (const key of flatten(messages)) {
        const text = read(messages, key) as string;
        expect(text.includes("—"), key).toBe(false);
        expect(text.includes("–"), key).toBe(false);
      }
    }
  });
});
