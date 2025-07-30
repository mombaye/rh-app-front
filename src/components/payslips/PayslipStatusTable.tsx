import React from "react";
import { FaCheckCircle, FaTimesCircle, FaClock } from "react-icons/fa";

export interface PayslipStatus {
  matricule: string;
  email: string;
  status: "sent" | "failed" | "pending";
  sent_at?: string;
}

interface Props {
  data: PayslipStatus[];
}

export default function PayslipStatusTable({ data }: Props) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <FaCheckCircle className="text-green-600" />;
      case "failed":
        return <FaTimesCircle className="text-red-600" />;
      case "pending":
      default:
        return <FaClock className="text-yellow-500" />;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white rounded-lg shadow-md">
        <thead className="bg-camublue-900 text-white">
          <tr>
            <th className="px-4 py-2 text-left">Matricule</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Statut</th>
            <th className="px-4 py-2 text-left">Date d'envoi</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.matricule + item.email}
              className="border-b hover:bg-gray-50"
            >
              <td className="px-4 py-2 font-medium">{item.matricule}</td>
              <td className="px-4 py-2">{item.email}</td>
              <td className="px-4 py-2 flex items-center gap-2">
                {getStatusIcon(item.status)} {item.status === "sent" ? "Envoyé" : item.status === "failed" ? "Échec" : "En attente"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {item.sent_at || "-"}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-500">
                Aucun bulletin trouvé pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
