
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";

interface ControleReceptionData {
  lotNumber: string;
  controleNotes: string;
  controleStatus: string;
  controleDate: string;
}

const ControleReception: React.FC = () => {
  const { lotNumber } = useParams<{ lotNumber: string }>();
  const [controleData, setControleData] = useState<ControleReceptionData | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lotNumber) return;
    const fetchData = async () => {
      const docRef = doc(db, "reception-entries", lotNumber);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setControleData({
          lotNumber,
          controleNotes: data.controleNotes || "",
          controleStatus: data.controleStatus || "",
          controleDate: data.controleDate || "",
        });
        setNotes(data.controleNotes || "");
        setStatus(data.controleStatus || "");
      }
    };
    fetchData();
  }, [lotNumber]);

  const handleSave = async () => {
    if (!lotNumber) return;
    setSaving(true);
    try {
      const docRef = doc(db, "reception-entries", lotNumber);
      await updateDoc(docRef, {
        controleNotes: notes,
        controleStatus: status,
        controleDate: new Date().toISOString(),
      });
      alert("Contrôle enregistré avec succès !");
    } catch (e) {
      alert("Erreur lors de l'enregistrement du contrôle.");
    } finally {
      setSaving(false);
    }
  };

  if (!controleData) {
    return <div className="p-8">Chargement...</div>;
  }

  return (
    <div className="p-8 max-w-xl mx-auto bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-6">Contrôle de Réception - Lot {controleData.lotNumber}</h1>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Statut du Contrôle</label>
        <Input
          value={status}
          onChange={e => setStatus(e.target.value)}
          placeholder="Statut (Conforme, Non Conforme, ... )"
        />
      </div>
      <div className="mb-4">
        <label className="block font-semibold mb-1">Notes de Contrôle</label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes, remarques, etc."
        />
      </div>
      <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
        {saving ? "Enregistrement..." : "Enregistrer le Contrôle"}
      </Button>
    </div>
  );
};

export default ControleReception;