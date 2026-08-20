import { useState } from "react";
import type { LowStockAlertResult } from "@/utils/stockAlerts";

export function useLowStockConfirm() {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [alertReport, setAlertReport] = useState<LowStockAlertResult | null>(null);

  function openConfirmModal(report: LowStockAlertResult) {
    setAlertReport(report);
    setShowConfirmModal(true);
  }

  function closeConfirmModal() {
    setShowConfirmModal(false);
    setAlertReport(null);
  }

  return {
    showConfirmModal,
    setShowConfirmModal,
    alertReport,
    openConfirmModal,
    closeConfirmModal,
  };
}
