export interface PlanPricingItem {
  id: "free" | "basic" | "pro" | "agency";
  name: string;
  badge?: string;
  description: string;
  audience: string;
  referencePrice: number;
  monthlyPrice: number;
  yearlyAnnualTotal: number;
  yearlyEquivalentMonthly: number;
  yearlySavings: number;
  savingsPercentage: number;
  websiteLimit: number;
  scansLimit: number;
  features: string[];
  differentiators?: string[];
  ctaMonthly: string;
  ctaYearly: string;
  supportingText: string;
  popular: boolean;
  // Backward compatibility fields
  price: string;
  interval: string;
  cta: string;
}

export const PRICING_PLANS: PlanPricingItem[] = [
  {
    id: "free",
    name: "Free",
    description:
      "Get started with essential website security checks. Perfect for individuals and small website owners who want to understand their website's security posture.",
    audience: "Individuals and beginners",
    referencePrice: 0,
    monthlyPrice: 0,
    yearlyAnnualTotal: 0,
    yearlyEquivalentMonthly: 0,
    yearlySavings: 0,
    savingsPercentage: 0,
    websiteLimit: 1,
    scansLimit: 10,
    features: [
      "1 Website",
      "10 Scans per month",
      "Deterministic Security Score",
      "SSL/TLS, DNS, Header & Cookie Checks",
      "Top 3 Findings Unlocked",
      "Actionable Plain-English Fixes",
      "7-Day Scan History",
      "Preview PDF Report",
    ],
    ctaMonthly: "Start Free",
    ctaYearly: "Start Free",
    cta: "Start Free",
    price: "$0",
    interval: "forever",
    popular: false,
    supportingText: "No credit card required.",
  },
  {
    id: "basic",
    name: "Basic",
    description:
      "Build a stronger security routine for your business website with automated monitoring, timely alerts, and useful reporting.",
    audience: "Small businesses and website owners",
    referencePrice: 19,
    monthlyPrice: 9,
    yearlyAnnualTotal: 90,
    yearlyEquivalentMonthly: 7.5,
    yearlySavings: 18,
    savingsPercentage: 16.7,
    websiteLimit: 2,
    scansLimit: 100,
    features: [
      "Up to 2 Websites",
      "100 Scans per month",
      "Weekly automated monitoring",
      "Email alerts for SSL expiry & score drops",
      "Full PDF report exports",
      "SiteSecura Verified Badge",
      "30-Day historical trends",
      "Full security findings & remediation",
      "Standard scan queue",
    ],
    differentiators: [
      "Weekly automated monitoring & alerts",
      "Full unredacted findings & PDF exports",
    ],
    ctaMonthly: "Get Basic",
    ctaYearly: "Choose Basic Yearly",
    cta: "Upgrade to Basic",
    price: "$9",
    interval: "/month",
    popular: false,
    supportingText: "Everything you need to monitor a small website portfolio.",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Recommended for growing teams",
    description:
      "Go beyond basic monitoring with deeper security insights, AI-assisted remediation, and tools for managing a growing portfolio.",
    audience: "Growing businesses and developers",
    referencePrice: 69,
    monthlyPrice: 49,
    yearlyAnnualTotal: 490,
    yearlyEquivalentMonthly: 40.83,
    yearlySavings: 98,
    savingsPercentage: 16.7,
    websiteLimit: 10,
    scansLimit: 500,
    features: [
      "Up to 10 Websites",
      "500 Scans per month",
      "Daily automated monitoring",
      "Up to 3 Team member seats",
      "CSV bulk website import",
      "Deep Scan F1–F8 assessment (up to 50 pages)",
      "AI Security Advisor & custom fix plans",
      "90-Day history retention",
      "Instant security change notifications",
      "Security Health Timeline & drift tracking",
      "Priority scan queue",
    ],
    differentiators: [
      "Daily monitoring & instant alerts",
      "Deep Scan F1–F8 + AI Security Advisor",
    ],
    ctaMonthly: "Get Pro",
    ctaYearly: "Choose Pro Yearly",
    cta: "Upgrade to Pro",
    price: "$49",
    interval: "/month",
    popular: true,
    supportingText: "For growing businesses that need more visibility and control.",
  },
  {
    id: "agency",
    name: "Agency",
    badge: "Built for agencies",
    description:
      "Manage multiple client websites from one place with scalable monitoring, branded reporting, and collaborative workflows.",
    audience: "Agencies and teams managing client websites",
    referencePrice: 129,
    monthlyPrice: 99,
    yearlyAnnualTotal: 990,
    yearlyEquivalentMonthly: 82.5,
    yearlySavings: 198,
    savingsPercentage: 16.7,
    websiteLimit: 100,
    scansLimit: 3000,
    features: [
      "Up to 100 Websites",
      "3,000 Scans per month",
      "Up to 15 Team member seats",
      "Custom white-label PDF reports (logo & colors)",
      "Client grouping & portfolio folders",
      "Bulk CSV import & export",
      "Deep Scan F1–F8 assessment (up to 100 pages)",
      "365-Day history retention",
      "Dedicated agency support",
      "Priority scan queue",
    ],
    differentiators: [
      "Custom white-label PDF branding",
      "100 websites & 15 team seats",
    ],
    ctaMonthly: "Get Agency",
    ctaYearly: "Choose Agency Yearly",
    cta: "Upgrade to Agency",
    price: "$99",
    interval: "/month",
    popular: false,
    supportingText: "Built to help agencies manage security reporting across client portfolios.",
  },
];

