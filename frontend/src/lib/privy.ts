/**
 * Privy configuration.
 *
 * The app id is a public identifier, not a secret - it ships in the browser
 * bundle by design. Everything else (the app secret) stays in the Privy
 * dashboard and never touches this repository.
 */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/**
 * Without an app id `PrivyProvider` cannot mount, and every Privy/wagmi hook
 * below it throws. Rather than let the whole site white-screen on a missing env
 * var, the UI branches on this flag: `/app` explains what to set, and the
 * marketing pages still render.
 */
export const PRIVY_ENABLED = PRIVY_APP_ID.length > 0;
