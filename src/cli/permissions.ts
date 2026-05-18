import {
  buildPermissionProfileSettings,
  parsePermissionProfileCommand,
  renderPermissionProfileApplied,
  renderPermissionProfileHelp,
  renderPermissionProfileList,
  renderPermissionProfileStatus,
} from '../commands/permissions/permission-profiles.js'
import {
  getSettings_DEPRECATED,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

export async function permissionsHandler(args: readonly string[]): Promise<void> {
  const parsed = parsePermissionProfileCommand(args.join(' '))
  if (!parsed) {
    process.stdout.write(`${renderPermissionProfileHelp()}\n`)
    return
  }

  switch (parsed.action) {
    case 'help':
      process.stdout.write(`${renderPermissionProfileHelp()}\n`)
      return
    case 'list':
      process.stdout.write(`${renderPermissionProfileList()}\n`)
      return
    case 'status':
      process.stdout.write(
        `${renderPermissionProfileStatus(getSettings_DEPRECATED())}\n`,
      )
      return
    case 'error':
      process.stderr.write(`${parsed.message}\n`)
      process.exitCode = 1
      return
    case 'apply': {
      const result = updateSettingsForSource(
        parsed.source,
        buildPermissionProfileSettings(parsed.profile),
      )
      if (result.error) {
        process.stderr.write(
          `Failed to apply permission profile: ${result.error.message}\n`,
        )
        process.exitCode = 1
        return
      }
      process.stdout.write(
        `${renderPermissionProfileApplied(parsed.profile, parsed.source)}\n`,
      )
      return
    }
  }
}
