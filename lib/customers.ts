export type CustomerGuarantor = {
  id: string;
  guarantorCustomerId: string;
  name: string;
  phone: string;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  isBlacklisted: boolean;
  idCardPhotoUrl?: string | null;
  profilePhotoUrl?: string | null;
  guarantors?: CustomerGuarantor[];
};

export type CustomerListRow = CustomerSummary;

export function mapGuarantors(
  rows: Array<{
    id: string;
    guarantorCustomerId: string;
    guarantorCustomer: { name: string; phone: string };
  }>,
): CustomerGuarantor[] {
  return rows.map((row) => ({
    id: row.id,
    guarantorCustomerId: row.guarantorCustomerId,
    name: row.guarantorCustomer.name,
    phone: row.guarantorCustomer.phone,
  }));
}
