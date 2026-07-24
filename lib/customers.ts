export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  isBlacklisted: boolean;
  idCardPhotoUrl?: string | null;
  profilePhotoUrl?: string | null;
};

export type CustomerListRow = CustomerSummary;