export const INR_PRICING_PLANS: PlanPricingItem[] = [
  {
    id: "free",
    name: "Free",
    description:
      "Get started with essential website security checks. Perfect for individuals and small website owners who want to understand their website's security posture.",
    audience: "Individuals and beginners",
    referencePrice: 0,
    monthlyPrice: 0,
    yearlyAnnualTotal: 0,
    yearlyEquivalentMonthly: 0,
    yearlySavings: 0,
    savingsPercentage: 0,
    websiteLimit: 1,
    scansLimit: 10,
    features: [
      "1 Website",
      "10 Scans per month",
      "Deterministic Security Score",
      "SSL/TLS, DNS, Header & Cookie Checks",
      "Top 3 Findings Unlocked",
      "Actionable Plain-English Fixes",
      "7-Day Scan History",
      "Preview PDF Report",
    ],
    ctaMonthly: "Start Free",
    ctaYearly: "Start Free",
    cta: "Start Free",
    price: "₹0",
    interval: "forever",
    popular: false,
    supportingText: "No credit card required.",
  },
  {
    id: "basic",
    name: "Basic",
    description:
      "Build a stronger security routine for your business website with automated monitoring, timely alerts, and useful reporting.",
    audience: "Small businesses and website owners",
    referencePrice: 1599,
    monthlyPrice: 799,
    yearlyAnnualTotal: 7990,
    yearlyEquivalentMonthly: 665.83,
    yearlySavings: 1598,
    savingsPercentage: 16.7,
    websiteLimit: 2,
    scansLimit: 100,
    features: [
      "Up to 2 Websites",
      "100 Scans per month",
      "Weekly automated monitoring",
      "Email alerts for SSL expiry & score drops",
      "Full PDF report exports",
      "SiteSecura Verified Badge",
      "30-Day historical trends",
      "Full security findings & remediation",
      "Standard scan queue",
    ],
    differentiators: [
      "Weekly automated monitoring & alerts",
      "Full unredacted findings & PDF exports",
    ],
    ctaMonthly: "Get Basic",
    ctaYearly: "Choose Basic Yearly",
    cta: "Upgrade to Basic",
    price: "₹799",
    interval: "/month",
    popular: false,
    supportingText: "Everything you need to monitor a small website portfolio.",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Recommended for growing teams",
    description:
      "Go beyond basic monitoring with deeper security insights, AI-assisted remediation, and tools for managing a growing portfolio.",
    audience: "Growing businesses and developers",
    referencePrice: 7999,
    monthlyPrice: 3999,
    yearlyAnnualTotal: 39990,
    yearlyEquivalentMonthly: 3332.5,
    yearlySavings: 7998,
    savingsPercentage: 16.7,
    websiteLimit: 10,
    scansLimit: 500,
    features: [
      "Up to 10 Websites",
      "500 Scans per month",
      "Daily automated monitoring",
      "Up to 3 Team member seats",
      "CSV bulk website import",
      "Deep Scan F1–F8 assessment (up to 50 pages)",
      "AI Security Advisor & custom fix plans",
      "90-Day history retention",
      "Instant security change notifications",
      "Security Health Timeline & drift tracking",
      "Priority scan queue",
    ],
    differentiators: [
      "Daily monitoring & instant alerts",
      "Deep Scan F1–F8 + AI Security Advisor",
    ],
    ctaMonthly: "Get Pro",
    ctaYearly: "Choose Pro Yearly",
    cta: "Upgrade to Pro",
    price: "₹3,999",
    interval: "/month",
    popular: true,
    supportingText: "For growing businesses that need more visibility and control.",
  },
  {
    id: "agency",
    name: "Agency",
    badge: "Built for agencies",
    description:
      "Manage multiple client websites from one place with scalable monitoring, branded reporting, and collaborative workflows.",
    audience: "Agencies and teams managing client websites",
    referencePrice: 15999,
    monthlyPrice: 7999,
    yearlyAnnualTotal: 79990,
    yearlyEquivalentMonthly: 6665.83,
    yearlySavings: 15998,
    savingsPercentage: 16.7,
    websiteLimit: 100,
    scansLimit: 3000,
    features: [
      "Up to 100 Websites",
      "3,000 Scans per month",
      "Up to 15 Team member seats",
      "Custom white-label PDF reports (logo & colors)",
      "Client grouping & portfolio folders",
      "Bulk CSV import & export",
      "Deep Scan F1–F8 assessment (up to 100 pages)",
      "365-Day history retention",
      "Instant security change notifications",
      "Dedicated scan infrastructure",
    ],
    differentiators: [
      "Custom white-label PDF branding",
      "100 websites & 15 team seats",
    ],
    ctaMonthly: "Get Agency",
    ctaYearly: "Choose Agency Yearly",
    cta: "Upgrade to Agency",
    price: "₹7,999",
    interval: "/month",
    popular: false,
    supportingText: "Built to help agencies manage security reporting across client portfolios.",
  },
];

