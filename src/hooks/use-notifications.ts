import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface NotificationRow {
  id: string;
  user_id: string | null;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// ─── Standalone helpers (used by auth flow & low stock) ──────────

export async function insertConnectionLog(
  user: User,
  displayName: string,
) {
  const { error } = await supabase.from("connection_logs").insert({
    user_id: user.id,
    email: user.email ?? "",
    display_name: displayName,
    connected_at: new Date().toISOString(),
  });
  if (error) console.error("Failed to log connection:", error);
}

export async function insertNotification(
  message: string,
  type = "info",
  userId?: string,
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId ?? null,
    message,
    type,
    is_read: false,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("Failed to insert notification:", error);
}

// ─── Hook for the UI ────────────────────────────────────────

export function useNotifications(currentUserId: string | null) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!currentUserId) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .or(`user_id.eq.${currentUserId},user_id.is.null`);
    if (count !== null) setUnreadCount(count);
  }, [currentUserId]);

  const fetchAll = useCallback(async () => {
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (currentUserId) {
      query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
    }

    const { data } = await query;
    if (data) setNotifications(data);
    fetchCount();
    setLoading(false);
  }, [currentUserId, fetchCount]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchAll();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchAll, fetchCount]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      console.error("Erreur suppression notification:", error);
      return;
    }
    const deleted = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (deleted && !deleted.is_read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const deleteAllNotifications = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids);
    if (error) {
      console.error("Erreur suppression des notifications:", error);
      return;
    }
    setNotifications([]);
    if (unreadIds.length > 0) setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refresh: fetchAll,
  };
}
