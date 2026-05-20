export interface EcomFilterValue {
  categories: string[];
  brands: string[];
  statuses: string[];
  payment_methods: string[];
}

export const emptyEcomFilter: EcomFilterValue = {
  categories: [],
  brands: [],
  statuses: [],
  payment_methods: [],
};
