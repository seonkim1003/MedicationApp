import axios from 'axios';

export interface NdcProperties {
  labeler?: string;
  packaging?: string;
  shape?: string;
  color?: string;
  size?: string;
  imprint?: string;
}

export interface ScannedMedication {
  name: string;
  genericName?: string;
  strength?: string;
  form?: string;
  manufacturer?: string;
  matchedNdc?: string;
  ndcProperties?: NdcProperties;
}

export interface UpcProduct {
  title?: string;
  description?: string;
  brand?: string;
  category?: string;
}

class DrugLookupService {
  private static instance: DrugLookupService;
  private readonly BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

  private constructor() {}

  public static getInstance(): DrugLookupService {
    if (!DrugLookupService.instance) {
      DrugLookupService.instance = new DrugLookupService();
    }
    return DrugLookupService.instance;
  }

  private formatNdcTo4_4_2(ndc: string): string | null {
    const d = ndc.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(1, 5)}-${d.slice(5, 9)}-${d.slice(9)}`;
    if (d.length === 10) return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
    return null;
  }

  private normalizeBarcodeToNdcCandidates(barcode: string): string[] {
    const digits = barcode.replace(/\D/g, '');
    if (!digits || digits.length < 9) {
      return [];
    }

    const candidates: string[] = [digits];

    if (digits.length === 12) {
      candidates.push(digits.slice(1, 11));
      candidates.push('0' + digits.slice(1, 11));
      if (digits.startsWith('3')) candidates.push(digits.slice(1, 12));
      if (digits.startsWith('0')) candidates.push(digits.slice(0, 11));
    }
    if (digits.length === 13 && digits.startsWith('0')) {
      candidates.push(digits.slice(1, 13));
    }

    if (digits.length === 11) {
      candidates.push('0' + digits);
    }

    if (digits.length === 10) {
      candidates.push('0' + digits);
    }

    if (digits.length === 9) {
      candidates.push('0' + digits);
    }

    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of candidates) {
      if (!seen.has(c)) {
        seen.add(c);
        result.push(c);
      }
    }

    for (const c of result) {
      const d = c.replace(/\D/g, '');
      if (d.length === 10 || d.length === 11) {
        const dashed = this.formatNdcTo4_4_2(d);
        if (dashed && !seen.has(dashed)) {
          seen.add(dashed);
          result.push(dashed);
        }
      }
    }

    return result;
  }

  private async fetchNdcProperties(ndc: string): Promise<NdcProperties | undefined> {
    try {
      const url = `${this.BASE_URL}/ndcproperties.json?id=${encodeURIComponent(ndc)}`;
      const response = await axios.get(url, {
        timeout: 8000,
        headers: { 'Accept': 'application/json' },
      });
      const list = response.data?.ndcPropertyList?.ndcProperty;
      if (!list || !Array.isArray(list) || list.length === 0) return undefined;
      const first = Array.isArray(list) ? list[0] : list;
      const props = first?.propertyConceptList?.propertyConcept;
      if (!props) return undefined;
      const propMap: Record<string, string> = {};
      const arr = Array.isArray(props) ? props : [props];
      for (const p of arr) {
        if (p?.propName && p?.propValue) propMap[p.propName] = p.propValue;
      }
      const packaging = first?.packagingList?.packaging;
      const packStr = Array.isArray(packaging) ? packaging[0] : packaging;
      return {
        labeler: propMap.LABELER,
        packaging: packStr || undefined,
        shape: propMap.SHAPETEXT,
        color: propMap.COLORTEXT,
        size: propMap.SIZE,
        imprint: propMap.IMPRINT_CODE,
      };
    } catch {
      return undefined;
    }
  }

  private async lookupByNdc(ndc: string): Promise<ScannedMedication | null> {
    const ndcUrl = `${this.BASE_URL}/rxcui.json?idtype=NDC&id=${encodeURIComponent(ndc)}`;
    const ndcResponse = await axios.get(ndcUrl, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' },
    });

    const ndcData = ndcResponse.data;
    const ids = ndcData?.idGroup?.rxnormId;
    const rxcui = Array.isArray(ids) ? ids[0] : ids;
    if (!rxcui || String(rxcui).trim() === '') {
      return null;
    }
    const propertiesUrl = `${this.BASE_URL}/rxcui/${rxcui}/properties.json`;
    const propertiesResponse = await axios.get(propertiesUrl, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' },
    });

    const propertiesData = propertiesResponse.data?.properties;
    if (!propertiesData) {
      return null;
    }

    let ndcProperties = await this.fetchNdcProperties(ndc);
    if (!ndcProperties) {
      const dashed = this.formatNdcTo4_4_2(ndc.replace(/\D/g, ''));
      if (dashed) {
        ndcProperties = await this.fetchNdcProperties(dashed);
      }
    }
    const labeler = ndcProperties?.labeler;

    return {
      name: propertiesData.name || propertiesData.synonym || 'Unknown Medication',
      genericName: propertiesData.synonym && propertiesData.synonym !== propertiesData.name
        ? propertiesData.synonym
        : undefined,
      strength: this.extractStrength(propertiesData.name),
      form: this.extractForm(propertiesData.name),
      manufacturer: labeler,
      matchedNdc: ndc,
      ndcProperties,
    };
  }

  async lookupByBarcode(barcode: string): Promise<ScannedMedication | null> {
    try {
      if (!barcode || !barcode.trim()) {
        return null;
      }

      const candidates = this.normalizeBarcodeToNdcCandidates(barcode);

      for (const ndc of candidates) {
        if (ndc.length < 10) continue;
        try {
          const result = await this.lookupByNdc(ndc);
          if (result) return result;
        } catch {}
      }

      return null;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.log(`Medication not found for barcode: ${barcode}`);
        } else {
          console.error(`RxNorm API error for barcode ${barcode}:`, error.response?.status, error.message);
        }
      } else {
        console.error('DrugLookupService.lookupByBarcode error:', error?.message || error);
      }
      return null;
    }
  }

  async lookupByUpc(barcode: string): Promise<UpcProduct | null> {
    try {
      const digits = barcode.replace(/\D/g, '');
      if (digits.length !== 12 && digits.length !== 13) return null;
      const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(digits)}`;
      const response = await axios.get(url, {
        timeout: 8000,
        headers: { 'Accept': 'application/json' },
      });
      const items = response.data?.items;
      if (!items || !Array.isArray(items) || items.length === 0) return null;
      const item = items[0];
      return {
        title: item.title || undefined,
        description: item.description || undefined,
        brand: item.brand || undefined,
        category: item.category || undefined,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log(`UPC lookup failed for barcode ${barcode}:`, error.response?.status);
      }
      return null;
    }
  }

  private extractStrength(name: string): string | undefined {
    if (!name) return undefined;
    const strengthMatch = name.match(/\d+\s*(MG|MCG|G|ML|%|UNITS?)\/?\d*\s*(MG|MCG|G|ML)?/i);
    return strengthMatch ? strengthMatch[0].trim() : undefined;
  }

  private extractForm(name: string): string | undefined {
    if (!name) return undefined;
    const formKeywords = [
      'tablet', 'capsule', 'liquid', 'solution', 'suspension',
      'injection', 'cream', 'ointment', 'gel', 'spray', 'drops',
      'patch', 'powder', 'syrup', 'elixir'
    ];
    
    const lowerName = name.toLowerCase();
    for (const form of formKeywords) {
      if (lowerName.includes(form)) return form.charAt(0).toUpperCase() + form.slice(1);
    }
    
    return undefined;
  }
}

export default DrugLookupService;


