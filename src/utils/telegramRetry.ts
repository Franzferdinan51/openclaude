export function isTelegramMisdirectedResponse(
  status: number,
  statusText = '',
  bodyText = '',
): boolean {
  if (status === 421) return true
  const details = `${statusText}\n${bodyText}`.toLowerCase()
  return details.includes('misdirected request')
}
