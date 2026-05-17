/**
 * Converts Zod v4 schemas to JSON Schema using native toJSONSchema.
 */

import { toJSONSchema, type ZodTypeAny } from 'zod/v4'

export type JsonSchema7Type = Record<string, unknown>

// toolToAPISchema() runs this for every tool on every API request (~60-250
// times/turn). Tool schemas are wrapped with lazySchema() which guarantees the
// same ZodTypeAny reference per session, so we can cache by identity.
const cache = new WeakMap<ZodTypeAny, JsonSchema7Type>()
const emptyObjectSchema: JsonSchema7Type = { type: 'object', properties: {} }

function isZodV4Schema(schema: unknown): schema is ZodTypeAny {
  return (
    !!schema &&
    typeof schema === 'object' &&
    '_zod' in schema &&
    typeof (schema as { _zod?: unknown })._zod === 'object'
  )
}

function isJsonSchemaObject(schema: unknown): schema is JsonSchema7Type {
  return (
    !!schema &&
    typeof schema === 'object' &&
    ('type' in schema || 'properties' in schema || '$schema' in schema)
  )
}

/**
 * Converts a Zod v4 schema to JSON Schema format.
 */
export function zodToJsonSchema(schema: unknown): JsonSchema7Type {
  if (!schema) return emptyObjectSchema

  if (isJsonSchemaObject(schema) && !isZodV4Schema(schema)) {
    return schema
  }

  if (!isZodV4Schema(schema)) {
    return emptyObjectSchema
  }

  const hit = cache.get(schema)
  if (hit) return hit
  const result = toJSONSchema(schema) as JsonSchema7Type
  cache.set(schema, result)
  return result
}
