import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, 'insights.ts'), 'utf8')

describe('/insights prompt references', () => {
  test('suggests DuckHive commands in generated report guidance', () => {
    expect(source).toContain('DUCKHIVE FEATURES REFERENCE')
    expect(source).toContain('duckhive mcp add <server-name> -- <command>')
    expect(source).toContain('duckhive -p "fix lint errors"')
    expect(source).not.toContain('claude mcp add <server-name> -- <command>')
    expect(source).not.toContain('claude -p "fix lint errors"')
  })
})
