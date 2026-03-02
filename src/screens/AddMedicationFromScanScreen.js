import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Toast from 'react-native-toast-message';

import MedicationManager from '../services/MedicationManager';
import { getBarcodeTypeLabel, inferManufacturerFromUPC, inferBarcodeFormat, formatNdc11, getDigitCount } from '../utils/barcodeDetails';

export default function AddMedicationFromScanScreen({ route, navigation }) {
  const { barcode, barcodeType, scannedMedication, upcProduct, groupId: selectedGroupId } = route.params || {};

  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [pillCount, setPillCount] = useState('');

  useEffect(() => {
    if (scannedMedication) {
      setName(scannedMedication.name || '');
      setGenericName(scannedMedication.genericName || '');
      setStrength(scannedMedication.strength || '');
      setForm(scannedMedication.form || '');
      setManufacturer(scannedMedication.manufacturer || (barcode ? inferManufacturerFromUPC(barcode) : '') || '');
    } else {
      if (upcProduct?.title) setName(upcProduct.title);
      if (barcode && inferManufacturerFromUPC(barcode)) {
        setManufacturer(inferManufacturerFromUPC(barcode));
      }
    }
  }, [scannedMedication, upcProduct, barcode]);

  const handleSave = async () => {
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        Toast.show({
          type: 'error',
          text1: 'Name required',
          text2: 'Please enter a medication name',
        });
        return;
      }

      const count = Number.parseInt(pillCount, 10);
      const medicationManager = MedicationManager.getInstance();

      const newMed = {
        id: Date.now().toString(),
        name: trimmedName,
        displayName: trimmedName,
        genericName: genericName.trim() || trimmedName,
        isActive: true,
        pillCount: Number.isNaN(count) ? 0 : count,
        alarms: [],
        groupId: selectedGroupId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await medicationManager.addMedication(newMed);

      Toast.show({
        type: 'success',
        text1: 'Medication Added',
        text2: barcode ? `Scanned from barcode ${barcode}` : undefined,
      });

      navigation.popToTop();
    } catch (error) {
      console.error('Error saving scanned medication:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save medication',
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Add Medication from Scan</Text>

        {barcode ? (
          <View style={styles.scanDetailsCard}>
            <Text style={styles.scanDetailsTitle}>Scan Details</Text>
            <Text style={styles.scanDetailsRow}>Barcode: {barcode}</Text>
            <Text style={styles.scanDetailsRow}>Type: {getBarcodeTypeLabel(barcodeType)}</Text>
            <Text style={styles.scanDetailsRow}>Format: {inferBarcodeFormat(barcode)}</Text>
            {getDigitCount(barcode) > 0 ? (
              <Text style={styles.scanDetailsRow}>Digits: {getDigitCount(barcode)}</Text>
            ) : null}
            {scannedMedication?.matchedNdc ? (
              <Text style={styles.scanDetailsRow}>
                Matched NDC: {formatNdc11(scannedMedication.matchedNdc) || scannedMedication.matchedNdc}
              </Text>
            ) : null}
            {(scannedMedication?.ndcProperties?.labeler || scannedMedication?.manufacturer || inferManufacturerFromUPC(barcode)) ? (
              <Text style={styles.scanDetailsRow}>
                Labeler: {scannedMedication?.ndcProperties?.labeler || scannedMedication?.manufacturer || inferManufacturerFromUPC(barcode)}
              </Text>
            ) : null}
            {scannedMedication?.ndcProperties?.packaging ? (
              <Text style={styles.scanDetailsRow}>Packaging: {scannedMedication.ndcProperties.packaging}</Text>
            ) : null}
            {(scannedMedication?.ndcProperties?.color || scannedMedication?.ndcProperties?.shape || scannedMedication?.ndcProperties?.size) ? (
              <Text style={styles.scanDetailsRow}>
                Physical: {[scannedMedication?.ndcProperties?.color, scannedMedication?.ndcProperties?.shape, scannedMedication?.ndcProperties?.size].filter(Boolean).join(' | ')}
              </Text>
            ) : null}
            {scannedMedication?.ndcProperties?.imprint ? (
              <Text style={styles.scanDetailsRow}>Imprint: {scannedMedication.ndcProperties.imprint}</Text>
            ) : null}
            {(upcProduct?.title || upcProduct?.brand || upcProduct?.category) ? (
              <Text style={styles.scanDetailsRow}>
                Product: {[upcProduct?.title, upcProduct?.brand, upcProduct?.category].filter(Boolean).join(' • ')}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.barcodeText}>No barcode (manual entry)</Text>
        )}

        <Text style={styles.label}>Medication Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Aspirin 81 mg"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Generic Name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., acetylsalicylic acid"
          value={genericName}
          onChangeText={setGenericName}
        />

        <Text style={styles.label}>Strength (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 81 mg"
          value={strength}
          onChangeText={setStrength}
        />

        <Text style={styles.label}>Form (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., tablet, capsule"
          value={form}
          onChangeText={setForm}
        />

        <Text style={styles.label}>Manufacturer (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Bayer"
          value={manufacturer}
          onChangeText={setManufacturer}
        />

        <Text style={styles.label}>Pills on Hand (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 30"
          keyboardType="numeric"
          value={pillCount}
          onChangeText={setPillCount}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>Save Medication</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    color: '#212529',
  },
  barcodeText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
    textAlign: 'center',
  },
  scanDetailsCard: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    padding: 12,
    marginBottom: 16,
  },
  scanDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  scanDetailsRow: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});


