import { sendBulletinToUser } from "@/services/employeeService";
import { Employee } from "@/types/employee";
import dayjs from "dayjs";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { FaCheckCircle, FaTimesCircle, FaClock } from "react-icons/fa";
import { FiSend } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { BulletinResendModal } from "./BulletinResendModal";



export interface PayslipStatus {
  employee_id: number;
  matricule: string;
  email: string;
  status: "sent" | "failed" | "pending";
  sent_at?: string;
}


interface Props {
  data: PayslipStatus[];
}

export default function PayslipStatusTable({ data }: Props) {
  const [bulletinLoading, setBulletinLoading] = useState<number | null>(null);
  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmpId, setResendEmpId] = useState<number | 0>(0);
  const [resendEmpName, setResendEmpName] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [search, setSearch] = useState("");

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
 

  const filteredData = data.filter((item) => {
  const term = search.toLowerCase().trim();
  return (
    (item.email || "").toLowerCase().includes(term) ||
    (item.matricule || "").toLowerCase().includes(term)
  );
});


  

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 mb-3 ml-4 mt-6">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par email…"
        className="border rounded-lg px-3 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-camublue-900"
      />
    </div>

      <table className="min-w-full bg-white rounded-lg shadow-md">
        <thead className="bg-camublue-900 text-white">
          <tr>
            <th className="px-4 py-2 text-left">Matricule</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Statut</th>
            <th className="px-4 py-2 text-left">Date d'envoi</th>
            <th className="px-4 py-2 text-right">Action</th>

          </tr>
        </thead>
        <tbody> 
          {filteredData.map((item) => (
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
              <td className="px-4 py-2 text-right">
                <td className="px-4 py-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 bg-camublue-900 hover:bg-camublue-800 text-white px-3 py-1 rounded-lg"
                    title="Renvoyer des bulletins"
                    onClick={() => {
                      setResendOpen(true);
                      setResendEmpId(item.employee_id);
                      setResendEmpName(item.matricule);
                      setResendEmail(item.email)
                    }}
                  >
                    <FiSend className="text-lg" /> <span className="text-xs">Renvoyer</span>
                  </button>
                </td>
              </td>
            </tr>
          ))}
          {filteredData.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
                Aucun bulletin trouvé pour le moment.
              </td>
            </tr>
          )}
        </tbody>

      </table>

      {resendOpen && (
        <BulletinResendModal
          open={resendOpen}
          onClose={() => setResendOpen(false)}
          employeeId={resendEmpId}
          matricule={resendEmpName}
          email={resendEmail}
        />
      )}
    </div>
  );
}
