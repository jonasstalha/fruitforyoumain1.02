import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Check,
  AlertTriangle,
  Save,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X
} from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import styled, { createGlobalStyle } from 'styled-components';

// Global styles for animations
const GlobalStyle = createGlobalStyle`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in-out forwards;
  }
`;

export default function historiquedeconsomation() {
  const [selectedDate, setSelectedDate] = useState('');
  const [materials, setMaterials] = useState([]);
  const [consumption, setConsumption] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [animateItems, setAnimateItems] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch materials from Firestore when component mounts
  useEffect(() => {
    const fetchMaterials = async () => {
      setLoading(true);
      try {
        // Fetch consumable items from Firestore inventory collection
        const querySnapshot = await getDocs(collection(db, "inventory"));
        const inventoryData = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            name: doc.data().itemName,
            current_stock: parseFloat(doc.data().quantity),
            alert_threshold: doc.data().alertThreshold ? parseFloat(doc.data().alertThreshold) : 0,
            unit: doc.data().unit,
            itemType: doc.data().itemType,
            isConsumable: doc.data().isConsumable !== undefined ? doc.data().isConsumable : true
          }))
          // Only show consumable items
          .filter(item => item.isConsumable);

        setMaterials(inventoryData);

        // Initialize consumption with zeros
        const initialConsumption = {};
        inventoryData.forEach(material => {
          initialConsumption[material.id] = 0;
        });
        setConsumption(initialConsumption);

        // Trigger animation after data is loaded
        setTimeout(() => {
          setAnimateItems(true);
        }, 100);

      } catch (error) {
        console.error("Failed to fetch materials:", error);
        showNotification({
          type: "error",
          message: "Impossible de charger les matériaux"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  // Calculate remaining stock for a material
  const calculateRemainingStock = (material) => {
    const consumed = consumption[material.id] || 0;
    return material.current_stock - consumed;
  };

  // Check for low stock when consumption changes
  useEffect(() => {
    const alerts = materials.filter(material => {
      const remaining = calculateRemainingStock(material);
      return remaining <= material.alert_threshold;
    }).map(material => material.name);

    setLowStockAlerts(alerts);
  }, [consumption, materials]);

  // Show notification
  const showNotification = (notif) => {
    setNotification(notif);

    // Auto-dismiss success notifications after 4 seconds
    if (notif.type === "success") {
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    }
  };

  // Handle consumption input change
  const handleConsumptionChange = (materialId, value) => {
    const numValue = parseInt(value, 10) || 0;

    // Ensure consumption doesn't exceed current stock
    const material = materials.find(m => m.id === materialId);
    if (material && numValue > material.current_stock) {
      showNotification({
        type: "error",
        message: `La consommation ne peut pas dépasser le stock actuel (${material.current_stock})`
      });
      return;
    } else if (numValue < 0) {
      return;
    }

    setConsumption(prev => ({
      ...prev,
      [materialId]: numValue
    }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedDate) {
      showNotification({
        type: "error",
        message: "Veuillez sélectionner une date"
      });
      return;
    }

    // Get consumed materials (only those with values > 0)
    const consumedMaterials = Object.entries(consumption)
      .filter(([_, value]) => value > 0)
      .map(([materialId, value]) => {
        const material = materials.find(m => m.id === materialId);
        return {
          id: materialId,
          consumed_qty: parseFloat(value),
          material_name: material.name,
          material_type: material.itemType,
          unit: material.unit
        };
      });

    if (consumedMaterials.length === 0) {
      showNotification({
        type: "error",
        message: "Aucune consommation à enregistrer"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Process each consumed material
      for (const item of consumedMaterials) {
        // 1. Update inventory quantity in Firestore
        const material = materials.find(m => m.id === item.id);
        const newQuantity = material.current_stock - item.consumed_qty;

        // Update the inventory item in Firestore
        await updateDoc(doc(db, "inventory", item.id), {
          quantity: newQuantity
        });

        // 2. Add consumption record to Firestore
        await addDoc(collection(db, "consumption"), {
          itemId: item.id,
          itemName: item.material_name,
          itemType: item.material_type,
          quantity: item.consumed_qty,
          unit: item.unit,
          date: selectedDate,
          department: "production",
          notes: "Consommation enregistrée depuis la production",
          timestamp: new Date().toISOString()
        });
      }

      showNotification({
        type: "success",
        message: "Consommation enregistrée avec succès"
      });

      // Update the stock in our local state
      const updatedMaterials = materials.map(material => {
        const consumedQty = consumption[material.id] || 0;
        return {
          ...material,
          current_stock: material.current_stock - consumedQty
        };
      });

      setMaterials(updatedMaterials);

      // Reset consumption
      const resetConsumption = {};
      updatedMaterials.forEach(material => {
        resetConsumption[material.id] = 0;
      });
      setConsumption(resetConsumption);

    } catch (error) {
      console.error("Failed to submit consumption:", error);
      showNotification({
        type: "error",
        message: "Erreur lors de l'enregistrement de la consommation"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset consumption values to zero
  const handleReset = () => {
    const resetConsumption = {};
    materials.forEach(material => {
      resetConsumption[material.id] = 0;
    });
    setConsumption(resetConsumption);

    showNotification({
      type: "info",
      message: "Valeurs de consommation réinitialisées"
    });
  };

  // Get stock status for styling and icon
  const getStockStatus = (material) => {
    const remaining = calculateRemainingStock(material);
    if (remaining <= 0) return "danger";
    if (remaining <= material.alert_threshold) return "warning";
    return "normal";
  };

  // Render stock status icon
  const renderStockIcon = (status) => {
    switch (status) {
      case "danger":
        return <AlertCircle className="text-red-500" />;
      case "warning":
        return <AlertTriangle className="text-yellow-500" />;
      default:
        return <Check className="text-green-500" />;
    }
  };

  // Render notification
  const renderNotification = () => {
    if (!notification) return null;

    const bgColor = {
      success: "bg-green-50 border-green-400",
      error: "bg-red-50 border-red-400",
      info: "bg-blue-50 border-blue-400"
    }[notification.type];

    const textColor = {
      success: "text-green-700",
      error: "text-red-700",
      info: "text-blue-700"
    }[notification.type];

    const icon = {
      success: <Check className="h-5 w-5 text-green-400" />,
      error: <AlertCircle className="h-5 w-5 text-red-400" />,
      info: <Info className="h-5 w-5 text-blue-400" />
    }[notification.type];

    return (
      <div className={`fixed top-4 right-4 z-50 animate-fade-in flex items-center p-4 max-w-xs rounded shadow-lg ${bgColor} border-l-4`}>
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-3 mr-2 flex-grow">
          <p className={`text-sm ${textColor}`}>{notification.message}</p>
        </div>
        <button
          onClick={() => setNotification(null)}
          className="flex-shrink-0 ml-auto text-gray-400 hover:text-gray-500"
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <GlobalStyle />
      {renderNotification()}

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Suivi de Consommation des Matériaux</h1>

        {/* Date Selection Card */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-5 transition duration-200 hover:shadow-md">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="text-blue-500" />
              <label htmlFor="date" className="font-medium">Date de consommation:</label>
            </div>
            <input
              type="date"
              id="date"
              className="border border-gray-300 rounded-md p-2 w-full sm:w-auto focus:ring-2 focus:ring-blue-300 focus:border-blue-500 focus:outline-none transition duration-200"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Alerts Section with Toggle */}
        {lowStockAlerts.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
            <div
              className="bg-yellow-50 border-l-4 border-yellow-400 p-4 cursor-pointer flex justify-between items-center"
              onClick={() => setExpanded(!expanded)}
            >
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <span className="ml-2 font-medium text-yellow-700">
                  {lowStockAlerts.length} matériau{lowStockAlerts.length > 1 ? 'x' : ''} en niveau d'alerte
                </span>
              </div>
              {expanded ?
                <ChevronUp className="h-5 w-5 text-yellow-500" /> :
                <ChevronDown className="h-5 w-5 text-yellow-500" />
              }
            </div>

            {expanded && (
              <div className="p-4 bg-white">
                <ul className="space-y-2">
                  {lowStockAlerts.map((name, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-700">
                      <div className="h-2 w-2 bg-yellow-400 rounded-full mr-2"></div>
                      <span>Le stock de <span className="font-medium">{name}</span> est presque épuisé</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin mb-4">
              <RefreshCw className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        ) : selectedDate ? (
          <>
            {/* Materials Table for Desktop */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Matériau
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Actuel
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consommation
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Restant
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materials.map((material, index) => {
                      const status = getStockStatus(material);
                      const remaining = calculateRemainingStock(material);

                      return (
                        <tr
                          key={material.id}
                          className={`${status === "danger" ? "bg-red-50" :
                              status === "warning" ? "bg-yellow-50" : ""
                            } transition-all duration-300 ease-in-out hover:bg-gray-50 ${animateItems ? 'opacity-100' : 'opacity-0'
                            }`}
                          style={{ transitionDelay: `${index * 80}ms` }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{material.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700">
                              {material.current_stock} <span className="text-gray-500 text-xs">{material.unit}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max={material.current_stock}
                                value={consumption[material.id] || 0}
                                onChange={(e) => handleConsumptionChange(material.id, e.target.value)}
                                className="border border-gray-300 rounded-md p-2 w-20 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 focus:outline-none transition-all duration-200"
                              />
                              <span className="ml-2 text-xs text-gray-500">{material.unit}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${status === "danger" ? "text-red-700" :
                                status === "warning" ? "text-yellow-700" :
                                  "text-gray-900"
                              }`}>
                              {remaining} <span className="text-gray-500 text-xs font-normal">{material.unit}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {renderStockIcon(status)}
                              <span className={`ml-2 text-sm px-2 py-1 rounded-full ${status === "danger" ? "bg-red-100 text-red-700" :
                                  status === "warning" ? "bg-yellow-100 text-yellow-700" :
                                    "bg-green-100 text-green-700"
                                }`}>
                                {status === "danger" ? "Critique" :
                                  status === "warning" ? "Alerte" : "Normal"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View for Materials */}
            <div className="md:hidden space-y-4 mb-6">
              {materials.map((material, index) => {
                const status = getStockStatus(material);
                const remaining = calculateRemainingStock(material);

                return (
                  <div
                    key={material.id}
                    className={`bg-white rounded-lg shadow-sm p-4 ${status === "danger" ? "border-l-4 border-red-500" :
                        status === "warning" ? "border-l-4 border-yellow-500" : ""
                      } transition-all duration-300 ease-in-out ${animateItems ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                      }`}
                    style={{ transitionDelay: `${index * 80}ms` }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium text-gray-800">{material.name}</h3>
                      <div className={`flex items-center px-2 py-1 rounded-full text-xs ${status === "danger" ? "bg-red-100 text-red-700" :
                          status === "warning" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                        }`}>
                        {renderStockIcon(status)}
                        <span className="ml-1">
                          {status === "danger" ? "Critique" :
                            status === "warning" ? "Alerte" : "Normal"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500 mb-1">Stock Actuel</p>
                        <p className="font-medium">
                          {material.current_stock} <span className="text-xs text-gray-500 font-normal">{material.unit}</span>
                        </p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500 mb-1">Stock Restant</p>
                        <p className={`font-medium ${status === "danger" ? "text-red-700" :
                            status === "warning" ? "text-yellow-700" :
                              "text-gray-900"
                          }`}>
                          {remaining} <span className="text-xs text-gray-500 font-normal">{material.unit}</span>
                        </p>
                      </div>
                      <div className="col-span-2 mt-1">
                        <label className="text-xs text-gray-500 block mb-1">Consommation</label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            max={material.current_stock}
                            value={consumption[material.id] || 0}
                            onChange={(e) => handleConsumptionChange(material.id, e.target.value)}
                            className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-300 focus:border-blue-500 focus:outline-none transition-all duration-200"
                          />
                          <span className="ml-2 text-xs text-gray-500">{material.unit}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={handleReset}
                disabled={submitting}
                className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition duration-200"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Réinitialiser
              </button>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm ${submitting ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700"
                  } transition duration-200`}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center transition-all duration-300 ease-in-out">
            <Calendar className="mx-auto text-blue-400 h-16 w-16 mb-4" />
            <h2 className="text-xl font-medium text-gray-700 mb-2">Sélectionnez une date</h2>
            <p className="text-gray-500 mb-6">Veuillez sélectionner une date pour afficher la liste des matériaux</p>
            <div className="inline-block animate-bounce">
              <ChevronUp className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations is now managed with styled-components */}
    </div>
  );
}