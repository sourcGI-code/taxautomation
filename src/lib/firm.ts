/**
 * Collins Fast Tax / Ken Collins — public firm identity.
 * Env vars override when set (for deploy without code changes).
 */

export const FIRM = {
  brandName: "Collins Fast Tax",
  legalName:
    process.env.NEXT_PUBLIC_PRACTICE_NAME ||
    process.env.PRACTICE_NAME ||
    "Collins Fast Tax",
  proprietor: "Ken Collins",
  tagline: "Tax preparation in Wabash, Indiana",
  rating: "4.9",
  reviewCountLabel: "Google reviews",
  addressLine: "19 E Main St",
  cityStateZip: "Wabash, IN 46992",
  fullAddress: "19 E Main St, Wabash, IN 46992",
  phone: process.env.PRACTICE_PHONE || process.env.NEXT_PUBLIC_PRACTICE_PHONE || "(260) 906-6212",
  phoneTel: "+12609066212",
  email: process.env.PRACTICE_EMAIL || "jaxonraymccollum@gmail.com",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=19+E+Main+St+Wabash+IN+46992",
  hoursNote: "Open now — call for full hours & appointments",
  reviews: [
    {
      author: "Shayla Mathis",
      quote: "A great experience with Ken and his staff!",
    },
    {
      author: "Kami Hartsfield",
      quote: "This place is the BEST!",
    },
    {
      author: "Tawnya Norman Delaplane",
      quote: "Super knowledgeable, professional, down to earth guy.",
    },
  ],
} as const;

export function firmDisplayName(): string {
  return (
    process.env.NEXT_PUBLIC_PRACTICE_NAME?.trim() || FIRM.brandName
  );
}
