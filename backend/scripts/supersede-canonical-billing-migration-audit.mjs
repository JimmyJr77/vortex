#!/usr/bin/env node
import { runAndReportCanonicalBillingMigration } from './lib/canonical-billing-migration-cli.mjs'

runAndReportCanonicalBillingMigration('supersede-audit')
