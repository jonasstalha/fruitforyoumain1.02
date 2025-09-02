import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { Farm, Lot, AvocadoTracking, StatsData } from "@shared/schema";
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { generateLotPDF } from './pdfGenerator';
import { uploadFileToStorage } from './firebaseHelpers';

// Helper function to convert Firestore timestamp to ISO string
const timestampToISOString = (timestamp: any) => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return timestamp;
};

// Helper function to convert Firestore document to Farm type
const convertFarmDoc = (doc: any): Farm => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    location: data.location,
    description: data.description || "",
    code: data.code,
    active: data.active !== false, // Default to true if not specified
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt)
  };
};

// Helper function to convert Firestore document to Lot type
const convertLotDoc = (doc: any): Lot => {
  const data = doc.data();
  return {
    id: doc.id,
    lotNumber: data.lotNumber,
    farmId: data.farmId,
    harvestDate: timestampToISOString(data.harvestDate),
    initialQuantity: data.initialQuantity,
    currentStatus: data.currentStatus,
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt),
    notes: data.notes || ""
  };
};

// Helper function to convert Firestore document to AvocadoTracking type
const convertAvocadoTrackingDoc = (doc: any): AvocadoTracking => {
  const data = doc.data();
  return {
    id: doc.id,
    harvest: {
      harvestDate: timestampToISOString(data.harvest.harvestDate),
      farmLocation: data.harvest.farmLocation,
      farmerId: data.harvest.farmerId,
      lotNumber: data.harvest.lotNumber,
      variety: data.harvest.variety
    },
    transport: {
      lotNumber: data.transport.lotNumber,
      transportCompany: data.transport.transportCompany,
      driverName: data.transport.driverName,
      vehicleId: data.transport.vehicleId,
      departureDateTime: timestampToISOString(data.transport.departureDateTime),
      arrivalDateTime: timestampToISOString(data.transport.arrivalDateTime),
      temperature: data.transport.temperature
    },
    sorting: {
      lotNumber: data.sorting.lotNumber,
      sortingDate: timestampToISOString(data.sorting.sortingDate),
      qualityGrade: data.sorting.qualityGrade,
      rejectedCount: data.sorting.rejectedCount,
      notes: data.sorting.notes || ""
    },
    packaging: {
      lotNumber: data.packaging.lotNumber,
      packagingDate: timestampToISOString(data.packaging.packagingDate),
      boxId: data.packaging.boxId,
      workerIds: data.packaging.workerIds || [],
      netWeight: data.packaging.netWeight,
      avocadoCount: data.packaging.avocadoCount,
      boxType: data.packaging.boxType || "case"
    },
    storage: {
      boxId: data.storage.boxId,
      entryDate: timestampToISOString(data.storage.entryDate),
      storageTemperature: data.storage.storageTemperature,
      storageRoomId: data.storage.storageRoomId,
      exitDate: timestampToISOString(data.storage.exitDate)
    },
    export: {
      boxId: data.export.boxId,
      loadingDate: timestampToISOString(data.export.loadingDate),
      containerId: data.export.containerId,
      driverName: data.export.driverName,
      vehicleId: data.export.vehicleId,
      destination: data.export.destination
    },
    delivery: {
      boxId: data.delivery.boxId,
      estimatedDeliveryDate: timestampToISOString(data.delivery.estimatedDeliveryDate),
      actualDeliveryDate: timestampToISOString(data.delivery.actualDeliveryDate),
      clientName: data.delivery.clientName,
      clientLocation: data.delivery.clientLocation,
      notes: data.delivery.notes || ""
    },
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt)
  };
};

// Farms API
export const getFarms = async (): Promise<Farm[]> => {
  try {
    console.log("Fetching farms from Firestore");
    const farmsRef = collection(db, "farms");
    const q = query(farmsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const farms = querySnapshot.docs.map(convertFarmDoc);
    console.log("Fetched farms:", farms);
    return farms;
  } catch (error) {
    console.error("Error getting farms:", error);
    throw error;
  }
};

export const addFarm = async (data: Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>): Promise<Farm> => {
  try {
    console.log("Adding farm to Firestore:", data);
    
    // Validate required fields
    if (!data.name || !data.location || !data.code) {
      console.error("Missing required fields:", { data });
      throw new Error("Missing required fields: name, location, and code are required");
    }
    
    // Validate field types
    if (typeof data.name !== 'string' || typeof data.location !== 'string' || typeof data.code !== 'string') {
      console.error("Invalid field types:", { data });
      throw new Error("Invalid field types: name, location, and code must be strings");
    }
    
    // Validate boolean field
    if (typeof data.active !== 'boolean') {
      console.error("Invalid active field type:", { data });
      throw new Error("Invalid field type: active must be a boolean");
    }
    
    const farmsRef = collection(db, "farms");
    const newFarm = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log("Creating farm document with data:", newFarm);
    const docRef = await addDoc(farmsRef, newFarm);
    console.log("Farm document created with ID:", docRef.id);
    
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.error("Document not found after creation:", docRef.id);
      throw new Error("Failed to create farm document");
    }
    
    const farm = convertFarmDoc(docSnap);
    console.log("Created farm:", farm);
    
    return farm;
  } catch (error) {
    console.error("Error adding farm:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to add farm: ${error.message}`);
    }
    throw error;
  }
};

