/**
 * Shared validation utilities for SDK-facing APIs.
 */

export function validateArrayOf<T>(
  items: unknown[],
  validator: (item: unknown, index: number) => T,
  label: string,
): T[] {
  if (!Array.isArray(items)) {
    throw new TypeError(`${label}: expected an array, got ${typeof items}`)
  }
  return items.map((item, i) => {
    try {
      return validator(item, i)
    } catch (err) {
      if (err instanceof TypeError) {
        throw new TypeError(`${label}: item at index ${i} - ${err.message}`)
      }
      throw err
    }
  })
}

export function assertNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`missing or empty '${field}' (expected non-empty string)`)
  }
}

export function assertFunction(
  value: unknown,
  field: string,
): asserts value is (...args: unknown[]) => unknown {
  if (typeof value !== 'function') {
    throw new TypeError(`missing or invalid '${field}' (expected function)`)
  }
}

export function assertObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`missing or invalid '${field}' (expected object)`)
  }
}
