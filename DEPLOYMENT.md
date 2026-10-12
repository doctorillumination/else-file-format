# dotelse.app on Cloudflare

The site is static. All reading, PDF extraction, creation and editing happen in the visitor's browser. Cloudflare serves the public application assets and sample only. There is no upload handler or server-side AI service.

## Connect the GitHub repository

Recommended: Cloudflare Workers with Git integration. Create the `dotelse` Worker from `doctorillumination/else-file-format`, using production branch `main` and the repository root. The checked-in `wrangler.jsonc` identifies the public asset directory and custom domain.

Build command: `python3 build_site.py`

Deploy command: `npx wrangler@4.149.0 deploy`

Wrangler's build hook also rebuilds the site. If the Cloudflare build field is left empty, its deploy command still runs that hook. Use Node.js 22 or later and Python 3.9 or later. No deployment secrets belong in this repository.

Only `docs/` is uploaded. Never select the repository root as the asset directory: it contains source, test tooling and local build output. The configuration binds the Worker to the already owned `dotelse.app` domain. Cloudflare must have access to that domain's zone in the selected account.

An authenticated Cloudflare account and its GitHub repository connection are required to create the project. If Cloudflare needs additional repository access, grant only this public repository. Once connected, commits to `main` deploy automatically.

## Cloudflare Pages alternative

The same static directory can be hosted by a Git-connected Pages project named `dotelse`. Use framework preset None, production branch `main`, build command `python3 build_site.py`, output directory `docs`, and the repository root. Add `dotelse.app` through the project's Custom domains tab. Pages does not use `wrangler.jsonc` for this deployment.

The committed `docs/` is also ready to serve without a build step. GitHub Actions checks that it matches `build_site.py` and the website sources. `docs/_headers` configures the local-only browser policy, framing restrictions, privacy headers and cache revalidation on either Cloudflare static-assets host.

## Verify a deployment

1. Confirm the Git deployment for the expected commit succeeds.
2. Open `https://dotelse.app/` and check the landing page, desktop-reader link and sample.
3. Drop a public .else file, edit a note and save the edited copy.
4. Independently open that copy and confirm the original PDF bytes are unchanged.
5. Test PDF creation, AI-context export, cancellation, unsaved-work handling and a narrow viewport.
6. Compare the live HTML, CSS and JavaScript bytes with the committed `docs/` assets. Inspect response headers too.

`npm run test:browser` exercises the local flow while disconnected from the network after initial loading. It uses synthetic public fixtures in a fresh browser profile. It is a local check, not proof that a custom domain has been deployed.

## References

- [Cloudflare Workers Git builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/get-started/)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
