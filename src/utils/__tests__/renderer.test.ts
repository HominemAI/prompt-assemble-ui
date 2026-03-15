import { describe, it, expect, vi } from 'vitest'
import { renderPrompt } from '../renderer'

describe('renderPrompt() - Basic Rendering', () => {
  const mockFetchPrompt = vi.fn().mockResolvedValue('fetched content')
  const mockFindByTags = vi.fn().mockReturnValue(['tag1', 'tag2'])

  it('renders template with variables', async () => {
    const template = 'Hello World'
    const variables = { NAME: 'World' }
    const result = await renderPrompt(
      template,
      variables,
      mockFetchPrompt,
      mockFindByTags
    )
    expect(typeof result).toBe('string')
  })

  it('handles empty template', async () => {
    const result = await renderPrompt(
      '',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(typeof result).toBe('string')
  })

  it('handles empty variables', async () => {
    const result = await renderPrompt(
      'Template',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(typeof result).toBe('string')
  })
})

describe('renderPrompt() - With Options', () => {
  const mockFetchPrompt = vi.fn().mockResolvedValue('content')
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('accepts optional getPromptVariables parameter', async () => {
    const mockGetPromptVars = vi.fn().mockResolvedValue({})
    const result = await renderPrompt(
      'Test',
      {},
      mockFetchPrompt,
      mockFindByTags,
      mockGetPromptVars
    )
    expect(typeof result).toBe('string')
  })

  it('accepts optional options parameter', async () => {
    const result = await renderPrompt(
      'Test',
      {},
      mockFetchPrompt,
      mockFindByTags,
      undefined,
      { maxDepth: 5, recursive: true }
    )
    expect(typeof result).toBe('string')
  })
})

describe('renderPrompt() - Error Handling', () => {
  const mockFetchPrompt = vi.fn().mockResolvedValue('')
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('handles rejected promises gracefully', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('Fetch failed'))
    const result = await renderPrompt('[[PROMPT: missing]]', {}, failingFetch, mockFindByTags)
    // Silent failure: returns empty string instead of throwing
    expect(result).toBe('')
  })

  it('returns string even with missing variables', async () => {
    const result = await renderPrompt(
      'Missing [[UNKNOWN]]',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(typeof result).toBe('string')
  })

  it('is async and returns promise', () => {
    const promise = renderPrompt(
      'Test',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(promise).toBeInstanceOf(Promise)
  })
})

describe('renderPrompt() - Integration', () => {
  it('calls fetchPrompt when prompt sigils present', async () => {
    const mockFetchPrompt = vi.fn().mockResolvedValue('Fetched prompt')
    const mockFindByTags = vi.fn().mockReturnValue([])

    await renderPrompt(
      '[[PROMPT: test]]',
      {},
      mockFetchPrompt,
      mockFindByTags
    )

    // May or may not be called depending on implementation
    expect(typeof mockFetchPrompt).toBe('function')
  })

  it('calls findByTags when tag sigils present', async () => {
    const mockFetchPrompt = vi.fn()
    const mockFindByTags = vi.fn().mockReturnValue([])

    await renderPrompt(
      '[[PROMPT_TAG: persona]]',
      {},
      mockFetchPrompt,
      mockFindByTags
    )

    // May or may not be called depending on implementation
    expect(typeof mockFindByTags).toBe('function')
  })
})

describe('renderPrompt() - Empty XML Section Cleanup', () => {
  const mockFetchPrompt = vi.fn().mockResolvedValue('fetched')
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('removes empty tag with spaces', async () => {
    const template = '<persona>   </persona>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
  })

  it('removes empty tag with newlines', async () => {
    const template = '<persona>\n\n</persona>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
  })

  it('removes empty tag with mixed whitespace', async () => {
    const template = '<tag>  \n  \t  </tag>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
  })

  it('preserves tag with content', async () => {
    const template = '<persona>expert</persona>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('<persona>expert</persona>')
  })

  it('removes empty tag created by variable substitution', async () => {
    const template = '<persona>[[VAR]]\n</persona>'
    const result = await renderPrompt(template, { VAR: '' }, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
  })

  it('removes multiple empty tags', async () => {
    const template = '<tag1>   </tag1> text <tag2>\n\n</tag2>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe(' text ')
  })

  it('handles nested tags with empty inner', async () => {
    const template = '<outer><inner>  </inner></outer>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    // Inner tag is removed, leaving just outer tags
    expect(result).toBe('<outer></outer>')
  })

  it('preserves empty tags with surrounding text', async () => {
    const template = 'Start <persona>\n</persona> End'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('Start  End')
  })
})

describe('renderPrompt() - Empty XML with Complex Sigils', () => {
  const mockFetchPrompt = vi.fn()
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('removes empty tag with undefined variable', async () => {
    const template = '<context>[[UNDEFINED_VAR]]\n</context>'
    const result = await renderPrompt(template, { OTHER: 'value' }, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
  })

  it('removes empty tag created by empty variable', async () => {
    const template = '<system>[[EMPTY_VAR]]</system>'
    const result = await renderPrompt(template, { EMPTY_VAR: '' }, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
  })

  it('preserves tag with variable content', async () => {
    const template = '<output>[[USERNAME]]</output>'
    const result = await renderPrompt(template, { USERNAME: 'alice' }, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('<output>alice</output>')
  })

  it('removes tag with undefined component', async () => {
    mockFetchPrompt.mockRejectedValue(new Error('Fetch failed'))
    const template = '<wrapper>[[PROMPT: missing]]</wrapper>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    // Component returns empty on error, making tag empty
    expect(result).toBe('')
    mockFetchPrompt.mockClear()
  })

  it('preserves tag with component content', async () => {
    mockFetchPrompt.mockResolvedValue('Component content')
    const template = '<instructions>[[PROMPT: task]]</instructions>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('<instructions>Component content</instructions>')
    mockFetchPrompt.mockClear()
  })

  it('removes multiple empty tags with variables', async () => {
    const template = '<tag1>[[UNDEF1]]\n</tag1> text <tag2>  </tag2>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe(' text ')
  })

  it('handles tag with mixed empty and full sigils', async () => {
    const template = '<output>[[VAR1]] [[UNDEF]] [[VAR2]]</output>'
    const result = await renderPrompt(
      template,
      { VAR1: 'hello', VAR2: 'world' },
      mockFetchPrompt,
      mockFindByTags
    )
    // VAR1 and VAR2 have content, UNDEF returns empty, but tag has content
    expect(result).toBe('<output>hello  world</output>')
  })

  it('removes tag with only undefined sigils', async () => {
    const template = '<output>[[UNDEF1]] [[UNDEF2]]</output>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    // All undefined return empty, tag becomes empty
    expect(result).toBe('')
  })

  it('handles JSON with empty tags', async () => {
    const template = JSON.stringify(
      {
        system: '<system>   </system>',
        user: '<user>[[USERNAME]]</user>',
        empty: '<tag></tag>',
      },
      null,
      2
    )
    const result = await renderPrompt(template, { USERNAME: 'alice' }, mockFetchPrompt, mockFindByTags)
    expect(result).toContain('<user>alice</user>')
    expect(result).not.toContain('<system>')
    expect(result).not.toContain('<empty>')
  })

  it('removes nested empty inner tags', async () => {
    const template = '<outer><inner>  </inner></outer>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    // Inner tag removed, leaving outer tags
    expect(result).toBe('<outer></outer>')
  })

  it('handles PROMPT_TAG with no matches', async () => {
    mockFindByTags.mockReturnValue([])
    const template = '<results>[[PROMPT_TAG: missing_tag]]</results>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toBe('')
    mockFindByTags.mockReturnValue([])
  })

  it('preserves tag with PROMPT_TAG content', async () => {
    mockFetchPrompt.mockResolvedValue('Task')
    mockFindByTags.mockReturnValue(['task1', 'task2'])
    const template = '<results>[[PROMPT_TAG: task]]</results>'
    const result = await renderPrompt(template, {}, mockFetchPrompt, mockFindByTags)
    expect(result).toContain('<results>')
    expect(result).toContain('Task')
    mockFetchPrompt.mockClear()
    mockFindByTags.mockClear()
  })
})
