import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  CreditCard,
  Layers,
  ListChecks,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Radio,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Target,
  Users,
  X,
} from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FilterMultiSelect } from "@/components/feature/filters/FilterMultiSelect";
import { FilterSheet, type FilterField } from "@/components/feature/filters/FilterSheet";
import { adminApi } from "@/lib/api/admin";
import {
  countActiveFilters,
  useFiltersStore,
} from "@/stores/useFiltersStore";

export type { FilterField };

interface GlobalFilterBarProps {
  /** Inline + panelde gösterilecek multi-select filtreler (sayfaya göre). */
  fields?: FilterField[];
  /** Gelişmiş aralık filtreleri (ciro/sipariş/ROAS/dönüşüm) — panelde. */
  showRanges?: boolean;
  /** Çubuğun sağına yerleşen ek kontrol(ler) — ör. tarih aralığı + karşılaştırma. */
  trailing?: ReactNode;
}

/**
 * Dashboard filtre çubuğu.
 *
 * - "Filtreler" butonu → sağdan açılan gelişmiş panel (FilterSheet): sayfanın
 *   TÜM filtreleri tek yerde, taslak + Uygula.
 * - Yanında hızlı erişim için inline dropdown'lar (anında uygulanır).
 * - `fields`/`showRanges` ile sayfaya göre yapılandırılır; her sayfada yalnız
 *   backend'in doğru desteklediği filtreler gösterilir.
 */
