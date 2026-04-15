import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Calendar, CheckCircle2, Clock, XCircle,
  AlertCircle, Pencil, FileDown, ChevronDown, ChevronUp,
  Loader2, ChevronLeft, ChevronRight, TrendingUp, Filter,
  X, CalendarDays, User, Hash, MessageSquare, ShieldCheck,
  ThumbsUp, Upload, FileCheck, Paperclip, ExternalLink,
  AlertTriangle, UserX, Trash2, Eye, ArrowDown, Building2, RefreshCw,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";