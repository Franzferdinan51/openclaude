import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('async agent handoff tells the main agent to stop unless work is clearly non-overlapping', () => {
  const source = readFileSync(
    join(import.meta.dir, 'AgentTool.tsx'),
    'utf8',
  )

  expect(source).toContain(
    'Briefly tell the user what you launched and end your response — agent results will arrive in a subsequent message.',
  )
  expect(source).toContain(
    'You may continue first ONLY if you have other tasks on clearly different files that this agent is not touching.',
  )
})
