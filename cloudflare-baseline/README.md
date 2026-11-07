# Cloudflare 2026-11-07 RecordNote source snapshot

These are read-only snapshots of the active Cloudflare Workers for audit and safe development, **not** approved automatic production deploy artifacts. Never overwrite production bindings or D1/R2 using these files without a new release gate.

- recordnote API baseline version: 9f28746c-cc1b-4375-a41a-bb7690f9f999.
- recordnote Web baseline version: 55bd8d42-ed66-491c-8d2a-6c62f55620e1.
- No Cloudflare Secret values were extracted or written. Only script code was copied; runtime bindings and secrets remain in Cloudflare.
- The existing RecordNote legacy NLSC reverse lookup is not compliant with the new Geoapify-only feature design. Do not switch routes until the client sends accurate GPS timestamp and accuracy and opt-in consent.
- Snapshots are based on live Cloudflare deployments, not the GitHub scaffold.
