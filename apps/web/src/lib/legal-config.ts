/**
 * SiteSecura Legal & Compliance Configuration Constants
 *
 * NOTE FOR LEGAL REVIEW:
 * Update these constants with actual company and legal entity information
 * prior to production launch.
 */

export const LEGAL_CONFIG = {
  // Configured Legal Entity
  COMPANY_NAME: "[SiteSecura]",
  ENTITY_DBA: "[SiteSecura PVT LTD], doing business as SiteSecura",
  BRAND_NAME: "SiteSecura",

  // Business & Contact Addresses
  BUSINESS_ADDRESS: "[Indore, Madhya Pradesh]",
  CONTACT_EMAIL: "legal@sitesecura.com",
  CONTACT_EMAIL_PLACEHOLDER: "[legal@sitesecura.com]",
  SECURITY_EMAIL: "security@sitesecura.com",
  SECURITY_EMAIL_PLACEHOLDER: "[security@sitesecura.com]",
  SUPPORT_EMAIL: "support@sitesecura.com",

  // Dates & Policies
  EFFECTIVE_DATE: "September 30, 2026",
  LAST_UPDATED: "September 30, 2026",

  // Jurisdiction & Liability Review Placeholders
  JURISDICTION: "[JURISDICTION]",
  LIABILITY_PERIOD: "[3/6/12] months",
  LIABILITY_MINIMUM_AMOUNT: "[A SPECIFIED MINIMUM AMOUNT]",
  DISPUTE_RESOLUTION_CLAUSE: "[GOVERNING LAW AND DISPUTE-RESOLUTION TERMS TO BE COMPLETED AFTER LEGAL REVIEW.]",
} as const;
