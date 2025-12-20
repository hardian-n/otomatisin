'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';

type Rule = {
  id: string;
  channel: string;
  channelTargetId?: string | null;
  keywordPattern: string;
  matchType: 'EXACT' | 'CONTAINS' | 'REGEX';
  replyText: string;
  priority: number;
  delaySec: number;
  cooldownSec: number;
  isActive: boolean;
};

const matchTypes: Rule['matchType'][] = ['EXACT', 'CONTAINS', 'REGEX'];

const emptyForm: Partial<Rule> = {
  channel: '',
  channelTargetId: '',
  keywordPattern: '',
  matchType: 'CONTAINS',
  replyText: '',
  priority: 100,
  delaySec: 0,
  cooldownSec: 0,
  isActive: true,
};

export default function AutoreplyAdminPage() {
  const fetcher = useFetch();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [form, setForm] = useState<Partial<Rule>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      !!form.channel?.trim() &&
      !!form.keywordPattern?.trim() &&
      !!form.matchType &&
      !!form.replyText?.trim()
    );
  }, [form]);

  const loadRules = async (channel?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = channel ? `?channel=${encodeURIComponent(channel)}` : '';
      const res = await fetcher(`/v1/autoreply/rules${qs}`);
      const data = await res.json();
      setRules(data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules(filterChannel || undefined);
  }, [filterChannel]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        channel: form.channel?.trim(),
        channel_target_id: form.channelTargetId || null,
        keyword_pattern: form.keywordPattern?.trim(),
        match_type: form.matchType,
        reply_text: form.replyText?.trim(),
        priority: Number(form.priority ?? 100),
        delay_sec: Number(form.delaySec ?? 0),
        cooldown_sec: Number(form.cooldownSec ?? 0),
        is_active: form.isActive,
      };

      if (editingId) {
        await fetcher(`/v1/autoreply/rules/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await fetcher('/v1/autoreply/rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await loadRules(filterChannel || undefined);
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setForm({
      channel: rule.channel,
      channelTargetId: rule.channelTargetId || '',
      keywordPattern: rule.keywordPattern,
      matchType: rule.matchType,
      replyText: rule.replyText,
      priority: rule.priority,
      delaySec: rule.delaySec,
      cooldownSec: rule.cooldownSec,
      isActive: rule.isActive,
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    setError(null);
    try {
      await fetcher(`/v1/autoreply/rules/${id}`, { method: 'DELETE' });
      await loadRules(filterChannel || undefined);
      if (editingId === id) {
        resetForm();
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Autoreply Rules</h1>
        <div className="flex items-center gap-2">
          <input
            className="border border-gray-700 bg-transparent rounded px-3 py-2 text-sm"
            placeholder="Filter by channel (e.g. telegram)"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
          />
          <Button type="button" onClick={() => loadRules(filterChannel || undefined)}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-900 text-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">Channel</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Keyword</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Reply</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rules.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-400" colSpan={8}>
                      No rules yet.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-400" colSpan={8}>
                      Loading...
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-gray-800">
                    <td className="px-3 py-2">{r.channel}</td>
                    <td className="px-3 py-2">{r.channelTargetId || <span className="text-gray-500">—</span>}</td>
                    <td className="px-3 py-2">{r.keywordPattern}</td>
                    <td className="px-3 py-2">{r.matchType}</td>
                    <td className="px-3 py-2 truncate max-w-xs">{r.replyText}</td>
                    <td className="px-3 py-2">{r.priority}</td>
                    <td className="px-3 py-2">{r.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 space-x-2">
                      <Button className="h-[32px] px-3 text-sm" type="button" onClick={() => onEdit(r)}>
                        Edit
                      </Button>
                      <Button
                        secondary
                        className="h-[32px] px-3 text-sm"
                        type="button"
                        onClick={() => onDelete(r.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Rule' : 'New Rule'}</h2>
            {editingId && (
              <button
                type="button"
                className="text-sm text-blue-400 hover:underline"
                onClick={resetForm}
              >
                Reset
              </button>
            )}
          </div>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              label="Channel"
              placeholder="e.g. telegram / thread"
              value={form.channel || ''}
              onChange={(e: any) => setForm((s) => ({ ...s, channel: e.target.value }))}
            />
            <Input
              label="Channel Target ID (optional)"
              placeholder="chat_id / room_id"
              value={form.channelTargetId || ''}
              onChange={(e: any) =>
                setForm((s) => ({ ...s, channelTargetId: e.target.value }))
              }
            />
            <Input
              label="Keyword / Pattern"
              placeholder="keyword or regex"
              value={form.keywordPattern || ''}
              onChange={(e: any) =>
                setForm((s) => ({ ...s, keywordPattern: e.target.value }))
              }
            />
            <div>
              <label className="text-sm text-gray-300">Match Type</label>
              <select
                className="mt-1 w-full rounded border border-gray-700 bg-black px-3 py-2 text-sm"
                value={form.matchType}
                onChange={(e) =>
                  setForm((s) => ({ ...s, matchType: e.target.value as Rule['matchType'] }))
                }
              >
                {matchTypes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Reply Text"
              placeholder="What to reply"
              value={form.replyText || ''}
              onChange={(e: any) => setForm((s) => ({ ...s, replyText: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Priority"
                type="number"
                value={form.priority ?? 100}
                onChange={(e: any) =>
                  setForm((s) => ({ ...s, priority: Number(e.target.value) }))
                }
              />
              <Input
                label="Delay (sec)"
                type="number"
                value={form.delaySec ?? 0}
                onChange={(e: any) =>
                  setForm((s) => ({ ...s, delaySec: Number(e.target.value) }))
                }
              />
              <Input
                label="Cooldown (sec)"
                type="number"
                value={form.cooldownSec ?? 0}
                onChange={(e: any) =>
                  setForm((s) => ({ ...s, cooldownSec: Number(e.target.value) }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
              />
              <label htmlFor="is_active" className="text-sm text-gray-200">
                Active
              </label>
            </div>
            <Button type="submit" disabled={!canSubmit || saving} loading={saving}>
              {editingId ? 'Update Rule' : 'Create Rule'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
