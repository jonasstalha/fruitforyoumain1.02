
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "../../components/ui/table";
import { Button } from "../../components/ui/button";

interface ReceptionEntry {
  lotNumber: string;
  receptionDateTime: string;
  farm: string;
  variety: string;
  quantity: string;
  status?: string;
}

const SuiviReception: React.FC = () => {
  const [receptions, setReceptions] = useState<ReceptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reception-entries"), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as ReceptionEntry);
      setReceptions(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-gray-800 mb-6">Suivi des Réceptions</h1>
      <Table className="bg-white rounded-lg shadow">
        <TableHeader>
          <TableRow>
            <TableHead>Lot</TableHead>
            <TableHead>Date Réception</TableHead>
            <TableHead>Ferme</TableHead>
            <TableHead>Variété</TableHead>
            <TableHead>Quantité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Contrôle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7}>Chargement...</TableCell></TableRow>
          ) : receptions.length === 0 ? (
            <TableRow><TableCell colSpan={7}>Aucune réception trouvée.</TableCell></TableRow>
          ) : (
            receptions.map((entry) => (
              <TableRow key={entry.lotNumber}>
                <TableCell>{entry.lotNumber}</TableCell>
                <TableCell>{entry.receptionDateTime ? new Date(entry.receptionDateTime).toLocaleString() : ""}</TableCell>
                <TableCell>{entry.farm}</TableCell>
                <TableCell>{entry.variety}</TableCell>
                <TableCell>{entry.quantity}</TableCell>
                <TableCell>{entry.status || "-"}</TableCell>
                <TableCell>
                  <Button onClick={() => navigate(`/recaption/controle/${entry.lotNumber}`)} className="bg-blue-600 text-white hover:bg-blue-700">Contrôle</Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default SuiviReception;