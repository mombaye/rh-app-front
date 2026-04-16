import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/useAuth";