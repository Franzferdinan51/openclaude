const DANGEROUS_SKIP_PERMISSION_FLAGS = new Set([
  '--dangerously-skip-permissions',
  '--yolo',
])

export function isDangerousSkipPermissionFlag(arg: string): boolean {
  return DANGEROUS_SKIP_PERMISSION_FLAGS.has(arg)
}

export function hasDangerousSkipPermissionFlag(args: readonly string[]): boolean {
  return args.some(isDangerousSkipPermissionFlag)
}

export function removeDangerousSkipPermissionFlags(args: string[]): boolean {
  let removed = false
  for (let i = args.length - 1; i >= 0; i--) {
    if (isDangerousSkipPermissionFlag(args[i]!)) {
      args.splice(i, 1)
      removed = true
    }
  }
  return removed
}
