import type { ComponentType } from 'react'
import { template as bookingConfirmation } from './booking-confirmation'
import { template as cleanerPaymentConfirmation } from './cleaner-payment-confirmation'
import { template as bookingEstimate } from './booking-estimate'
import { template as ownerBookingNotification } from './owner-booking-notification'
import { customerPaymentReceipt, customerTipReceipt, cleanerPayoutReceipt, cleanerTipPayoutReceipt } from './payment-receipts'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmation': bookingConfirmation,
  'cleaner-payment-confirmation': cleanerPaymentConfirmation,
  'booking-estimate': bookingEstimate,
  'owner-booking-notification': ownerBookingNotification,
  'customer-payment-receipt': customerPaymentReceipt,
  'customer-tip-receipt': customerTipReceipt,
  'cleaner-payout-receipt': cleanerPayoutReceipt,
  'cleaner-tip-payout-receipt': cleanerTipPayoutReceipt,
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
}
