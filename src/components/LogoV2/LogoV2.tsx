import * as React from 'react';
import { feature } from 'bun:bundle';
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, color } from '../../ink.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { stringWidth } from '../../ink/stringWidth.js';
import {
  calculateLayoutDimensions,
  calculateOptimalLeftWidth,
  formatWelcomeMessage,
  getLayoutMode,
  getLogoDisplayData,
  getRecentActivitySync,
  getRecentReleaseNotesSync,
  truncatePath,
} from '../../utils/logoV2Utils.js';
import { truncate } from '../../utils/format.js';
import { getDisplayPath } from '../../utils/file.js';
import { Clawd } from './Clawd.js';
import { FeedColumn } from './FeedColumn.js';
import {
  createGuestPassesFeed,
  createProjectOnboardingFeed,
  createRecentActivityFeed,
  createWhatsNewFeed,
} from './feedConfigs.js';
import { getGlobalConfig, saveGlobalConfig } from 'src/utils/config.js';
import { resolveThemeSetting } from 'src/utils/systemTheme.js';
import { getInitialSettings } from 'src/utils/settings/settings.js';
import { getDebugLogPath, isDebugMode, isDebugToStdErr } from 'src/utils/debug.js';
import {
  getSteps,
  incrementProjectOnboardingSeenCount,
  shouldShowProjectOnboarding,
} from '../../projectOnboardingState.js';
import { CondensedLogo } from './CondensedLogo.js';
import { OffscreenFreeze } from '../OffscreenFreeze.js';
import { checkForReleaseNotesSync } from '../../utils/releaseNotes.js';
import { getDumpPromptsPath } from 'src/services/api/dumpPrompts.js';
import { isEnvTruthy } from 'src/utils/envUtils.js';
import {
  getStartupPerfLogPath,
  isDetailedProfilingEnabled,
} from 'src/utils/startupProfiler.js';
import { EmergencyTip } from './EmergencyTip.js';
import { VoiceModeNotice } from './VoiceModeNotice.js';
import { Opus1mMergeNotice } from './Opus1mMergeNotice.js';
import { SandboxManager } from 'src/utils/sandbox/sandbox-adapter.js';
import {
  incrementGuestPassesSeenCount,
  useShowGuestPassesUpsell,
} from './GuestPassesUpsell.js';
import {
  createOverageCreditFeed,
  incrementOverageCreditUpsellSeenCount,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js';
import { useAppState } from '../../state/AppState.js';
import { getEffortSuffix } from '../../utils/effort.js';
import { getAPIProvider } from '../../utils/model/providers.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { renderModelSetting } from '../../utils/model/model.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const ChannelsNoticeModule =
  feature('KAIROS') || feature('KAIROS_CHANNELS')
    ? (require('./ChannelsNotice.js') as typeof import('./ChannelsNotice.js'))
    : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const LEFT_PANEL_MAX_WIDTH = 52;

type AccentTone =
  | 'claude'
  | 'inactive'
  | 'suggestion'
  | 'success'
  | 'warning'
  | 'text';

function InfoRow({
  label,
  value,
  tone = 'text',
}: {
  label: string;
  value: string;
  tone?: AccentTone;
}): React.ReactNode {
  return (
    <Text wrap="truncate">
      <Text color="inactive">{label.padEnd(11)}</Text>
      <Text color={tone}>{value}</Text>
    </Text>
  );
}

function MiniCard({
  title,
  borderColor = 'inactive',
  children,
}: {
  title: string;
  borderColor?: AccentTone;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      flexDirection="column"
      gap={0}
    >
      <Text color="inactive">{title}</Text>
      {children}
    </Box>
  );
}

function renderAuxiliaryNotices(
  showSandboxStatus: boolean,
  announcement: string | undefined,
  showAccountIdentity: boolean,
  organizationName: string | undefined,
): React.ReactNode {
  return (
    <>
      <VoiceModeNotice />
      <Opus1mMergeNotice />
      {ChannelsNoticeModule ? <ChannelsNoticeModule.ChannelsNotice /> : null}
      {isDebugMode() ? (
        <Box paddingLeft={2} flexDirection="column">
          <Text color="warning">Debug mode enabled</Text>
          <Text dimColor>
            Logging to: {isDebugToStdErr() ? 'stderr' : getDebugLogPath()}
          </Text>
        </Box>
      ) : null}
      <EmergencyTip />
      {process.env.CLAUDE_CODE_TMUX_SESSION ? (
        <Box paddingLeft={2} flexDirection="column">
          <Text dimColor>tmux session: {process.env.CLAUDE_CODE_TMUX_SESSION}</Text>
          <Text dimColor>
            {process.env.CLAUDE_CODE_TMUX_PREFIX_CONFLICTS
              ? `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} ${process.env.CLAUDE_CODE_TMUX_PREFIX} d (press prefix twice - DuckHive uses ${process.env.CLAUDE_CODE_TMUX_PREFIX})`
              : `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} d`}
          </Text>
        </Box>
      ) : null}
      {announcement ? (
        <Box paddingLeft={2} flexDirection="column">
          {showAccountIdentity && organizationName ? (
            <Text dimColor>Message from {organizationName}:</Text>
          ) : null}
          <Text>{announcement}</Text>
        </Box>
      ) : null}
      {showSandboxStatus ? (
        <Box paddingLeft={2} flexDirection="column">
          <Text color="warning">
            Bash commands are sandboxed. Disable with `/sandbox`.
          </Text>
        </Box>
      ) : null}
      {false && !process.env.DEMO_VERSION ? (
        <Box paddingLeft={2} flexDirection="column">
          <Text dimColor>Use /issue to report model behavior issues</Text>
        </Box>
      ) : null}
      {false && !process.env.DEMO_VERSION ? (
        <Box paddingLeft={2} flexDirection="column">
          <Text color="warning">[internal] Logs:</Text>
          <Text dimColor>API calls: {getDisplayPath(getDumpPromptsPath())}</Text>
          <Text dimColor>Debug logs: {getDisplayPath(getDebugLogPath())}</Text>
          {isDetailedProfilingEnabled() ? (
            <Text dimColor>
              Startup Perf: {getDisplayPath(getStartupPerfLogPath())}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </>
  );
}

export function LogoV2(): React.ReactNode {
  const activities = getRecentActivitySync();
  const showAccountIdentity = getAPIProvider() === 'firstParty';
  const username = showAccountIdentity
    ? getGlobalConfig().oauthAccount?.displayName ?? ''
    : '';
  const { columns } = useTerminalSize();
  const showOnboarding = shouldShowProjectOnboarding();
  const showSandboxStatus = SandboxManager.isSandboxingEnabled();
  const showGuestPassesUpsell = useShowGuestPassesUpsell();
  const showOverageCreditUpsell = useShowOverageCreditUpsell();
  const agent = useAppState(s => s.agent);
  const effortValue = useAppState(s => s.effortValue);
  const config = getGlobalConfig();

  let changelog;
  try {
    changelog = getRecentReleaseNotesSync(3);
  } catch {
    changelog = [];
  }

  const [announcement] = useState(() => {
    const announcements = getInitialSettings().companyAnnouncements;
    if (!announcements || announcements.length === 0) {
      return undefined;
    }
    return config.numStartups === 1
      ? announcements[0]
      : announcements[Math.floor(Math.random() * announcements.length)];
  });

  const { hasReleaseNotes } = checkForReleaseNotesSync(config.lastReleaseNotesSeen);

  useEffect(() => {
    const currentConfig = getGlobalConfig();
    if (currentConfig.lastReleaseNotesSeen === MACRO.VERSION) {
      return;
    }
    saveGlobalConfig(current => {
      if (current.lastReleaseNotesSeen === MACRO.VERSION) {
        return current;
      }
      return {
        ...current,
        lastReleaseNotesSeen: MACRO.VERSION,
      };
    });
    if (showOnboarding) {
      incrementProjectOnboardingSeenCount();
    }
  }, [showOnboarding]);

  const isCondensedMode =
    !hasReleaseNotes &&
    !showOnboarding &&
    !isEnvTruthy(process.env.CLAUDE_CODE_FORCE_FULL_LOGO);

  useEffect(() => {
    if (showGuestPassesUpsell && !showOnboarding && !isCondensedMode) {
      incrementGuestPassesSeenCount();
    }
  }, [isCondensedMode, showGuestPassesUpsell, showOnboarding]);

  useEffect(() => {
    if (
      showOverageCreditUpsell &&
      !showOnboarding &&
      !showGuestPassesUpsell &&
      !isCondensedMode
    ) {
      incrementOverageCreditUpsellSeenCount();
    }
  }, [
    isCondensedMode,
    showGuestPassesUpsell,
    showOnboarding,
    showOverageCreditUpsell,
  ]);

  const model = useMainLoopModel();
  const fullModelDisplayName = renderModelSetting(model);
  const { version, cwd, billingType, agentName: agentNameFromSettings } =
    getLogoDisplayData();
  const agentName = agent ?? agentNameFromSettings;
  const effortSuffix = getEffortSuffix(model, effortValue);
  const modelDisplayName = truncate(
    fullModelDisplayName + effortSuffix,
    LEFT_PANEL_MAX_WIDTH - 18,
  );

  const notices = renderAuxiliaryNotices(
    showSandboxStatus,
    announcement,
    showAccountIdentity,
    config.oauthAccount?.organizationName,
  );

  if (isCondensedMode) {
    return (
      <>
        <CondensedLogo />
        {notices}
      </>
    );
  }

  const layoutMode = getLayoutMode(columns);
  const userTheme = resolveThemeSetting(getGlobalConfig().theme);
  const borderTitle = ` ${color('text', userTheme)('DuckHive')} ${color(
    'inactive',
    userTheme,
  )(`v${version}`)} `;
  const compactBorderTitle = color('text', userTheme)(' DuckHive ');

  const welcomeMessage = formatWelcomeMessage(username);
  const modelLine =
    showAccountIdentity &&
    !process.env.IS_DEMO &&
    config.oauthAccount?.organizationName
      ? `${modelDisplayName} · ${billingType} · ${config.oauthAccount.organizationName}`
      : `${modelDisplayName} · ${billingType}`;
  const cwdWidth = agentName
    ? LEFT_PANEL_MAX_WIDTH - stringWidth(agentName) - 4
    : LEFT_PANEL_MAX_WIDTH;
  const cwdLine = agentName
    ? `@${agentName} · ${truncatePath(cwd, Math.max(cwdWidth, 10))}`
    : truncatePath(cwd, LEFT_PANEL_MAX_WIDTH);

  const metaEnabled = process.env.DUCKHIVE_META_ENABLED !== 'false';
  const councilEnabled = process.env.DUCKHIVE_COUNCIL_ENABLED !== 'false';
  const fallbackEnabled = process.env.DUCKHIVE_FALLBACK_ENABLED !== 'false';
  const maxAgents = process.env.DUCKHIVE_MAX_CONCURRENT || '3';
  const optimalLeftWidth = Math.max(
    44,
    calculateOptimalLeftWidth(welcomeMessage, cwdLine, modelLine) + 2,
  );
  const { leftWidth, rightWidth, totalWidth } = calculateLayoutDimensions(
    columns,
    layoutMode,
    optimalLeftWidth,
  );

  const quickActions = useMemo(
    () => [
      { command: '/help', detail: 'commands, shortcuts, provider state' },
      { command: '/agents', detail: 'spawn teams and delegate work' },
      { command: '/mcp', detail: 'inspect servers and tool inventory' },
      { command: 'Ctrl+X', detail: 'toggle shell mode without leaving REPL' },
    ],
    [],
  );

  const capabilityLines = useMemo(
    () => [
      'Agent teams, councils, fallback routing',
      'Shell, MCP, browser, desktop, and media jobs',
      'Codex, Gemini, Kimi, MiniMax style workflows',
    ],
    [],
  );

  const feedSet = showOnboarding
    ? [createProjectOnboardingFeed(getSteps()), createRecentActivityFeed(activities)]
    : showGuestPassesUpsell
      ? [createRecentActivityFeed(activities), createGuestPassesFeed()]
      : showOverageCreditUpsell
        ? [createRecentActivityFeed(activities), createOverageCreditFeed()]
        : [createRecentActivityFeed(activities), createWhatsNewFeed(changelog)];

  if (layoutMode === 'compact') {
    const compactWelcome =
      stringWidth(welcomeMessage) > columns - 8
        ? formatWelcomeMessage(null)
        : welcomeMessage;
    const compactPathWidth = agentName
      ? columns - stringWidth(agentName) - 10
      : columns - 8;
    const compactPath = agentName
      ? `@${agentName} · ${truncatePath(cwd, Math.max(compactPathWidth, 10))}`
      : truncatePath(cwd, Math.max(columns - 8, 10));

    return (
      <>
        <OffscreenFreeze>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="inactive"
            borderText={{
              content: compactBorderTitle,
              position: 'top',
              align: 'start',
              offset: 1,
            }}
            paddingX={1}
            paddingY={1}
            gap={1}
            width={Math.max(columns - 2, 32)}
          >
            <MiniCard title="Control Deck" borderColor="claude">
              <Text>
                <Text color="claude">DuckHive</Text>
                <Text dimColor> capability-first shell</Text>
              </Text>
              <Text dimColor>{compactWelcome}</Text>
            </MiniCard>
            <Box justifyContent="center">
              <Clawd />
            </Box>
            <MiniCard title="Session">
              <InfoRow label="model" value={modelLine} tone="text" />
              <InfoRow label="workspace" value={compactPath} tone="text" />
              <InfoRow
                label="execution"
                value={showSandboxStatus ? 'sandboxed shell' : 'direct shell'}
                tone={showSandboxStatus ? 'warning' : 'success'}
              />
              <InfoRow
                label="orchestrator"
                value={`${metaEnabled ? 'meta' : 'direct'} · ${
                  councilEnabled ? 'council' : 'solo'
                } · max ${maxAgents}`}
              />
            </MiniCard>
            <MiniCard title="Launchpad">
              <Text>
                <Text color="claude">/help</Text>
                <Text dimColor> commands and shortcuts</Text>
              </Text>
              <Text>
                <Text color="claude">/agents</Text>
                <Text dimColor> team orchestration</Text>
              </Text>
              <Text>
                <Text color="claude">Ctrl+X</Text>
                <Text dimColor> shell mode toggle</Text>
              </Text>
            </MiniCard>
          </Box>
        </OffscreenFreeze>
        {notices}
      </>
    );
  }

  return (
    <>
      <OffscreenFreeze>
        <Box
          borderStyle="round"
          borderColor="inactive"
          borderText={{
            content: borderTitle,
            position: 'top',
            align: 'start',
            offset: 3,
          }}
          flexDirection="column"
          width={Math.min(totalWidth, columns - 2)}
          paddingX={1}
          paddingY={0}
        >
          <Box flexDirection="row" gap={1}>
            <Box width={leftWidth} flexDirection="column" gap={1}>
              <MiniCard title="DuckHive Control Deck" borderColor="claude">
                <Text>
                  <Text color="claude">DuckHive</Text>
                  <Text dimColor> capability-first command shell</Text>
                </Text>
                <Text dimColor>{welcomeMessage}</Text>
                <Text dimColor>
                  Crush-style session framing on top of the OpenClaude base, with
                  DuckHive orchestration across the full harness.
                </Text>
              </MiniCard>

              <Box justifyContent="center" marginY={0}>
                <Clawd />
              </Box>

              <MiniCard title="Session State">
                <InfoRow label="model" value={modelLine} />
                <InfoRow label="workspace" value={cwdLine} />
                <InfoRow
                  label="execution"
                  value={showSandboxStatus ? 'sandboxed shell' : 'direct shell'}
                  tone={showSandboxStatus ? 'warning' : 'success'}
                />
                <InfoRow
                  label="orchestrator"
                  value={`${metaEnabled ? 'meta routing' : 'direct routing'} · ${
                    councilEnabled ? 'council' : 'solo'
                  } · max ${maxAgents}`}
                />
              </MiniCard>

              <MiniCard title="Capability Grid">
                {capabilityLines.map(line => (
                  <Text key={line}>
                    <Text color="success">● </Text>
                    {line}
                  </Text>
                ))}
                <Text>
                  <Text color={fallbackEnabled ? 'suggestion' : 'inactive'}>
                    {fallbackEnabled ? '● ' : '○ '}
                  </Text>
                  model fallback and self-healing agents
                </Text>
              </MiniCard>
            </Box>

            <Box width={Math.max(30, rightWidth)} flexDirection="column" gap={1}>
              <MiniCard title="Launchpad" borderColor="suggestion">
                {quickActions.map(action => (
                  <Text key={action.command}>
                    <Text color="claude">{action.command}</Text>
                    <Text dimColor> {action.detail}</Text>
                  </Text>
                ))}
              </MiniCard>
              <FeedColumn
                feeds={feedSet}
                maxWidth={Math.max(28, rightWidth - 2)}
              />
            </Box>
          </Box>
        </Box>
      </OffscreenFreeze>
      {notices}
    </>
  );
}
