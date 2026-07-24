export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  isBlacklisted: boolean;
};

export type CustomerListRow = CustomerSummary;
