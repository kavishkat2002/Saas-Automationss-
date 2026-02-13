
/**
 * Formats a phone number to Sri Lankan standard (+94 7X XXX XXXX)
 * @param phone Raw phone number string
 * @returns Formatted E.164 string or original if invalid
 */
export const formatSLPhoneNumber = (phone: string): string => {
    if (!phone) return "";

    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, "");

    // Handle 07XXXXXXXX format
    if (cleaned.length === 10 && cleaned.startsWith("0")) {
        return "+94" + cleaned.substring(1);
    }

    // Handle 7XXXXXXXX format
    if (cleaned.length === 9 && (cleaned.startsWith("7") || cleaned.startsWith("1") || cleaned.startsWith("2"))) {
        return "+94" + cleaned;
    }

    // Handle 947XXXXXXXX format
    if (cleaned.length === 11 && cleaned.startsWith("94")) {
        return "+" + cleaned;
    }

    // Already has +94
    if (phone.startsWith("+94") && cleaned.length === 11) {
        return "+" + cleaned;
    }

    return phone;
};

/**
 * Validates if a number is a valid Sri Lankan mobile or landline number
 */
export const isValidSLNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, "");
    // SL numbers are 9 digits without the leading 0 or 94
    // Mobile: 7X (e.g. 77, 71, 76, 70, 75, 78)
    // Landline: 11, 2X, 3X, etc.

    const regex = /^(?:\+94|94|0)?(7[0-9]|11|[2345689][0-9])[0-9]{7}$/;
    return regex.test(phone);
};
