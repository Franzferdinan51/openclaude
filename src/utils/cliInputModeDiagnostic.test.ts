import { describe, expect, test } from 'bun:test'
import { detectCliInputModeWarnings } from './cliInputModeDiagnostic.js'

describe('detectCliInputModeWarnings', () => {
  test('does not warn for Windows managed stdin defaults', () => {
    expect(detectCliInputModeWarnings({}, 'win32')).toEqual([])
  })

  test('warns when Windows data stdin is forced', () => {
    const warnings = detectCliInputModeWarnings(
      { DUCKHIVE_USE_DATA_STDIN: '1' },
      'win32',
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.issue).toContain('data stdin')
    expect(warnings[0]?.fix).toContain('readable input compatibility path')
  })

  test('warns when Windows CONIN stdin diagnostics are forced', () => {
    const warnings = detectCliInputModeWarnings(
      { DUCKHIVE_USE_CONIN_STDIN: '1' },
      'win32',
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.issue).toContain('CONIN$ stdin')
    expect(warnings[0]?.fix).toContain('DUCKHIVE_USE_CONIN_STDIN')
  })

  test('does not warn for non-Windows data stdin diagnostics', () => {
    expect(
      detectCliInputModeWarnings({ DUCKHIVE_USE_DATA_STDIN: '1' }, 'linux'),
    ).toEqual([])
  })
})
