export type AppUser = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "bhw";
  password_hash?: string | null;
  is_active: number;
  must_change_password: number;
};

export type Barangay = { id: string; name: string };
export type Purok = { id: string; name: string; barangay_id: string };
export type Sitio = { id: string; name: string; barangay_id: string };

export type Child = {
  id: string;
  name: string;
  birthday: string;
  sex: "F" | "M";
  parents: string;
  barangay_id: string;
  barangay_name: string;
  purok_id: string | null;
  purok_name: string | null;
  bhw_names: string | null;
  updated_at?: string;
};

export type ManagedUser = AppUser & { assigned_ids: string | null; assigned_purok_ids: string | null };