export function getPricingPlans(currency: "inr" | "usd" = "inr"): PlanPricingItem[] {
  return currency === "inr" ? INR_PRICING_PLANS : PRICING_PLANS;
}


export const FAQ_ITEMS = [
  {
    q: "What does SiteSecura check?",
    a: "SiteSecura evaluates core defensive web postures: SSL/TLS certificate validity & expiration, HTTPS enforcement & redirection, email spoofing protections (SPF, DMARC, DNSSEC), HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), cookie security flags (Secure, HttpOnly, SameSite), and server software disclosures.",
  },
  {
    q: "How does SiteSecura calculate the security score?",
    a: "SiteSecura uses a deterministic scoring engine starting at a base of 100 points. Verified issues apply exact deductions across 5 weighted categories: HTTPS/SSL (30 pts), Security Headers (25 pts), DNS & Email (20 pts), Server Hygiene (15 pts), and Cookie Security (10 pts). Final scores map strictly to risk levels: Excellent (90-100), Good (75-89), Medium Risk (60-74), High Risk (40-59), and Critical Risk (0-39).",
  },
  {
    q: "Is the website scan free?",
    a: "Yes. Any visitor can perform an instant website security scan for free without entering payment information or signing up for a trial.",
  },
  {
    q: "Do I need an account to scan?",
    a: "No. You can enter any public domain on our homepage and immediately receive a verified security score, overview checklist, and top findings without creating an account.",
  },
  {
    q: "Does SiteSecura modify my website?",
    a: "Never. SiteSecura performs strictly non-intrusive, read-only passive inspections. We query public DNS records, inspect SSL certificates, and analyze HTTP response headers. We do not inject malicious payloads, perform denial-of-service tests, or alter your server configuration in any way.",
  },
  {
    q: "How long does a scan take?",
    a: "Most scans complete in 5 to 15 seconds. Scan duration depends on DNS resolution and your web server's response time.",
  },
  {
    q: "What does a security score mean?",
    a: "The score reflects your website's defensive posture against common configuration oversights. A higher score demonstrates strong encryption enforcement, effective clickjacking and XSS mitigations, and authenticated email domain settings that safeguard your visitors and brand reputation.",
  },
  {
    q: "What is website security monitoring?",
    a: "Security monitoring is an automated background service that scans your domains on a regular cadence (weekly on Basic, daily on Pro). It tracks posture over time and detects drift—such as SSL certificates approaching expiration, missing security headers after a deployment, or altered DNS records.",
  },
  {
    q: "Can SiteSecura monitor my website?",
    a: "Yes. Subscribed accounts can add websites to their dashboard for continuous monitoring. SiteSecura will run automated background scans and dispatch immediate email notifications when critical issues or score decreases are detected.",
  },
  {
    q: "Can I download a PDF security report?",
    a: "Yes. Subscribed users on Basic, Pro, and Agency tiers can generate and download executive PDF audit reports containing detailed scorecards, itemized checks, and remediation instructions to share with stakeholders, clients, or compliance auditors.",
  },
  {
    q: "What is the difference between a Normal Scan and Deep Scan?",
    a: "A Normal Scan performs an immediate 60-second perimeter audit of public DNS, SSL/TLS certificates, security headers, and cookie flags with a deterministic score. Deep Scan (available on Pro and Agency plans) executes an in-depth F1–F8 assessment covering attack surface discovery, asset enumeration, frontend dependency disclosures, and correlated risk intelligence.",
  },
  {
    q: "Is SiteSecura suitable for agencies?",
    a: "Yes. SiteSecura offers a dedicated Agency plan supporting up to 100 client websites, 15 team member accounts, bulk CSV imports, and custom white-label PDF reports customized with your agency logo, brand colors, and footer.",
  },
  {
    q: "Does SiteSecura perform penetration testing?",
    a: "No. SiteSecura is strictly designed for passive, defensive security assessments and posture evaluation. It analyzes publicly observable configuration signals, DNS records, and HTTP headers without sending intrusive exploit payloads, attempting authentication bypasses, or disrupting web server stability.",
  },
];

