'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type XSettingsPayload = {
  apiKey: string;
  apiSecret: string;
};

export const XSettings = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const data = (await (await fetch('/settings/x')).json()) as
        | XSettingsPayload
        | undefined;
      setApiKey(data?.apiKey || '');
      setApiSecret(data?.apiSecret || '');
    } catch {
      setApiKey('');
      setApiSecret('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    const payload = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
    };
    if (!payload.apiKey || !payload.apiSecret) {
      toaster.show(
        t('x_settings_required', 'Please fill X API key and secret'),
        'warning'
      );
      return;
    }

    await fetch('/settings/x', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    toaster.show(t('x_settings_saved', 'X settings saved'), 'success');
  }, [apiKey, apiSecret]);

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
      <div className="text-[16px]">{t('x', 'X')}</div>
      <div className="text-[12px] text-customColor18">
        {t(
          'x_settings_desc',
          'Set your X API key and secret once, then add X channels without using environment variables.'
        )}
      </div>
      <div className="flex flex-col gap-[12px]">
        <Input
          label={t('x_api_key', 'X API Key')}
          name="xApiKey"
          disableForm={true}
          value={apiKey}
          onChange={(e: any) => setApiKey(e.target.value)}
          placeholder="Your X API key"
        />
        <Input
          label={t('x_api_secret', 'X API Secret')}
          name="xApiSecret"
          disableForm={true}
          type="password"
          value={apiSecret}
          onChange={(e: any) => setApiSecret(e.target.value)}
          placeholder="Your X API secret"
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
