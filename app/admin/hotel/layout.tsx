import type { ReactNode } from "react";

import HotelAdminShell from "@/components/hotel-admin/HotelAdminShell";

// Authentifizierung übernimmt das übergeordnete app/admin/layout.tsx.
export default function HotelAdminLayout({ children }: { children: ReactNode }) {
  return <HotelAdminShell>{children}</HotelAdminShell>;
}
