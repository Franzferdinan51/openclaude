import * as React from 'react';
import { PermissionRuleList } from '../../components/permissions/rules/PermissionRuleList.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
import { createPermissionRetryMessage } from '../../utils/messages.js';
import { getSettings_DEPRECATED, updateSettingsForSource } from '../../utils/settings/settings.js';
import {
  applyPermissionProfileToAppState,
  buildPermissionProfileSettings,
  parsePermissionProfileCommand,
  renderPermissionProfileApplied,
  renderPermissionProfileHelp,
  renderPermissionProfileList,
  renderPermissionProfileStatus,
} from './permission-profiles.js';

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const profileCommand = parsePermissionProfileCommand(args);
  if (profileCommand) {
    switch (profileCommand.action) {
      case 'help':
        onDone(renderPermissionProfileHelp());
        return null;
      case 'list':
        onDone(renderPermissionProfileList());
        return null;
      case 'status':
        onDone(renderPermissionProfileStatus(getSettings_DEPRECATED()));
        return null;
      case 'error':
        onDone(profileCommand.message);
        return null;
      case 'apply': {
        const result = updateSettingsForSource(
          profileCommand.source,
          buildPermissionProfileSettings(profileCommand.profile),
        );
        if (result.error) {
          onDone(`Failed to apply permission profile: ${result.error.message}`);
          return null;
        }
        context.setAppState(prev =>
          applyPermissionProfileToAppState(prev, profileCommand.profile),
        );
        onDone(
          renderPermissionProfileApplied(
            profileCommand.profile,
            profileCommand.source,
          ),
        );
        return null;
      }
    }
  }

  if (context.options.isNonInteractiveSession) {
    onDone(renderPermissionProfileHelp());
    return null;
  }

  return <PermissionRuleList onExit={onDone} onRetryDenials={commands => {
    context.setMessages(prev => [...prev, createPermissionRetryMessage(commands)]);
  }} />;
};
