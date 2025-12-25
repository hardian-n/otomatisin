import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class AdminOrganizationSubscriptionDto {
  @IsIn(['FREE', 'STANDARD', 'TEAM', 'PRO', 'ULTIMATE'])
  subscriptionTier: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';

  @IsOptional()
  @IsInt()
  @Min(0)
  totalChannels?: number;

  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  period?: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsBoolean()
  isLifetime?: boolean;

  @IsOptional()
  @IsBoolean()
  allowTrial?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrailing?: boolean;
}
