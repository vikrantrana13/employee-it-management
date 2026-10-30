# Authenticator MFA

## Enroll with your phone

1. Run `npm run mfa:setup` once for an existing local realm. The fresh realm import also includes the dedicated account.
2. Sign out of the portal, then sign in as `mfa.demo`. Its initial password is `KEYCLOAK_DEMO_PASSWORD` in your private root `.env`.
3. Keycloak displays an authenticator enrollment page. In your authenticator app, add a time-based account and scan the QR code directly from this page. Do not put the QR code or setup key in screenshots, Git, or tickets.
4. Enter the current six-digit code, give the authenticator a recognizable device label and submit.
5. Sign out and sign in again. After your password, Keycloak asks for the authenticator code.
6. Open the Knowledge Base in the same browser session. SSO reuses the authenticated session without another MFA prompt.

Existing portal users can choose **Set up authenticator** to open the same Keycloak enrollment action. This is optional enrollment for those users. Only `mfa.demo` is explicitly required to enroll; this milestone does not enforce MFA for all employees or Admins. Existing sessions do not automatically acquire a new MFA challenge. The portal does not display an unverified “MFA enabled” claim.

## Concepts

A password is a knowledge factor. The authenticator holds a shared secret and computes a time-based one-time password (TOTP), providing a possession factor. The current local policy uses six digits, HMAC-SHA1 and 30-second steps. Keycloak checks the code; neither React nor Express stores the authenticator secret or validates OTP itself. Keep device time automatic so the server and phone agree on the time step.

The `CONFIGURE_TOTP` required action handles enrollment. The realm's browser flow already includes conditional OTP authentication: enrolled users are challenged during a fresh password login. The portal button starts an application-initiated action using Keycloak's JavaScript adapter. The setup script checks that OTP enrollment and an OTP form are available. It preserves existing authenticators and passwords when rerun.

MFA strengthens login; it does not replace API token checks, RBAC, offboarding, or the application approval ledger. This is not per-operation step-up authentication. A valid SSO session can open both apps without repeating the second factor.

## Lost phone: local learning recovery

Use the independent local administrator at http://127.0.0.1:8080/admin/ (`local-admin`, password from `KEYCLOAK_ADMIN_PASSWORD`). Select `employee-it`, find the affected user, and inspect Credentials. After confirming the user's identity, remove only the lost OTP credential, add **Configure OTP** to the user's required actions, and sign out their existing sessions. They must enroll a replacement authenticator on their next sign-in. For this learning project, an administrator performs these actions manually; no recovery endpoint or automatic reset has been added. Recovery codes are not configured.

For a real organization, recovery requires an established identity-verification and audit process. Do not delete Docker volumes or reset other credentials to recover an authenticator.

## Verification

Build both apps with `npm run build`; run API regression tests with `npm test`. Browser verification uses a disposable account and an in-memory authenticator secret, tests enrollment, wrong-code rejection, valid-code login, SSO and the portal enrollment action, then deletes the fixture. `mfa.demo` is left unenrolled so you can scan it with your own phone.

Official reference: https://www.keycloak.org/docs/latest/server_admin/#_otp_policies
