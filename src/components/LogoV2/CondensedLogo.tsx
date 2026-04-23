import * as React from 'react';
import { useEffect } from 'react';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text } from '../../ink.js';
import { useAppState } from '../../state/AppState.js';
import { getEffortSuffix } from '../../utils/effort.js';
import { truncate } from '../../utils/format.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import {
  formatModelAndBilling,
  getLogoDisplayData,
  truncatePath,
} from '../../utils/logoV2Utils.js';
import { renderModelSetting } from '../../utils/model/model.js';
import { OffscreenFreeze } from '../OffscreenFreeze.js';
import { AnimatedClawd } from './AnimatedClawd.js';
import { Clawd } from './Clawd.js';
import {
  GuestPassesUpsell,
  incrementGuestPassesSeenCount,
  useShowGuestPassesUpsell,
} from './GuestPassesUpsell.js';
import {
  incrementOverageCreditUpsellSeenCount,
  OverageCreditUpsell,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js';

function CondensedRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactNode {
  return (
    <Text wrap="truncate">
      <Text color="inactive">{label.padEnd(8)}</Text>
      <Text dimColor> {value}</Text>
    </Text>
  );
}

export function CondensedLogo(): React.ReactNode {
  const { columns } = useTerminalSize();
  const agent = useAppState(s => s.agent);
  const effortValue = useAppState(s => s.effortValue);
  const model = useMainLoopModel();
  const modelDisplayName = renderModelSetting(model);
  const { version, cwd, billingType, agentName: agentNameFromSettings } =
    getLogoDisplayData();
  const agentName = agent ?? agentNameFromSettings;
  const showGuestPassesUpsell = useShowGuestPassesUpsell();
  const showOverageCreditUpsell = useShowOverageCreditUpsell();

  useEffect(() => {
    if (showGuestPassesUpsell) {
      incrementGuestPassesSeenCount();
    }
  }, [showGuestPassesUpsell]);

  useEffect(() => {
    if (showOverageCreditUpsell && !showGuestPassesUpsell) {
      incrementOverageCreditUpsellSeenCount();
    }
  }, [showGuestPassesUpsell, showOverageCreditUpsell]);

  const textWidth = Math.max(columns - 18, 24);
  const truncatedVersion = truncate(version, Math.max(textWidth - 12, 6));
  const effortSuffix = getEffortSuffix(model, effortValue);
  const { shouldSplit, truncatedModel, truncatedBilling } = formatModelAndBilling(
    modelDisplayName + effortSuffix,
    billingType,
    textWidth,
  );
  const cwdWidth = agentName ? textWidth - agentName.length - 4 : textWidth;
  const compactPath = agentName
    ? `@${agentName} · ${truncatePath(cwd, Math.max(cwdWidth, 10))}`
    : truncatePath(cwd, Math.max(textWidth, 10));
  const flowLabel = `${
    isFullscreenEnvEnabled() ? 'fullscreen repl' : 'scrollback repl'
  } · ${(process.env.DUCKHIVE_META_ENABLED !== 'false' ? 'meta' : 'direct')} · ${
    process.env.DUCKHIVE_MAX_CONCURRENT || '3'
  } agents`;

  return (
    <OffscreenFreeze>
      <Box
        borderStyle="round"
        borderColor="inactive"
        paddingX={2}
        paddingY={0}
        flexDirection="row"
        gap={2}
        alignItems="center"
      >
        <Box flexDirection="column" alignItems="center">
          <Text color="inactive">•</Text>
          {isFullscreenEnvEnabled() ? <AnimatedClawd /> : <Clawd />}
          <Text color="inactive">•</Text>
        </Box>
        <Box flexDirection="column" flexShrink={1}>
          <Text>
            <Text color="claude">DuckHive</Text>
            <Text dimColor> v{truncatedVersion}</Text>
          </Text>
          <Text dimColor>Capability-first coding shell</Text>
          {shouldSplit ? (
            <>
              <CondensedRow label="Model" value={truncatedModel} />
              <CondensedRow label="Mode" value={truncatedBilling} />
            </>
          ) : (
            <CondensedRow
              label="Model"
              value={`${truncatedModel} · ${truncatedBilling}`}
            />
          )}
          <CondensedRow label="Path" value={compactPath} />
          <CondensedRow label="Flow" value={flowLabel} />
          {showGuestPassesUpsell ? <GuestPassesUpsell /> : null}
          {!showGuestPassesUpsell && showOverageCreditUpsell ? (
            <OverageCreditUpsell maxWidth={textWidth} twoLine={true} />
          ) : null}
        </Box>
      </Box>
    </OffscreenFreeze>
  );
}
