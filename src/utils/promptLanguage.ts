import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { Extension, StateField, EditorState } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { linter, Diagnostic } from '@codemirror/lint';

// Create custom mark decorations for our syntax tokens
// Allow normal cursor placement and editing - marks are for styling only
const varMark = Decoration.mark({ class: 'cm-prompt-var', readonly: false, inclusiveStart: true, inclusiveEnd: true });
const componentMark = Decoration.mark({ class: 'cm-prompt-component', readonly: false, inclusiveStart: true, inclusiveEnd: true });
const componentNameMark = Decoration.mark({ class: 'cm-prompt-name', readonly: false, inclusiveStart: true, inclusiveEnd: true });
const tagMark = Decoration.mark({ class: 'cm-prompt-tag', readonly: false, inclusiveStart: true, inclusiveEnd: true });
const tagNameMark = Decoration.mark({ class: 'cm-prompt-name', readonly: false, inclusiveStart: true, inclusiveEnd: true });
const commentMark = Decoration.mark({ class: 'cm-prompt-comment', readonly: false, inclusiveStart: true, inclusiveEnd: true });

// Decorations for bracket matching
const bracketMatchMark = Decoration.mark({ class: 'cm-bracket-match', readonly: false, inclusiveStart: true, inclusiveEnd: true });

// Plugin to highlight our custom syntax
export function promptSyntaxHighlight(): Extension {
  return EditorView.decorations.compute(['doc'], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const text = state.doc.toString();

    // Match all tokens - collect all matches first, then sort by position
    const patterns = [
      // HTML multiline comments
      { regex: /<!--[\s\S]*?-->/g, mark: commentMark },
      { regex: /#!.*$/gm, mark: commentMark },
      { regex: /\[\[PROMPT_TAG:\d*:[^\]]*\]\]|\[\[PROMPT_TAG:[^\]]*\]\]/g, mark: tagMark },
      { regex: /\[\[PROMPT:[^\]]*\]\]/g, mark: componentMark },
      { regex: /\[\[[A-Za-z_][A-Za-z0-9_]*\]\]/g, mark: varMark },
      // HTML/XML tags are now handled by the built-in @codemirror/lang-html mode
    ];

    // Collect all matches
    const matches: Array<{ from: number; to: number; mark: any }> = [];

    for (const { regex, mark } of patterns) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          from: match.index,
          to: match.index + match[0].length,
          mark,
        });
      }
    }

    // Add purple highlighting for prompt and tag names
    // PROMPT: name - highlight just "name"
    let promptMatch;
    const promptRegex = /\[\[PROMPT:\s*([^\[\]\s][^\[\]]*?)\s*\]\]/g;
    promptRegex.lastIndex = 0;
    while ((promptMatch = promptRegex.exec(text)) !== null) {
      const nameStart = promptMatch.index + promptMatch[0].indexOf(promptMatch[1]);
      const nameEnd = nameStart + promptMatch[1].length;
      matches.push({
        from: nameStart,
        to: nameEnd,
        mark: componentNameMark,
      });
    }

    // PROMPT_TAG: tags or PROMPT_TAG:N: tags - highlight just "tags"
    let tagMatch;
    const tagRegex = /\[\[PROMPT_TAG:\d*:\s*([^\[\]]+?)\s*\]\]|\[\[PROMPT_TAG:\s*([^\[\]]+?)\s*\]\]/g;
    tagRegex.lastIndex = 0;
    while ((tagMatch = tagRegex.exec(text)) !== null) {
      // Match group 1 is for PROMPT_TAG:N: format, group 2 is for PROMPT_TAG: format
      const tagContent = tagMatch[1] || tagMatch[2];
      const tagStart = tagMatch.index + tagMatch[0].indexOf(tagContent);
      const tagEnd = tagStart + tagContent.length;
      matches.push({
        from: tagStart,
        to: tagEnd,
        mark: tagNameMark,
      });
    }

    // Sort by position, with larger ranges first when starting at same position
    // This handles overlapping ranges properly for CodeMirror
    matches.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      return b.to - a.to; // Larger ranges first
    });
    for (const { from, to, mark } of matches) {
      builder.add(from, to, mark);
    }

    return builder.finish();
  });
}

