import { createCliLocalCommandContext } from './localCommandContext.js'

function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes('--help') || args.includes('-h')
}

function normalizeSkillArgs(args: readonly string[]): string {
  if (hasHelpFlag(args)) {
    return ''
  }

  return args.join(' ')
}

async function runSkillCommand(args: readonly string[]): Promise<void> {
  const { call } = await import('../commands/skill/skill-impl.js')
  const result = await call(normalizeSkillArgs(args), createCliLocalCommandContext())

  if (result.type === 'text' && result.value.trim().length > 0) {
    process.stdout.write(`${result.value}\n`)
  }
}

export async function skillHandler(args: readonly string[]): Promise<void> {
  await runSkillCommand(args)
}

export async function skillsHandler(args: readonly string[]): Promise<void> {
  if (hasHelpFlag(args)) {
    await runSkillCommand([])
    return
  }

  if (args.length === 0) {
    await runSkillCommand(['list'])
    return
  }

  await runSkillCommand(args)
}
