import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

function iconForType(type: string): string {
  if (type === "connection") return "🟢";
  if (type === "low_stock") return "⚠️";
  return "ℹ️";
}

export function NotificationPopover({ userId }: { userId: string | null }) {
  const { isAdmin } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } =
    useNotifications(userId, isAdmin);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-full p-2 text-[#747878] hover:text-[#000000] hover:bg-[#f3f3f4] transition"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-2 flex items-center justify-center rounded-full bg-red-500 h-4 min-w-4 px-1 text-[10px] font-bold text-white leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 bg-white border border-gray-200 shadow-xl rounded-lg z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Notifications
          </span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-[10px] gap-1 text-slate-500 hover:text-black"
              >
                <CheckCheck className="h-3 w-3" /> Tout lu
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteAllNotifications}
                className="h-7 text-[10px] gap-1 text-slate-500 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" /> Tout supprimer
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Aucune notification pour le moment
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200">
            <div className="divide-y divide-slate-50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`group relative w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 ${
                    !n.is_read ? "bg-blue-50/40" : ""
                  }`}
                >
                  <button
                    onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-sm leading-none shrink-0">
                        {iconForType(n.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-700 leading-relaxed break-words pr-5">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#091426]" />
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-500"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
