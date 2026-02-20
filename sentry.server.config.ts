import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance
  tracesSampleRate: 0.1,

  // Environment
  environment: process.env.NODE_ENV,
  release: process.env.npm_package_version,

  // Filter sensitive data
  beforeSend(event) {
    // Remove PII
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }
    return event
  },

  // Integrations
  integrations: [
    Sentry.extraErrorDataIntegration(),
  ],
})
