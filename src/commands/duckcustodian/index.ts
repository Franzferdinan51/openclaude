/**
 * DuckCustodian command — DuckHive's self-repair and configuration helper.
 * Pattern from OpenClaw's Crestodian, adapted for DuckHive.
 */
import type { Command } from '../../commands.js';

const duckcustodian: Command = {
  type: 'local',
  name: 'duckcustodian',
  description:
    'DuckHive self-repair: diagnostics, health probes, config validation, setup bootstrap, memory management, and rescue mode',
  aliases: ['custodian', 'custodian'],
  supportsNonInteractive: true,
  load() {
    return import('./impl.js');
  },
};

export default duckcustodian;
