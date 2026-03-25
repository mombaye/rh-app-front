import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Calendar, CheckCircle2, Clock, XCircle,
  AlertCircle, Pencil, FileDown, ChevronDown, ChevronUp,
  Loader2, ChevronLeft, ChevronRight, TrendingUp, Filter,
  X, CalendarDays, User, Hash, MessageSquare, ShieldCheck,
  ThumbsUp, Upload, FileCheck, Paperclip, ExternalLink,
  AlertTriangle, UserX, Trash2, Eye, ArrowDown, Building2, GitBranch,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 8;
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveBalanceService, leaveRequestService, leaveTypeService } from "@/services/leaveService";
import { employeeHierarchyService, MyHierarchyChain } from "@/services/hierarchyService";
import { LeaveBalance, LeaveRequest, LeaveRequestCreate, LeaveType } from "@/types/leave";
import toast from "react-hot-toast";
import HierarchyModal from "@/components/leaves/HierarchyModal";
