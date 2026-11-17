export type AppUser = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "bhw";
  password_hash: string | null;
  is_active: number;
  must_change_password: number;
};

export type Barangay = { id: string; name: string };

export type Child = {
  id: string;
  name: string;
  birthday: string;
  sex: "F" | "M";
  parents: string;
  barangay_id: string;
  barangay_name: string;
  bhw_names: string | null;
};

export type ManagedUser = AppUser & { assigned_ids: string | null };
