# Marketing & Visibility workflow

The Admin Portal's **Marketing & Visibility** workspace is the source of truth for external discovery, outreach, reputation, social, content, and paid-acquisition channels.

## Operating workflow

1. Update the channel in the admin portal. Record the public username or handle, internal owner, account URL, status, inputs supplied to the service, service settings, and review date.
2. Put only environment-variable or vault-key names in **Secret references**. Never save passwords, access tokens, recovery codes, or private keys in the marketing record.
3. Resolve the readiness blockers shown on every critical channel. A channel is ready when it has an internal owner, complete inputs, an active or in-progress status, and a scheduled review date.
4. Select **Create implementation package**. This freezes a versioned database snapshot and downloads the same JSON manifest. Packages with unresolved critical blockers are labeled `draft`; only packages with no critical blockers are labeled `ready`.
5. Ask Codex to apply the latest marketing implementation package, or export it locally:

   ```sh
   npm run marketing:export
   ```

   The command writes `generated/marketing-visibility.json`. Export a specific revision with `npm run marketing:export -- 3`, or choose a target with `--output=path/to/file.json`.

6. Codex can compare the manifest with website metadata, analytics IDs, structured data, sitemap settings, outbound profile links, and deployment environment-variable references, then make and verify the corresponding code changes.

Creating a package does not automatically publish to Google, Apple, Meta, or other third-party accounts. Each provider requires separate authorization and provider-specific API support. The versioned package is the controlled handoff that makes those changes reviewable before implementation.

## Access and credential safety

- Anyone with `analytics.view` can inspect the workspace.
- Only master admins and admins with `marketing.manage` can create, edit, or package channels.
- `secretRefs` accepts environment-variable or vault-key names such as `GOOGLE_BUSINESS_REFRESH_TOKEN`; raw passwords, API keys, tokens, or private keys are rejected from channel inputs and settings.
- Public Vortex facts and confirmed measurement IDs are seeded from the canonical website and measurement framework. External verification flags, provider account IDs, direct review links, internal owners, and review dates must be confirmed by an operator.
