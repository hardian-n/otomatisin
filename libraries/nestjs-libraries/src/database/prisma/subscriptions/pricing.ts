export interface PricingInnerInterface {
  current: string;
  month_price: number;
  year_price: number;
  channel?: number;
  posts_per_month: number;
  team_members: boolean;
  community_features: boolean;
  featured_by_gitroom: boolean;
  ai: boolean;
  import_from_channels: boolean;
  image_generator?: boolean;
  image_generation_count: number;
  generate_videos: number;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
}
export interface PricingInterface {
  [key: string]: PricingInnerInterface;
}
export const pricing: PricingInterface = {
  FREE: {
    current: 'FREE',
    month_price: 0,
    year_price: 0,
    channel: 3,
    image_generation_count: 3,
    posts_per_month: 3,
    team_members: false,
    community_features: false,
    featured_by_gitroom: false,
    ai: false,
    import_from_channels: false,
    image_generator: false,
    public_api: false,
    webhooks: 0,
    autoPost: false,
    generate_videos: 0,
  },
  BASIC: {
    current: 'BASIC',
    month_price: 20000,
    year_price: 20000,
    channel: 3,
    posts_per_month: 3,
    image_generation_count: 3,
    team_members: true,
    community_features: true,
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 3,
    autoPost: true,
    generate_videos: 3,
  },
  ENTERPRISE: {
    current: 'ENTERPRISE',
    month_price: 20000,
    year_price: 20000,
    channel: 3,
    posts_per_month: 3,
    image_generation_count: 3,
    team_members: true,
    community_features: true,
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 3,
    autoPost: true,
    generate_videos: 3,
  },
};
