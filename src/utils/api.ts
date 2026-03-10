/**
 * PromptBackend abstraction layer for multi-mode operation
 *
 * Supports three runtime modes:
 * - 'remote': HTTP/Flask API (default)
 * - 'local': IndexedDB (persistent across restarts, no network)
 * - 'filesystem': File System Access API (editable on disk)
 *
 * Auth is future-safe: no auth parameters baked into interface.
 * getHeaders hook allows callers to add auth when available.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BackendMode = 'remote';

export interface PromptInfo {
  name: string;
  updated_at?: string;
  description?: string;
  tags?: string[];
  owner?: string;
}

export interface Prompt {
  name: string;
  content: string;
  description: string;
  tags: string[];
  owner?: string;
  source_ref?: string;
  updated_at?: string;
}

export interface SavePromptData {
  content: string;
  metadata: {
    description: string;
    tags: string[];
    owner?: string;
    revisionComments?: string;
  };
}

export interface VariableSet {
  id: string;
  name: string;
  owner?: string | null;
  variables: Record<string, string | { value: string; tag?: string }>;
}

export interface PromptVarSetData {
  variableSetIds: string[];
  overrides: Record<string, Record<string, string>>;
}

export interface VersionEntry {
  version: number;
  timestamp: string;
  comment: string;
}

export interface ExportOptions {
  tags?: string[];
  namePattern?: string;
}

export interface ImportResult {
  name: string;
  success: boolean;
  error?: string;
}

export interface BackendConfig {
  mode: BackendMode;
  baseUrl?: string;
  getHeaders?: () => Record<string, string>;
}

export interface BackendCapabilities {
  canExportAll: boolean;
  canSwitchTo: BackendMode[];
  supportsOffline: boolean;
  requiresAuth: boolean;
  name: string;
}

export interface PromptBackend {
  listPrompts(): Promise<PromptInfo[]>;
  getPrompt(name: string): Promise<Prompt>;
  savePrompt(name: string, data: SavePromptData): Promise<void>;
  deletePrompt(name: string): Promise<void>;
  listTags(): Promise<string[]>;
  listVariableSets(): Promise<VariableSet[]>;
  saveVariableSet(set: VariableSet): Promise<void>;
  deleteVariableSet(id: string): Promise<void>;
  getPromptVariableSets(promptName: string): Promise<PromptVarSetData>;
  savePromptVariableSets(promptName: string, data: PromptVarSetData): Promise<void>;
  getPromptHistory(promptName: string): Promise<VersionEntry[]>;
  revertPrompt(promptName: string, version: number): Promise<void>;
  exportPrompts(options: ExportOptions): Promise<Blob>;
  importFiles(files: File[], tags: string[]): Promise<ImportResult[]>;
  backupAllData(): Promise<Blob>;
  getCapabilities(): BackendCapabilities;
}

// ============================================================================
// REMOTE BACKEND (HTTP/Flask)
// ============================================================================

class RemoteBackend implements PromptBackend {
  private baseUrl: string;
  private getHeaders: () => Record<string, string>;

  constructor(baseUrl: string = '', getHeaders?: () => Record<string, string>) {
    this.baseUrl = baseUrl || '';
    this.getHeaders = getHeaders || (() => ({}));
  }

  private async fetchJson<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = {
      ...this.getHeaders(),
      ...options.headers,
    };

    const response = await fetch(this.baseUrl + url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private async fetchBlob(
    url: string,
    options: RequestInit = {}
  ): Promise<Blob> {
    const headers = {
      ...this.getHeaders(),
      ...options.headers,
    };

    const response = await fetch(this.baseUrl + url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  }

  async listPrompts(): Promise<PromptInfo[]> {
    const data = await this.fetchJson<{ prompts: PromptInfo[] }>('/api/prompts');
    return data.prompts || [];
  }

  async getPrompt(name: string): Promise<Prompt> {
    const encoded = encodeURIComponent(name);
    return this.fetchJson<Prompt>(`/api/prompts/${encoded}`);
  }

  async savePrompt(name: string, data: SavePromptData): Promise<void> {
    const encoded = encodeURIComponent(name);
    await this.fetchJson(`/api/prompts/${encoded}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.content,
        description: data.metadata.description,
        tags: data.metadata.tags,
        owner: data.metadata.owner,
        revision_comment: data.metadata.revisionComments,
      }),
    });
  }

  async deletePrompt(name: string): Promise<void> {
    const encoded = encodeURIComponent(name);
    await this.fetchJson(`/api/prompts/${encoded}`, { method: 'DELETE' });
  }

  async listTags(): Promise<string[]> {
    const data = await this.fetchJson<{ tags: string[] }>('/api/tags');
    return data.tags || [];
  }

  async listVariableSets(): Promise<VariableSet[]> {
    const data = await this.fetchJson<{ variable_sets: VariableSet[] }>(
      '/api/variable-sets'
    );
    return data.variable_sets || [];
  }

  async saveVariableSet(set: VariableSet): Promise<void> {
    await this.fetchJson('/api/variable-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: set.id,
        name: set.name,
        variables: set.variables,
      }),
    });
  }

  async deleteVariableSet(id: string): Promise<void> {
    const encoded = encodeURIComponent(id);
    await this.fetchJson(`/api/variable-sets/${encoded}`, {
      method: 'DELETE',
    });
  }

  async getPromptVariableSets(promptName: string): Promise<PromptVarSetData> {
    const encoded = encodeURIComponent(promptName);
    const data = await this.fetchJson<{
      variable_set_ids: string[];
      overrides: Record<string, Record<string, string>>;
    }>(`/api/prompts/${encoded}/variable-sets`);
    return {
      variableSetIds: data.variable_set_ids || [],
      overrides: data.overrides || {},
    };
  }

  async savePromptVariableSets(
    promptName: string,
    data: PromptVarSetData
  ): Promise<void> {
    const encoded = encodeURIComponent(promptName);
    await this.fetchJson(`/api/prompts/${encoded}/variable-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variable_set_ids: data.variableSetIds,
        overrides: data.overrides,
      }),
    });
  }

  async getPromptHistory(promptName: string): Promise<VersionEntry[]> {
    const encoded = encodeURIComponent(promptName);
    const data = await this.fetchJson<{ history: VersionEntry[] }>(
      `/api/prompts/${encoded}/history`
    );
    return data.history || [];
  }

  async revertPrompt(promptName: string, version: number): Promise<void> {
    const encoded = encodeURIComponent(promptName);
    await this.fetchJson(`/api/prompts/${encoded}/revert/${version}`, {
      method: 'POST',
    });
  }

  async exportPrompts(options: ExportOptions): Promise<Blob> {
    const query = new URLSearchParams();
    if (options.tags && options.tags.length > 0) {
      query.append('tags', options.tags.join(','));
    }
    if (options.namePattern) {
      query.append('name_pattern', options.namePattern);
    }

    return this.fetchBlob(
      `/api/export${query.toString() ? '?' + query.toString() : ''}`,
      {
        method: 'POST',
      }
    );
  }

  async importFiles(files: File[], tags: string[]): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    for (const file of files) {
      try {
        const name = file.name.split('.')[0].replace(/[\s\-]/g, '_');
        const content = await file.text();
        await this.savePrompt(name, {
          content,
          metadata: {
            description: `Imported from ${file.name}`,
            tags,
            owner: undefined,
          },
        });
        results.push({ name, success: true });
      } catch (error) {
        results.push({
          name: file.name,
          success: false,
          error: String(error),
        });
      }
    }
    return results;
  }

  async backupAllData(): Promise<Blob> {
    // Call backend API to get all data as zip
    return this.fetchBlob('/api/backup', { method: 'GET' });
  }

  async getVariableSet(id: string): Promise<VariableSet> {
    return this.fetchJson<VariableSet>(`/api/variable-sets/${id}`);
  }

  async updateVariableSet(id: string, set: VariableSet): Promise<void> {
    await this.fetchJson(`/api/variable-sets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: set.name,
        owner: set.owner,
        variables: set.variables,
      }),
    });
  }

  async addVariableToSet(
    setId: string,
    key: string,
    value: string,
    tag?: string
  ): Promise<void> {
    await this.fetchJson(`/api/variable-sets/${setId}/variables`, {
      method: 'POST',
      body: JSON.stringify({ key, value, tag }),
    });
  }

  async removeVariableFromSet(setId: string, key: string): Promise<void> {
    await this.fetchJson(`/api/variable-sets/${setId}/variables/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  async findVariableSets(
    name?: string,
    owner?: string,
    matchType: 'exact' | 'partial' = 'exact'
  ): Promise<VariableSet[]> {
    const response = await this.fetchJson<{ variable_sets: VariableSet[] }>(
      '/api/variable-sets/find',
      {
        method: 'POST',
        body: JSON.stringify({ name, owner, match_type: matchType }),
      }
    );
    return response.variable_sets;
  }

  async renderPrompt(
    name: string,
    variables?: Record<string, string>,
    variableSets?: string[],
    recursive: boolean = true,
    maxDepth: number = 10
  ): Promise<string> {
    const response = await this.fetchJson<{ rendered: string }>(
      `/api/prompts/${encodeURIComponent(name)}/render`,
      {
        method: 'POST',
        body: JSON.stringify({
          variables: variables || {},
          variable_sets: variableSets || [],
          recursive,
          max_depth: maxDepth,
        }),
      }
    );
    return response.rendered;
  }

  getCapabilities(): BackendCapabilities {
    return {
      name: 'Cloud Storage',
      canExportAll: true,
      canSwitchTo: ['remote'],
      supportsOffline: false,
      requiresAuth: false,
    };
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

export function createBackend(config: BackendConfig): PromptBackend {
  return new RemoteBackend(config.baseUrl, config.getHeaders);
}

/**
 * Determine backend mode (always 'remote' for OSS version)
 */
function getInitialBackendMode(): BackendMode {
  return 'remote';
}

const runtimeConfig: BackendConfig = {
  mode: getInitialBackendMode(),
};

export const backend: PromptBackend = createBackend(runtimeConfig);
