import type { AppUser } from "@/Data/entities";

export function postLoginRoute(user: Pick<AppUser, "must_change_password">): "/dashboard" | "/password" {
  return user.must_change_password ? "/password" : "/dashboard";
}
