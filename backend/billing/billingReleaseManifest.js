// Release provenance for automatic enrollment adoption. The regression test
// compares this value with the deployment manifest; changing billing migrations
// requires regenerating it with computeBillingDeployManifestChecksum in the CLI.
// Request handlers never read or execute migration files.
export const BILLING_DEPLOY_MANIFEST_CHECKSUM = "e43b8a5d5ef9f7a3c7e4c1c4040108d19d4d9156507e70a30de42e023f1ca78e"
