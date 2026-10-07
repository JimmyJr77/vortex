// Release provenance for automatic enrollment adoption. The regression test
// compares this value with the deployment manifest; changing billing migrations
// requires regenerating it with computeBillingDeployManifestChecksum in the CLI.
// Request handlers never read or execute migration files.
export const BILLING_DEPLOY_MANIFEST_CHECKSUM = '5c64413969f54f957e01b33ede2f4ba104033a4374616c7e37e57fe4d96d4f79'
