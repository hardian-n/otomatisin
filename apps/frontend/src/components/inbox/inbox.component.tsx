'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import useSWR from 'swr';
import dayjs from 'dayjs';
import Image from 'next/image';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';

type IntegrationLite = {
  id: string;
  name: string;
  identifier?: string;
  providerIdentifier?: string;
  picture?: string | null;
  profile?: string | null;
  disabled?: boolean;
  inBetweenSteps?: boolean;
  refreshNeeded?: boolean;
  type?: string;
};

type ThreadsReply = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  permalink?: string;
};

type TelegramMessage = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
};

type InboxPost = {
  id: string;
  content: string;
  publishDate: string;
  releaseId?: string | null;
  releaseURL?: string | null;
  image?: string | null;
  replies: ThreadsReply[];
};

type InboxResponse = {
  integration: {
    id: string;
    name: string;
    profile?: string | null;
    picture?: string | null;
    providerIdentifier: string;
  };
  posts: InboxPost[];
  lastSync: string;
  error?: string;
};

type TelegramInboxResponse = {
  integration: {
    id: string;
    name: string;
    profile?: string | null;
    picture?: string | null;
    providerIdentifier: string;
  };
  messages: TelegramMessage[];
  lastSync: string;
  error?: string;
};

const providerLabels: Record<string, string> = {
  threads: 'Threads',
  telegram: 'Telegram',
};

