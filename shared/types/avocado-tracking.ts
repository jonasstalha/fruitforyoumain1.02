// This file contains the definition for the AvocadoTracking type.

export interface Harvest {
    harvestDate: string;
    farmLocation: string;
    farmerId: string;
    lotNumber: string;
    variety: string;
}

export interface Transport {
    lotNumber: string;
    transportCompany: string;
    driverName: string;
    vehicleId: string;
    departureDateTime: string;
    arrivalDateTime: string;
    temperature: number;
}

export interface Sorting {
    qualityGrade: string;
    rejectedCount: number;
    notes?: string;
}

export interface Packaging {
    boxId: string;
    netWeight: number;
    avocadoCount: number;
    boxType: string;
}

export interface Delivery {
    clientName: string;
    clientLocation: string;
    actualDeliveryDate?: string;
    notes?: string;
}

export interface AvocadoTracking {
    id: string;
    harvest: Harvest;
    transport: Transport;
    sorting: Sorting;
    packaging: Packaging;
    delivery: Delivery;
}