export const updateFarm = async (id: string, data: Partial<Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Farm> => {
  try {
    console.log("Updating farm in Firestore:", { id, data });
    
    // Validate required fields if they are being updated
    if (data.name === "" || data.location === "" || data.code === "") {
      throw new Error("Required fields cannot be empty");
    }
    
    const farmRef = doc(db, "farms", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    console.log("Updating farm document with data:", updateData);
    await updateDoc(farmRef, updateData);
    
    const docSnap = await getDoc(farmRef);
    const farm = convertFarmDoc(docSnap);
    console.log("Updated farm:", farm);
    
    return farm;
  } catch (error) {
    console.error("Error updating farm:", error);
    throw error;
  }
};

export const deleteFarm = async (id: string): Promise<void> => {
  try {
    console.log("Deleting farm from Firestore:", id);
    const farmRef = doc(db, "farms", id);
    await deleteDoc(farmRef);
    console.log("Farm deleted successfully");
  } catch (error) {
    console.error("Error deleting farm:", error);
    throw error;
  }
};

// Lots API
export const getLots = async (): Promise<Lot[]> => {
  try {
    const lotsRef = collection(db, "lots");
    const q = query(lotsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertLotDoc);
  } catch (error) {
    console.error("Error getting lots:", error);
    throw error;
  }
};

export const addLot = async (data: Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lot> => {
  try {
    const lotsRef = collection(db, "lots");
    const newLot = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(lotsRef, newLot);
    const docSnap = await getDoc(docRef);
    return convertLotDoc(docSnap);
  } catch (error) {
    console.error("Error adding lot:", error);
    throw error;
  }
};

export const updateLot = async (id: string, data: Partial<Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lot> => {
  try {
    const lotRef = doc(db, "lots", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    await updateDoc(lotRef, updateData);
    const docSnap = await getDoc(lotRef);
    return convertLotDoc(docSnap);
  } catch (error) {
    console.error("Error updating lot:", error);
    throw error;
  }
};

export const deleteLot = async (id: string): Promise<void> => {
  try {
    const lotRef = doc(db, "lots", id);
    await deleteDoc(lotRef);
  } catch (error) {
    console.error("Error deleting lot:", error);
    throw error;
  }
};

// Avocado Tracking API
export const getAvocadoTrackingData = async (): Promise<AvocadoTracking[]> => {
  try {
    const trackingRef = collection(db, "avocado-tracking");
    const q = query(trackingRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertAvocadoTrackingDoc);
  } catch (error) {
    console.error("Error getting avocado tracking data:", error);
    throw error;
  }
};

export const addAvocadoTracking = async (data: Omit<AvocadoTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<AvocadoTracking> => {
  try {
    const trackingRef = collection(db, "avocado-tracking");
    
    // Convert empty strings to null and ensure proper types
    const cleanData = {
      harvest: {
        harvestDate: data.harvest?.harvestDate || "",
        farmLocation: data.harvest?.farmLocation || "",
        farmerId: data.harvest?.farmerId || "",
        lotNumber: data.harvest?.lotNumber || "",
        variety: data.harvest?.variety || "hass"
      },
      transport: {
        lotNumber: data.transport?.lotNumber || "",
        transportCompany: data.transport?.transportCompany || "",
        driverName: data.transport?.driverName || "",
        vehicleId: data.transport?.vehicleId || "",
        departureDateTime: data.transport?.departureDateTime || "",
        arrivalDateTime: data.transport?.arrivalDateTime || "",
        temperature: data.transport?.temperature || 0
      },
      sorting: {
        lotNumber: data.sorting?.lotNumber || "",
        sortingDate: data.sorting?.sortingDate || "",
        qualityGrade: data.sorting?.qualityGrade || "A",
        rejectedCount: data.sorting?.rejectedCount || 0,
        notes: data.sorting?.notes || ""
      },
      packaging: {
        lotNumber: data.packaging?.lotNumber || "",
        packagingDate: data.packaging?.packagingDate || "",
        boxId: data.packaging?.boxId || "",
        workerIds: data.packaging?.workerIds || [],
        netWeight: data.packaging?.netWeight || 0,
        avocadoCount: data.packaging?.avocadoCount || 0,
        boxType: data.packaging?.boxType || "case"
      },
      storage: {
        boxId: data.storage?.boxId || "",
        entryDate: data.storage?.entryDate || "",
        storageTemperature: data.storage?.storageTemperature || 0,
        storageRoomId: data.storage?.storageRoomId || "",
        exitDate: data.storage?.exitDate || ""
      },
      export: {
        boxId: data.export?.boxId || "",
        loadingDate: data.export?.loadingDate || "",
        containerId: data.export?.containerId || "",
        driverName: data.export?.driverName || "",
        vehicleId: data.export?.vehicleId || "",
        destination: data.export?.destination || ""
      },
      delivery: {
        boxId: data.delivery?.boxId || "",
        estimatedDeliveryDate: data.delivery?.estimatedDeliveryDate || "",
        actualDeliveryDate: data.delivery?.actualDeliveryDate || "",
        clientName: data.delivery?.clientName || "",
        clientLocation: data.delivery?.clientLocation || "",
        notes: data.delivery?.notes || ""
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(trackingRef, cleanData);
    const docSnap = await getDoc(docRef);
    return convertAvocadoTrackingDoc(docSnap);
  } catch (error) {
    console.error("Error adding avocado tracking:", error);
    throw error;
  }
};

export const updateAvocadoTracking = async (id: string, data: Partial<Omit<AvocadoTracking, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AvocadoTracking> => {
  try {
    const trackingRef = doc(db, "avocado-tracking", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    await updateDoc(trackingRef, updateData);
    const docSnap = await getDoc(trackingRef);
    return convertAvocadoTrackingDoc(docSnap);
  } catch (error) {
    console.error("Error updating avocado tracking:", error);
    throw error;
  }
};

export const deleteAvocadoTracking = async (id: string): Promise<void> => {
  try {
    const trackingRef = doc(db, "avocado-tracking", id);
    await deleteDoc(trackingRef);
  } catch (error) {
    console.error("Error deleting avocado tracking:", error);
    throw error;
  }
};

// Stats API
export const getStats = async (): Promise<StatsData> => {
  try {
    // Get active farms count
    const farmsRef = collection(db, "farms");
    const activeFarmsQuery = query(farmsRef, where("active", "==", true));
    const activeFarmsSnapshot = await getDocs(activeFarmsQuery);
    const activeFarmsCount = activeFarmsSnapshot.size;
    
    // Get total lots count
    const lotsRef = collection(db, "lots");
    const lotsSnapshot = await getDocs(lotsRef);
    const totalLotsCount = lotsSnapshot.size;
    
    // Get in transit lots count
    const inTransitQuery = query(lotsRef, where("currentStatus", "==", "shipped"));
    const inTransitSnapshot = await getDocs(inTransitQuery);
    const inTransitCount = inTransitSnapshot.size;
    
    // Get delivered today lots count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const deliveredTodayQuery = query(
      lotsRef, 
      where("currentStatus", "==", "delivered"),
      where("updatedAt", ">=", Timestamp.fromDate(today)),
      where("updatedAt", "<", Timestamp.fromDate(tomorrow))
    );
    const deliveredTodaySnapshot = await getDocs(deliveredTodayQuery);
    const deliveredTodayCount = deliveredTodaySnapshot.size;
    
    return {
      totalLots: totalLotsCount,
      activeFarms: activeFarmsCount,
      inTransit: inTransitCount,
      deliveredToday: deliveredTodayCount
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    throw error;
  }
};

// PDF Generation and Storage
export const generateAndStorePDF = async (lotId: string): Promise<string> => {
  try {
    // Get the lot data
    const entries = await getAvocadoTrackingData();
    const lot = entries.find(entry => entry.harvest.lotNumber === lotId);
    
    if (!lot) {
      throw new Error(`Lot ${lotId} not found`);
    }

    // Generate PDF
    const pdfBlob = await generateLotPDF(lot);

    // Upload to Firebase Storage
    const storageRef = ref(storage, `reports/${lotId}.pdf`);
    await uploadBytes(storageRef, pdfBlob, {
      contentType: 'application/pdf'
    });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error generating and storing PDF:", error);
    throw error;
  }
};

// Add a function to create a new archive box in Firestore
export const createArchiveBox = async (title: string, color: string, icon: string, userId: string): Promise<string> => {
  if (!userId) {
    throw new Error('User ID is required to create a box.');
  }

  const docRef = await addDoc(collection(db, 'boxes'), {
    title,
    color,
    icon,
    userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// Add a function to add an item to an archive box
export const addItemToBox = async (
  boxId: string,
  itemName: string,
  type: string,
  file: File | undefined,
  userId: string
): Promise<string> => {
  if (!userId) {
    throw new Error('User ID is required to add an item to a box.');
  }

  let fileUrl = '';
  if (file) {
    try {
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000000000000);
      const safeFileName = `${timestamp}_${randomId}.${file.name.split('.').pop()}`;
      
      // Upload file to storage
      fileUrl = await uploadFileToStorage(file, boxId, itemName, type, userId);
      console.log('File uploaded successfully:', fileUrl);
    } catch (error) {
      console.error('Storage upload error:', error);
      throw new Error('Failed to upload file. Please try again.');
    }
  }

  try {
    const docRef = await addDoc(collection(db, 'boxItems'), {
      boxId,
      name: itemName,
      type,
      fileUrl,
      userId,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Firestore add error:', error);
    if (fileUrl && file) {
      try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
      } catch (deleteError) {
        console.error('Failed to clean up orphaned file:', deleteError);
      }
    }
    throw error;
  }
};
