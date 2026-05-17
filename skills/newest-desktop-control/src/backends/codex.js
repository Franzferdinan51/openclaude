import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const PLUGIN_NAME = 'computer-use';
const CODEX_APP_BUNDLE = 'Codex Computer Use.app';
const CLIENT_RELATIVE_PATH = join(
  CODEX_APP_BUNDLE,
  'Contents',
  'SharedSupport',
  'SkyComputerUseClient.app',
  'Contents',
  'MacOS',
  'SkyComputerUseClient',
);
const CLIENT_LEGACY_RELATIVE_PATH = join(
  CODEX_APP_BUNDLE,
  'Contents',
  'MacOS',
  'SkyComputerUseClient',
);
const SERVICE_RELATIVE_PATH = join(
  CODEX_APP_BUNDLE,
  'Contents',
  'MacOS',
  'SkyComputerUseService',
);

const SYSTEM_CODEX_PLUGIN_ROOT = join(
  '/Applications',
  'Codex.app',
  'Contents',
  'Resources',
  'plugins',
  'openai-bundled',
  'plugins',
  PLUGIN_NAME,
);

function pluginRootsFromEnv(env = process.env) {
  return [
    env.DUCKHIVE_CODEX_COMPUTER_USE_PLUGIN_DIR,
    env.CODEX_COMPUTER_USE_PLUGIN_DIR,
  ].filter(Boolean);
}

function clientPathsFromEnv(env = process.env) {
  return [
    env.DUCKHIVE_CODEX_COMPUTER_USE_CLIENT,
    env.CODEX_COMPUTER_USE_CLIENT,
  ].filter(Boolean);
}

export function getCandidateCodexComputerUsePluginRoots(env = process.env) {
  return [
    ...pluginRootsFromEnv(env),
    join(process.cwd(), 'packages', 'computer-use-bundle', PLUGIN_NAME),
    SYSTEM_CODEX_PLUGIN_ROOT,
    join(
      homedir(),
      'Applications',
      'Codex.app',
      'Contents',
      'Resources',
      'plugins',
      'openai-bundled',
      'plugins',
      PLUGIN_NAME,
    ),
    join(
      homedir(),
      '.codex',
      '.tmp',
      'bundled-marketplaces',
      'openai-bundled',
      'plugins',
      PLUGIN_NAME,
    ),
    join(homedir(), '.codex', 'plugins', PLUGIN_NAME),
  ];
}

export function getCandidateCodexComputerUseClientPaths(env = process.env) {
  const fromPluginRoots = getCandidateCodexComputerUsePluginRoots(env).flatMap((root) => [
    join(root, CLIENT_RELATIVE_PATH),
    join(root, CLIENT_LEGACY_RELATIVE_PATH),
  ]);
  return [...clientPathsFromEnv(env), ...fromPluginRoots];
}

export function findCodexComputerUseClient() {
  return getCandidateCodexComputerUseClientPaths().find((path) => existsSync(path)) ?? null;
}

function pluginRootForClient(client) {
  for (const root of getCandidateCodexComputerUsePluginRoots()) {
    if (client === join(root, CLIENT_RELATIVE_PATH) || client === join(root, CLIENT_LEGACY_RELATIVE_PATH)) {
      return root;
    }
  }
  return dirname(client);
}

export function createCodexMcpConfig() {
  const client = findCodexComputerUseClient();
  if (!client) {
    return {
      available: false,
      reason: 'Codex Computer Use client was not found in known supported locations.',
      mcpServers: {},
    };
  }
  return {
    available: true,
    mcpServers: {
      'computer-use': {
        command: client,
        args: ['mcp'],
        cwd: pluginRootForClient(client),
        startup_timeout_sec: 20,
        tool_timeout_sec: 60,
      },
    },
    codexConfigToml: `[mcp_servers.computer-use]\ncommand = ${JSON.stringify(client)}\nargs = ["mcp"]\ncwd = ${JSON.stringify(pluginRootForClient(client))}\nstartup_timeout_sec = 20\ntool_timeout_sec = 60\n`,
  };
}

export function createCodexBackend() {
  return {
    status() {
      const client = findCodexComputerUseClient();
      const clientExists = Boolean(client);
      const pluginRoot = client ? pluginRootForClient(client) : SYSTEM_CODEX_PLUGIN_ROOT;
      const servicePath = join(pluginRoot, SERVICE_RELATIVE_PATH);
      const serviceExists = existsSync(servicePath);
      return {
        available: clientExists,
        detail: {
          pluginRoot,
          client,
          service: serviceExists ? servicePath : null,
          launchMode: clientExists ? 'supported MCP command: SkyComputerUseClient mcp' : 'not installed',
          note: 'This gateway detects Codex Computer Use but does not patch or bypass the proprietary app bundle.',
        },
      };
    },
    mcpConfig() {
      return createCodexMcpConfig();
    },
  };
}
