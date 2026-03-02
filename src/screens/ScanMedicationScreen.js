import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { CameraView, useCameraPermissions } from 'expo-camera';
import DrugLookupService from '../services/DrugLookupService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRAME_WIDTH = SCREEN_WIDTH * 0.85;
const FRAME_HEIGHT = 220;
const CORNER_LENGTH = 36;
const CORNER_THICKNESS = 4;

const HINTS = [
  'Align the NDC barcode inside the frame',
  'Come closer if the barcode looks blurry',
  'Move back if the barcode is too close',
  'Try better lighting or a different angle',
  'Not working? Tap below to enter manually',
];
const HINT_INTERVAL_MS = 5000;

export default function ScanMedicationScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [hintIndex, setHintIndex] = useState(0);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission?.granted && isScanning) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [permission?.granted, isScanning]);

  useEffect(() => {
    if (!isScanning || isLoading) return;
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % HINTS.length);
    }, HINT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isScanning, isLoading]);

  const handleBarCodeScanned = async ({ data, type }) => {
    if (!isScanning) return;
    setIsScanning(false);
    setIsLoading(true);

    const barcode = String(data || '').trim();

    try {
      const lookupService = DrugLookupService.getInstance();
      let medication = await lookupService.lookupByBarcode(barcode);
      let upcProduct = null;

      if (!medication) {
        const digits = barcode.replace(/\D/g, '');
        if (digits.length === 12 || digits.length === 13) {
          upcProduct = await lookupService.lookupByUpc(barcode);
        }
        Toast.show({
          type: 'info',
          text1: 'Medication Not Found',
          text2: 'We could not find this barcode. You can enter details manually.',
        });
      }

      navigation.navigate('AddMedicationFromScan', {
        barcode,
        barcodeType: type || null,
        scannedMedication: medication || null,
        upcProduct: upcProduct || null,
      });
    } catch (error) {
      console.error('Error looking up medication by barcode:', error);
      Toast.show({
        type: 'error',
        text1: 'Lookup Failed',
        text2: 'We could not look up this medication. Please try again or enter it manually.',
      });
      navigation.navigate('AddMedicationFromScan', {
        barcode,
        barcodeType: type || null,
        scannedMedication: null,
        upcProduct: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setHintIndex(0);
    setIsScanning(true);
  };

  const handleMountError = ({ nativeEvent }) => {
    setCameraError(nativeEvent?.message || 'Camera failed to load');
  };

  const handleManualEntry = () => {
    navigation.navigate('AddMedicationFromScan', {
      barcode: null,
      scannedMedication: null,
    });
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.infoText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.infoText}>
          Camera access is required to scan medication NDC barcodes.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
          <Text style={styles.manualButtonText}>Enter Medication Manually</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cameraError) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Barcode Scanner Not Available</Text>
        <Text style={styles.infoText}>
          The barcode scanner requires native code and may not be available in Expo Go.
        </Text>
        <Text style={[styles.infoText, { marginTop: 10 }]}>
          To use this feature, create a development build:
        </Text>
        <Text style={[styles.infoText, { marginTop: 10, fontWeight: 'bold' }]}>
          npx expo prebuild{'\n'}
          npx expo run:ios
        </Text>
        <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
          <Text style={styles.manualButtonText}>Enter Medication Manually</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_HEIGHT - 4],
  });

  const isNotWorkingHint = hintIndex === HINTS.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Medication Barcode</Text>
        <Text style={styles.subtitle}>Align the NDC barcode inside the frame below.</Text>
      </View>

      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.scanner}
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'code128', 'code39'],
          }}
          onMountError={handleMountError}
        />
        <View style={styles.overlayTop} />
        <View style={styles.overlayBottom} />
        <View style={styles.overlayLeft} />
        <View style={styles.overlayRight} />

        <View style={[styles.frame, { width: FRAME_WIDTH, height: FRAME_HEIGHT }]}>
          <Text style={styles.scanLabel}>Scan NDC barcode here</Text>

          <View style={[styles.cornerBracket, styles.cornerTopLeft]}>
            <View style={[styles.cornerBarH, styles.cornerBarTop]} />
            <View style={[styles.cornerBarV, styles.cornerBarLeft]} />
          </View>
          <View style={[styles.cornerBracket, styles.cornerTopRight]}>
            <View style={[styles.cornerBarH, styles.cornerBarTop]} />
            <View style={[styles.cornerBarV, styles.cornerBarRight]} />
          </View>
          <View style={[styles.cornerBracket, styles.cornerBottomLeft]}>
            <View style={[styles.cornerBarH, styles.cornerBarBottom]} />
            <View style={[styles.cornerBarV, styles.cornerBarLeft]} />
          </View>
          <View style={[styles.cornerBracket, styles.cornerBottomRight]}>
            <View style={[styles.cornerBarH, styles.cornerBarBottom]} />
            <View style={[styles.cornerBarV, styles.cornerBarRight]} />
          </View>

          {isScanning && (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanLineTranslate }],
                },
              ]}
            />
          )}
        </View>
      </View>

      <View style={styles.hintContainer}>
        <Text style={[styles.hintText, isNotWorkingHint && styles.hintTextEmphasized]}>
          {HINTS[hintIndex]}
        </Text>
      </View>

      <View style={styles.footer}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#007bff" />
            <Text style={styles.loadingText}>Looking up medication details...</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry} disabled={isScanning}>
            <Text style={styles.secondaryButtonText}>
              {isScanning ? 'Scanning...' : 'Scan Again'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.manualButton, isNotWorkingHint && styles.manualButtonHighlighted]}
          onPress={handleManualEntry}
        >
          <Text style={[styles.manualButtonText, isNotWorkingHint && styles.manualButtonTextHighlighted]}>
            Not working? Enter manually
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#ced4da',
  },
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanner: {
    width: '100%',
    height: '100%',
  },
  frame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 204, 0.6)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanLabel: {
    position: 'absolute',
    top: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#00ffcc',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cornerBracket: {
    position: 'absolute',
    width: CORNER_LENGTH,
    height: CORNER_LENGTH,
  },
  cornerBarH: {
    position: 'absolute',
    width: CORNER_LENGTH,
    height: CORNER_THICKNESS,
    backgroundColor: '#00ffcc',
  },
  cornerBarV: {
    position: 'absolute',
    width: CORNER_THICKNESS,
    height: CORNER_LENGTH,
    backgroundColor: '#00ffcc',
  },
  cornerBarTop: { top: 0, left: 0 },
  cornerBarBottom: { bottom: 0, left: 0 },
  cornerBarLeft: { top: 0, left: 0 },
  cornerBarRight: { top: 0, right: 0 },
  cornerTopLeft: { top: 0, left: 0 },
  cornerTopRight: { top: 0, right: 0 },
  cornerBottomLeft: { bottom: 0, left: 0 },
  cornerBottomRight: { bottom: 0, right: 0 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: 'rgba(0, 255, 204, 0.8)',
    top: 0,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '18%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '18%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayLeft: {
    position: 'absolute',
    top: '18%',
    bottom: '18%',
    left: 0,
    width: '7%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayRight: {
    position: 'absolute',
    top: '18%',
    bottom: '18%',
    right: 0,
    width: '7%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hintContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#000',
    minHeight: 60,
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 16,
    color: '#ced4da',
    textAlign: 'center',
    fontWeight: '500',
  },
  hintTextEmphasized: {
    color: '#00ffcc',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#000',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#343a40',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  manualButtonHighlighted: {
    borderColor: '#00ffcc',
    backgroundColor: 'rgba(0, 255, 204, 0.15)',
  },
  manualButtonText: {
    color: '#ced4da',
    fontSize: 14,
    fontWeight: '500',
  },
  manualButtonTextHighlighted: {
    color: '#00ffcc',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  infoText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    marginBottom: 16,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});
