export type BillingType = 'api' | 'subscription' | 'free' | 'unknown' | string

export type SubscriptionType = 'free' | 'pro' | 'max' | 'team' | 'enterprise' | string

export type RateLimitTier = string

export type OAuthProfileResponse = {
  account: {
    uuid: string
    email: string
    display_name?: string | null
    created_at?: string
  }
  organization: {
    uuid: string
    organization_type?: string | null
    rate_limit_tier?: RateLimitTier | null
    has_extra_usage_enabled?: boolean | null
    billing_type?: BillingType | null
    subscription_created_at?: string
  }
}

export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  account?: {
    uuid: string
    email_address: string
  }
  organization?: {
    uuid: string
  }
}

export type OAuthTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes: string[]
  subscriptionType: SubscriptionType | null
  rateLimitTier: RateLimitTier | null
  profile?: OAuthProfileResponse
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid?: string
  }
}

export type ReferralCampaign = 'claude_code_guest_pass' | string

export type ReferrerRewardInfo = {
  credit_amount_cents?: number
  credit_amount_usd?: number
  currency?: string
}

export type ReferralEligibilityResponse = {
  eligible: boolean
  campaign?: ReferralCampaign
  remaining_passes?: number
  referral_code_details?: {
    referral_link?: string
    referral_code?: string
  }
  referrer_reward?: ReferrerRewardInfo
  referrer_reward_info?: ReferrerRewardInfo
  [key: string]: unknown
}

export type ReferralRedemptionsResponse = {
  limit?: number
  redemptions?: Array<{
    redeemed_at?: string
    referee_email?: string
    status?: string
  }>
  referrer_reward_info?: ReferrerRewardInfo
  [key: string]: unknown
}
