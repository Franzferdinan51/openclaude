import type { Command } from '../../commands.js'

const searchProvider = {
  type: 'local',
  name: 'search-provider',
  aliases: ['search', 'web-search-provider'],
  description: 'Configure DuckHive web search provider defaults',
  argumentHint: '[auto|native|ddg|searxng|tavily|exa|you|jina|bing|mojeek|linkup|custom] [--url <searxng-url>]',
  supportsNonInteractive: true,
  load: () => import('./search-provider-impl.js'),
} satisfies Command

export default searchProvider
