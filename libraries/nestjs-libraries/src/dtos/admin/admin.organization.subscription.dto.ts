import { IsIn, IsOptional, IsString, IsISO8601 } from 'class-validator';

export class AdminOrganizationSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELED'])
  status?: 'PENDING' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELED';

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsISO8601()
  trialEndsAt?: string;
}
