# HAR-inspired consumer account hub — November 1, 2026

Patrick requested a more professional HAR-style customer experience inside both existing real-estate sites, explicitly preserving their branding and overall site design and excluding rentals and AI mode. HAR's supplied screenshots and public myaccount/login pages were used as reference. No HAR connector was available in the session; no HAR account, password, contact list or private HAR profile was imported.

The existing live Repliers public IDX connection remains the property source. Consumer identity, owner-scoped account data and CRM sync remain in the separate consumer Firebase / GMS / GCR HighLevel architecture documented in `consumer-accounts-and-saved-searches-2026-11-01.md`. Repliers' documented client/favorite/saved-search APIs demonstrate additional platform capabilities, but this release does not enable a second provider alert engine or send consumer data to a newly enabled Repliers client integration.

## Delivered

- A wider, responsive account hub with desktop sidebar and phone-size account-section selector. Existing website logos, public navigation, home pages, content and other page layouts were retained.
- An overview with a real public listing grid around the consumer's preferred ZIP/area, search links for open houses, new listings, new construction, price reductions, land and homes with acreage, plus actual saved-search/favorite counts. No invented trending/popularity data.
- Named saved-search cards with collapsible editing and existing independent subscriptions/frequencies. Favorites render actual listing cards. Recently viewed properties are stored as bounded, validated listing IDs under the verified account and can be used across both sites.
- Property/tour inquiry history includes only persisted inquiries for the verified email and permitted board/listing references. It explicitly says an inquiry was received, not that a tour is booked. Optional history failures are isolated from profile/search access.
- A brokerage-contact section using Golden Cross Realty's already-public broker information, not private call-tree recipients or a fabricated buyer-agent assignment.
- Profile first/last name, phone and preferred ZIP, secure email change, password reset, and the existing SMS/email/callback controls. Existing STOP protection and separate qualification/billing remain.
- A shared, styled sign-in/create-account component used by the account page and save-search dialogs. Both secure email links and password sign-in/registration are available. New password accounts require verified email. Password policy remains 12–128 characters. Registration collects optional phone/ZIP and explicit existing Terms/Privacy acknowledgment; no preselected SMS/marketing consent. A short-lived, email-scoped local signup draft lets the verified user finish profile synchronization without losing entered details. Passwords and action codes are not stored in that draft.
- Browser mutations are serialized so profile/history saves do not race their revision checks. The backend's old blanket 250 ms mutation rejection was removed while verified-token, ownership and endpoint rate protections remain.
- HighLevel profile synchronization retains compound first names and ZIP. A hash of meaningful profile/permission/search content avoids repeated CRM notes merely from viewing another listing. Upsert still matches verified email rather than an unverified phone.

## Deliberately not presented as working features

No rentals, AI mode, social-login buttons without configured providers, home-value/AVM estimates, shared lists, consumer messaging inbox, confirmed tour booking, reviews or traffic reports were added. These require their own provider entitlement, ownership, data and workflow checks. The existing native HighLevel AI workflow was not modified or enrolled.

## Source and release evidence

Previous website deployments were verified as North `dpl_5rJyCVL1DDbHjYAfg1MeS5BC4jRH` and GCR `dpl_9iiJTgXc3SBoGxTowy1uqLKrYdSa` before edits. Their reconciled source directories were retained; no older main checkout was used as a production baseline.

New live releases:

- North: `dpl_BFJb5z7FGXozVmGQDxEyAd9kyUix`.
- GCR: `dpl_CfyH29SX8urnP2XBeswp6yEwzcAT`.
- Account API: `gmsconsumeraccount-00005-foh`, recovered from the actual preceding account service source.
- Maintenance: `gmsconsumermaintenance-00007-xub`, recovered independently from the actual preceding maintenance source.

All function updates used `--runtime-update-policy on-deploy`. Existing secrets, service identities, min instances and private scheduler protection were preserved. The new GMS `websiteInquiryEmails` composite index (`inquiry.email ASC`, `createdAt DESC`) is READY so the consumer sees the newest inquiries, not an arbitrary earlier page.

Source and tests are preserved in `firebase/consumer-accounts/` and its site overlays, with full isolated website release sources in the workspace's `tmp/consumer-accounts-20261101/{north,gcr}`. Existing draft PRs GCR16, North5 and Customer6 carry the updates; they remain pending live owner acceptance rather than silently merging an untested account transition into main.

## Verification

Both site lint/build checks passed. North production release checks retain real county/price-reduction verification and the non-delivering active intake probe. Live account pages render with the original site branding; desktop signup/password fields and the signed-in dashboard/search-card/mobile navigation were inspected in the browser. The signed-in design review used an explicitly labeled, development-only example profile with no live account actions. All development preview entry files are excluded from deployed source; deployed auth source parity was checked against local final files.

Fourteen emulator tests pass, including previous ownership/STOP/unsubscribe/retry cases plus ZIP/name validation, recently-viewed ownership, inquiry history isolation, compound-name/ZIP CRM sync, and suppression of repeated CRM notes for history-only changes. Live account pages return 200, unauthenticated profile access 401, unauthenticated maintenance 403, and the private scheduler returns 200 on the latest worker. Both public property APIs still return 48 real Conroe listings and remain enabled.

Patrick still needs to complete a real registration/sign-in, profile save and two-search/favorite test to establish live consumer-to-GHL acceptance. No consumer was falsely marked verified, no real signup was submitted in the design preview, and no live email/SMS/call was sent by these release checks.
