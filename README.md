# Prompt Assemble UI
> ⚠️ This readme was AI Generated It is a placeholder but has useful information

A modern, web-based interface for managing and assembling AI prompts. Prompt Assemble provides an intuitive editor with syntax highlighting, versioning, variable substitution, and prompt composition features.

## Purpose

Prompt Assemble UI is designed to help users:
- **Create and manage prompts** with a powerful code editor
- **Organize prompts** through tagging and search
- **Compose complex prompts** by referencing and injecting other prompts
- **Track versions** of prompts with revision history
- **Substitute variables** with predefined values
- **Export prompts** in multiple formats
- **Work with backends** that support prompt storage and management

## Features

### Editor
- **Syntax Highlighting** for custom prompt syntax with XML/HTML support
- **Token Counting** to estimate API usage costs
- **Bracket Matching** for nested structures
- **Code Navigation** with Ctrl/Cmd+Click to jump between referenced prompts
- **Undo/Redo** support with keyboard shortcuts

### Prompt Composition
- **Variable Substitution**: `[[VAR_NAME]]` - inject variables into prompts
- **Component Injection**: `[[PROMPT: name]]` - reference and inject other prompts
- **Tag-Based Injection**: `[[PROMPT_TAG: tag1, tag2]]` - inject by tags

### Organization
- **Search & Filter** across all prompts
- **Tagging System** for categorizing prompts
- **Prompt Explorer** for browsing your prompt library

### Advanced Features
- **Version History** with commit messages
- **Variable Sets** for managing different configurations
- **Export** to JSON, YAML, and ZIP formats
- **Backup & Restore** functionality
- **Dark Mode** support

## Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- A running Prompt Assemble backend (for full functionality)

### Installation

```bash
# Clone the repository
git clone https://github.com/HominemAI/prompt-assemble-ui.git
cd prompt-assemble-ui

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in your terminal).

### Build for Production

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

The built files will be in the `dist/` directory.

## Testing

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
src/
├── components/          # React components
│   ├── EditorPanel.tsx     # Main code editor
│   ├── PromptExplorer.tsx  # Prompt browser
│   ├── SettingsModal.tsx   # Settings and backup
│   └── ...
├── utils/              # Utility functions
│   ├── api.ts             # Backend API client
│   ├── promptLanguage.ts  # Syntax highlighting & extensions
│   ├── tokenCounter.ts    # Token counting logic
│   └── ...
├── styles/             # CSS stylesheets
├── hooks/              # React custom hooks
├── contexts/           # React contexts
└── App.tsx            # Main application component
```

## Syntax Reference

### Variables
```
[[VAR_NAME]]
```
Substitute with a value from the active variable set.

### Component Injection
```
[[PROMPT: component-name]]
```
Inject another prompt by name. Use Ctrl/Cmd+Click to navigate.

### Tag-Based Injection
```
[[PROMPT_TAG: tag1, tag2]]
```
Inject prompts filtered by tags.

### Bookmarks
```
<!-- comment -->
#! comment
```
Create bookmarks for quick navigation within a prompt.

## Configuration

### Theme
Toggle between light and dark modes via Settings (⚙️).

### Backend
The app communicates with a backend API for storing and retrieving prompts. Backend configuration is handled through the `BackendContext`.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Technologies

- **React** 18 - UI framework
- **TypeScript** - Type-safe JavaScript
- **CodeMirror 6** - Advanced code editor
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool
- **Vitest** - Unit testing

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

See LICENSE file for details.

## Links

- [GitHub Repository](https://github.com/HominemAI/prompt-assemble-ui)
- [Backend Repository](https://github.com/HominemAI/prompt-assemble)
