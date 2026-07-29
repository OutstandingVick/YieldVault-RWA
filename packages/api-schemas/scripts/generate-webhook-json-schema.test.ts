import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  WEBHOOK_SCHEMA_VERSION,
  WebhookEnvelopeSchema,
  WebhookEventPayloadSchemas,
} from "../src/webhookEvents";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, "..", "..", "..", "docs", "schemas", "webhooks");

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, filename), "utf8"));
}

/**
 * Guards against the committed JSON Schema catalog (docs/schemas/webhooks/)
 * drifting from the Zod schemas that generate it. If this test fails, run
 * `npm run schemas:generate` in packages/api-schemas and commit the diff.
 */
describe("generated webhook JSON Schema catalog", () => {
  it("envelope.schema.json matches the current WebhookEnvelopeSchema", () => {
    const committed = readJson("envelope.schema.json");
    const fresh = z.toJSONSchema(WebhookEnvelopeSchema);
    expect(committed).toEqual(fresh);
  });

  it("catalog.json lists every event type with a matching payload schema file", () => {
    const catalog = readJson("catalog.json") as {
      schemaVersion: number;
      events: Array<{ eventType: string; payloadSchema: string }>;
    };

    expect(catalog.schemaVersion).toBe(WEBHOOK_SCHEMA_VERSION);

    const catalogedTypes = catalog.events.map((e) => e.eventType).sort();
    const actualTypes = Object.keys(WebhookEventPayloadSchemas).sort();
    expect(catalogedTypes).toEqual(actualTypes);

    for (const [eventType, schema] of Object.entries(WebhookEventPayloadSchemas)) {
      const committed = readJson(`${eventType}.payload.schema.json`);
      expect(committed).toEqual(z.toJSONSchema(schema));
    }
  });
});
