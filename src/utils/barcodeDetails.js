const BARCODE_TYPE_LABELS = {
  upc_a: 'UPC-A (12 digits)',
  upc_e: 'UPC-E',
  ean13: 'EAN-13',
  code128: 'Code 128',
  code39: 'Code 39',
};

export function getBarcodeTypeLabel(type) {
  if (!type || typeof type !== 'string') return 'Unknown';
  return BARCODE_TYPE_LABELS[type] || type;
}

const UPC_PREFIX_TO_MANUFACTURER = {
  '049022': 'Walgreens',
  '311917': 'Walgreens',
  '012000': 'CVS',
  '036000': 'Kroger',
  '078000': 'Rite Aid',
};

export function inferManufacturerFromUPC(barcode) {
  if (!barcode || typeof barcode !== 'string') return null;
  const digits = barcode.replace(/\D/g, '');
  if (digits.length < 6) return null;

  const prefix6 = digits.slice(0, 6);
  if (UPC_PREFIX_TO_MANUFACTURER[prefix6]) {
    return UPC_PREFIX_TO_MANUFACTURER[prefix6];
  }

  const prefix5 = digits.slice(0, 5);
  for (const [key, value] of Object.entries(UPC_PREFIX_TO_MANUFACTURER)) {
    if (key.startsWith(prefix5) || prefix5 === key.slice(0, 5)) {
      return value;
    }
  }

  return null;
}

export function inferBarcodeFormat(barcode) {
  if (!barcode || typeof barcode !== 'string') return 'Unknown';
  const digits = barcode.replace(/\D/g, '');
  if (!digits) return 'Unknown';

  if (digits.length === 12) {
    if (digits.startsWith('3')) return 'NDC in UPC format';
    if (digits.startsWith('0')) return 'Standard UPC-A (retail)';
    return 'UPC-A (12 digits)';
  }
  if (digits.length === 13) return 'EAN-13';
  if (digits.length >= 10 && digits.length <= 11) return 'NDC format';
  return 'Unknown';
}

export function formatNdc11(ndc) {
  if (!ndc || typeof ndc !== 'string') return null;
  const digits = ndc.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(1, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return null;
}

export function getDigitCount(barcode) {
  if (!barcode || typeof barcode !== 'string') return 0;
  const digits = barcode.replace(/\D/g, '');
  return digits.length;
}
