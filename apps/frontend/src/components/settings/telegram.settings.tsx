'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type TelegramSettingsPayload = {
  botName: string;
  botToken: string;
};

export const TelegramSettings = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const [isLoading, setIsLoading] = useState(true);
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const data = (await (await fetch('/settings/telegram')).json()) as
        | TelegramSettingsPayload
        | undefined;
      setBotName(data?.botName || '');
      setBotToken(data?.botToken || '');
    } catch {
      setBotName('');
      setBotToken('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    const payload = {
      botName: botName.trim(),
      botToken: botToken.trim(),
    };
    if (!payload.botName || !payload.botToken) {
      toaster.show(
        t('telegram_settings_required', 'Please fill bot name and token'),
        'warning'
      );
      return;
    }

    await fetch('/settings/telegram', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    toaster.show(
      t('telegram_settings_saved', 'Telegram settings saved'),
      'success'
    );
  }, [botName, botToken]);

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
      <div className="text-[16px]">{t('telegram', 'Telegram')}</div>
      <div className="text-[12px] text-customColor18">
        {t(
          'telegram_settings_desc',
          'Configure your Telegram bot once and connect channels without re-entering tokens.'
        )}
      </div>
      <div className="flex flex-col gap-[12px]">
        <Input
          label={t('telegram_bot_name', 'Telegram Bot Name')}
          name="telegramBotName"
          disableForm={true}
          value={botName}
          onChange={(e: any) => setBotName(e.target.value)}
          placeholder="@your_bot"
        />
        <Input
          label={t('telegram_bot_token', 'Telegram Bot Token')}
          name="telegramBotToken"
          disableForm={true}
          type="password"
          value={botToken}
          onChange={(e: any) => setBotToken(e.target.value)}
          placeholder="123456:ABCDEF..."
        />
      </div>
      <div>
        <Button type="button" onClick={saveSettings}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};
