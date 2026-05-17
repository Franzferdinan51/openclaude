import { expect, test } from 'bun:test'
import {
  getLastPeerDmSummary as aliasGetLastPeerDmSummary,
  readMailbox as aliasReadMailbox,
  writeToMailbox as aliasWriteToMailbox,
} from './teammateMailbox.js'
import {
  getLastPeerDmSummary,
  readMailbox,
  writeToMailbox,
} from '../teammateMailbox.js'

test('swarm teammate mailbox path uses the real mailbox implementation', () => {
  expect(aliasReadMailbox).toBe(readMailbox)
  expect(aliasWriteToMailbox).toBe(writeToMailbox)
  expect(aliasGetLastPeerDmSummary).toBe(getLastPeerDmSummary)
})
