import { Command } from '@commander-js/extra-typings'
import { describe, expect, test } from 'bun:test'
import mmxCommand from './index.js'
import { MMX_HELP_TEXT, registerDuckhiveMmxCommand } from './duckhiveMmxCommand.js'

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
})
