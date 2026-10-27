/** Keep today's strict certificate check. `sslmode=require` will mean less in a future pg release. */
export function withVerifyFullSsl(connectionString) {
  return connectionString.replace(
    /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/i,
    "$1sslmode=verify-full",
  )
}
