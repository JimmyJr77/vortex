// Release provenance for automatic enrollment adoption. The regression test
// compares this value with the deployment manifest; changing billing migrations
// requires regenerating it with computeBillingDeployManifestChecksum in the CLI.
// Request handlers never read or execute migration files.
export const BILLING_DEPLOY_MANIFEST_CHECKSUM = '23fbd9b2c8c502063010e6f089d3de9afb509871ff5bda07af156e3a3c278be5'
