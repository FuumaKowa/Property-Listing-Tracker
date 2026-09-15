# Secret handling

Keep credentials in ignored local environment files and encrypted hosting-provider secrets. Only `.env.example`, with empty values or obvious placeholders, belongs in Git. Generated `dist` and `.server` output must not be committed.

The GitHub `Secret scan` workflow runs checksum-verified Gitleaks against the tracked snapshot and incoming commits. `.gitleaks.toml` extends the standard detectors with Neon PostgreSQL password detection. Logs redact matched values. Configure this check as required in branch protection if changes must be blocked before merging; a workflow alone does not prevent direct pushes or automatically block Cloudflare deployment.

To audit all history locally with Gitleaks 8.30.1:

```sh
gitleaks git . --log-opts="--all" --config=.gitleaks.toml --redact=100
```

If a credential was committed, removing the file does not revoke it. Rotate the credential at its provider and update every runtime that uses it. Coordinate database password changes with Cloudflare Pages secret updates and deployment so existing users are not stranded on the old password. Check isolated database branches too, since they may retain copied credentials.

History cleanup changes commit IDs and requires coordination with contributors. After replacing affected branches, contributors should re-clone or carefully reset rather than merging old history back. GitHub pull-request refs, cached commit views, forks and existing clones can retain the old content; contact GitHub Support for sensitive-data cache/ref removal. Rotation is required even after a clean history scan.

Firebase browser API keys are generally public identifiers, not database passwords. Review their API/application restrictions and Firebase authorization rules; retire unused keys through the Google Cloud project owner. Do not assume a scanner match proves that a key grants private access.
