import { describe, it, expect, vi } from 'vitest'
import { renderPrompt, formatXml } from '../renderer'

describe('renderPrompt() - Variable Substitution', () => {
  const mockFetchPrompt = vi.fn().mockResolvedValue('')
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('substitutes a single variable', async () => {
    const result = await renderPrompt(
      'Hello [[NAME]]',
      { NAME: 'Alice' },
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('Hello Alice')
  })

  it('substitutes multiple different variables', async () => {
    const result = await renderPrompt(
      '[[GREETING]] [[NAME]]!',
      { GREETING: 'Hi', NAME: 'Bob' },
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('Hi Bob!')
  })

  it('substitutes the same variable used multiple times', async () => {
    const result = await renderPrompt(
      '[[X]] and [[X]]',
      { X: 'val' },
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('val and val')
  })

  it('returns empty string for undefined variable (silent failure)', async () => {
    const result = await renderPrompt(
      'Hello [[MISSING]]',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('Hello ')
  })
})

describe('renderPrompt() - Comment Stripping', () => {
  const mockFetchPrompt = vi.fn().mockResolvedValue('')
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('strips #! single-line comments', async () => {
    const result = await renderPrompt(
      '#! this is a comment\nHello',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('Hello')
  })

  it('strips <!-- --> multiline comments', async () => {
    const result = await renderPrompt(
      '<!-- comment -->\nHello',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('Hello')
  })

  it('strips comments but preserves surrounding content', async () => {
    const result = await renderPrompt(
      'Before\n#! comment\nAfter',
      {},
      mockFetchPrompt,
      mockFindByTags
    )
    expect(result).toBe('Before\nAfter')
  })
})

describe('renderPrompt() - Nested Prompt Injection', () => {
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('injects a named prompt', async () => {
    const mockFetch = vi.fn().mockResolvedValue('injected content')
    const result = await renderPrompt(
      'Start [[PROMPT: sub]] End',
      {},
      mockFetch,
      mockFindByTags
    )
    expect(result).toBe('Start injected content End')
  })

  it('recursively resolves nested prompts', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce('level1 [[PROMPT: inner]]')
      .mockResolvedValueOnce('level2')
    const result = await renderPrompt(
      '[[PROMPT: outer]]',
      {},
      mockFetch,
      mockFindByTags
    )
    expect(result).toBe('level1 level2')
  })

  it('respects recursive: false option on top-level template', async () => {
    const mockFetch = vi.fn().mockResolvedValue('')
    // Template has a variable that would resolve to another sigil
    const result = await renderPrompt(
      '[[A]] [[B]]',
      { A: '[[C]]', B: 'done' },
      mockFetch,
      mockFindByTags,
      undefined,
      { recursive: false }
    )
    // Only one pass, so [[C]] from variable A is not further resolved
    expect(result).toContain('[[C]]')
    expect(result).toContain('done')
  })
})

describe('renderPrompt() - Variable Hierarchy in Nested Prompts', () => {
  const mockFindByTags = vi.fn().mockReturnValue([])

  it('passes parent variables to nested prompts', async () => {
    const mockFetch = vi.fn().mockResolvedValue('Hello [[NAME]]')
    const result = await renderPrompt(
      '[[PROMPT: greeting]]',
      { NAME: 'Alice' },
      mockFetch,
      mockFindByTags
    )
    expect(result).toBe('Hello Alice')
  })

  it('prompt variables override parent variables', async () => {
    const mockFetch = vi.fn().mockResolvedValue('Hello [[NAME]]')
    const mockGetVars = vi.fn().mockResolvedValue({ NAME: 'Override' })
    const result = await renderPrompt(
      '[[PROMPT: greeting]]',
      { NAME: 'Parent' },
      mockFetch,
      mockFindByTags,
      mockGetVars
    )
    expect(result).toBe('Hello Override')
  })
})

describe('renderPrompt() - PROMPT_TAG Injection', () => {
  it('injects prompts matching tags', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce('Content A')
      .mockResolvedValueOnce('Content B')
    const mockFindByTags = vi.fn().mockReturnValue(['promptA', 'promptB'])

    const result = await renderPrompt(
      '[[PROMPT_TAG: persona]]',
      {},
      mockFetch,
      mockFindByTags
    )
    expect(mockFindByTags).toHaveBeenCalledWith(['persona'])
    expect(result).toContain('Content A')
    expect(result).toContain('Content B')
  })

  it('respects limit in PROMPT_TAG', async () => {
    const mockFetch = vi.fn().mockResolvedValue('Content')
    const mockFindByTags = vi.fn().mockReturnValue(['a', 'b', 'c'])

    await renderPrompt(
      '[[PROMPT_TAG:2: persona]]',
      {},
      mockFetch,
      mockFindByTags
    )
    // Should only fetch 2 prompts
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns empty for no tag matches', async () => {
    const mockFetch = vi.fn()
    const mockFindByTags = vi.fn().mockReturnValue([])

    const result = await renderPrompt(
      '[[PROMPT_TAG: nonexistent]]',
      {},
      mockFetch,
      mockFindByTags
    )
    expect(result).toBe('')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('formatXml()', () => {
  it('indents nested elements', () => {
    const result = formatXml('<root><child>text</child></root>')
    expect(result).toContain('  <child>')
    expect(result).toContain('    text')
  })

  it('handles self-closing tags', () => {
    const result = formatXml('<root><br/></root>')
    expect(result).toContain('<br/>')
  })

  it('handles empty input', () => {
    const result = formatXml('')
    expect(result).toBe('')
  })

  it('uses custom indent size', () => {
    const result = formatXml('<root><child>x</child></root>', 4)
    expect(result).toContain('    <child>')
  })

  it('handles comments', () => {
    const result = formatXml('<root><!-- comment --></root>')
    expect(result).toContain('<!-- comment -->')
  })
})