export interface ComparisonFeature {
  name: string;
  tooltip?: string;
  free: string | boolean;
  basic: string | boolean;
  pro: string | boolean;
  agency: string | boolean;
}

export interface ComparisonCategory {
  title: string;
  features: ComparisonFeature[];
}

export const PRICING_COMPARISON_CATEGORIES: ComparisonCategory[] = [
  {
    title: "Core Usage & Limits",
    features: [
      {
        name: "Monthly price",
        tooltip: "Current actual monthly billing price per organization.",
        free: "$0",
        basic: "$9/mo",
        pro: "$49/mo",
        agency: "$99/mo",
      },
      {
        name: "Annual payment",
        tooltip: "Annual upfront payment with 2 months free (save 16.7%).",
        free: "Free",
        basic: "$90/yr ($7.50/mo)",
        pro: "$490/yr ($40.83/mo)",
        agency: "$990/yr ($82.50/mo)",
      },
      {
        name: "Monitored websites",
        tooltip: "Number of unique domains you can store and continuously evaluate in your dashboard.",
        free: "1",
        basic: "2",
        pro: "10",
        agency: "100",
      },
      {
        name: "Monthly scans (shared quota)",
        tooltip: "Total monthly scans allowed across Normal Scans and Deep Scans.",
        free: "10",
        basic: "100",
        pro: "500",
        agency: "3,000",
      },
      {
        name: "Team member seats",
        tooltip: "Number of teammate logins with role-based access to your organization.",
        free: "1 seat (Owner)",
        basic: "1 seat (Owner)",
        pro: "Up to 3 seats",
        agency: "Up to 15 seats",
      },
      {
        name: "Historical scan retention",
        tooltip: "Duration past scan results and score progression remain queryable.",
        free: "7 days",
        basic: "30 days",
        pro: "90 days",
        agency: "365 days",
      },
    ],
  },
  {
    title: "Defensive Security Scanning",
    features: [
      {
        name: "Deterministic security score",
        tooltip: "100-point transparent mathematical score with exact issue deductions.",
        free: true,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "SSL/TLS & cipher checks",
        tooltip: "Certificate validity, expiration warning, cipher strength, and hostname matching.",
        free: true,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "DNS & email hygiene (SPF, DMARC)",
        tooltip: "Spoofing protections, SPF syntax, DMARC policies, and DNSSEC validation.",
        free: true,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "Security headers audit",
        tooltip: "HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.",
        free: true,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "Cookie security flags",
        tooltip: "Secure, HttpOnly, and SameSite attribute verification for every Set-Cookie header.",
        free: true,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "Security findings visibility",
        tooltip: "Level of detail and technical evidence unlocked on reports.",
        free: "Top 3 unredacted",
        basic: "Full unredacted",
        pro: "Full unredacted",
        agency: "Full unredacted",
      },
      {
        name: "Plain-English remediation guidance",
        tooltip: "Actionable instructions written for both business owners and developers.",
        free: true,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "Deep Scan F1–F8 assessment",
        tooltip: "Deep asset discovery, subdomains, frontend dependencies, and correlated risks.",
        free: false,
        basic: false,
        pro: "Up to 50 pages (depth 2)",
        agency: "Up to 100 pages (depth 2)",
      },
      {
        name: "Priority scan queue",
        tooltip: "Fast-track execution in Celery background queues ahead of free scans.",
        free: "Standard",
        basic: "Standard",
        pro: "Priority fast-track",
        agency: "Priority fast-track",
      },
    ],
  },
  {
    title: "Automated Monitoring & Alerts",
    features: [
      {
        name: "Automated background monitoring",
        tooltip: "Scheduled background execution that detects configuration drift and regressions.",
        free: false,
        basic: "Weekly",
        pro: "Daily",
        agency: "Daily",
      },
      {
        name: "Email alerts",
        tooltip: "Notifications when certificates expire or score drops exceed thresholds.",
        free: false,
        basic: "Standard",
        pro: "Advanced",
        agency: "Advanced",
      },
      {
        name: "Instant change notifications",
        tooltip: "Immediate alert dispatch upon finding newly introduced critical risks.",
        free: false,
        basic: "Standard",
        pro: "Instant",
        agency: "Instant",
      },
      {
        name: "Security Health Timeline",
        tooltip: "Visual progression tracking showing score and finding history over time.",
        free: false,
        basic: "Basic trends",
        pro: "Advanced timeline",
        agency: "Advanced timeline",
      },
      {
        name: "Compare previous scans",
        tooltip: "Side-by-side posture diff highlighting resolved and introduced findings.",
        free: false,
        basic: false,
        pro: true,
        agency: true,
      },
    ],
  },
  {
    title: "Reporting & White-Labeling",
    features: [
      {
        name: "Executive PDF security reports",
        tooltip: "Print-ready executive summary and technical breakdown document.",
        free: "Preview (Watermarked)",
        basic: "Full branded",
        pro: "Full branded",
        agency: "Custom white-label",
      },
      {
        name: "SiteSecura Verified Badge",
        tooltip: "Embeddable website trust badge dynamically validating your security score.",
        free: false,
        basic: true,
        pro: true,
        agency: true,
      },
      {
        name: "White-label custom branding",
        tooltip: "Replace SiteSecura logo, brand colors, and company footer on all PDF reports.",
        free: false,
        basic: false,
        pro: false,
        agency: "Full (Logo, Colors, Name)",
      },
      {
        name: "AI Security Advisor",
        tooltip: "LLM-assisted remediation plans, natural-language fixes, and executive advice.",
        free: false,
        basic: false,
        pro: "Included (100 req/mo)",
        agency: "Included (500 req/mo)",
      },
      {
        name: "Monthly security digest",
        tooltip: "Automated monthly summary email summarizing all portfolio audit scores.",
        free: false,
        basic: false,
        pro: true,
        agency: true,
      },
    ],
  },
  {
    title: "Agency & Collaboration",
    features: [
      {
        name: "CSV bulk website import",
        tooltip: "Import dozens of customer domains simultaneously via simple CSV upload.",
        free: false,
        basic: false,
        pro: true,
        agency: true,
      },
      {
        name: "Bulk CSV export",
        tooltip: "Export audit results, findings, and score archives to CSV spreadsheet format.",
        free: false,
        basic: false,
        pro: false,
        agency: true,
      },
      {
        name: "Client grouping & portfolio folders",
        tooltip: "Organize client websites into distinct accounts and project categories.",
        free: false,
        basic: false,
        pro: false,
        agency: true,
      },
      {
        name: "Dedicated agency support",
        tooltip: "Direct email support and technical assistance for client deployments.",
        free: "Community",
        basic: "Standard email",
        pro: "Priority email",
        agency: "Dedicated email support",
      },
    ],
  },
];

