'use client';

import React, { ReactNode, useCallback, useEffect } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { Title } from '@gitroom/frontend/components/layout/title';
import { TopMenu, useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { BillingAfter } from '@gitroom/frontend/components/new-layout/billing.after';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { MenuItem } from '@gitroom/frontend/components/new-layout/menu-item';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();
  const { firstMenu, secondMenu } = useMenuItem();
  const router = useRouter();
  const pathname = usePathname();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  useEffect(() => {
    if (user?.billingBlocked && pathname !== '/billing/invoice') {
      router.replace('/billing/invoice');
    }
  }, [user?.billingBlocked, pathname, router]);

  if (!user) return null;

  if (user?.billingBlocked && pathname !== '/billing/invoice') {
    return null;
  }

  const isAdmin = !!(user as any)?.admin;
  const canShowMenuItem = (item: {
    name: string;
    role?: string[];
    hide?: boolean;
    requireBilling?: boolean;
    adminOnly?: boolean;
  }) => {
    if (item.hide) {
      return false;
    }
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    if (item.requireBilling && !billingEnabled) {
      return false;
    }
    if (item.name === 'Billing' && user?.isLifetime) {
      return false;
    }
    if (item.role) {
      return item.role.includes(user?.role!);
    }
    return true;
  };

  const mobileMenuItems = [
    ...((user?.orgId &&
      (user?.tier?.current !== 'FREE' || !isGeneral || !billingEnabled) &&
      firstMenu.filter(canShowMenuItem)) ||
      []),
    ...secondMenu.filter(canShowMenuItem),
  ];

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper>
          {user?.tier?.current === 'FREE' && searchParams.get('check') && (
            <CheckPayment check={searchParams.get('check')!} mutate={mutate} />
          )}
          <ToolTip />
          <ShowMediaBoxModal />
          <ShowLinkedinCompany />
          <MediaSettingsLayout />
          <Toaster />
          <ShowPostSelector />
          <PreConditionComponent />
          <NewSubscription />
          <Support />
          <ContinueProvider />
          <div
            className={clsx(
              'flex flex-col min-h-screen w-full text-newTextColor p-[12px] overflow-x-hidden',
              jakartaSans.className
            )}
          >
            <div>{user?.admin ? <Impersonate /> : <div />}</div>
            {user?.tier?.current === 'FREE' && isGeneral && billingEnabled ? (
              <BillingAfter />
            ) : (
              <div className="flex-1 flex flex-col lg:flex-row gap-[8px]">
                <div className="hidden lg:flex flex-col bg-newBgColorInner w-[80px] rounded-[12px] shrink-0">
                  <div
                    className={clsx(
                      'lg:fixed h-full w-[64px] start-[17px] flex flex-1 top-0',
                      user?.admin && 'pt-[60px]'
                    )}
                  >
                    <div className="flex flex-col h-full gap-[32px] flex-1 py-[12px]">
                      <Logo />
                      <TopMenu />
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                  <div className="flex flex-col lg:flex-row bg-newBgColorInner min-h-[80px] px-[12px] lg:px-[20px] py-[12px] lg:py-0 gap-[12px] lg:gap-0 lg:items-center">
                    <div className="text-[20px] lg:text-[24px] font-[600] flex flex-1">
                      <Title />
                    </div>
                    <div className="flex flex-wrap gap-[12px] lg:gap-[20px] text-textItemBlur items-center">
                      <OrganizationSelector />
                      <div className="hover:text-newTextColor">
                        <ModeComponent />
                      </div>
                      <div className="w-[1px] h-[20px] bg-blockSeparator" />
                      <LanguageComponent />
                      <ChromeExtensionComponent />
                      <div className="w-[1px] h-[20px] bg-blockSeparator" />
                      <AttachToFeedbackIcon />
                      <NotificationComponent />
                    </div>
                  </div>
                  <div className="lg:hidden bg-newBgColorInner border-t border-newBgLineColor px-[12px] py-[10px]">
                    <div className="flex gap-[8px] overflow-x-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
                      {mobileMenuItems.map((item) => (
                        <MenuItem
                          compact
                          key={item.name}
                          path={item.path}
                          label={item.name}
                          icon={item.icon}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-1 gap-[1px] flex-col lg:flex-row">
                    {children}
                  </div>
                </div>
              </div>
            )}
          </div>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
