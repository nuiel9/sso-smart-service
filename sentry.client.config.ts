import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session Replay (optional)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.npm_package_version,

  // Ignore specific errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection',
    'Network request failed',
  ],

  // Filter sensitive data
  beforeSend(event) {
    // Remove PII from error reports
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }

    // Remove sensitive query params
    if (event.request?.query_string) {
      event.request.query_string = '[Filtered]'
    }

    return event
  },

  // Tags for filtering
  initialScope: {
    tags: {
      app: 'sso-smart-service',
      locale: 'th-TH',
    },
  },
})
