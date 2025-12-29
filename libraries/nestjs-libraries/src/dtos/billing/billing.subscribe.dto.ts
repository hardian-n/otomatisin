import { IsIn, IsOptional, IsString } from 'class-validator';

export class BillingSubscribeDto {
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  period?: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsIn(['STANDARD', 'PRO', 'TEAM', 'ULTIMATE'])
  billing?: 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE';

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  planKey?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  utm?: string;

  @IsOptional()
  @IsString()
  tolt?: string;
}
