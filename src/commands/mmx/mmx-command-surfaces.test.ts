import { Command } from '@commander-js/extra-typings'
import { describe, expect, test } from 'bun:test'
import { resolve } from 'path'
import mmxCommand from './index.js'
import { MMX_HELP_TEXT, registerDuckhiveMmxCommand } from './duckhiveMmxCommand.js'
import { findMmx, getMmxCandidatePaths } from './findMmx.js'

function isAscii(value: string): boolean {
  return [...value].every(char => char.charCodeAt(0) < 128)
}

describe('mmx command terminal surfaces', () => {
  test('slash-command metadata is ASCII-safe', () => {
    expect(mmxCommand.description).toBe(
      'MiniMax AI Platform - text, image, speech, music, video, vision, search',
    )
    expect(isAscii(mmxCommand.description)).toBe(true)
  })

  test('standalone mmx help text is ASCII-safe', () => {
    expect(MMX_HELP_TEXT).toContain('DuckHive MiniMax Integration')
    expect(MMX_HELP_TEXT).toContain('duckhive mmx text chat')
    expect(isAscii(MMX_HELP_TEXT)).toBe(true)
  })

  test('registered commander help uses ASCII description', () => {
    const program = new Command()
    program.exitOverride()
    registerDuckhiveMmxCommand(program)

    const help = program.helpInformation()

    expect(help).toContain('MiniMax AI Platform - text, image, speech, music, video,')
    expect(help).toContain('vision, search')
    expect(isAscii(help)).toBe(true)
  })

  test('MMX lookup uses Windows npm paths without literal tilde fallback', () => {
    const paths = getMmxCandidatePaths({
      env: {
        APPDATA: 'C:\\Users\\franz\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\franz\\AppData\\Local',
      },
      homeDir: 'C:\\Users\\franz',
      platform: 'win32',
    })

    expect(paths).toContain(
      resolve('C:\\Users\\franz\\AppData\\Roaming', 'npm', 'mmx.cmd'),
    )
    expect(paths).toContain(
      resolve('C:\\Users\\franz', '.npm-global', 'bin', 'mmx.cmd'),
    )
    expect(paths.some(path => path.includes('~'))).toBe(false)
  })

  test('MMX lookup honors explicit binary and otherwise falls back to executable', () => {
    expect(findMmx({
      env: { MMX_BIN: 'C:\\Tools\\mmx.cmd' },
      exists: () => false,
      homeDir: 'C:\\Users\\franz',
      platform: 'win32',
    })).toBe('C:\\Tools\\mmx.cmd')

    expect(findMmx({
      env: {},
      exists: () => false,
      homeDir: 'C:\\Users\\franz',
      platform: 'win32',
    })).toBe('mmx.cmd')
  })
})