// XML Linting Extension
export function xmlLintExtension(): Extension {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();

    // Strip [[...]] patterns and comments to get clean text for XML parsing
    const cleanText = text
      .replace(/\[\[[^\]]*\]\]/g, (match) => ' '.repeat(match.length)) // Replace [[...]] with spaces
      .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length)); // Replace comments with spaces

    // Find all XML tags
    const tagRegex = /<(\/)?([a-zA-Z_][a-zA-Z0-9_:-]*)(\s[^>]*)?(\/)?>/g;
    const tags: Array<{
      fullMatch: string;
      isClose: boolean;
      name: string;
      isSelfClosing: boolean;
      index: number;
      from: number;
      to: number;
    }> = [];

    let match;
    tagRegex.lastIndex = 0;
    while ((match = tagRegex.exec(cleanText)) !== null) {
      const [fullMatch, openingSlash, tagName, attributes, closingSlash] = match;
      const isClose = !!openingSlash;
      const isSelfClosing = !!closingSlash;
      tags.push({
        fullMatch,
        isClose,
        name: tagName,
        isSelfClosing,
        index: match.index,
        from: match.index,
        to: match.index + fullMatch.length,
      });
    }

    // Stack-based validation
    const stack: Array<{
      name: string;
      from: number;
      to: number;
    }> = [];
    const errors: Array<{
      from: number;
      to: number;
      message: string;
    }> = [];

    for (const tag of tags) {
      if (tag.isSelfClosing) {
        // Skip self-closing tags
        continue;
      }

      if (!tag.isClose) {
        // Opening tag
        stack.push({
          name: tag.name,
          from: tag.from,
          to: tag.to,
        });
      } else {
        // Closing tag
        if (stack.length === 0) {
          errors.push({
            from: tag.from,
            to: tag.to,
            message: `Unexpected closing tag </${tag.name}> with no matching opening tag`,
          });
        } else if (stack[stack.length - 1].name === tag.name) {
          // Properly matched
          stack.pop();
        } else {
          // Mismatched
          const openingTag = stack[stack.length - 1];
          errors.push({
            from: tag.from,
            to: tag.to,
            message: `Mismatched closing tag </${tag.name}>, expected </${openingTag.name}>`,
          });
          // Don't pop to allow further error detection
        }
      }
    }

    // Unclosed tags
    for (const unclosed of stack) {
      errors.push({
        from: unclosed.from,
        to: unclosed.to,
        message: `Unclosed tag <${unclosed.name}> has no matching closing tag`,
      });
    }

    // Convert errors to diagnostics
    for (const error of errors) {
      diagnostics.push({
        from: error.from,
        to: error.to,
        severity: 'error',
        message: error.message,
      });
    }

    return diagnostics;
  });
}

// Prompt Click Extension - enables Ctrl/Cmd+Click navigation to referenced prompts
export function promptClickExtension(onPromptOpen: (name: string) => void): Extension {
  return EditorView.domEventHandlers({
    click: (event, view) => {
      // Only handle Ctrl/Cmd+Click
      if (!event.ctrlKey && !event.metaKey) {
        return false;
      }

      // Get the position of the click
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) {
        return false;
      }

      const text = view.state.doc.toString();

      // Find all PROMPT tokens with their positions
      const promptRegex = /\[\[PROMPT:\s*([^\[\]\s][^\[\]]*?)\s*\]\]/g;
      let match;
      promptRegex.lastIndex = 0;

      // Look for a PROMPT token near the click position (within 50 chars)
      while ((match = promptRegex.exec(text)) !== null) {
        const tokenStart = match.index;
        const tokenEnd = match.index + match[0].length;
        const searchRadius = 50; // Allow clicking slightly outside the token

        // Check if click position is near this PROMPT token
        if (pos >= tokenStart - searchRadius && pos <= tokenEnd + searchRadius) {
          // Verify the click is actually on this line to avoid false positives
          // Count newlines from token start to click position
          const beforeToken = text.substring(0, tokenStart);
          const beforeClick = text.substring(0, pos);
          const tokenLineNum = (beforeToken.match(/\n/g) || []).length;
          const clickLineNum = (beforeClick.match(/\n/g) || []).length;

          // Only trigger if on the same line
          if (tokenLineNum === clickLineNum) {
            // Extract the prompt name (capture group 1)
            const promptName = match[1].trim();
            onPromptOpen(promptName);
            event.preventDefault();
            return true;
          }
        }
      }

      return false;
    },
    mousemove: (event, view) => {
      // Only check hover state when Ctrl/Cmd is held
      if (!event.ctrlKey && !event.metaKey) {
        // Remove the clickable class if Ctrl/Cmd is released
        const editor = view.dom;
        editor.classList.remove('cm-prompt-clickable');
        return false;
      }

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) {
        view.dom.classList.remove('cm-prompt-clickable');
        return false;
      }

      const text = view.state.doc.toString();
      const promptRegex = /\[\[PROMPT:\s*([^\[\]\s][^\[\]]*?)\s*\]\]/g;
      let match;
      let isOverPrompt = false;
      promptRegex.lastIndex = 0;

      while ((match = promptRegex.exec(text)) !== null) {
        const tokenStart = match.index;
        const tokenEnd = match.index + match[0].length;

        if (pos >= tokenStart && pos < tokenEnd) {
          isOverPrompt = true;
          break;
        }
      }

      const editor = view.dom;
      if (isOverPrompt) {
        editor.classList.add('cm-prompt-clickable');
      } else {
        editor.classList.remove('cm-prompt-clickable');
      }

      return false;
    },
  });
}

// Bracket Matching Extension
export function bracketMatchExtension(): Extension {
  return EditorView.decorations.compute(['doc', 'selection'], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const text = state.doc.toString();
    const cursor = state.selection.main.from;

    // Find matching [[...]] brackets
    const bracketRegex = /\[\[/g;
    let bracketMatch;
    bracketRegex.lastIndex = 0;
    while ((bracketMatch = bracketRegex.exec(text)) !== null) {
      const openPos = bracketMatch.index;
      const closePos = text.indexOf(']]', openPos + 2);

      if (closePos === -1) continue; // Unclosed bracket

      const openEnd = openPos + 2;
      const closeStart = closePos;
      const closeEnd = closePos + 2;

      // Check if cursor is inside or adjacent to this bracket pair
      if (cursor > openPos && cursor < closeEnd) {
        builder.add(openPos, openEnd, bracketMatchMark);
        builder.add(closeStart, closeEnd, bracketMatchMark);
        break; // Only highlight the bracket pair containing the cursor
      }
    }

    // XML/HTML tag matching is now handled by the built-in @codemirror/lang-html mode

    return builder.finish();
  });
}