const InboxChannels = ({
  integrations,
  selectedId,
  onSelect,
}: {
  integrations: IntegrationLite[];
  selectedId?: string | null;
  onSelect: (integration: IntegrationLite | null) => void;
}) => {
  const [collapseMenu, setCollapseMenu] = useCookie('collapseInboxMenu', '0');

  const normalizedIntegrations = useMemo(() => {
    return (integrations || []).map((integration: IntegrationLite) => ({
      ...integration,
      identifier: integration.identifier || integration.providerIdentifier || '',
    }));
  }, [integrations]);

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      normalizedIntegrations,
      ['disabled', 'identifier', 'name'],
      ['asc', 'asc', 'asc']
    );
  }, [normalizedIntegrations]);

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
            Inbox Channels
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
          {!sortedIntegrations.length && (
            <div className="text-sm text-textItemBlur">No channels found.</div>
          )}
          {sortedIntegrations.map((integration: IntegrationLite) => {
            const identifier =
              integration.identifier || integration.providerIdentifier || '';
            return (
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
                  fallbackSrc={`/icons/platforms/${identifier}.png`}
                  src={integration.picture}
                  className="rounded-[8px]"
                  alt={identifier}
                  width={36}
                  height={36}
                />
                <Image
                  src={`/icons/platforms/${identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={identifier}
                  width={18}
                  height={18}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                  {integration.name}
                  {integration.providerIdentifier && (
                  <span className="text-[11px] text-textItemBlur">
                      {' '}
                      -{' '}
                      {providerLabels[integration.providerIdentifier] ||
                        integration.providerIdentifier}
                    </span>
                  )}
                </div>
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
};

export const InboxComponent = () => {
  const fetcher = useFetch();
  const [channels, setChannels] = useState<IntegrationLite[]>([]);
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationLite | null>(null);

  const loadChannels = useCallback(async () => {
    const safeLoad = async (path: string) => {
      try {
        const res = await fetcher(path);
        if (!res.ok) {
          return [];
        }
        const data = await res.json();
        return data?.channels || [];
      } catch {
        return [];
      }
    };

    const [threads, telegram] = await Promise.all([
      safeLoad('/inbox/threads/channels'),
      safeLoad('/inbox/telegram/channels'),
    ]);

    return [...threads, ...telegram];
  }, [fetcher]);

  const { data: channelData, isLoading: channelsLoading } = useSWR(
    'inbox-channels',
    loadChannels,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      fallbackData: [],
    }
  );

  const sortedChannels = useMemo(() => {
    return orderBy(
      channelData || [],
      ['providerIdentifier', 'disabled', 'name'],
      ['asc', 'asc', 'asc']
    );
  }, [channelData]);

  useEffect(() => {
    setChannels(sortedChannels as IntegrationLite[]);
  }, [sortedChannels]);

  const selectedProvider =
    selectedIntegration?.providerIdentifier || selectedIntegration?.identifier;

  const loadReplies = useCallback(
    async (path: string) => {
      return (await (await fetcher(path)).json()) as
        | InboxResponse
        | TelegramInboxResponse;
    },
    [fetcher]
  );

  const repliesKey = selectedIntegration
    ? selectedProvider === 'telegram'
      ? `/inbox/telegram/messages?integrationId=${encodeURIComponent(
          selectedIntegration.id
        )}&limit=20`
      : `/inbox/threads/replies?integrationId=${encodeURIComponent(
          selectedIntegration.id
        )}&postLimit=10&replyLimit=20`
    : null;

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(repliesKey, loadReplies, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  const posts = (data as InboxResponse)?.posts || [];
  const messages = (data as TelegramInboxResponse)?.messages || [];
  const lastSync = data?.lastSync
    ? dayjs(data.lastSync).format('HH:mm:ss')
    : '';

  return (
    <>
      <div className="flex flex-col lg:flex-row w-full gap-[12px]">
        <div className="hidden lg:block">
          <InboxChannels
            integrations={channels}
            selectedId={selectedIntegration?.id || null}
            onSelect={setSelectedIntegration}
          />
        </div>
        <div className="bg-newBgColorInner flex flex-1 relative">
          <div className="absolute top-0 start-0 w-full h-full p-[12px] lg:p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-[12px] mb-[16px]">
              <div className="flex flex-col gap-[4px]">
                <h1 className="text-[20px] font-[600]">Inbox</h1>
                <div className="text-[12px] text-textItemBlur">
                  {selectedIntegration
                    ? `${selectedIntegration.name} - ${
                        providerLabels[selectedProvider || ''] ||
                        selectedProvider
                      }`
                    : 'Select a channel to view inbox'}
                  {lastSync && ` | last sync ${lastSync}`}
                </div>
              </div>
              <div className="flex items-center gap-[8px]">
                <div className="text-[12px] text-textItemBlur">
                  Auto refresh 15s
                </div>
                <Button
                  type="button"
                  disabled={!selectedIntegration || isLoading}
                  onClick={() => refresh()}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mb-[12px] w-full sm:max-w-[260px]">
              <Select
                label="Channel"
                name="channel"
                disableForm={true}
                hideErrors={true}
                value={selectedIntegration?.id || ''}
                onChange={(e) => {
                  const selected = channels.find(
                    (channel) => channel.id === e.target.value
                  );
                  setSelectedIntegration(selected || null);
                }}
              >
                <option value="">
                  {channelsLoading ? 'Loading channels...' : 'Select a channel'}
                </option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} -{' '}
                    {providerLabels[channel.providerIdentifier || ''] ||
                      channel.providerIdentifier}
                  </option>
                ))}
              </Select>
            </div>

            {error && (
              <div className="text-red-400 text-sm mb-[12px]">
                Failed to load inbox.
              </div>
            )}
            {data?.error === 'refresh_needed' && (
              <div className="text-yellow-300 text-sm mb-[12px]">
                Channel needs reconnect to refresh token.
              </div>
            )}

            {!selectedIntegration && (
              <div className="text-sm text-textItemBlur">
                Choose a channel from the list.
              </div>
            )}

            {selectedIntegration && isLoading && (
              <div className="text-sm text-textItemBlur">Loading inbox...</div>
            )}

            {selectedIntegration &&
              !isLoading &&
              selectedProvider === 'telegram' &&
              !messages.length && (
                <div className="text-sm text-textItemBlur">
                  No messages found yet.
                </div>
              )}

            {selectedIntegration &&
              !isLoading &&
              selectedProvider !== 'telegram' &&
              !posts.length && (
                <div className="text-sm text-textItemBlur">
                  No replies found yet.
                </div>
              )}

            {selectedIntegration && selectedProvider === 'telegram' && (
              <div className="flex flex-col gap-[12px]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="border border-newTableBorder rounded-[10px] bg-newTableHeader p-[12px]"
                  >
                    <div className="flex items-center justify-between text-xs text-textItemBlur mb-[6px]">
                      <div>{msg.username ? `@${msg.username}` : 'User'}</div>
                      <div>
                        {msg.timestamp
                          ? dayjs(msg.timestamp).format('HH:mm')
                          : ''}
                      </div>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {msg.text || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedIntegration && selectedProvider !== 'telegram' && (
              <div className="flex flex-col gap-[16px]">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-newTableBorder rounded-[10px] bg-newTableHeader p-[16px]"
                  >
                    <div className="flex flex-col gap-[8px]">
                      <div className="text-[12px] text-textItemBlur">
                        {dayjs(post.publishDate).format('DD/MM/YYYY HH:mm')}
                      </div>
                      <div
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: post.content,
                        }}
                      />
                      {post.releaseURL && (
                        <a
                          href={post.releaseURL}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                        >
                          View on Threads
                        </a>
                      )}
                    </div>

                    <div className="mt-[12px] border-t border-newTableBorder pt-[12px]">
                      <div className="text-xs text-textItemBlur mb-[8px]">
                        Replies ({post.replies?.length || 0})
                      </div>
                      {!post.replies?.length && (
                        <div className="text-sm text-textItemBlur">
                          No replies yet.
                        </div>
                      )}
                      <div className="flex flex-col gap-[10px]">
                        {(post.replies || []).map((reply) => (
                          <div
                            key={reply.id}
                            className="bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[10px]"
                          >
                            <div className="flex items-center justify-between text-xs text-textItemBlur mb-[6px]">
                              <div>
                                {reply.username ? `@${reply.username}` : 'User'}
                              </div>
                              <div>
                                {reply.timestamp
                                  ? dayjs(reply.timestamp).format('HH:mm')
                                  : ''}
                              </div>
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {reply.text || ''}
                            </div>
                            {reply.permalink && (
                              <a
                                href={reply.permalink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-400 hover:underline mt-[6px] inline-block"
                              >
                                Open reply
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
