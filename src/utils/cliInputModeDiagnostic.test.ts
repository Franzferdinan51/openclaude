import { describe, expect, test } from 'bun:test'
import { detectCliInputModeWarnings } from './cliInputModeDiagnostic.js'

describe('detectCliInputModeWarnings', () => {
  test('does not warn for Windows readable stdin defaults', () => {
    expect(detectCliInputModeWarnings({}, 'win32')).toEqual([])
  })

  test('warns when Windows data stdin is forced', () => {
    const warnings = detectCliInputModeWarnings(
      { DUCKHIVE_USE_DATA_STDIN: '1' },
      'win32',
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.issue).toContain('data stdin')
    expect(warnings[0]?.fix).toContain('typing does not appear')
  })

  test('warns when Windows readable stdin is disabled', () => {
    const warnings = detectCliInputModeWarnings(
      { DUCKHIVE_USE_READABLE_STDIN: '0' },
      'win32',
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.issue).toContain('readable stdin')
    expect(warnings[0]?.fix).toContain('restore interactive typing')
  })

  test('does not warn for non-Windows data stdin diagnostics', () => {
    expect(
      detectCliInputModeWarnings({ DUCKHIVE_USE_DATA_STDIN: '1' }, 'linux'),
    ).toEqual([])
  })
})
