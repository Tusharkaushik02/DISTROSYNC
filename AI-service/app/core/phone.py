import re


def normalize_phone_number(phone: str | None) -> str | None:
    """Normalize phone numbers from various WhatsApp/Twilio formats to canonical E.164.

    Handles formats:
      - "+91 8287162023" -> "+918287162023"
      - "+918287162023"  -> "+918287162023"
      - "918287162023"   -> "+918287162023"
      - "whatsapp:+918287162023"  -> "+918287162023"
      - "whatsapp: +918287162023" -> "+918287162023"
      - "8287162023" (10 digits)  -> "+918287162023" (default Indian country code)
    """
    if not phone or not isinstance(phone, str):
        return None

    # 1. Strip whitespace and case-insensitive 'whatsapp:' prefix
    cleaned = re.sub(r'(?i)^whatsapp:\s*', '', phone.strip())

    # 2. Strip all formatting characters (spaces, dashes, parentheses, dots)
    cleaned = re.sub(r'[\s\(\)\-\.]+', '', cleaned)

    if not cleaned:
        return None

    # 3. If starts with '+', validate and keep digits
    if cleaned.startswith('+'):
        digits = cleaned[1:]
        if not digits.isdigit():
            return None
        return f"+{digits}"

    # 4. If plain digits
    if not cleaned.isdigit():
        return None

    # 12 digits starting with 91 (e.g. 918287162023)
    if len(cleaned) == 12 and cleaned.startswith('91'):
        return f"+{cleaned}"

    # 10 digits (e.g. 8287162023) -> assume India (+91)
    if len(cleaned) == 10:
        return f"+91{cleaned}"

    # Generic digits with leading '+'
    return f"+{cleaned}"
