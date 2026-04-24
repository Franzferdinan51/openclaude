import * as React from 'react'
import { useState } from 'react'
import type { LocalJSXCommandOnDone, LocalJSXCommandContext } from '../../types/command.js'
import { Box, Text } from '../../ink.js'
import { Spinner } from '../../components/spinner/Spinner.js'

interface Step {
  id: string
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to DuckHive',
    description: 'This wizard will help you set up DuckHive for first-time use.',
  },
  {
    id: 'provider',
    title: 'Select Provider',
    description: 'Choose your AI provider (Anthropic, OpenAI, OpenRouter, LM Studio, etc.)',
  },
  {
    id: 'apikey',
    title: 'API Key Configuration',
    description: 'Enter your API key for the selected provider.',
  },
  {
    id: 'model',
    title: 'Select Model',
    description: 'Choose the model you want to use.',
  },
  {
    id: 'permissions',
    title: 'Permission Mode',
    description: 'Configure permission level (auto, bypass, etc.)',
  },
  {
    id: 'complete',
    title: 'Setup Complete',
    description: 'DuckHive is ready to use!',
  },
]

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args?: string,
): Promise<React.ReactNode> {
  return <OnboardWizard onDone={onDone} />
}

function OnboardWizard({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const step = STEPS[currentStep]!

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onDone('DuckHive setup complete! Run /help for available commands.')
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  function handleSkip() {
    onDone('Setup skipped. Run /onboard anytime to set up DuckHive.')
  }

  return (
    <Box flexDirection="column" gap={2} padding={1}>
      {/* Progress indicator */}
      <Box flexDirection="row" gap={1}>
        {STEPS.map((s, i) => (
          <Box
            key={s.id}
            width={3}
            height={1}
            backgroundColor={i <= currentStep ? 'green' : 'gray'}
          />
        ))}
      </Box>

      {/* Step content */}
      <Box flexDirection="column" gap={1} marginTop={1}>
        <Text bold color="cyan">
          Step {currentStep + 1}/{STEPS.length}: {step.title}
        </Text>
        <Text>{step.description}</Text>
      </Box>

      {/* Actions based on step */}
      <Box flexDirection="column" gap={1} marginTop={2}>
        {step.id === 'welcome' && (
          <>
            <Text dimColor>Press Enter to continue or Esc to skip setup.</Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <ActionButton label="Continue" onClick={handleNext} primary />
              <ActionButton label="Skip Setup" onClick={handleSkip} />
            </Box>
          </>
        )}

        {step.id === 'provider' && (
          <>
            <Text>Select an AI provider:</Text>
            <Text dimColor>1. Anthropic (recommended)</Text>
            <Text dimColor>2. OpenAI</Text>
            <Text dimColor>3. OpenRouter</Text>
            <Text dimColor>4. LM Studio</Text>
            <Text dimColor>5. MiniMax</Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <ActionButton label="Anthropic (default)" onClick={handleNext} primary />
              <ActionButton label="Back" onClick={handleBack} />
            </Box>
          </>
        )}

        {step.id === 'apikey' && (
          <>
            <Text>API keys are configured via environment variables or settings.</Text>
            <Text dimColor>Set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.</Text>
            <Text dimColor>Or use /provider command after setup.</Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <ActionButton label="Continue" onClick={handleNext} primary />
              <ActionButton label="Back" onClick={handleBack} />
            </Box>
          </>
        )}

        {step.id === 'model' && (
          <>
            <Text>Default model selection:</Text>
            <Text dimColor>Use /model command to change models anytime.</Text>
            <Text dimColor>Run /model --list to see available models.</Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <ActionButton label="Continue" onClick={handleNext} primary />
              <ActionButton label="Back" onClick={handleBack} />
            </Box>
          </>
        )}

        {step.id === 'permissions' && (
          <>
            <Text>Permission modes:</Text>
            <Text dimColor>• auto (default) - asks for sensitive tools</Text>
            <Text dimColor>• bypass (/yolo) - auto-approves all tools</Text>
            <Text dimColor>• plan - read-only research mode</Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <ActionButton label="Use Auto (default)" onClick={handleNext} primary />
              <ActionButton label="Back" onClick={handleBack} />
            </Box>
          </>
        )}

        {step.id === 'complete' && (
          <>
            <Text bold color="green">DuckHive is ready!</Text>
            <Text dimColor>Run /help to see available commands.</Text>
            <Text dimColor>Run /model --list to switch models.</Text>
            <Text dimColor>Run /provider to manage providers.</Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <ActionButton label="Finish" onClick={handleNext} primary />
            </Box>
          </>
        )}
      </Box>

      {isLoading && (
        <Box marginTop={1}>
          <Spinner /> <Text> Processing...</Text>
        </Box>
      )}
    </Box>
  )
}

function ActionButton({
  label,
  onClick,
  primary,
}: {
  label: string
  onClick: () => void
  primary?: boolean
}): React.ReactElement {
  return (
    <Box
      borderStyle="round"
      borderColor={primary ? 'cyan' : 'gray'}
      paddingX={2}
      paddingY={1}
      onPress={onClick}
    >
      <Text color={primary ? 'cyan' : 'white'}>{label}</Text>
    </Box>
  )
}
