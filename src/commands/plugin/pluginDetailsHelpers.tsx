// @ts-nocheck
import { c as _c } from "react-compiler-runtime";
/**
 * Shared helper functions and types for plugin details views
 *
 * Used by both DiscoverPlugins and BrowseMarketplace components.
 */

import * as React from 'react';
import {
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { Box, Text } from '../../ink.js';
import { isLocalPluginSource } from '../../utils/plugins/schemas.js';
import type { PluginMarketplaceEntry } from '../../utils/plugins/schemas.js';

/**
 * Represents a plugin available for installation from a marketplace
 */
export type InstallablePlugin = {
  entry: PluginMarketplaceEntry;
  marketplaceName: string;
  pluginId: string;
  isInstalled: boolean;
  marketplaceInstallLocation?: string;
};

/**
 * Menu option for plugin details view
 */
export type PluginDetailsMenuOption = {
  label: string;
  action: string;
};

/**
 * Extract GitHub repo info from a plugin's source
 */
export function extractGitHubRepo(plugin: InstallablePlugin): string | null {
  const isGitHub = plugin.entry.source && typeof plugin.entry.source === 'object' && 'source' in plugin.entry.source && plugin.entry.source.source === 'github';
  if (isGitHub && typeof plugin.entry.source === 'object' && 'repo' in plugin.entry.source) {
    return plugin.entry.source.repo;
  }
  return null;
}

/**
 * Build menu options for plugin details view with scoped installation options
 */
export function buildPluginDetailsMenuOptions(hasHomepage: string | undefined, githubRepo: string | null): PluginDetailsMenuOption[] {
  const options: PluginDetailsMenuOption[] = [{
    label: 'Install for you (user scope)',
    action: 'install-user'
  }, {
    label: 'Install for all collaborators on this repository (project scope)',
    action: 'install-project'
  }, {
    label: 'Install for you, in this repo only (local scope)',
    action: 'install-local'
  }];
  if (hasHomepage) {
    options.push({
      label: 'Open homepage',
      action: 'homepage'
    });
  }
  if (githubRepo) {
    options.push({
      label: 'View on GitHub',
      action: 'github'
    });
  }
  options.push({
    label: 'Back to plugin list',
    action: 'back'
  });
  return options;
}

function pluralize(label: string, count: number): string {
  if (count === 1) {
    return label;
  }
  if (label.endsWith('y')) {
    return `${label.slice(0, -1)}ies`;
  }
  return `${label}s`;
}

function countVisibleEntries(path: string): number {
  try {
    return readdirSync(path, { withFileTypes: true }).filter(entry => !entry.name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

function resolveMarketplaceRoot(installLocation: string): string {
  const resolved = resolve(installLocation);
  if (!existsSync(resolved)) {
    return resolved;
  }
  if (statSync(resolved).isDirectory()) {
    return resolved;
  }
  const parent = dirname(resolved);
  return basename(parent) === '.claude-plugin' ? dirname(parent) : parent;
}

function resolveLocalPluginRoot(basePath: string, relativePath: string): string | null {
  const marketplaceRoot = resolveMarketplaceRoot(basePath);
  const resolvedPath = resolve(marketplaceRoot, relativePath);
  const normalizedBase = marketplaceRoot + sep;
  if (
    resolvedPath !== marketplaceRoot &&
    !resolvedPath.startsWith(normalizedBase)
  ) {
    return null;
  }
  return resolvedPath;
}

export function discoverLocalPluginComponents(
  plugin: InstallablePlugin,
): string[] {
  if (
    !plugin.marketplaceInstallLocation ||
    !isLocalPluginSource(plugin.entry.source)
  ) {
    return [];
  }

  const pluginRoot = resolveLocalPluginRoot(
    plugin.marketplaceInstallLocation,
    plugin.entry.source,
  );
  if (!pluginRoot || !existsSync(pluginRoot)) {
    return [];
  }

  const discovered: string[] = [];
  const componentDirs = [
    { path: 'commands', label: 'Command' },
    { path: 'agents', label: 'Agent' },
    { path: 'skills', label: 'Skill' },
    { path: 'output-styles', label: 'Output style' },
  ];

  for (const component of componentDirs) {
    const fullPath = join(pluginRoot, component.path);
    if (!existsSync(fullPath)) {
      continue;
    }
    try {
      if (!statSync(fullPath).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    const count = countVisibleEntries(fullPath);
    if (count > 0) {
      discovered.push(
        `${pluralize(component.label, count)}: ${count} ${pluralize('entry', count)} in ${component.path}/`,
      );
    }
  }

  if (existsSync(join(pluginRoot, 'hooks', 'hooks.json'))) {
    discovered.push('Hooks: hooks/hooks.json');
  }

  if (existsSync(join(pluginRoot, '.mcp.json'))) {
    discovered.push('MCP Servers: .mcp.json');
  }

  return discovered;
}

/**
 * Key hint component for plugin selection screens
 */
export function PluginSelectionKeyHint(t0) {
  const $ = _c(7);
  const {
    hasSelection
  } = t0;
  let t1;
  if ($[0] !== hasSelection) {
    t1 = hasSelection && <ConfigurableShortcutHint action="plugin:install" context="Plugin" fallback="i" description="install" bold={true} />;
    $[0] = hasSelection;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  let t3;
  let t4;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <ConfigurableShortcutHint action="plugin:toggle" context="Plugin" fallback="Space" description="toggle" />;
    t3 = <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="details" />;
    t4 = <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />;
    $[2] = t2;
    $[3] = t3;
    $[4] = t4;
  } else {
    t2 = $[2];
    t3 = $[3];
    t4 = $[4];
  }
  let t5;
  if ($[5] !== t1) {
    t5 = <Box marginTop={1}><Text dimColor={true} italic={true}><Byline>{t1}{t2}{t3}{t4}</Byline></Text></Box>;
    $[5] = t1;
    $[6] = t5;
  } else {
    t5 = $[6];
  }
  return t5;
}
