import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import FavoritePicturesService from '../services/FavoritePicturesService';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FavoritePicturesScreen() {
  const [currentPicture, setCurrentPicture] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pictureCount, setPictureCount] = useState(0);

  useEffect(() => {
    loadRandomPicture();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Toast.show({
          type: 'warning',
          text1: 'Permissions Required',
          text2: 'Please grant camera and photo library permissions to add pictures',
        });
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const loadRandomPicture = async () => {
    try {
      setIsLoading(true);
      const service = FavoritePicturesService.getInstance();
      const randomPicture = await service.getRandomPicture();
      const count = await service.getPictureCount();
      
      setCurrentPicture(randomPicture);
      setPictureCount(count);
    } catch (error) {
      console.error('Error loading random picture:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load picture',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPicture = () => {
    Alert.alert(
      'Add Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Photo Library',
          onPress: () => openImageLibrary(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await addPictureToFavorites(uri);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open camera',
      });
    }
  };

  const openImageLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await addPictureToFavorites(uri);
      }
    } catch (error) {
      console.error('Error opening image library:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open photo library',
      });
    }
  };

  const addPictureToFavorites = async (uri) => {
    try {
      const service = FavoritePicturesService.getInstance();
      await service.addPicture(uri);
      
      // Reload to show the new picture (or a random one)
      await loadRandomPicture();
      
      Toast.show({
        type: 'success',
        text1: 'Picture Added',
        text2: 'Picture has been added to your favorites',
      });
    } catch (error) {
      console.error('Error adding picture:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add picture',
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentPicture ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: currentPicture.uri }}
            style={styles.image}
            resizeMode="contain"
          />
          <View style={styles.overlay}>
            <Text style={styles.pictureCount}>
              {pictureCount} {pictureCount === 1 ? 'picture' : 'pictures'} in collection
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Pictures Yet</Text>
          <Text style={styles.emptyText}>
            Add your favorite pictures to see them here
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddPicture}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Add Picture</Text>
        </TouchableOpacity>
        
        {currentPicture && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadRandomPicture}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>New Random</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: '500',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pictureCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  addButton: {
    backgroundColor: '#007bff',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 12,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  refreshButton: {
    backgroundColor: '#6c757d',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 150,
    alignItems: 'center',
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});


