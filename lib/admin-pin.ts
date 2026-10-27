import { timingSafeEqual } from "node:crypto"

export function pinsMatch(input: string) {
  const expected = process.env.ADMIN_PINCODE ?? ""
  if (!expected || !input) return false
  const left = Buffer.from(input)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