export const PLAN_DIFFERENCES = [
  {
    plan: "Free",
    title: "Explore your website security",
    tagline: "Essential checks for individual site owners",
    description:
      "For individuals and website owners who want to run occasional security checks and understand their current security posture.",
    highlight: "10 free scans/mo with core checks",
  },
  {
    plan: "Basic",
    title: "Establish a regular security routine",
    tagline: "Automated monitoring for small businesses",
    description:
      "For small businesses that want automated weekly monitoring, essential email alerts, and full security reports without managing a large website portfolio.",
    highlight: "Weekly automated audits & email alerts",
  },
  {
    plan: "Pro",
    title: "Monitor and improve multiple websites",
    tagline: "Deep insights & AI for growing teams",
    description:
      "For growing businesses and developers who need more scans, daily monitoring, deeper insights, and collaborative workflows.",
    highlight: "Daily monitoring, Deep Scan & AI Advisor",
  },
  {
    plan: "Agency",
    title: "Manage security across client portfolios",
    tagline: "White-label reporting for web agencies",
    description:
      "For web agencies and service providers managing many websites and requiring client-oriented reporting, custom branding, and team collaboration.",
    highlight: "100 websites, 15 seats & custom branding",
  },
];

export const SECURITY_TRANSPARENCY_ITEMS = [
  {
    title: "Actionable security insights",
    description:
      "Understand the findings that matter and follow practical recommendations to improve your website's security posture.",
  },
  {
    title: "Flexible billing",
    description:
      "Choose monthly or annual billing according to your budget and usage needs, with 2 months free on annual plans.",
  },
  {
    title: "Secure payments",
    description:
      "Payments are processed through Stripe's secure payment infrastructure. SiteSecura does not store raw credit card details.",
  },
  {
    title: "Clear usage limits",
    description:
      "Your subscription determines the number of websites, monthly scans, monitoring capabilities, and available reporting features.",
  },
  {
    title: "Subscription management",
    description:
      "Manage eligible subscription changes, payment methods, and cancellations using the self-service Stripe billing portal.",
  },
];

