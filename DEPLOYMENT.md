# dotelse.app on Cloudflare

The site is static. All reading, PDF extraction, creation and editing happen in the visitor's browser. Cloudflare serves the public application assets and sample only. There is no upload handler or server-side AI service.

## Production deployment

The site is live at [dotelse.app](https://dotelse.app/), hosted by the Git-connected Cloudflare Pages project `dotelse`. Its default address is [dotelse.pages.dev](https://dotelse.pages.dev/). Production builds use these settings:

| Setting | Value |
| --- | --- |
| Repository | `doctorillumination/else-file-format` |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `python3 build_site.py` |
| Build output directory | `docs` |
| Custom domain | `dotelse.app` |

Automatic production deployments are enabled. The custom domain is active with SSL enabled, and the apex DNS record points to `dotelse.pages.dev`. Pages uses its existing GitHub connection and does not need a deployment token in this repository. Pages does not use `wrangler.jsonc` for this deployment.

Only `docs/` is published. Never select the repository root as the output directory: it contains source, test tooling and local build output. The committed `docs/` is also ready to serve without a build step. GitHub Actions checks that it matches `build_site.py` and the website sources.

`docs/_headers` configures the local-only browser policy, framing restrictions, privacy headers and cache revalidation. GitHub Pages remains available at [the fallback address](https://doctorillumination.github.io/else-file-format/).

The desktop download buttons point to tested packages in [release v0.2.0-experiment](https://github.com/doctorillumination/else-file-format/releases/tag/v0.2.0-experiment). Those files are served by GitHub Releases. Cloudflare still publishes only `docs/`; it does not install Electron, package desktop applications or receive selected files. Desktop build dependencies and output remain separate from the static website.

## Optional Workers deployment

The checked-in `wrangler.jsonc` supports a separate Workers static-assets deployment. It is an alternative configuration, not the active production host. Do not deploy it to the same custom domain while the Pages domain connection is active.

For a separate Worker, use the repository root, Node.js 22 or later, Python 3.9 or later, and deploy command `npx wrangler@4.149.0 deploy`. Wrangler's build hook runs `python3 build_site.py` and serves only `docs/`. GitHub Actions verifies this optional configuration with a local dry-run. No deployment secrets belong in this repository.

## Live verification

On October 11, 2026, the production deployment of commit `88ce83b` was opened at `https://dotelse.app/` in Chrome. The public sample was edited and the new .else, original PDF and AI context were downloaded through the actual reader controls. Python and Swift independently opened the edited package with matching model and context. Its PDF and source-text derivative were unchanged, the second interpretation and all contributor labels were retained, and the source declaration included the prior archive fingerprint.

All 14 publicly served files, including the HTML, CSS, JavaScript, renderer, sample and icon, matched the committed `docs/` bytes over HTTPS with certificate verification enabled. The content policy, privacy headers and cache revalidation were present in the live response. See [the verification record](VERIFICATION.md) for the local creation and offline checks.

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

## Isolated live source view

The visual mixed reader loads X and YouTube when online. `sources.dotelse.app` is an additional custom domain on the same Pages project. `web/_worker.js`, copied to `docs/_worker.js`, routes that hostname to just two public embed assets. It returns 404 for the reader, sample archives and every other path, and 405 for uploads. On the main hostname it delegates static serving to Pages. It has no storage bindings, accounts, selected-file handler or AI endpoint.

The remote post view receives a numeric public post ID and a random message nonce. Source messages are checked against the frame, origin and nonce. The archive reader does not load a provider SDK. Desktop source descendants have HTTPS access while the root reader remains unable to make network requests. Child frames cannot call the native file bridge. Saved excerpts are available when a provider is unreachable.

Deploy the generated `docs/` through the existing Git connection. Add `sources.dotelse.app` under the Pages project's Custom domains. Verify that the embed HTML returns 200 without `X-Frame-Options: DENY`, that `/mixed.html` on the source hostname returns 404, and that the main reader still denies framing and uploads. `node web/test_source_boundary.mjs` checks those routing and desktop rules locally.
