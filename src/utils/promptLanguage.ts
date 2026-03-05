import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { Extension, StateField, EditorState } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { linter, Diagnostic } from '@codemirror/lint';

// Create custom mark decorations for our syntax tokens
// These are read-only and don't interfere with editing
const varMark = Decoration.mark({ class: 'cm-prompt-var', readonly: false });
const componentMark = Decoration.mark({ class: 'cm-prompt-component', readonly: false });
const componentNameMark = Decoration.mark({ class: 'cm-prompt-name', readonly: false });
const tagMark = Decoration.mark({ class: 'cm-prompt-tag', readonly: false });
const tagNameMark = Decoration.mark({ class: 'cm-prompt-name', readonly: false });
const commentMark = Decoration.mark({ class: 'cm-prompt-comment', readonly: false });
const xmlTagMark = Decoration.mark({ class: 'cm-xml-tag', readonly: false });

// Decorations for bracket and tag matching
const bracketMatchMark = Decoration.mark({ class: 'cm-bracket-match', readonly: false });
const xmlTagMatchMark = Decoration.mark({ class: 'cm-xml-tag-match', readonly: false });

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
      // Only match complete XML tags that are NOT part of our special syntax
      { regex: /<(?!--)(?!!\[)(?:\/)?([a-zA-Z_][a-zA-Z0-9_:-]*)\b[^<]*?(?:\/)?>/g, mark: xmlTagMark },
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

    // Sort by position and add to builder
    matches.sort((a, b) => a.from - b.from);
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

      while ((match = promptRegex.exec(text)) !== null) {
        const tokenStart = match.index;
        const tokenEnd = match.index + match[0].length;

        // Check if click position is inside this PROMPT token
        if (pos >= tokenStart && pos < tokenEnd) {
          // Extract the prompt name (capture group 1)
          const promptName = match[1];
          onPromptOpen(promptName);
          event.preventDefault();
          return true;
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

    // Find matching XML tags
    const cleanText = text
      .replace(/\[\[[^\]]*\]\]/g, (match) => ' '.repeat(match.length))
      .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length));

    const tagRegex = /<(\/)?([a-zA-Z_][a-zA-Z0-9_:-]*)(\s[^>]*)?(\/)?>/g;
    const tags: Array<{
      isClose: boolean;
      name: string;
      isSelfClosing: boolean;
      from: number;
      to: number;
    }> = [];

    let tagMatch;
    tagRegex.lastIndex = 0;
    while ((tagMatch = tagRegex.exec(cleanText)) !== null) {
      const [fullMatch, openingSlash, tagName, attributes, closingSlash] = tagMatch;
      const isClose = !!openingSlash;
      const isSelfClosing = !!closingSlash;
      tags.push({
        isClose,
        name: tagName,
        isSelfClosing,
        from: tagMatch.index,
        to: tagMatch.index + fullMatch.length,
      });
    }

    // Find if cursor is in a tag
    let cursorInTag: (typeof tags)[0] | null = null;
    for (const tag of tags) {
      if (cursor >= tag.from && cursor <= tag.to) {
        cursorInTag = tag;
        break;
      }
    }

    if (cursorInTag && !cursorInTag.isSelfClosing) {
      if (!cursorInTag.isClose) {
        // Cursor is in an opening tag, find matching closing tag
        const stack: Array<{ name: string; tag: (typeof tags)[0] }> = [];
        let foundMatch: (typeof tags)[0] | null = null;

        for (const tag of tags) {
          if (tag.isSelfClosing) continue;

          if (!tag.isClose) {
            stack.push({ name: tag.name, tag });
          } else {
            if (stack.length > 0 && stack[stack.length - 1].name === tag.name) {
              const opening = stack.pop();
              if (opening?.tag === cursorInTag) {
                foundMatch = tag;
                break;
              }
            }
          }
        }

        if (foundMatch) {
          builder.add(cursorInTag.from, cursorInTag.to, xmlTagMatchMark);
          builder.add(foundMatch.from, foundMatch.to, xmlTagMatchMark);
        }
      } else {
        // Cursor is in a closing tag, find matching opening tag
        const stack: Array<{ name: string; tag: (typeof tags)[0] }> = [];
        let foundMatch: (typeof tags)[0] | null = null;

        for (const tag of tags) {
          if (tag.isSelfClosing) continue;

          if (!tag.isClose) {
            stack.push({ name: tag.name, tag });
          } else {
            if (stack.length > 0 && stack[stack.length - 1].name === tag.name) {
              const opening = stack.pop();
              if (tag === cursorInTag) {
                foundMatch = opening?.tag || null;
                break;
              }
            }
          }
        }

        if (foundMatch) {
          builder.add(cursorInTag.from, cursorInTag.to, xmlTagMatchMark);
          builder.add(foundMatch.from, foundMatch.to, xmlTagMatchMark);
        }
      }
    }

    return builder.finish();
  });
}
