'use client';

import { createContext, FC, ReactNode, useContext } from 'react';
import { User } from '@prisma/client';
import {
  pricing,
  PricingInnerInterface,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

type PlanSummary = {
  id: string;
  key: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  trialEnabled: boolean;
  trialDays: number;
  isActive: boolean;
  isDefault: boolean;
  channelLimit: number | null;
  channelLimitUnlimited: boolean;
  postLimitMonthly: number | null;
  postLimitMonthlyUnlimited: boolean;
  memberLimit: number | null;
  memberLimitUnlimited: boolean;
  storageLimitMb: number | null;
  storageLimitMbUnlimited: boolean;
  inboxLimitMonthly: number | null;
  inboxLimitMonthlyUnlimited: boolean;
  autoreplyLimit: number | null;
  autoreplyLimitUnlimited: boolean;
};

type SubscriptionSummary = {
  id: string;
  status: string;
  startsAt: string;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
};
export const UserContext = createContext<
  | undefined
  | (User & {
      orgId: string;
      tier: PricingInnerInterface;
      plan?: PlanSummary | null;
      subscription?: SubscriptionSummary | null;
      publicApi: string;
      role: 'USER' | 'ADMIN' | 'SUPERADMIN';
      totalChannels: number;
      isLifetime?: boolean;
      impersonate: boolean;
      allowTrial: boolean;
      isTrailing: boolean;
      billingBlocked?: boolean;
    })
>(undefined);
export const ContextWrapper: FC<{
  user: User & {
    orgId: string;
    tier: string;
    plan?: PlanSummary | null;
    subscription?: SubscriptionSummary | null;
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
    publicApi: string;
    totalChannels: number;
    billingBlocked?: boolean;
  };
  children: ReactNode;
}> = ({ user, children }) => {
  const plan = user?.plan;
  const planKey = (plan?.key || user.tier || 'FREE').toUpperCase();
  const fallback = pricing[planKey] || pricing.FREE;
  const tierFromPlan: PricingInnerInterface = {
    ...fallback,
    current: planKey,
    month_price: plan?.price ?? fallback.month_price,
    year_price: plan?.price ?? fallback.year_price,
    channel: plan?.channelLimitUnlimited
      ? Number.MAX_SAFE_INTEGER
      : plan?.channelLimit ?? fallback.channel,
    posts_per_month: plan?.postLimitMonthlyUnlimited
      ? Number.MAX_SAFE_INTEGER
      : plan?.postLimitMonthly ?? fallback.posts_per_month,
    team_members: planKey !== 'FREE',
    community_features: planKey !== 'FREE',
    featured_by_gitroom: planKey !== 'FREE',
    ai: planKey !== 'FREE',
    import_from_channels: planKey !== 'FREE',
    image_generator: planKey !== 'FREE',
    image_generation_count: plan?.postLimitMonthly ?? fallback.image_generation_count,
    generate_videos: plan?.postLimitMonthly ?? fallback.generate_videos,
    public_api: planKey !== 'FREE',
    webhooks: planKey === 'FREE' ? 0 : fallback.webhooks,
    autoPost: planKey !== 'FREE',
  };
  const values = user
    ? {
        ...user,
        tier: tierFromPlan,
      }
    : ({} as any);
  return <UserContext.Provider value={values}>{children}</UserContext.Provider>;
};
export const useUser = () => useContext(UserContext);
