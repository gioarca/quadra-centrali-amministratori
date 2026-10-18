import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/index.ts";

/** I dati della centrale arrivano ogni 10 minuti: ricontrolliamo ogni minuto. */
const LIVE = 60_000;

/** Dopo ogni modifica ricarichiamo tutto: con pochi dati è la scelta più semplice e sempre corretta. */
export function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api.me(), staleTime: 60_000 });
export const useFleet = () => useQuery({ queryKey: ["fleet"], queryFn: () => api.fleet(), refetchInterval: LIVE });
export const usePlant = (id: string) =>
  useQuery({ queryKey: ["plant", id], queryFn: () => api.plant(id), refetchInterval: LIVE, enabled: !!id });
export const useWorkOrders = () => useQuery({ queryKey: ["work"], queryFn: () => api.workOrders() });
export const useWorkOrder = (id: string) => useQuery({ queryKey: ["work", id], queryFn: () => api.workOrder(id), enabled: !!id });
export const useDeadlines = () => useQuery({ queryKey: ["deadlines"], queryFn: () => api.deadlines() });
export const useQuotes = () => useQuery({ queryKey: ["quotes"], queryFn: () => api.quotes() });
export const useQuote = (id: string) => useQuery({ queryKey: ["quote", id], queryFn: () => api.quote(id), enabled: !!id });
export const useAdminHome = () => useQuery({ queryKey: ["adminHome"], queryFn: () => api.adminHome(), refetchInterval: LIVE });
export const useBuilding = (id: string) =>
  useQuery({ queryKey: ["building", id], queryFn: () => api.building(id), refetchInterval: LIVE, enabled: !!id });
export const useNotices = () => useQuery({ queryKey: ["notices"], queryFn: () => api.notices() });
export const useMyBuildings = () => useQuery({ queryKey: ["myBuildings"], queryFn: () => api.myBuildings() });
