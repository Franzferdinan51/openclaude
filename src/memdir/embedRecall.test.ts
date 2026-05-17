import { expect, test } from 'bun:test'
import { join } from 'path'
import {
  getEmbedRecallIndexDir,
  getEmbedRecallIndexPath,
  getEmbedRecallSessionsDir,
} from './embedRecall.js'

test('uses DuckHive config home for the embed recall index directory', () => {
  expect(getEmbedRecallIndexDir('C:/DuckHive')).toBe('C:/DuckHive')
  expect(getEmbedRecallIndexPath('C:/DuckHive')).toBe(
    join('C:/DuckHive', 'embed-index.json'),
  )
})

test('uses DuckHive config home for embed recall session bootstrap', () => {
  expect(getEmbedRecallSessionsDir('C:/DuckHive')).toBe(
    join('C:/DuckHive', 'sessions'),
  )
})
