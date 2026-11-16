// Release provenance for automatic enrollment adoption. The regression test
// compares this value with the deployment manifest; changing billing migrations
// requires regenerating it with computeBillingDeployManifestChecksum in the CLI.
// Request handlers never read or execute migration files.
export const BILLING_DEPLOY_MANIFEST_CHECKSUM = "c933df2e42ed4337ca9ff5e3e693285e5fdd048d7bf49d7bd14f03c1ab11ce68"
