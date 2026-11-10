'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyListItem,
} from '@/lib/api/actions';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  KeyRound,
  Plug,
  Terminal,
  FileText,
  Trash2,
  BookOpen,
} from 'lucide-react';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
        <p className="text-xs font-mono text-gray-600">{title}</p>
        <CopyButton text={code} />
      </div>
      <pre className="bg-gray-900 text-gray-100 text-xs p-4 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: 'GET endpoints + read MCP tools',
  write: 'POST/PATCH endpoints + mutation MCP tools',
  admin: 'Audit log endpoint (admin roles only)',
};

export default function IntegrationsPage() {
  const { profile } = useAuth();
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ key: string; prefix: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    scopes: ['read'] as string[],
    expires_in_days: '' as '' | '30' | '90' | '365',
  });

  const baseUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
    [],
  );
  const canAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const result = await listApiKeys();
      if (!result.success) throw new Error(result.error);
      setKeys(result.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load keys' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const toggleScope = (scope: string) => {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope)
        ? f.scopes.filter((s) => s !== scope)
        : [...f.scopes, scope],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const result = await createApiKey({
        name: form.name,
        scopes: form.scopes,
        expires_in_days: form.expires_in_days === '' ? null : Number(form.expires_in_days),
      });
      if (!result.success) throw new Error(result.error);
      setCreatedKey({ key: result.data.key, prefix: result.data.key_prefix });
      setShowCreate(false);
      setForm({ name: '', scopes: ['read'], expires_in_days: '' });
      fetchKeys();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create key' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Revoke the key "${name}"? Clients using it stop working immediately.`)) return;
    const result = await revokeApiKey(id);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({ type: 'success', text: `Key "${name}" revoked` });
    fetchKeys();
  };

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        vms: {
          type: 'http',
          url: `${baseUrl}/api/mcp`,
          headers: { Authorization: 'Bearer vms_YOUR_KEY' },
        },
      },
    },
    null,
    2,
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        vms: {
          url: `${baseUrl}/api/mcp`,
          headers: { Authorization: 'Bearer vms_YOUR_KEY' },
        },
      },
    },
    null,
    2,
  );

  const curlExample = [
    `# List stock levels`,
    `curl -H "Authorization: Bearer vms_YOUR_KEY" \\`,
    `  ${baseUrl}/api/v1/stock`,
    ``,
    `# Search products`,
    `curl -H "Authorization: Bearer vms_YOUR_KEY" \\`,
    `  "${baseUrl}/api/v1/products?q=filter"`,
    ``,
    `# Record a movement (write scope)`,
    `curl -X POST -H "Authorization: Bearer vms_YOUR_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"sku":"OIL-5W30","type":"outbound","quantity":2,"reason":"Job card 1234"}' \\`,
    `  ${baseUrl}/api/v1/movements`,
  ].join('\n');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-1">
          Connect AI assistants and scripts to VMS — MCP server, scoped API keys, REST API v1.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      {createdKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-amber-900">
              API key created — copy it now
            </h3>
          </div>
          <p className="text-sm text-amber-800">
            This is the only time the full key is shown. Store it somewhere safe; VMS only keeps a
            hash.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 text-sm font-mono break-all">
              {createdKey.key}
            </code>
            <CopyButton text={createdKey.key} label="Copy key" />
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="text-sm text-amber-700 underline hover:text-amber-900"
          >
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      <Section
        icon={<Plug className="h-5 w-5" />}
        title="MCP server"
        subtitle="JSON-RPC 2.0 over HTTP POST — plug VMS into Claude Desktop, Cursor, or any MCP client"
      >
        <div className="grid gap-4">
          <div>
            <p className="text-sm text-gray-700 mb-2">
              Endpoint: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{baseUrl}/api/mcp</code>
            </p>
            <p className="text-sm text-gray-500">
              Read-scoped keys see read tools only; write-scoped keys unlock mutations. All calls are
              governed by your role&apos;s permission matrix, same as the dashboard.
            </p>
          </div>
          <CodeBlock title="Claude Desktop — claude_desktop_config.json" code={claudeConfig} />
          <CodeBlock title="Cursor — .cursor/mcp.json" code={cursorConfig} />
          <p className="text-xs text-gray-500">
            After creating a key below, replace <code>vms_YOUR_KEY</code> in the config and restart
            the client. Verify with a <code>tools/list</code> request.
          </p>
        </div>
      </Section>

      <Section
        icon={<KeyRound className="h-5 w-5" />}
        title="API keys"
        subtitle="Scoped credentials for the REST API and MCP — keys you create act as YOU, capped by both scope and your role"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Rate limit: 60 requests/minute per key. Keys can optionally expire.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <KeyRound className="h-4 w-4" />
            Create Key
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">Loading keys…</div>
          ) : keys.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No keys yet — create one to connect an MCP client or script.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prefix</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scopes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last used</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {keys.map((k) => {
                  const revoked = !!k.revoked_at;
                  const expired = !!k.expires_at && new Date(k.expires_at).getTime() <= Date.now();
                  return (
                    <tr key={k.id} className={revoked ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{k.name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{k.key_prefix}…</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-1">
                          {k.scopes.map((s) => (
                            <span
                              key={s}
                              className={`px-2 py-0.5 text-xs rounded capitalize ${
                                s === 'admin'
                                  ? 'bg-purple-100 text-purple-700'
                                  : s === 'write'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {revoked ? (
                          <span className="text-red-600">Revoked</span>
                        ) : expired ? (
                          <span className="text-amber-600">Expired</span>
                        ) : (
                          <span className="text-green-600">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!revoked && (
                          <button
                            onClick={() => handleRevoke(k.id, k.name)}
                            className="p-1.5 hover:bg-red-50 rounded text-red-600"
                            title="Revoke key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section
        icon={<Terminal className="h-5 w-5" />}
        title="REST API quickstart"
        subtitle="The same surface as MCP, over plain HTTP — spec at /api/v1/openapi.json"
      >
        <CodeBlock title="curl" code={curlExample} />
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <a href="/api/v1/openapi.json" target="_blank" className="text-blue-600 hover:underline">
              OpenAPI 3.0 spec →
            </a>
          </p>
          <p>
            Routes: <code>products</code>, <code>stock</code>, <code>movements</code>,{' '}
            <code>loans</code>, <code>takes</code>, <code>low-stock</code>, <code>audit</code> (admin),{' '}
            <code>health</code>. Errors:{' '}
            <code>{'{ "error": { "code", "message" } }'}</code>.
          </p>
        </div>
      </Section>

      <Section
        icon={<FileText className="h-5 w-5" />}
        title="Machine-readable discovery"
        subtitle="llms.txt lets agents find this surface on their own"
      >
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <a href="/llms.txt" target="_blank" className="text-blue-600 hover:underline">
              /llms.txt
            </a>{' '}
            — static manifest, and{' '}
            <a href="/api/llms" target="_blank" className="text-blue-600 hover:underline">
              /api/llms
            </a>{' '}
            — live version generated from the current tool registry.
          </p>
          <p className="flex items-center gap-2 text-gray-500 text-xs">
            <BookOpen className="h-4 w-4" />
            Both list the auth model, rate limit, REST routes, and every MCP tool with its scope.
          </p>
        </div>
      </Section>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create API key</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Claude Desktop on Kurt's laptop"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
                <div className="space-y-2">
                  {(['read', 'write', 'admin'] as const).map((scope) => {
                    const disabled = scope === 'admin' && !canAdmin;
                    return (
                      <label key={scope} className={`flex items-start gap-3 ${disabled ? 'opacity-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.scopes.includes(scope)}
                          disabled={disabled}
                          onChange={() => toggleScope(scope)}
                          className="mt-1"
                        />
                        <span>
                          <span className="text-sm font-medium text-gray-800 capitalize">{scope}</span>
                          <span className="block text-xs text-gray-500">
                            {SCOPE_DESCRIPTIONS[scope]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
                <select
                  value={form.expires_in_days}
                  onChange={(e) =>
                    setForm({ ...form, expires_in_days: e.target.value as typeof form.expires_in_days })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Never expires</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || form.scopes.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {isSubmitting ? 'Creating…' : 'Create key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
