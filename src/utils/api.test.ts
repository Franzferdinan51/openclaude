import { expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { getEmptyToolPermissionContext, type Tool, type Tools } from '../Tool.js'
import { SkillTool } from '../tools/SkillTool/SkillTool.js'
import { getTools } from '../tools.js'
import { toolToAPISchema } from './api.js'
import { zodToJsonSchema } from './zodToJsonSchema.js'

test('toolToAPISchema preserves provider-specific schema keywords in input_schema', async () => {
  const schema = await toolToAPISchema(
    {
      name: 'WebFetch',
      inputSchema: z.strictObject({}),
      inputJSONSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Public HTTP or HTTPS URL',
          },
          metadata: {
            type: 'object',
            propertyNames: {
              pattern: '^[a-z]+$',
            },
            properties: {
              callback: {
                type: 'string',
                format: 'uri-reference',
              },
            },
          },
        },
      },
      prompt: async () => 'Fetch a URL',
    } as unknown as Tool,
    {
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      tools: [] as unknown as Tools,
      agents: [],
    },
  )

  expect(schema).toMatchObject({
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Public HTTP or HTTPS URL',
        },
        metadata: {
          type: 'object',
          propertyNames: {
            pattern: '^[a-z]+$',
          },
          properties: {
            callback: {
              type: 'string',
              format: 'uri-reference',
            },
          },
        },
      },
    },
  })
})

test('toolToAPISchema keeps skill required for SkillTool', async () => {
  const schema = await toolToAPISchema(SkillTool, {
    getToolPermissionContext: async () => getEmptyToolPermissionContext(),
    tools: [] as unknown as Tools,
    agents: [],
  })

  expect((schema as { input_schema: unknown }).input_schema).toMatchObject({
    type: 'object',
    required: ['skill'],
  })
})

test('toolToAPISchema removes extra required keys not in properties (MCP schema sanitization)', async () => {
  const schema = await toolToAPISchema(
    {
      name: 'mcp__test__create_object',
      inputSchema: z.strictObject({}),
      inputJSONSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name', 'attributes'],
      },
      prompt: async () => 'Create an object',
    } as unknown as Tool,
    {
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      tools: [] as unknown as Tools,
      agents: [],
    },
  )

  const inputSchema = (schema as { input_schema: { required?: string[] } }).input_schema
  expect(inputSchema.required).toEqual(['name'])
})

test('zodToJsonSchema tolerates missing and JSON-schema-shaped inputs', () => {
  expect(zodToJsonSchema(undefined)).toEqual({
    type: 'object',
    properties: {},
  })
  expect(zodToJsonSchema({})).toEqual({
    type: 'object',
    properties: {},
  })
  expect(
    zodToJsonSchema({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    }),
  ).toEqual({
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
  })
})

test('zodToJsonSchema tolerates malformed nested Zod schemas without _zod crashes', () => {
  const malformedSchema = z.object({
    bad: undefined as unknown as z.ZodTypeAny,
  })

  expect(zodToJsonSchema(malformedSchema)).toEqual({
    type: 'object',
    properties: {},
  })
})

test('toolToAPISchema does not crash on a non-Zod input schema', async () => {
  const schema = await toolToAPISchema(
    {
      name: 'PlainObjectSchemaRegression',
      inputSchema: {} as Tool['inputSchema'],
      prompt: async () => 'Plain object schema regression',
    } as unknown as Tool,
    {
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      tools: [] as unknown as Tools,
      agents: [],
    },
  )

  expect((schema as { input_schema?: unknown }).input_schema).toEqual({
    type: 'object',
    properties: {},
  })
})

test('toolToAPISchema converts every built-in tool schema', async () => {
  const toolPermissionContext = getEmptyToolPermissionContext()
  const tools = getTools(toolPermissionContext)

  for (const tool of tools) {
    const schema = await toolToAPISchema(tool, {
      getToolPermissionContext: async () => toolPermissionContext,
      tools,
      agents: [],
    })

    expect((schema as { input_schema?: unknown }).input_schema, tool.name).toBeTruthy()
  }
})
