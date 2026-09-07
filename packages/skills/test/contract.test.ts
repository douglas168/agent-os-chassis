import { describe, it, expect } from "vitest";
import { z } from "zod";
import { describeConfigFields } from "../src/contract";

describe("describeConfigFields", () => {
  it("describes a string field, marking it optional", () => {
    const schema = z.object({ reminderToneHint: z.string().max(200).optional() });
    expect(describeConfigFields(schema)).toEqual([
      { name: "reminderToneHint", type: "string", optional: true },
    ]);
  });

  it("describes required number and boolean fields", () => {
    const schema = z.object({ retryCount: z.number(), notifyOnFail: z.boolean() });
    expect(describeConfigFields(schema)).toEqual([
      { name: "retryCount", type: "number", optional: false },
      { name: "notifyOnFail", type: "boolean", optional: false },
    ]);
  });

  it("unwraps a defaulted field to its base type, not marking it optional", () => {
    const schema = z.object({ retries: z.number().default(3) });
    expect(describeConfigFields(schema)).toEqual([
      { name: "retries", type: "number", optional: false },
    ]);
  });

  it("returns an empty list for a non-object schema", () => {
    expect(describeConfigFields(z.string())).toEqual([]);
  });
});
