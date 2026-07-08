/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AppState, CustomExpense, BankAccount, HistoryLog } from "../types";
import { ECATS } from "../constants";
import { fmtRp, fmtK, totalExp, getCycleExpenses, toLocalDateStr, getCurrentCycleRange, getExpensesForRange } from "../utils";
import Modal from "./Modal";
import { getTranslation } from "../translations";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";

interface ExpenseTabProps {
  state: AppState;
  onChange: (updates: Partial<AppState>) => void;
  showToast: (msg: string) => void;
}

export default function ExpenseTab({ state, onChange, showToast }: ExpenseTabProps) {
  const [editEId, setEditEId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  
  // Custom expense creation state
  const [customName, setCustomName] = useState("");
  const [customAmt, setCustomAmt] = useState("");

  // Edit custom category state
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [editCustomName, setEditCustomName] = useState("");
  const [editCustomAmt, setEditCustomAmt] = useState("");

  // Unlock Savings state
  const [isTabunganModalOpen, setIsTabunganModalOpen] = useState(false);
  const [tabConfirmInput, setTabConfirmInput] = useState("");
  const [isTabUnfinished, setIsTabUnfinished] = useState(true);
  const [tabVal, setTabVal] = useState("");

  const [simCategory, setSimCategory] = useState<string>("");
  const [simReduction, setSimReduction] = useState<string>("");
  const [simResults, setSimResults] = useState<any[]>([]);
  const [hasSimulated, setHasSimulated] = useState(false);

  const isEn = state.lang === "en";
  const t = getTranslation(state.lang);
  const confirmKeyword = isEn ? "AGREE" : "SETUJU";

  // --- MULTI-BANK SEPARATION STATES ---
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankBalance, setBankBalance] = useState("");
  const [bankIcon, setBankIcon] = useState("🏦");
  const [bankNotes, setBankNotes] = useState("");

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSource, setTransferSource] = useState("");
  const [transferDest, setTransferDest] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [confirmDeleteBankId, setConfirmDeleteBankId] = useState<string | null>(null);

  // --- LOG NEW TRANSACTION FORM STATES ---
  const [logCatId, setLogCatId] = useState("");
  const [logAmt, setLogAmt] = useState("");
  const [logBankId, setLogBankId] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logDate, setLogDate] = useState("");

  // --- LEDGER FILTERS ---
  const [ledgerCycleFilter, setLedgerCycleFilter] = useState<"all" | "current">("current");
  const [ledgerCatFilter, setLedgerCatFilter] = useState("all");
  const [ledgerBankFilter, setLedgerBankFilter] = useState("all");

  const banks: BankAccount[] = state.banks || [
    { id: "b_1", name: "Bank BCA (Utama)", balance: 1500000, icon: "🏦", notes: "Rekening transaksi harian utama", isCurrentTarget: true },
    { id: "b_2", name: "Bank Mandiri (Cadangan)", balance: 500000, icon: "💳", notes: "Rekening cadangan anti-boros", isCurrentTarget: false }
  ];

  useEffect(() => {
    if (!state.banks) {
      onChange({
        banks: [
          { id: "b_1", name: "Bank BCA (Utama)", balance: 1500000, icon: "🏦", notes: "Rekening transaksi harian utama", isCurrentTarget: true },
          { id: "b_2", name: "Bank Mandiri (Cadangan)", balance: 500000, icon: "💳", notes: "Rekening cadangan anti-boros", isCurrentTarget: false }
        ]
      });
    }
  }, [state.banks, onChange]);

  useEffect(() => {
    if (banks.length > 0) {
      const activeBank = banks.find(b => b.isCurrentTarget) || banks[0];
      if (activeBank && !logBankId) {
        setLogBankId(activeBank.id);
      }
    }
  }, [banks, logBankId]);

  useEffect(() => {
    const todayStr = state.customActiveDateEnabled && state.customActiveDate 
      ? state.customActiveDate 
      : toLocalDateStr(new Date());
    setLogDate(todayStr);
  }, [state.customActiveDate, state.customActiveDateEnabled]);

  // --- MULTI-BANK ACTIONS ---
  const handleSetTargetBank = (id: string) => {
    const updatedBanks = banks.map((b) => ({
      ...b,
      isCurrentTarget: b.id === id,
    }));
    onChange({ banks: updatedBanks });
    const targetBank = banks.find((b) => b.id === id);
    showToast(isEn ? `🎯 Active target bank changed to: ${targetBank?.name}` : `🎯 Bank target aktif diubah ke: ${targetBank?.name}`);
  };

  const handleSaveBank = () => {
    const trimmedName = bankName.trim();
    if (!trimmedName) {
      showToast(isEn ? "❌ Fill in the bank name!" : "❌ Isi nama bank!");
      return;
    }
    const parsedBal = parseInt(bankBalance) || 0;
    
    if (editingBankId) {
      const updatedBanks = banks.map((b) =>
        b.id === editingBankId
          ? { ...b, name: trimmedName, balance: parsedBal, icon: bankIcon, notes: bankNotes }
          : b
      );
      onChange({ banks: updatedBanks });
      showToast(isEn ? "✅ Bank successfully updated!" : "✅ Data bank berhasil diperbarui!");
    } else {
      const newBank: BankAccount = {
        id: `b_${Date.now()}`,
        name: trimmedName,
        balance: parsedBal,
        icon: bankIcon,
        notes: bankNotes,
        isCurrentTarget: banks.length === 0,
      };
      onChange({ banks: [...banks, newBank] });
      showToast(isEn ? `✅ "${trimmedName}" added successfully!` : `✅ "${trimmedName}" berhasil ditambahkan!`);
    }
    setIsBankModalOpen(false);
    setEditingBankId(null);
    setBankName("");
    setBankBalance("");
    setBankIcon("🏦");
    setBankNotes("");
  };

  const handleDeleteBank = (id: string) => {
    if (banks.length <= 1) {
      showToast(isEn ? "❌ You must keep at least one bank account!" : "❌ Minimal harus ada satu rekening bank!");
      return;
    }
    const bankToDelete = banks.find((b) => b.id === id);
    const updatedBanks = banks.filter((b) => b.id !== id);
    if (bankToDelete?.isCurrentTarget && updatedBanks.length > 0) {
      updatedBanks[0].isCurrentTarget = true;
    }
    onChange({ banks: updatedBanks });
    showToast(isEn ? "🗑️ Bank successfully deleted!" : "🗑️ Rekening bank berhasil dihapus!");
  };

  const handleTransferFunds = () => {
    if (!transferSource || !transferDest) {
      showToast(isEn ? "❌ Select both source and destination banks!" : "❌ Pilih bank asal dan bank tujuan!");
      return;
    }
    if (transferSource === transferDest) {
      showToast(isEn ? "❌ Source and destination cannot be the same!" : "❌ Bank asal dan tujuan tidak boleh sama!");
      return;
    }
    const parsedAmt = parseInt(transferAmount) || 0;
    if (parsedAmt <= 0) {
      showToast(isEn ? "❌ Amount must be greater than zero!" : "❌ Jumlah transfer harus lebih dari nol!");
      return;
    }
    
    const sourceBank = banks.find((b) => b.id === transferSource);
    if (!sourceBank || sourceBank.balance < parsedAmt) {
      showToast(isEn ? `❌ Insufficient balance in ${sourceBank?.name || 'source bank'}!` : `❌ Saldo di ${sourceBank?.name || 'bank asal'} tidak mencukupi!`);
      return;
    }
    
    const updatedBanks = banks.map((b) => {
      if (b.id === transferSource) {
        return { ...b, balance: b.balance - parsedAmt };
      }
      if (b.id === transferDest) {
        return { ...b, balance: b.balance + parsedAmt };
      }
      return b;
    });
    
    onChange({ banks: updatedBanks });
    setIsTransferModalOpen(false);
    setTransferAmount("");
    showToast(isEn 
      ? `✅ Transferred ${fmtRp(parsedAmt)} from ${sourceBank.name} successfully!` 
      : `✅ Berhasil mentransfer ${fmtRp(parsedAmt)} dari ${sourceBank.name}!`);
  };

  const handleRebalanceBanks = () => {
    if (banks.length === 0) return;
    const perBank = Math.floor(state.budget / banks.length);
    const remainder = state.budget - (perBank * (banks.length - 1));
    
    const updatedBanks = banks.map((b, idx) => ({
      ...b,
      balance: idx === 0 ? remainder : perBank
    }));
    onChange({ banks: updatedBanks });
    showToast(isEn ? "✅ Balances redistributed evenly matching budget!" : "✅ Saldo telah didistribusikan merata sesuai anggaran!");
  };

  const tot = state.cycleStartDay && state.cycleStartDay !== 1 ? getCycleExpenses(state).total : totalExp(state);
  const activeExpensesMap = state.cycleStartDay && state.cycleStartDay !== 1 ? getCycleExpenses(state).byCategory : (state.expenses || {});
  
  const totalBankBalances = state.banks && state.banks.length > 0
    ? state.banks.reduce((acc, b) => acc + (b.balance || 0), 0)
    : 0;

  const tabunganAmt = activeExpensesMap.tabungan || 0;
  const daruratAmt = activeExpensesMap.darurat || 0;
  const aktual = tot - tabunganAmt - daruratAmt;

  const sisa = totalBankBalances > 0
    ? totalBankBalances
    : state.budget - aktual;

  const pct = state.budget > 0 ? Math.min(100, Math.round((tot / state.budget) * 100)) : 0;
  const pbC = pct > 90 ? "#E74C3C" : pct > 70 ? "#E67E22" : "#2ECC71";

  // Label translator for standard categories
  const getCategoryLabel = (cat: any) => {
    if (!isEn) return cat.label;
    const labelMap: Record<string, string> = {
      "makan": "Daily Food / Meals",
      "rokok": "Cigarettes / Smoking",
      "hiburan": "Entertainment / Vacation",
      "jajanan": "Snacks & Treats",
      "bensin": "Motorcycle Fuel / Gas",
      "outfit": "Clothing & Furniture",
      "kampus": "Campus & Organization",
      "laundry": "Laundry Services",
      "darurat": "Emergency Fund",
      "tabungan": "Locked Savings 🔒"
    };
    return labelMap[cat.id] || cat.label;
  };

  // Combine standard + custom categories with dynamic labels
  const allCategories = [
    ...ECATS.map(c => ({ ...c, label: getCategoryLabel(c) })),
    ...(state.customExp || []).map((e) => ({
      id: e.id,
      icon: e.icon || "📦",
      label: e.name,
      color: "#888",
      custom: true,
      locked: false,
    })),
  ];

  const handleSaveBudget = (v: number) => {
    onChange({ budget: v });
  };

  const handleAddCustomExpense = () => {
    const trimmed = customName.trim();
    const parsedAmt = parseInt(customAmt) || 0;
    if (!trimmed) {
      showToast(isEn ? "❌ Fill in the expense name!" : "❌ Isi nama pengeluaran!");
      return;
    }
    const newCustom: CustomExpense = {
      id: `c_${Date.now()}`,
      name: trimmed,
      amt: parsedAmt,
      icon: "📦",
    };
    const updatedCustoms = [...(state.customExp || []), newCustom];
    
    // Deduct parsedAmt from active target bank balance
    const updatedBanks = banks.map((b) => {
      if (b.isCurrentTarget || (!banks.some(bk => bk.isCurrentTarget) && b.id === banks[0]?.id)) {
        return { ...b, balance: Math.max(0, b.balance - parsedAmt) };
      }
      return b;
    });

    onChange({ customExp: updatedCustoms, banks: updatedBanks });
    setCustomName("");
    setCustomAmt("");
    showToast(isEn ? `✅ "${trimmed}" added successfully!` : `✅ "${trimmed}" berhasil ditambahkan!`);
  };

  const handleDeleteCustomExpense = (id: string) => {
    const deletedItem = (state.customExp || []).find((e) => e.id === id);
    const deletedAmt = deletedItem ? deletedItem.amt : 0;
    
    const updatedCustoms = (state.customExp || []).filter((e) => e.id !== id);
    // Also cleanup if it was stored under expenses map directly
    const updatedExpenses = { ...state.expenses };
    delete updatedExpenses[id];

    // Refund deletedAmt to active target bank balance
    const updatedBanks = banks.map((b) => {
      if (b.isCurrentTarget || (!banks.some(bk => bk.isCurrentTarget) && b.id === banks[0]?.id)) {
        return { ...b, balance: b.balance + deletedAmt };
      }
      return b;
    });

    onChange({ customExp: updatedCustoms, expenses: updatedExpenses, banks: updatedBanks });
    showToast(isEn ? "🗑️ Category deleted successfully" : "🗑️ Kategori berhasil dihapus");
  };

  const handleEditCustom = (id: string, name: string, amt: number) => {
    setSelectedCustomId(id);
    setEditCustomName(name);
    setEditCustomAmt(String(amt));
  };

  const handleSaveCustomEdit = () => {
    if (!selectedCustomId) return;
    const trimmed = editCustomName.trim();
    if (!trimmed) {
      showToast(isEn ? "❌ Name cannot be empty!" : "❌ Nama tidak boleh kosong!");
      return;
    }
    const parsedAmt = parseInt(editCustomAmt) || 0;
    const oldItem = (state.customExp || []).find((e) => e.id === selectedCustomId);
    const oldAmt = oldItem ? oldItem.amt : 0;
    const diff = parsedAmt - oldAmt;

    const updatedCustoms = (state.customExp || []).map((e) =>
      e.id === selectedCustomId ? { ...e, name: trimmed, amt: parsedAmt } : e
    );

    // Deduct difference from active target bank balance
    const updatedBanks = banks.map((b) => {
      if (b.isCurrentTarget || (!banks.some(bk => bk.isCurrentTarget) && b.id === banks[0]?.id)) {
        return { ...b, balance: Math.max(0, b.balance - diff) };
      }
      return b;
    });

    onChange({ customExp: updatedCustoms, banks: updatedBanks });
    setSelectedCustomId(null);
    showToast(isEn ? `✅ "${trimmed}" updated successfully!` : `✅ "${trimmed}" berhasil diperbarui!`);
  };

  const handleSaveTabungan = () => {
    const parsedVal = parseInt(tabVal) || 0;
    const oldVal = state.expenses?.tabungan || 0;
    const diff = parsedVal - oldVal;

    const updatedExpenses = { ...state.expenses, tabungan: parsedVal };

    // Deduct difference from active target bank balance
    const updatedBanks = banks.map((b) => {
      if (b.isCurrentTarget || (!banks.some(bk => bk.isCurrentTarget) && b.id === banks[0]?.id)) {
        return { ...b, balance: Math.max(0, b.balance - diff) };
      }
      return b;
    });

    onChange({ expenses: updatedExpenses, banks: updatedBanks });
    setIsTabunganModalOpen(false);
    setTabConfirmInput("");
    setIsTabUnfinished(true);
    setTabVal("");
    showToast(isEn ? `✅ Savings updated: ${fmtRp(parsedVal)} 🔒` : `✅ Tabungan diperbarui: ${fmtRp(parsedVal)} 🔒`);
  };

  const handleSimulate = () => {
    const reduction = parseInt(simReduction) || 0;
    if (reduction <= 0 || !simCategory) {
      showToast(isEn ? "⚠️ Pilih kategori dan masukkan jumlah penghematan!" : "⚠️ Pilih kategori dan masukkan jumlah penghematan!");
      return;
    }
    const affectedGoals = (state.goals || [])
      .filter(g => !g.completed && g.speed && g.speed > 0)
      .map(g => {
        const remaining = g.target - g.progress;
        const currentWeeksNeeded = remaining / (g.speed || 1);
        const newWeeklySpeed = (g.speed || 0) + (reduction / 4.33); 
        const newWeeksNeeded = remaining / newWeeklySpeed;
        const weeksSaved = currentWeeksNeeded - newWeeksNeeded;
        return {
          name: g.name,
          currentWeeks: Math.ceil(currentWeeksNeeded),
          newWeeks: Math.ceil(newWeeksNeeded),
          weeksSaved: Math.round(weeksSaved)
        };
      });
    setSimResults(affectedGoals);
    setHasSimulated(true);
  };

  const handleCommitExpenseChange = (id: string) => {
    const parsedVal = parseInt(editVal.replace(/\D/g, "")) || 0;
    
    // Check if custom or standard
    const isCustom = (state.customExp || []).some((e) => e.id === id);
    let oldVal = 0;
    if (isCustom) {
      oldVal = (state.customExp || []).find((e) => e.id === id)?.amt || 0;
    } else {
      oldVal = state.expenses?.[id] || 0;
    }
    const diff = parsedVal - oldVal;

    // Deduct difference from active target bank balance
    const updatedBanks = banks.map((b) => {
      if (b.isCurrentTarget || (!banks.some(bk => bk.isCurrentTarget) && b.id === banks[0]?.id)) {
        return { ...b, balance: Math.max(0, b.balance - diff) };
      }
      return b;
    });

    const activeBank = banks.find(b => b.isCurrentTarget) || banks[0];

    // Create a new activity log for this change so it's tracked in cycle ranges!
    let timestampStr = new Date().toISOString();
    if (state.customActiveDateEnabled && state.customActiveDate) {
      const timeOfToday = new Date();
      const [y, m, d] = state.customActiveDate.split("-").map(Number);
      const customDateObj = new Date(y, m - 1, d, timeOfToday.getHours(), timeOfToday.getMinutes(), timeOfToday.getSeconds());
      timestampStr = customDateObj.toISOString();
    }

    // Determine category label
    const catObj = allCategories.find(c => c.id === id);
    const catLabel = catObj ? catObj.label : id;

    const newLog: HistoryLog = {
      id: `log_ex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timestampStr,
      type: "expense",
      action: `Penyesuaian Kategori ${catLabel.toUpperCase()}`,
      details: diff >= 0 
        ? `Menambah alokasi sebesar ${fmtRp(diff)} via ${activeBank?.name}` 
        : `Mengurangi alokasi sebesar ${fmtRp(Math.abs(diff))} via ${activeBank?.name}`,
      value: diff,
      bankId: activeBank?.id,
      category: id,
      note: diff >= 0 ? "Penyesuaian Manual (+)" : "Penyesuaian Manual (-)"
    };

    const updatedLogs = [...(state.activityLogs || []), newLog];

    if (isCustom) {
      const updatedCustoms = (state.customExp || []).map((e) =>
        e.id === id ? { ...e, amt: parsedVal } : e
      );
      onChange({ customExp: updatedCustoms, banks: updatedBanks, activityLogs: updatedLogs });
    } else {
      const updatedExpenses = { ...state.expenses, [id]: parsedVal };
      onChange({ expenses: updatedExpenses, banks: updatedBanks, activityLogs: updatedLogs });
    }
    setEditEId(null);
    setEditVal("");
    showToast(isEn ? `✅ Expense of ${fmtRp(parsedVal)} saved` : `✅ Pengeluaran ${fmtRp(parsedVal)} disimpan`);
  };

  const handleLogNewExpense = () => {
    const parsedAmt = parseInt(logAmt.replace(/\D/g, "")) || 0;
    if (parsedAmt <= 0) {
      showToast(isEn ? "❌ Amount must be greater than zero!" : "❌ Jumlah pengeluaran harus lebih dari nol!");
      return;
    }
    if (!logCatId) {
      showToast(isEn ? "❌ Select an expense category!" : "❌ Pilih kategori pengeluaran!");
      return;
    }
    if (!logBankId) {
      showToast(isEn ? "❌ Select a payment bank account!" : "❌ Pilih rekening pembayaran!");
      return;
    }

    const selectedBank = banks.find(b => b.id === logBankId);
    if (!selectedBank) return;

    if (selectedBank.balance < parsedAmt) {
      if (!confirm(isEn 
        ? `⚠️ Warning: Balance of ${selectedBank.name} is insufficient! Continue?` 
        : `⚠️ Peringatan: Saldo di ${selectedBank.name} tidak mencukupi! Tetap lanjutkan?`
      )) {
        return;
      }
    }

    // Get category details
    const catObj = allCategories.find(c => c.id === logCatId);
    const catLabel = catObj ? catObj.label : logCatId;

    // 1. Deduct from selected bank
    const updatedBanks = banks.map((b) => {
      if (b.id === logBankId) {
        return { ...b, balance: Math.max(0, b.balance - parsedAmt) };
      }
      return b;
    });

    // 2. Increase category total in state
    let updatedExpenses = { ...state.expenses };
    let updatedCustoms = [...(state.customExp || [])];

    const isCustom = updatedCustoms.some(ce => ce.id === logCatId);

    if (isCustom) {
      updatedCustoms = updatedCustoms.map(ce => 
        ce.id === logCatId ? { ...ce, amt: ce.amt + parsedAmt } : ce
      );
    } else {
      updatedExpenses[logCatId] = (updatedExpenses[logCatId] || 0) + parsedAmt;
    }

    // 3. Create a clean HistoryLog
    const timeOfToday = new Date();
    const [y, m, d] = logDate.split("-").map(Number);
    const customDateObj = new Date(y, m - 1, d, timeOfToday.getHours(), timeOfToday.getMinutes(), timeOfToday.getSeconds());
    const timestampStr = customDateObj.toISOString();

    const newLog: HistoryLog = {
      id: `log_ex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timestampStr,
      type: "expense",
      action: `Pengeluaran Baru: Kategori ${catLabel.toUpperCase()}`,
      details: `${logNote.trim() ? logNote.trim() + " " : ""}via ${selectedBank.name}`,
      value: parsedAmt,
      bankId: logBankId,
      category: logCatId,
      note: logNote.trim()
    };

    const updatedLogs = [...(state.activityLogs || []), newLog];

    onChange({
      banks: updatedBanks,
      expenses: updatedExpenses,
      customExp: updatedCustoms,
      activityLogs: updatedLogs
    });

    setLogAmt("");
    setLogNote("");
    showToast(isEn 
      ? `✅ Logged ${fmtRp(parsedAmt)} under ${catLabel} successfully!` 
      : `✅ Berhasil mencatat ${fmtRp(parsedAmt)} di kategori ${catLabel}!`);
  };

  const handleDeleteTransaction = (logId: string) => {
    const logToDelete = (state.activityLogs || []).find(log => log.id === logId);
    if (!logToDelete) return;

    if (!confirm(isEn 
      ? `Are you sure you want to delete this transaction of ${fmtRp(logToDelete.value || 0)}? This will refund the amount back to your bank account.` 
      : `Apakah Anda yakin ingin menghapus transaksi sebesar ${fmtRp(logToDelete.value || 0)} ini? Tindakan ini akan mengembalikan saldo ke rekening bank terkait.`
    )) {
      return;
    }

    const value = logToDelete.value || 0;
    const catId = logToDelete.category;
    const bankId = logToDelete.bankId;

    // 1. Refund to bank
    const updatedBanks = banks.map((b) => {
      // If we have a tracked bankId, refund specifically to that bank.
      // If not, fall back to parsing from the "via <Bank Name>" string in log.details!
      let shouldRefund = b.id === bankId;
      if (!bankId && logToDelete.details) {
        shouldRefund = logToDelete.details.toLowerCase().includes(b.name.toLowerCase());
      }
      if (shouldRefund) {
        return { ...b, balance: b.balance + value };
      }
      return b;
    });

    // 2. Subtract from category total in state
    let updatedExpenses = { ...state.expenses };
    let updatedCustoms = [...(state.customExp || [])];

    if (catId) {
      const isCustom = updatedCustoms.some(ce => ce.id === catId);
      if (isCustom) {
        updatedCustoms = updatedCustoms.map(ce => 
          ce.id === catId ? { ...ce, amt: Math.max(0, ce.amt - value) } : ce
        );
      } else {
        updatedExpenses[catId] = Math.max(0, (updatedExpenses[catId] || 0) - value);
      }
    } else {
      // Fallback: parse category from actionLower
      const actionLower = logToDelete.action.toLowerCase();
      const matchedCat = ["makan", "rokok", "hiburan", "jajanan", "bensin", "outfit", "kampus", "laundry", "darurat", "tabungan"].find(
        c => actionLower.includes(c)
      );
      if (matchedCat) {
        updatedExpenses[matchedCat] = Math.max(0, (updatedExpenses[matchedCat] || 0) - value);
      } else {
        const matchedCustom = updatedCustoms.find(ce => actionLower.includes(ce.name.toLowerCase()));
        if (matchedCustom) {
          updatedCustoms = updatedCustoms.map(ce => 
            ce.id === matchedCustom.id ? { ...ce, amt: Math.max(0, ce.amt - value) } : ce
          );
        }
      }
    }

    // 3. Remove from activityLogs
    const updatedLogs = (state.activityLogs || []).filter(log => log.id !== logId);

    onChange({
      banks: updatedBanks,
      expenses: updatedExpenses,
      customExp: updatedCustoms,
      activityLogs: updatedLogs
    });

    showToast(isEn ? "🗑️ Transaction deleted and balance refunded!" : "🗑️ Transaksi dihapus dan saldo dikembalikan!");
  };

  // Recharts data for chart below
  const chartData = ECATS.filter((c) => c.id !== "tabungan" && (activeExpensesMap?.[c.id] || 0) > 0).map((c) => ({
    name: getCategoryLabel(c).split(" ")[0],
    jumlah: activeExpensesMap?.[c.id] || 0,
    color: c.color,
  }));

  const todayStr = state.customActiveDateEnabled && state.customActiveDate 
    ? state.customActiveDate 
    : toLocalDateStr(new Date());
  const cycleStart = state.cycleStartDay || 1;
  const cycleRange = getCurrentCycleRange(todayStr, cycleStart);

  const formatCycleDate = (d: Date) => {
    return d.toLocaleDateString(state.lang === "en" ? "en-US" : "id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="space-y-6 animate-fade-in text-zinc-700 pb-4">
      {/* ACTIVE CYCLE INFO BANNER */}
      <div className="bg-white border border-zinc-200/60 shadow-[0_4px_25px_rgb(0,0,0,0.01)] rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex gap-3.5 items-start">
          <span className="text-3xl select-none">📅</span>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              {isEn ? "Active Cycle Range" : "Siklus Keuangan Aktif"}
            </h4>
            <p className="text-sm font-extrabold text-zinc-900 tracking-tight">
              {formatCycleDate(cycleRange.startDate)} s/d {formatCycleDate(cycleRange.endDate)}
            </p>
            <p className="text-[10px] text-zinc-400 font-medium">
              {isEn 
                ? `Only expenses logged within this period are added to "Total Expenses" (${fmtRp(tot)}).` 
                : `Hanya pengeluaran yang dicatat pada rentang tanggal ini yang masuk ke "Total Pengeluaran" (${fmtRp(tot)}).`}
            </p>
          </div>
        </div>
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl px-4 py-3 max-w-sm text-[10px] text-amber-900 font-medium leading-normal">
          💡 <span className="font-extrabold">Info:</span> {isEn 
            ? "Your bank balances are safe and persistent! They represent actual cash in your accounts and never reset when the cycle dates change." 
            : "Saldo rekening bank Anda bersifat permanen & tidak terpengaruh reset siklus! Ini menjaga uang asli Anda tetap sinkron secara nyata."}
        </div>
      </div>


      {/* Monthly Budget Input Card */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#B8860B] mb-3 flex items-center gap-1.5">
          💰 {isEn ? "Monthly Budget" : "Anggaran Bulanan"}
        </h3>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="text-lg font-black text-[#B8860B]">Rp</span>
          <input
            type="text"
            value={state.budget.toLocaleString("id-ID")}
            onChange={(e) => {
              const cleaned = parseInt(e.target.value.replace(/\D/g, "")) || 0;
              handleSaveBudget(cleaned);
            }}
            placeholder="2.000.000"
            className="bg-zinc-50 border border-zinc-200 text-zinc-800 font-mono font-extrabold text-lg rounded-2xl py-2.5 px-4 w-[200px] outline-none focus:border-[#C9A84C] focus:bg-white focus:ring-1 focus:ring-[#C9A84C] transition-all"
          />
          <button
            onClick={() => showToast(isEn ? "✅ Budget saved successfully!" : "✅ Budget berhasil disimpan!")}
            className="bg-[#C9A84C] text-[#1a1500] hover:bg-[#B8860B] hover:text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
          >
            {isEn ? "Save" : "Simpan"}
          </button>
        </div>

        <div className="flex justify-between text-xs mb-2.5">
          <span className="text-zinc-500 font-medium">{isEn ? "Used" : "Terpakai"}</span>
          <span className="font-extrabold" style={{ color: pbC }}>
            {pct}%
          </span>
        </div>
        {/* Duolingo style bold progress bar */}
        <div className="h-4 bg-zinc-100 rounded-full overflow-hidden p-[2px] border border-zinc-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
          <div
            className="h-full rounded-full transition-all duration-1000 relative overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            style={{ width: `${pct}%`, backgroundColor: pbC }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between mt-3 text-xs font-mono font-bold">
          <span className="text-zinc-400">{isEn ? "Total" : "Total"}: {fmtRp(tot)}</span>
          <span className="font-black" style={{ color: sisa >= 0 ? "#10B981" : "#EF4444" }}>
            {sisa >= 0 ? (isEn ? "Remaining: " : "Sisa: ") : "OVER: "} {fmtRp(Math.abs(sisa))}
          </span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: isEn ? "Total Expenses" : "Total Pengeluaran", v: fmtRp(tot), c: "text-[#B8860B]", bg: "bg-amber-50/40 border-amber-100" },
          { l: isEn ? "Remaining Budget" : "Sisa Anggaran", v: fmtRp(sisa), c: sisa >= 0 ? "text-emerald-600" : "text-rose-600", bg: sisa >= 0 ? "bg-emerald-50/30 border-emerald-100" : "bg-rose-50/40 border-rose-100" },
          { l: isEn ? "Savings 🔒" : "Tabungan 🔒", v: fmtRp(state.expenses?.tabungan || 0), c: "text-emerald-600", bg: "bg-emerald-50/30 border-emerald-100" },
          { l: isEn ? "Actual (Spending)" : "Aktual (Belanja)", v: fmtRp(aktual), c: "text-blue-600", bg: "bg-blue-50/30 border-blue-100" },
        ].map((k, i) => (
          <div key={i} className={`bg-white border border-zinc-200/50 rounded-2xl p-4 shadow-sm text-center ${k.bg} transition-all duration-300 hover:scale-[1.02]`}>
            <div className={`text-xs font-extrabold font-mono ${k.c}`}>
              {k.v}
            </div>
            <div className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider mt-1">{k.l}</div>
          </div>
        ))}
      </div>

      {/* 🏦 PEMISAHAN SALDO BANK & DOMPET */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-[#B8860B] flex items-center gap-1.5">
              🏦 {isEn ? "Bank & Wallet Separation" : "Pemisahan Saldo Bank & Dompet"}
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              {isEn 
                ? "Split your balance into different accounts to prevent overspending. Only the active bank is used for transactions." 
                : "Bagi saldomu ke beberapa rekening agar tidak boros. Saldo aktif digunakan otomatis untuk transaksi."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingBankId(null);
                setBankName("");
                setBankBalance("");
                setBankIcon("🏦");
                setBankNotes("");
                setIsBankModalOpen(true);
              }}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              ➕ {isEn ? "Add Account" : "Tambah Rekening"}
            </button>
            <button
              onClick={() => {
                if (banks.length < 2) {
                  showToast(isEn ? "❌ You need at least 2 banks to transfer!" : "❌ Harus ada minimal 2 rekening untuk transfer!");
                  return;
                }
                setTransferSource(banks[0]?.id || "");
                setTransferDest(banks[1]?.id || "");
                setTransferAmount("");
                setIsTransferModalOpen(true);
              }}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              🔄 {isEn ? "Transfer" : "Transfer Saldo"}
            </button>
            <button
              onClick={handleRebalanceBanks}
              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[#B8860B] font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title={isEn ? "Rebalance matching total budget" : "Sesuaikan rata pembagian dengan total anggaran"}
            >
              ⚖️ {isEn ? "Auto Split" : "Bagi Rata"}
            </button>
          </div>
        </div>

        {/* List of banks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {banks.map((bank) => {
            const isTarget = bank.isCurrentTarget;
            return (
              <div
                key={bank.id}
                onClick={() => handleSetTargetBank(bank.id)}
                className={`group relative rounded-2xl p-4 border transition-all duration-300 cursor-pointer flex items-start gap-3.5 select-none ${
                  isTarget 
                    ? "bg-amber-50/30 border-[#C9A84C]/60 shadow-[0_4px_15px_rgba(201,168,76,0.06)]" 
                    : "bg-white border-zinc-200/60 hover:border-zinc-300/80 hover:bg-zinc-50/40"
                }`}
              >
                <div className={`text-2xl p-2.5 rounded-xl flex items-center justify-center transition-colors ${
                  isTarget ? "bg-amber-100 text-amber-700" : "bg-zinc-50 text-zinc-600 group-hover:bg-zinc-100"
                }`}>
                  {bank.icon || "🏦"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-zinc-800 tracking-tight block truncate">
                      {bank.name}
                    </span>
                    {isTarget ? (
                      <span className="text-[8px] font-black uppercase tracking-widest bg-[#C9A84C] text-[#1a1500] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        🎯 {isEn ? "Target" : "Aktif"}
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded-md">
                        {isEn ? "Standby" : "Cadangan"}
                      </span>
                    )}
                  </div>
                  <span className="font-black text-sm text-zinc-900 font-mono block mt-1">
                    {fmtRp(bank.balance)}
                  </span>
                  {bank.notes && (
                    <span className="text-[9px] text-zinc-400 mt-1 block truncate font-medium">
                      {bank.notes}
                    </span>
                  )}
                </div>

                {/* Action bar (Always visible but semi-transparent, fully opaque on hover for crisp UI) */}
                <div 
                  className="absolute top-2 right-2 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1.5 transition-all duration-200 bg-white/90 dark:bg-zinc-900/90 rounded-xl p-1 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {confirmDeleteBankId === bank.id ? (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-black">
                      <span className="text-rose-600 dark:text-rose-400 mr-1 animate-pulse">
                        {isEn ? "Sure?" : "Yakin?"}
                      </span>
                      <button
                        onClick={() => {
                          handleDeleteBank(bank.id);
                          setConfirmDeleteBankId(null);
                        }}
                        className="bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-2 py-1 rounded-lg font-black text-[9px] cursor-pointer transition-all"
                      >
                        {isEn ? "Yes" : "Ya"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteBankId(null)}
                        className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-1.5 py-1 rounded-lg font-bold text-[9px] cursor-pointer transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingBankId(bank.id);
                          setBankName(bank.name);
                          setBankBalance(String(bank.balance));
                          setBankIcon(bank.icon || "🏦");
                          setBankNotes(bank.notes || "");
                          setIsBankModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-[#B8860B] hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer text-xs transition-colors"
                        title={isEn ? "Edit" : "Ubah"}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          if (banks.length <= 1) {
                            showToast(isEn ? "❌ You must keep at least one bank account!" : "❌ Minimal harus ada satu rekening bank!");
                            return;
                          }
                          setConfirmDeleteBankId(bank.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer text-xs transition-colors"
                        title={isEn ? "Delete" : "Hapus"}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Allocation status & warning checker */}
        {(() => {
          const totalAllocated = banks.reduce((sum, b) => sum + (b.balance || 0), 0);
          const diff = totalAllocated - state.budget;
          const isBalanced = diff === 0;

          return (
            <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-zinc-500 font-medium">
                  {isEn ? "Budget Limit:" : "Total Anggaran:"}{" "}
                  <strong className="text-zinc-800 font-extrabold font-mono">{fmtRp(state.budget)}</strong>
                </div>
                <div className="text-zinc-500 font-medium">
                  {isEn ? "Separated Balance:" : "Total Saldo Terbagi:"}{" "}
                  <strong className="text-zinc-800 font-extrabold font-mono">{fmtRp(totalAllocated)}</strong>
                </div>
              </div>
              <div>
                {isBalanced ? (
                  <span className="text-emerald-600 font-extrabold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl">
                    ✅ {isEn ? "Perfectly Allocated" : "Alokasi Sesuai Anggaran"}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 font-extrabold bg-rose-50 px-2.5 py-1 rounded-xl">
                      ⚠️ {isEn ? "Out of Sync by" : "Selisih Alokasi:"} {fmtRp(Math.abs(diff))}
                    </span>
                    <button
                      onClick={() => {
                        const targetIndex = banks.findIndex(b => b.isCurrentTarget);
                        const idx = targetIndex !== -1 ? targetIndex : 0;
                        const updated = [...banks];
                        updated[idx].balance = Math.max(0, updated[idx].balance - diff);
                        onChange({ banks: updated });
                        showToast(isEn ? "✅ Balanced successfully!" : "✅ Selisih saldo berhasil disesuaikan!");
                      }}
                      className="text-[10px] font-black text-[#B8860B] hover:underline cursor-pointer bg-amber-50 px-2 py-1 rounded-lg"
                    >
                      {isEn ? "Balance it" : "Sesuaikan Selisih"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 📝 FORMULIR CATAT PENGELUARAN BARU */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-24 h-24 rounded-full bg-[#C9A84C]/5 blur-lg pointer-events-none" />
        <h3 className="text-xs font-black uppercase tracking-widest text-[#B8860B] mb-4 flex items-center gap-1.5">
          📝 {isEn ? "Log New Expense" : "Catat Pengeluaran Baru"}
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {/* Jumlah Pengeluaran */}
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
              {isEn ? "Amount (Rp)" : "Jumlah Pengeluaran (Rp)"}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-black text-zinc-400">Rp</span>
              <input
                type="text"
                placeholder="e.g. 25.000"
                value={logAmt}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setLogAmt(val ? Number(val).toLocaleString("id-ID") : "");
                }}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-mono font-bold outline-none focus:border-[#C9A84C] focus:bg-white focus:ring-1 focus:ring-[#C9A84C]"
              />
            </div>
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
              {isEn ? "Category" : "Pilih Kategori"}
            </label>
            <select
              value={logCatId}
              onChange={(e) => setLogCatId(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs font-bold outline-none focus:border-[#C9A84C] focus:bg-white"
            >
              <option value="">-- {isEn ? "Select Category" : "Pilih Kategori"} --</option>
              {allCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bayar Pakai (Rekening) */}
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
              {isEn ? "Payment Account" : "Bayar Menggunakan"}
            </label>
            <select
              value={logBankId}
              onChange={(e) => setLogBankId(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs font-bold outline-none focus:border-[#C9A84C] focus:bg-white"
            >
              <option value="">-- {isEn ? "Select Bank Account" : "Pilih Rekening"} --</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.icon} {b.name} ({fmtRp(b.balance)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Tanggal Transaksi */}
          <div className="sm:col-span-1">
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
              {isEn ? "Transaction Date" : "Tanggal Transaksi"}
            </label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs font-mono font-bold outline-none focus:border-[#C9A84C] focus:bg-white"
            />
          </div>

          {/* Keterangan / Note */}
          <div className="sm:col-span-1">
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
              {isEn ? "Note / Description (Optional)" : "Catatan / Keterangan (Opsional)"}
            </label>
            <input
              type="text"
              placeholder={isEn ? "e.g. Bought Starbucks coffee" : "misal: Makan nasi goreng padang"}
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs font-bold outline-none focus:border-[#C9A84C] focus:bg-white"
            />
          </div>

          {/* Simpan Button */}
          <div className="sm:col-span-1">
            <button
              onClick={handleLogNewExpense}
              className="w-full bg-[#C9A84C] hover:bg-[#B8860B] text-[#1a1500] hover:text-white font-extrabold py-2.5 px-5 rounded-2xl text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span>💾</span>
              <span>{isEn ? "Log Expense" : "Catat & Kurangi Saldo"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-zinc-600 bg-amber-50/50 rounded-2xl p-4 leading-relaxed border border-amber-200/30">
        💡 <strong className="text-[#B8860B] font-extrabold">{isEn ? "Tap any category row" : "Ketuk baris kategori"}</strong> &rarr; {isEn ? "Type amount &rarr; Press Enter to auto-save to cloud ☁️" : "Ketik jumlah &rarr; Enter untuk menyimpan otomatis ke cloud ☁️"}
      </div>

      {/* Category Rows */}
      <div className="space-y-3">
        {allCategories.map((cat) => {
          const isCustom = "custom" in cat && cat.custom;
          const val = isCustom
            ? (state.customExp || []).find((e) => e.id === cat.id)?.amt || 0
            : state.expenses?.[cat.id] || 0;
          
          const limit = state.catBudget?.[cat.id] || 0;
          const overLimit = limit > 0 && val > limit;
          const nearLimit = limit > 0 && val > limit * 0.8 && !overLimit;

          const catPct = state.budget > 0 ? Math.min(100, Math.round((val / state.budget) * 100)) : 0;
          const limitPct = limit > 0 ? Math.min(100, Math.round((val / limit) * 100)) : 0;
          
          const barColor = cat.locked ? "#10B981" : overLimit ? "#EF4444" : nearLimit ? "#F97316" : cat.color;
          const isEditing = editEId === cat.id;

          return (
            <div
              key={cat.id}
              onClick={() => {
                if (cat.locked) return;
                if (isCustom) {
                  const item = (state.customExp || []).find((e) => e.id === cat.id);
                  if (item) handleEditCustom(cat.id, item.name, item.amt);
                } else {
                  setEditEId(isEditing ? null : cat.id);
                  setEditVal(String(val || ""));
                }
              }}
              className={`flex items-center gap-4 bg-white border border-zinc-200/50 rounded-2xl p-4 transition-all duration-200 hover:bg-zinc-50 hover:shadow-sm cursor-pointer ${
                isEditing ? "border-[#C9A84C] bg-amber-50/20" : ""
              }`}
            >
              <span className="text-2xl select-none">{cat.icon}</span>
              
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold flex flex-wrap items-center gap-1.5">
                  <span className={cat.locked ? "text-emerald-600 font-extrabold" : "text-zinc-800"}>
                    {cat.label}
                  </span>
                  {limit > 0 && (
                    <>
                      {limitPct >= 100 ? (
                        <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md font-extrabold border border-rose-100 flex items-center gap-1">
                          🔴 {isEn ? "Overbudget" : "Overbudget"}
                        </span>
                      ) : limitPct >= 80 ? (
                        <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md font-extrabold border border-amber-200 flex items-center gap-1">
                          🟡 {isEn ? "Near limit" : "Hampir habis"}
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-extrabold border border-emerald-100 flex items-center gap-1">
                          🟢 {isEn ? "Safe" : "Aman"}
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                <div className="h-1.5 bg-zinc-100 rounded-full mt-2 overflow-hidden border border-zinc-200/10">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${limit > 0 ? limitPct : catPct}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
                
                <div className="text-[8px] text-zinc-400 mt-1 font-extrabold tracking-wide uppercase">
                  {limit > 0
                    ? `${fmtRp(val)} / ${isEn ? "limit" : "batas"} ${fmtRp(limit)} (${limitPct}%)`
                    : catPct > 0
                    ? `${catPct}% ${isEn ? "of total budget" : "dari total anggaran"}`
                    : isEn ? "No specific budget set" : "Belum dianggarkan secara spesifik"}
                </div>
              </div>

              {/* Action Column */}
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      placeholder="0"
                      className="bg-white border border-zinc-300 text-zinc-800 rounded-lg p-1.5 w-[110px] text-center text-xs font-extrabold outline-none font-mono focus:border-[#C9A84C]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCommitExpenseChange(cat.id);
                        if (e.key === "Escape") setEditEId(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleCommitExpenseChange(cat.id)}
                      className="bg-[#C9A84C] text-black hover:bg-[#B8860B] hover:text-white font-extrabold p-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditEId(null)}
                      className="bg-transparent border border-zinc-200 text-zinc-400 p-1.5 rounded-lg text-xs hover:text-zinc-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : cat.locked ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-emerald-600 font-mono">
                      {fmtRp(val)}
                    </span>
                    <button
                      onClick={() => {
                        setTabVal(String(state.expenses?.tabungan || 500000));
                        setIsTabunganModalOpen(true);
                      }}
                      className="bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-600 rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      🔓 Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-mono ${val > 0 ? "font-extrabold text-zinc-700" : "text-zinc-300 text-[11px]"}`}>
                      {val > 0 ? fmtRp(val) : (isEn ? "not filled ✏️" : "belum diisi ✏️")}
                    </span>
                    {isCustom && (
                      <>
                        <button
                          onClick={() => {
                            const item = (state.customExp || []).find((e) => e.id === cat.id);
                            if (item) handleEditCustom(cat.id, item.name, item.amt);
                          }}
                          className="text-[#B8860B] bg-amber-50 border border-amber-100 hover:bg-amber-100 rounded-lg px-2 py-1 text-[10px] cursor-pointer"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(isEn ? "Delete this custom category?" : "Hapus kategori kustom ini?")) handleDeleteCustomExpense(cat.id);
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 text-xs cursor-pointer"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 📋 DAFTAR RINCIAN TRANSAKSI PENGELUARAN (LEDGER) */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-[#B8860B] flex items-center gap-1.5">
              📋 {isEn ? "Where Did My Money Go?" : "Rincian Pengeluaran (Uang Gua Pergi Kemana?)"}
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              {isEn 
                ? "Detailed transaction logs. Delete any entry to instantly refund the amount back to its bank account." 
                : "Riwayat log transaksi lengkap. Hapus transaksi untuk otomatis mengembalikan saldo rekening bank Anda."}
            </p>
          </div>
          
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Siklus */}
            <select
              value={ledgerCycleFilter}
              onChange={(e) => setLedgerCycleFilter(e.target.value as any)}
              className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-[10px] font-black px-2.5 py-1.5 rounded-xl outline-none focus:border-[#C9A84C]"
            >
              <option value="current">{isEn ? "Current Cycle Only" : "Siklus Ini Saja"}</option>
              <option value="all">{isEn ? "All Cycles" : "Semua Siklus"}</option>
            </select>

            {/* Filter Kategori */}
            <select
              value={ledgerCatFilter}
              onChange={(e) => setLedgerCatFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-[10px] font-black px-2.5 py-1.5 rounded-xl outline-none focus:border-[#C9A84C]"
            >
              <option value="all">{isEn ? "All Categories" : "Semua Kategori"}</option>
              {allCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>

            {/* Filter Rekening */}
            <select
              value={ledgerBankFilter}
              onChange={(e) => setLedgerBankFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-[10px] font-black px-2.5 py-1.5 rounded-xl outline-none focus:border-[#C9A84C]"
            >
              <option value="all">{isEn ? "All Bank Accounts" : "Semua Rekening"}</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.icon} {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Total stats under active filter */}
        {(() => {
          const rawLogs = state.activityLogs || [];
          
          // Filter logs
          const filteredLogs = rawLogs.filter(log => {
            if (log.type !== "expense") return false;
            
            // Date cycle filter
            if (ledgerCycleFilter === "current") {
              const logDateStr = log.timestamp?.slice(0, 10);
              if (!logDateStr || logDateStr < cycleRange.startStr || logDateStr > cycleRange.endStr) {
                return false;
              }
            }
            
            // Category filter
            if (ledgerCatFilter !== "all") {
              // Try explicit category first
              if (log.category && log.category !== ledgerCatFilter) {
                return false;
              }
              // If no explicit category, try parsing from actionLower
              if (!log.category) {
                const actionLower = log.action.toLowerCase();
                const matchedCat = ["makan", "rokok", "hiburan", "jajanan", "bensin", "outfit", "kampus", "laundry", "darurat", "tabungan"].find(
                  c => actionLower.includes(c)
                );
                const isMatch = matchedCat === ledgerCatFilter;
                if (!isMatch) return false;
              }
            }

            // Bank account filter
            if (ledgerBankFilter !== "all") {
              if (log.bankId && log.bankId !== ledgerBankFilter) {
                return false;
              }
              if (!log.bankId && log.details) {
                const targetBank = banks.find(b => b.id === ledgerBankFilter);
                if (targetBank && !log.details.toLowerCase().includes(targetBank.name.toLowerCase())) {
                  return false;
                }
              }
            }
            
            return true;
          });

          // Sort logs newest first
          const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          const totalFilteredSpent = sortedLogs.reduce((sum, log) => sum + (log.value || 0), 0);

          return (
            <div className="space-y-4">
              <div className="bg-zinc-50 border border-zinc-200/50 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest block">
                    {isEn ? "Total Expenses (Filtered)" : "Total Pengeluaran (Terfilter)"}
                  </span>
                  <span className="text-sm font-black text-rose-600 font-mono">
                    - {fmtRp(totalFilteredSpent)}
                  </span>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-xl text-[10px] font-black text-zinc-500">
                  {sortedLogs.length} {isEn ? "Transactions" : "Transaksi"}
                </div>
              </div>

              {sortedLogs.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs italic bg-zinc-50/50 rounded-2xl border border-zinc-100 border-dashed">
                  {isEn ? "No transactions match your active filters." : "Tidak ada catatan pengeluaran yang sesuai dengan filter Anda."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        <th className="pb-3 text-left font-black">{isEn ? "Date" : "Tanggal"}</th>
                        <th className="pb-3 text-left font-black">{isEn ? "Category" : "Kategori"}</th>
                        <th className="pb-3 text-left font-black">{isEn ? "Details & Bank" : "Rincian & Rekening"}</th>
                        <th className="pb-3 text-right font-black">{isEn ? "Amount" : "Jumlah"}</th>
                        <th className="pb-3 text-center font-black">{isEn ? "Action" : "Aksi"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100/60">
                      {sortedLogs.map((log) => {
                        // Find matching category emoji & label
                        const itemCatId = log.category || (() => {
                          const actionLower = log.action.toLowerCase();
                          const matchedCat = ["makan", "rokok", "hiburan", "jajanan", "bensin", "outfit", "kampus", "laundry", "darurat", "tabungan"].find(
                            c => actionLower.includes(c)
                          );
                          return matchedCat || "darurat";
                        })();
                        
                        const catObj = allCategories.find(c => c.id === itemCatId);
                        const catIcon = catObj ? catObj.icon : "📦";
                        const catLabel = catObj ? catObj.label : itemCatId;

                        const dateObj = new Date(log.timestamp);
                        const displayDate = dateObj.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
                        const displayTime = dateObj.toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" }).split(",")[1] || "";

                        return (
                          <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                            {/* Date */}
                            <td className="py-3 pr-2 whitespace-nowrap">
                              <span className="font-extrabold block text-zinc-800">{displayDate}</span>
                              <span className="text-[9px] text-zinc-400 font-mono mt-0.5 block">{displayTime}</span>
                            </td>
                            {/* Category */}
                            <td className="py-3 pr-2 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-base select-none">{catIcon}</span>
                                <span className="font-bold text-zinc-800">{catLabel}</span>
                              </div>
                            </td>
                            {/* Details */}
                            <td className="py-3 pr-2">
                              <div className="space-y-0.5">
                                <span className="font-semibold text-zinc-700 block line-clamp-1">
                                  {log.note || log.action}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1 flex-wrap">
                                  <span>💳</span>
                                  <span>{log.details}</span>
                                </span>
                              </div>
                            </td>
                            {/* Amount */}
                            <td className="py-3 pr-3 text-right whitespace-nowrap">
                              <span className="font-black font-mono text-rose-500">
                                - {fmtRp(log.value || 0)}
                              </span>
                            </td>
                            {/* Action */}
                            <td className="py-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteTransaction(log.id)}
                                className="bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-extrabold px-2 py-1 rounded-xl text-[10px] cursor-pointer transition-colors"
                              >
                                {isEn ? "Delete" : "Hapus"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Add Custom Expense */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5">
          {isEn ? "➕ Add Other Expenses" : "➕ Tambah Pengeluaran Lainnya"}
        </h4>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder={isEn ? "Expense name..." : "Nama pengeluaran..."}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 min-w-[130px] bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs outline-none focus:bg-white focus:border-[#C9A84C]"
          />
          <input
            type="number"
            placeholder={isEn ? "Amount (Rp)" : "Jumlah (Rp)"}
            value={customAmt}
            onChange={(e) => setCustomAmt(e.target.value)}
            className="w-[120px] bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs outline-none focus:bg-white focus:border-[#C9A84C] font-mono"
          />
          <button
            onClick={handleAddCustomExpense}
            className="bg-[#C9A84C] text-[#1a1500] hover:bg-[#B8860B] hover:text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer active:scale-95"
          >
            {isEn ? "+ Add" : "+ Tambah"}
          </button>
        </div>
      </div>

      {/* Expense Share Bar Chart */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">
          {isEn ? "Expenses by Category Chart" : "Grafik Pengeluaran per Kategori"}
        </h4>
        <div className="h-[200px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis type="number" stroke="#a1a1aa" fontSize={8} tickFormatter={(v) => fmtK(v)} />
                <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={9} width={50} tickLine={false} />
                <RechartsTooltip
                  formatter={(value: any) => [fmtRp(value), isEn ? "Amount" : "Jumlah"]}
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#f4f4f5", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", color: "#18181b" }}
                />
                <Bar dataKey="jumlah" fill="#C9A84C" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-400 italic text-center">
              <span className="text-xl mb-1">📊</span>
              <span>{isEn ? "No expense data yet." : "Belum ada data pengeluaran."}</span>
            </div>
          )}
        </div>
      </div>

      {/* What-If Budget Simulator */}
      <div className="bg-white border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl p-6">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#B8860B] flex items-center gap-2">
            🧮 {isEn ? "Budget Scenario Simulation" : "Simulasi Skenario Hemat"}
          </h3>
          <p className="text-[10px] text-zinc-400 mt-1">
            {isEn ? "See the impact of savings on achieving your goals" : "Lihat dampak penghematan terhadap pencapaian goal kamu"}
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
                {isEn ? "Select Category" : "Pilih Kategori"}
              </label>
              <select
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs outline-none focus:bg-white focus:border-[#C9A84C]"
              >
                <option value="">{isEn ? "-- Select Category --" : "-- Pilih Kategori --"}</option>
                {allCategories
                  .filter((cat) => cat.id !== "tabungan")
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon || "📦"} {cat.label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1.5">
                {isEn ? "Reduce by Rp per Month" : "Kurangi sebesar Rp per bulan"}
              </label>
              <input
                type="number"
                placeholder={isEn ? "Amount (Rp)..." : "Jumlah (Rp)..."}
                value={simReduction}
                onChange={(e) => setSimReduction(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-2xl py-2.5 px-4 text-xs outline-none focus:bg-white focus:border-[#C9A84C] font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleSimulate}
            className="w-full bg-[#C9A84C] text-[#1a1500] hover:bg-[#B8860B] hover:text-white font-extrabold py-3 px-5 rounded-2xl text-xs transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-2"
          >
            📊 {isEn ? "Calculate Impact" : "Hitung Dampak"}
          </button>

          {/* Results section */}
          {hasSimulated ? (
            simResults.length > 0 ? (
              <div className="space-y-3 mt-4">
                <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black">
                  {isEn ? "Simulation Results" : "Hasil Simulasi"}
                </label>
                <div className="space-y-2">
                  {simResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 animate-fade-in"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">🎯</span>
                        <span className="text-xs font-extrabold text-zinc-700">{result.name}</span>
                      </div>
                      <div className="text-xs text-zinc-600 font-medium text-right md:text-left">
                        {isEn ? "Finished" : "Selesai"}{" "}
                        <span className="font-black text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-lg mx-1">
                          {result.weeksSaved} {isEn ? "weeks faster" : "minggu lebih cepat"}
                        </span>{" "}
                        ({result.currentWeeks} {isEn ? "weeks" : "minggu"} → {result.newWeeks} {isEn ? "weeks" : "minggu"})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 border border-zinc-200/50 rounded-2xl text-center text-zinc-400 italic text-xs animate-fade-in">
                <span className="text-lg block mb-1">💡</span>
                {isEn
                  ? "You don't have any goals with saving speed set. Set a saving speed in the Goals tab to see this simulation."
                  : "Kamu belum punya goal dengan kecepatan progress (speed) yang diset. Set kecepatan nabung di tab Goals untuk melihat simulasi ini."}
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Custom Category Edit Modal */}
      <Modal
         isOpen={selectedCustomId !== null}
         onClose={() => setSelectedCustomId(null)}
         title={isEn ? "✏️ Edit Expense" : "✏️ Edit Pengeluaran"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
              {isEn ? "Category Name" : "Nama Kategori"}
            </label>
            <input
              type="text"
              value={editCustomName}
              onChange={(e) => setEditCustomName(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm focus:border-[#C9A84C] text-zinc-800 outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
              {isEn ? "Amount (Rp)" : "Jumlah (Rp)"}
            </label>
            <input
              type="number"
              value={editCustomAmt}
              onChange={(e) => setEditCustomAmt(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-lg text-right font-extrabold font-mono text-[#B8860B] focus:border-[#C9A84C] outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveCustomEdit}
              className="flex-1 bg-[#C9A84C] text-[#1a1500] hover:bg-[#B8860B] hover:text-white font-extrabold p-3 rounded-xl transition-colors text-xs cursor-pointer"
            >
              ✓ {isEn ? "Save" : "Simpan"}
            </button>
            <button
              onClick={() => {
                if (selectedCustomId) {
                  handleDeleteCustomExpense(selectedCustomId);
                  setSelectedCustomId(null);
                }
              }}
              className="bg-rose-50 border border-rose-100 text-rose-600 font-extrabold p-3 rounded-xl hover:bg-rose-100 transition-colors text-xs px-4 cursor-pointer"
            >
              🗑️ {isEn ? "Delete" : "Hapus"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Tabungan (Savings) Unlock Modal */}
      <Modal
        isOpen={isTabunganModalOpen}
        onClose={() => {
          setIsTabunganModalOpen(false);
          setTabConfirmInput("");
          setIsTabUnfinished(true);
        }}
        title={isEn ? "🏦 Edit Savings" : "🏦 Edit Tabungan"}
      >
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 leading-relaxed">
            {isEn
              ? "⚠️ Savings are locked to prevent accidental spending."
              : "⚠️ Tabungan dikunci untuk mencegah pengeluaran tidak sengaja."}
            <br />
            {isEn ? (
              <>To unlock, type <strong className="text-[#B8860B] font-bold">AGREE</strong> below.</>
            ) : (
              <>Untuk membuka kunci, ketik <strong className="text-[#B8860B] font-bold">SETUJU</strong> di bawah.</>
            )}
          </div>

          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest mb-1 font-bold">
              {isEn ? "Type AGREE to unlock" : "Ketik SETUJU untuk buka kunci"}
            </label>
            <input
              type="text"
              placeholder={confirmKeyword}
              value={tabConfirmInput}
              onChange={(e) => {
                setTabConfirmInput(e.target.value);
                if (e.target.value.trim().toUpperCase() === confirmKeyword) {
                  setIsTabUnfinished(false);
                  showToast(isEn ? "🔓 Unlocked! Edit savings amount." : "🔓 Kunci terbuka! Edit jumlah tabungan.");
                } else {
                  setIsTabUnfinished(true);
                }
              }}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-3 px-4 text-center text-sm font-black tracking-widest uppercase outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {!isTabUnfinished && (
            <div className="animate-fade-in">
              <label className="block text-[9px] text-emerald-600 uppercase tracking-widest mb-1 font-bold">
                {isEn ? "Savings Amount" : "Jumlah Tabungan"}
              </label>
              <input
                type="number"
                value={tabVal}
                onChange={(e) => setTabVal(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-emerald-500 rounded-xl p-3 text-lg font-black font-mono text-emerald-600 text-right outline-none"
              />
            </div>
          )}

          <button
            onClick={() => {
              if (tabConfirmInput.trim().toUpperCase() === confirmKeyword) {
                if (isTabUnfinished) {
                  setIsTabUnfinished(false);
                } else {
                  handleSaveTabungan();
                }
              } else {
                showToast(isEn ? "❌ Type AGREE (caps) to unlock" : "❌ Ketik SETUJU (huruf kapital) untuk membuka");
              }
            }}
            className={`w-full font-bold p-3 rounded-xl text-xs transition-colors cursor-pointer ${
              isTabUnfinished
                ? "bg-[#C9A84C] text-[#1a1500] hover:bg-[#B8860B] hover:text-white"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            {isTabUnfinished ? (isEn ? "Check Confirmation" : "Cek Konfirmasi") : (isEn ? "✓ Save Savings" : "✓ Simpan Tabungan")}
          </button>
        </div>
      </Modal>

      {/* Modal Tambah/Edit Bank */}
      <Modal
        isOpen={isBankModalOpen}
        onClose={() => {
          setIsBankModalOpen(false);
          setEditingBankId(null);
          setBankName("");
          setBankBalance("");
          setBankIcon("🏦");
          setBankNotes("");
        }}
        title={editingBankId ? (isEn ? "Edit Bank Account ✏️" : "Edit Rekening Bank ✏️") : (isEn ? "Add Bank Account ➕" : "Tambah Rekening Bank ➕")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
              {isEn ? "Bank / Wallet Name" : "Nama Bank / Dompet"}
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. BCA, Mandiri, ShopeePay"
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
                {isEn ? "Balance Amount" : "Jumlah Saldo"}
              </label>
              <input
                type="number"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
                placeholder="e.g. 1500000"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs outline-none focus:border-[#C9A84C] font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
                {isEn ? "Icon" : "Ikon Visual"}
              </label>
              <select
                value={bankIcon}
                onChange={(e) => setBankIcon(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs outline-none focus:border-[#C9A84C]"
              >
                <option value="🏦">🏦 Bank (Standard)</option>
                <option value="💳">💳 Kartu Kredit/Debit</option>
                <option value="📱">📱 Dompet Digital (E-Wallet)</option>
                <option value="💵">💵 Uang Tunai (Cash)</option>
                <option value="🐷">🐷 Celengan / Saku</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
              {isEn ? "Short Note (Optional)" : "Catatan Singkat (Opsional)"}
            </label>
            <input
              type="text"
              value={bankNotes}
              onChange={(e) => setBankNotes(e.target.value)}
              placeholder="e.g. Rekening utama belanja harian"
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs outline-none focus:border-[#C9A84C]"
            />
          </div>

          <button
            onClick={handleSaveBank}
            className="w-full bg-[#C9A84C] hover:bg-[#B8860B] text-[#1a1500] hover:text-white font-bold p-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
          >
            {isEn ? "✓ Save Account" : "✓ Simpan Rekening"}
          </button>
        </div>
      </Modal>

      {/* Modal Transfer Saldo */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferAmount("");
        }}
        title={isEn ? "Transfer Funds 🔄" : "Pindahkan Saldo 🔄"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
                {isEn ? "Source Bank" : "Dari Rekening"}
              </label>
              <select
                value={transferSource}
                onChange={(e) => setTransferSource(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs outline-none focus:border-[#C9A84C]"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.icon} {b.name} ({fmtRp(b.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
                {isEn ? "Destination Bank" : "Ke Rekening"}
              </label>
              <select
                value={transferDest}
                onChange={(e) => setTransferDest(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs outline-none focus:border-[#C9A84C]"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.icon} {b.name} ({fmtRp(b.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] text-zinc-400 uppercase tracking-widest font-black mb-1">
              {isEn ? "Transfer Amount" : "Jumlah Transfer"}
            </label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="e.g. 200000"
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-2.5 px-4 text-xs font-mono font-bold outline-none focus:border-[#C9A84C]"
            />
          </div>

          <button
            onClick={handleTransferFunds}
            className="w-full bg-[#C9A84C] hover:bg-[#B8860B] text-[#1a1500] hover:text-white font-bold p-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
          >
            {isEn ? "✓ Confirm Transfer" : "✓ Konfirmasi Kirim Saldo"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