export function GlobalFilterBar({
  fields = ["channels", "devices"],
  showRanges = false,
  trailing,
}: GlobalFilterBarProps) {
  const { t } = useTranslation(["filters", "dashboard", "common"]);
  const store = useFiltersStore();

  const channelsQ = useQuery({
    queryKey: ["filters", "channels"],
    queryFn: () => adminApi.filterChannels(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("channels"),
  });
  const devicesQ = useQuery({
    queryKey: ["filters", "devices"],
    queryFn: () => adminApi.filterDevices(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("devices"),
  });
  const citiesQ = useQuery({
    queryKey: ["filters", "cities"],
    queryFn: () => adminApi.filterCities(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("cities"),
  });
  const categoriesQ = useQuery({
    queryKey: ["filters", "categories"],
    queryFn: () => adminApi.filterCategories(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("categories"),
  });
  const brandsQ = useQuery({
    queryKey: ["filters", "brands"],
    queryFn: () => adminApi.filterBrands(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("brands"),
  });
  const statusesQ = useQuery({
    queryKey: ["filters", "order-statuses"],
    queryFn: () => adminApi.filterOrderStatuses(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("statuses"),
  });
  const paymentMethodsQ = useQuery({
    queryKey: ["filters", "payment-methods"],
    queryFn: () => adminApi.filterPaymentMethods(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("payment_methods"),
  });
  const gendersQ = useQuery({
    queryKey: ["filters", "genders"],
    queryFn: () => adminApi.filterGenders(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("genders"),
  });
  const ageGroupsQ = useQuery({
    queryKey: ["filters", "age_groups"],
    queryFn: () => adminApi.filterAgeGroups(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("age_groups"),
  });
  const metaCampaignsQ = useQuery({
    queryKey: ["filters", "meta_campaigns"],
    queryFn: () => adminApi.filterMetaCampaigns(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("meta_campaigns"),
  });
  const metaObjectivesQ = useQuery({
    queryKey: ["filters", "meta_objectives"],
    queryFn: () => adminApi.filterMetaObjectives(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("meta_objectives"),
  });
  const googleCampaignsQ = useQuery({
    queryKey: ["filters", "google_campaigns"],
    queryFn: () => adminApi.filterGoogleCampaigns(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("google_campaigns"),
  });
  const googleDevicesQ = useQuery({
    queryKey: ["filters", "google_devices"],
    queryFn: () => adminApi.filterGoogleDevices(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("google_devices"),
  });
  const googleChannelTypesQ = useQuery({
    queryKey: ["filters", "google_channel_types"],
    queryFn: () => adminApi.filterGoogleChannelTypes(),
    staleTime: 60 * 60 * 1000,
    enabled: fields.includes("google_channel_types"),
  });

  const renderStatus = (o: string) => t(`dashboard:ecom.status_${o}`, { defaultValue: o });
  const renderPayment = (o: string) => t(`dashboard:ecom.payment_${o}`, { defaultValue: o });
  const renderGender = (o: string) =>
    t(`dashboard:customers.gender_${o}`, { defaultValue: o });
  const renderObjective = (o: string) =>
    t(`filters:objective_${o}`, { defaultValue: o });
  const renderChannelType = (o: string) =>
    t(`filters:channel_type_${o}`, { defaultValue: o });
  const renderDevice = (o: string) => t(`filters:device_${o}`, { defaultValue: o });

  const total = countActiveFilters(store);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 shadow-theme-xs">
      <FilterSheet
        fields={fields}
        showRanges={showRanges}
        trigger={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <SlidersHorizontal className="size-3.5 text-primary" />
            {t("filters:open_button")}
            {total > 0 && (
              <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {total}
              </span>
            )}
          </button>
        }
      />

      <div className="hidden h-5 w-px bg-border/70 sm:block" />

      {fields.includes("channels") && (
        <FilterMultiSelect
          label={t("filters:channel")}
          icon={Radio}
          options={channelsQ.data ?? []}
          selected={store.selected_channels}
          loading={channelsQ.isPending}
          onChange={store.setSelectedChannels}
        />
      )}
      {fields.includes("devices") && (
        <FilterMultiSelect
          label={t("filters:device")}
          icon={MonitorSmartphone}
          options={(devicesQ.data ?? []).filter((d) => d !== "all")}
          selected={store.selected_devices}
          loading={devicesQ.isPending}
          onChange={store.setSelectedDevices}
        />
      )}
      {fields.includes("cities") && (
        <FilterMultiSelect
          label={t("filters:city")}
          icon={MapPin}
          options={citiesQ.data ?? []}
          selected={store.selected_cities}
          loading={citiesQ.isPending}
          searchable
          onChange={store.setSelectedCities}
        />
      )}
      {fields.includes("categories") && (
        <FilterMultiSelect
          label={t("filters:category")}
          icon={Tag}
          options={categoriesQ.data ?? []}
          selected={store.selected_categories}
          loading={categoriesQ.isPending}
          searchable
          onChange={store.setSelectedCategories}
        />
      )}
      {fields.includes("brands") && (
        <FilterMultiSelect
          label={t("filters:brand")}
          icon={ShoppingBag}
          options={brandsQ.data ?? []}
          selected={store.selected_brands}
          loading={brandsQ.isPending}
          searchable
          onChange={store.setSelectedBrands}
        />
      )}
      {fields.includes("statuses") && (
        <FilterMultiSelect
          label={t("filters:status")}
          icon={ListChecks}
          options={statusesQ.data ?? []}
          selected={store.selected_statuses}
          loading={statusesQ.isPending}
          renderOption={renderStatus}
          onChange={store.setSelectedStatuses}
        />
      )}
      {fields.includes("payment_methods") && (
        <FilterMultiSelect
          label={t("filters:payment_method")}
          icon={CreditCard}
          options={paymentMethodsQ.data ?? []}
          selected={store.selected_payment_methods}
          loading={paymentMethodsQ.isPending}
          renderOption={renderPayment}
          onChange={store.setSelectedPaymentMethods}
        />
      )}
      {fields.includes("genders") && (
        <FilterMultiSelect
          label={t("filters:gender")}
          icon={Users}
          options={gendersQ.data ?? []}
          selected={store.selected_genders}
          loading={gendersQ.isPending}
          renderOption={renderGender}
          onChange={store.setSelectedGenders}
        />
      )}
      {fields.includes("age_groups") && (
        <FilterMultiSelect
          label={t("filters:age_group")}
          icon={CalendarRange}
          options={ageGroupsQ.data ?? []}
          selected={store.selected_age_groups}
          loading={ageGroupsQ.isPending}
          onChange={store.setSelectedAgeGroups}
        />
      )}
      {fields.includes("meta_campaigns") && (
        <FilterMultiSelect
          label={t("filters:campaign")}
          icon={Megaphone}
          options={metaCampaignsQ.data ?? []}
          selected={store.selected_meta_campaigns}
          loading={metaCampaignsQ.isPending}
          searchable
          onChange={store.setSelectedMetaCampaigns}
        />
      )}
      {fields.includes("meta_objectives") && (
        <FilterMultiSelect
          label={t("filters:objective")}
          icon={Target}
          options={metaObjectivesQ.data ?? []}
          selected={store.selected_meta_objectives}
          loading={metaObjectivesQ.isPending}
          renderOption={renderObjective}
          onChange={store.setSelectedMetaObjectives}
        />
      )}
      {fields.includes("google_campaigns") && (
        <FilterMultiSelect
          label={t("filters:campaign")}
          icon={Megaphone}
          options={googleCampaignsQ.data ?? []}
          selected={store.selected_google_campaigns}
          loading={googleCampaignsQ.isPending}
          searchable
          onChange={store.setSelectedGoogleCampaigns}
        />
      )}
      {fields.includes("google_devices") && (
        <FilterMultiSelect
          label={t("filters:device")}
          icon={MonitorSmartphone}
          options={googleDevicesQ.data ?? []}
          selected={store.selected_google_devices}
          loading={googleDevicesQ.isPending}
          renderOption={renderDevice}
          onChange={store.setSelectedGoogleDevices}
        />
      )}
      {fields.includes("google_channel_types") && (
        <FilterMultiSelect
          label={t("filters:channel_type")}
          icon={Layers}
          options={googleChannelTypesQ.data ?? []}
          selected={store.selected_google_channel_types}
          loading={googleChannelTypesQ.isPending}
          renderOption={renderChannelType}
          onChange={store.setSelectedGoogleChannelTypes}
        />
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {total > 0 && (
          <button
            type="button"
            onClick={() => store.resetFilters()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-error-50 hover:text-destructive dark:hover:bg-error-500/10"
          >
            <X className="size-3.5" />
            {t("filters:clear_all")}
          </button>
        )}
        {total === 0 && !trailing && (
          <span className="hidden text-xs text-text-dim sm:inline">
            {t("filters:all_data")}
          </span>
        )}
        {trailing && (
          <>
            <div className="hidden h-5 w-px bg-border/70 sm:block" />
            {trailing}
          </>
        )}
      </div>
    </div>
  );
}