export const PRICING_PAGE_FAQS = [
  {
    q: "Can I use SiteSecura for free?",
    a: "Yes. The Free plan lets you assess one website with up to 10 scans per month. It includes the essential security checks and available recommendations within the Free plan's limits.",
  },
  {
    q: "What is the difference between monthly and yearly billing?",
    a: "Monthly billing charges your subscription each month. Yearly billing charges once per year and offers a discount equivalent to two months of the current monthly price. The total annual payment is displayed before checkout.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes, where supported by your current subscription and billing configuration. Upgrades, downgrades, and their effective dates depend on your subscription state and Stripe billing rules.",
  },
  {
    q: "What happens when I reach my monthly scan limit?",
    a: "When you reach your plan's monthly scan allowance, additional scans may be restricted until your quota resets or you move to an eligible plan. Your dashboard should display your current usage and applicable limit.",
  },
  {
    q: "Does SiteSecura automatically fix security vulnerabilities?",
    a: "SiteSecura identifies security issues and provides remediation guidance. AI-assisted recommendations can help explain possible fixes, but they do not mean that SiteSecura automatically modifies your website.",
  },
  {
    q: "What does automated monitoring include?",
    a: "Automated monitoring checks eligible websites according to your plan's monitoring frequency and the currently supported checks. Monitoring frequency and alert availability depend on your subscription.",
  },
  {
    q: "Can I manage multiple websites?",
    a: "Yes. Paid plans support multiple websites, with limits depending on your subscription. Pro and Agency also provide higher website allowances for larger portfolios.",
  },
  {
    q: "Does the Agency plan support white-label reports?",
    a: "The Agency plan is designed for branded client reporting. Available branding options depend on the report customization features enabled in your account.",
  },
  {
    q: "How do cancellations work?",
    a: "You can manage eligible subscriptions through the available billing management workflow. Cancellation timing and access to paid features depend on your current billing period and subscription configuration.",
  },
  {
    q: "Are refunds available?",
    a: "Refund eligibility is governed by the current SiteSecura Refund and Cancellation Policy. Review the policy before purchasing.",
    linkText: "View Refund Policy",
    linkHref: "/refunds",
  },
  {
    q: "Are payments secure?",
    a: "Payments are handled through the existing Stripe payment integration. Available payment methods depend on the checkout configuration and your location.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Your access to plan-specific features and usage limits changes according to your new subscription. Data retention and access are governed by SiteSecura's applicable retention policies and subscription rules.",
  },
];
