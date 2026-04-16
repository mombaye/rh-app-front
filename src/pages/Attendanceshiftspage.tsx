import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/useAuth";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Check, Settings, CheckCircle, Lock, CalendarDays,
  TrendingUp, Pencil, Plus, Trash2, Upload, CalendarRange, ArrowLeftRight, ArrowRight,
  Table2, Filter,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getShiftDailyStats, getShiftPeriodStats, getEmployeePeriodDetail, getWeeklyStats, getMonthlyStats,
  getShiftSchedule, saveShiftSchedule, uploadShiftPlanning,
  getShiftPlanning, deleteSinglePlanningEntry, addSinglePlanningEntry,
  updateAttendanceRecord, sendAttendanceAlert,
} from "@/services/attendanceService";
import type { PlanningEntry } from "@/services/attendanceService";
import { parseNOCPlanningExcel, cellToDateStr, extractMonthYearFromSheetName } from "@/utils/planningParser";
import type { ParsedSheet } from "@/utils/planningParser";
import { getEmployees } from "@/services/employeeService";
import type {
  ShiftDailyStatsResponse, ShiftPeriodStatsResponse, ShiftTeamKey, ShiftRecord,
  EmployeePeriodDetailResponse, DayDetail,
  WeeklyStatsResponse, MonthlyStatsResponse, WeeklyDayEntry,
} from "@/types/attendance";
import type { Employee } from "@/types/employee";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";

TRUNCATE