import type { PermissionMode } from './permissions/PermissionMode.js'

export function shouldShowDangerousModeDialog(options: {
  permissionMode: PermissionMode
  allowDangerouslySkipPermissions: boolean
  explicitDangerousMode: boolean
  hasAcceptedPrompt: boolean
}): boolean {
  if (options.explicitDangerousMode || options.hasAcceptedPrompt) {
    return false
  }

  return options.permissionMode === 'bypassPermissions' || options.allowDangerouslySkipPermissions
}
