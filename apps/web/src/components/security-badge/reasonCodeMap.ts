/**
 * SiteSecura - Human-readable reason code mappings for Badge Eligibility.
 * Maps deterministic backend machine codes to plain-English user explanations.
 */

export interface ReasonDetail {
  title: string;
  description: string;
  actionHint?: string;
}

export const REASON_CODE_MAP: Record<string, ReasonDetail> = {
  SCORE_BELOW_THRESHOLD: {
    title: "Score Below Required Threshold",
    description: "Your latest scan score is below the current SiteSecura Verified threshold.",
    actionHint: "Resolve high-impact security findings to raise your score.",
  },
  SCAN_TOO_OLD: {
    title: "Scan Outdated",
    description: "Your latest completed scan is older than the allowed verification window.",
    actionHint: "Run a fresh scan to re-evaluate your website.",
  },
  CRITICAL_FINDING_PRESENT: {
    title: "Critical Finding Detected",
    description: "Your latest scan contains a critical security finding that currently prevents verification.",
    actionHint: "Fix the critical issue (e.g. SSL validity or TLS configuration) and rescan.",
  },
  HIGH_FINDING_PRESENT: {
    title: "High Finding Disallowed",
    description: "Your latest scan contains a high-severity finding disallowed by the active verification policy.",
    actionHint: "Remediate high-severity checks to meet policy criteria.",
  },
  SCAN_NOT_FOUND: {
    title: "No Completed Scan Available",
    description: "Run a completed security scan before requesting verification.",
    actionHint: "Start a free scan to establish your baseline security posture.",
  },
  SCAN_NOT_COMPLETED: {
    title: "Latest Scan Incomplete",
    description: "The latest scan has not completed successfully.",
    actionHint: "Wait for the current scan to finish or start a new scan.",
  },
  SCAN_COMPLETION_TIME_UNAVAILABLE: {
    title: "Scan Timestamp Unavailable",
    description: "Scan completion time could not be verified by the eligibility engine.",
    actionHint: "Run a new scan to establish an authoritative completion timestamp.",
  },
  SCORE_UNAVAILABLE: {
    title: "Score Unavailable",
    description: "The latest completed scan did not produce a deterministic score.",
    actionHint: "Run a new scan to calculate your security score.",
  },
  DOMAIN_MISMATCH: {
    title: "Domain Mismatch",
    description: "The website domain and scan domain do not match.",
    actionHint: "Ensure the scan was executed against the exact canonical domain.",
  },
  SCAN_WEBSITE_MISMATCH: {
    title: "Website Scan Mismatch",
    description: "Candidate scan is associated with a different website record.",
  },
  UNAUTHORIZED_WEBSITE: {
    title: "Permission Denied",
    description: "You do not have permission to manage verification for this website.",
  },
  POLICY_NOT_FOUND: {
    title: "Policy Configuration Unavailable",
    description: "The active SiteSecura verification policy could not be loaded.",
  },
  INVALID_SCAN_DATA: {
    title: "Invalid Scan Data",
    description: "The scan score or check data was outside valid parameters.",
  },
  MONITORING_REQUIRED: {
    title: "Continuous Monitoring Required",
    description: "Active monitoring is required by the current verification policy.",
    actionHint: "Enable weekly or daily monitoring in your website settings.",
  },
};

export function getReasonDetail(code: string): ReasonDetail {
  return (
    REASON_CODE_MAP[code] || {
      title: "Policy Requirement Not Met",
      description: `Requirement code '${code}' was not satisfied by the latest scan.`,
      actionHint: "Review your scan checks and rescan when ready.",
    }
  );
}
