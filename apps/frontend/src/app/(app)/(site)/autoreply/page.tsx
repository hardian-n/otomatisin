'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import Image from 'next/image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';

type IntegrationLite = {
  id: string;
  name: string;
  identifier: string;
  picture?: string | null;
  disabled?: boolean;
  inBetweenSteps?: boolean;
  refreshNeeded?: boolean;
  type?: string;
};

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

const AutoreplyChannels = ({
  selectedId,
  onSelect,
}: {
  selectedId?: string | null;
  onSelect: (integration: IntegrationLite | null) => void;
}) => {
  const fetch = useFetch();
  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');

  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, [fetch]);

  const { data } = useSWR('integrations', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data || [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center">
          <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500] mb-[15px]">
            Autoreply Channels
          </h2>
          <div
            onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
            className="-mt-3 group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="13"
              viewBox="0 0 7 13"
              fill="none"
            >
              <path
                d="M6 11.5L1 6.5L6 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className={clsx('flex flex-col gap-[15px]')}>
          {sortedIntegrations.map((integration: IntegrationLite) => (
            <div
              onClick={() =>
                onSelect(selectedId === integration.id ? null : integration)
              }
              key={integration.id}
              className={clsx(
                'flex gap-[12px] items-center group/profile justify-center hover:bg-boxHover rounded-e-[8px] hover:opacity-100 cursor-pointer',
                selectedId && selectedId !== integration.id && 'opacity-20'
              )}
            >
              <div
                className={clsx(
                  'relative rounded-full flex justify-center items-center gap-[6px]',
                  integration.disabled && 'opacity-50'
                )}
              >
                {(integration.inBetweenSteps || integration.refreshNeeded) && (
                  <div className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer">
                    <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-0 -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                      !
                    </div>
                    <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
                  </div>
                )}
                <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <SVGLine />
                </div>
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                  src={integration.picture}
                  className="rounded-[8px]"
                  alt={integration.identifier}
                  width={36}
                  height={36}
                />
                <Image
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={integration.identifier}
                  width={18.41}
                  height={18.41}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                {integration.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function AutoreplyPage() {
  const fetcher = useFetch();
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationLite | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Rule>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedChannel = selectedIntegration?.identifier || '';
  const hasChannel = !!selectedChannel;

  const canSubmit = useMemo(() => {
    return (
      !!form.channel?.trim() &&
      !!form.keywordPattern?.trim() &&
      !!form.matchType &&
      !!form.replyText?.trim()
    );
  }, [form]);

  const loadRules = useCallback(
    async (channel?: string) => {
      if (!channel) {
        setRules([]);
        return;
      }
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
    },
    [fetcher]
  );

  useEffect(() => {
    if (!hasChannel) {
      setRules([]);
      setForm({ ...emptyForm, channel: '' });
      setEditingId(null);
      return;
    }
    setForm({ ...emptyForm, channel: selectedChannel });
    setEditingId(null);
    loadRules(selectedChannel);
  }, [hasChannel, selectedChannel, loadRules]);

  const resetForm = () => {
    setForm({ ...emptyForm, channel: selectedChannel });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !hasChannel) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        channel: selectedChannel,
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

      await loadRules(selectedChannel);
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
      await loadRules(selectedChannel);
      if (editingId === id) {
        resetForm();
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    }
  };

  return (
    <>
      <AutoreplyChannels
        selectedId={selectedIntegration?.id || null}
        onSelect={setSelectedIntegration}
      />
      <div className="bg-newBgColorInner flex flex-1 relative">
        <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
          <div className="flex items-center justify-between mb-[16px]">
            <div className="flex flex-col gap-[4px]">
              <h1 className="text-[20px] font-[600]">Autoreply</h1>
              <div className="text-[12px] text-textItemBlur">
                {hasChannel
                  ? `${selectedIntegration?.name || selectedChannel} • ${selectedChannel}`
                  : 'Select a channel to manage autoreplies'}
              </div>
            </div>
            <Button
              type="button"
              disabled={!hasChannel || loading}
              onClick={() => loadRules(selectedChannel)}
            >
              Refresh
            </Button>
          </div>

          {error && <div className="text-red-400 text-sm mb-[12px]">{error}</div>}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-[16px]">
            <div className="xl:col-span-2">
              <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
                <table className="min-w-full text-[13px] text-textColor">
                  <thead className="bg-newTableHeader text-textColor">
                    <tr>
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
                    {!hasChannel && (
                      <tr>
                        <td
                          className="px-3 py-3 text-center text-textItemBlur"
                          colSpan={7}
                        >
                          Select a channel on the left to view rules.
                        </td>
                      </tr>
                    )}
                    {hasChannel && !loading && rules.length === 0 && (
                      <tr>
                        <td
                          className="px-3 py-3 text-center text-textItemBlur"
                          colSpan={7}
                        >
                          No rules yet.
                        </td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td
                          className="px-3 py-3 text-center text-textItemBlur"
                          colSpan={7}
                        >
                          Loading...
                        </td>
                      </tr>
                    )}
                    {rules.map((r) => (
                      <tr key={r.id} className="border-t border-newTableBorder">
                        <td className="px-3 py-2">
                          {r.channelTargetId || (
                            <span className="text-textItemBlur">All</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{r.keywordPattern}</td>
                        <td className="px-3 py-2">{r.matchType}</td>
                        <td className="px-3 py-2 truncate max-w-xs">
                          {r.replyText}
                        </td>
                        <td className="px-3 py-2">{r.priority}</td>
                        <td className="px-3 py-2">{r.isActive ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2 space-x-2">
                          <Button
                            className="h-[32px] px-3 text-sm"
                            type="button"
                            onClick={() => onEdit(r)}
                          >
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

            <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newTableHeader space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-[600]">
                  {editingId ? 'Edit Rule' : 'New Rule'}
                </h2>
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
                  name="channel"
                  placeholder="Select a channel"
                  value={form.channel || ''}
                  disabled
                  onChange={() => {}}
                />
                <Input
                  label="Channel Target ID (optional)"
                  name="channelTargetId"
                  placeholder="chat_id / room_id"
                  value={form.channelTargetId || ''}
                  disabled={!hasChannel}
                  onChange={(e: any) =>
                    setForm((s) => ({ ...s, channelTargetId: e.target.value }))
                  }
                />
                <Input
                  label="Keyword / Pattern"
                  name="keywordPattern"
                  placeholder="keyword or regex"
                  value={form.keywordPattern || ''}
                  disabled={!hasChannel}
                  onChange={(e: any) =>
                    setForm((s) => ({ ...s, keywordPattern: e.target.value }))
                  }
                />
                <div>
                  <label className="text-sm text-gray-300">Match Type</label>
                  <select
                    className="mt-1 w-full rounded border border-newTableBorder bg-newBgColorInner px-3 py-2 text-sm"
                    value={form.matchType}
                    disabled={!hasChannel}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        matchType: e.target.value as Rule['matchType'],
                      }))
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
                  name="replyText"
                  placeholder="What to reply"
                  value={form.replyText || ''}
                  disabled={!hasChannel}
                  onChange={(e: any) =>
                    setForm((s) => ({ ...s, replyText: e.target.value }))
                  }
                />
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Priority"
                    name="priority"
                    type="number"
                    value={form.priority ?? 100}
                    disabled={!hasChannel}
                    onChange={(e: any) =>
                      setForm((s) => ({
                        ...s,
                        priority: Number(e.target.value),
                      }))
                    }
                  />
                  <Input
                    label="Delay (sec)"
                    name="delaySec"
                    type="number"
                    value={form.delaySec ?? 0}
                    disabled={!hasChannel}
                    onChange={(e: any) =>
                      setForm((s) => ({
                        ...s,
                        delaySec: Number(e.target.value),
                      }))
                    }
                  />
                  <Input
                    label="Cooldown (sec)"
                    name="cooldownSec"
                    type="number"
                    value={form.cooldownSec ?? 0}
                    disabled={!hasChannel}
                    onChange={(e: any) =>
                      setForm((s) => ({
                        ...s,
                        cooldownSec: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={form.isActive ?? true}
                    disabled={!hasChannel}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, isActive: e.target.checked }))
                    }
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-200">
                    Active
                  </label>
                </div>
                <Button
                  type="submit"
                  disabled={!canSubmit || saving || !hasChannel}
                  loading={saving}
                >
                  {editingId ? 'Update Rule' : 'Create Rule'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
