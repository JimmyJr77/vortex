// Release provenance for automatic enrollment adoption. The regression test
// compares this value with the deployment manifest; changing billing migrations
// requires regenerating it with computeBillingDeployManifestChecksum in the CLI.
// Request handlers never read or execute migration files.
export const BILLING_DEPLOY_MANIFEST_CHECKSUM = '5df1a119e256a862b76a4548a4dc1dcb7e6ea42376a8310f8f6e020e518bc36b'
