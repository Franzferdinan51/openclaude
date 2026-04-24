import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  DEFAULT_DUCKHIVE_UI_SURFACE,
  getConfiguredDuckHiveUISurface,
  getPreferredDuckHiveUISurface,
  normalizeDuckHiveUISurface,
  readDuckHiveConfigSync,
  setDuckHiveUISurfacePreferenceSync,
} from './duckhiveUi.js'

let tempDir: string | undefined

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

test('normalizes supported UI aliases', () => {
  expect(normalizeDuckHiveUISurface('tui')).toBe('tui')
  expect(normalizeDuckHiveUISurface('repl')).toBe('legacy')
  expect(normalizeDuckHiveUISurface('classic')).toBe('legacy')
  expect(normalizeDuckHiveUISurface('bubbletea')).toBe('tui')
})

test('uses the configured surface when no env override is set', () => {
  expect(
    getConfiguredDuckHiveUISurface({
      ui: { defaultSurface: 'legacy' },
    }),
  ).toBe('legacy')
})

test('defaults to the classic REPL when no surface is configured', () => {
  expect(DEFAULT_DUCKHIVE_UI_SURFACE).toBe('legacy')
  expect(getConfiguredDuckHiveUISurface({})).toBe('legacy')
})

test('prefers explicit env overrides over config', () => {
  expect(
    getPreferredDuckHiveUISurface(
      { DUCKHIVE_DEFAULT_UI_SURFACE: 'tui' },
      { ui: { defaultSurface: 'legacy' } },
    ),
  ).toBe('tui')
})

test('legacy env toggle disables TUI auto launch', () => {
  expect(
    getPreferredDuckHiveUISurface(
      { DUCKHIVE_NO_AUTO_TUI: '1' },
      { ui: { defaultSurface: 'tui' } },
    ),
  ).toBe('legacy')
})

test('persists the UI preference without discarding other config keys', () => {
  tempDir = mkdtempSync(join(tmpdir(), 'duckhive-ui-'))
  const configPath = join(tempDir, 'config.json')

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        providers: { default: 'minimax' },
        ui: { defaultSurface: 'tui' },
      },
      null,
      2,
    ),
  )

  setDuckHiveUISurfacePreferenceSync('legacy', configPath)
  const saved = readDuckHiveConfigSync(configPath)

  expect(saved.providers).toEqual({ default: 'minimax' })
  expect(saved.ui).toEqual({ defaultSurface: 'legacy' })
})
