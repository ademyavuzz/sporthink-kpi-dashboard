export interface EcomFilterValue {
  categories: string[];
  brands: string[];
  statuses: string[];
  payment_methods: string[];
  segment_id: number | null;
}

export const emptyEcomFilter: EcomFilterValue = {
  categories: [],
  brands: [],
  statuses: [],
  payment_methods: [],
  segment_id: null,
};
