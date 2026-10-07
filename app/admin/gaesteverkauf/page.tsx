import MenuEditor from "@/components/menu-admin/MenuEditor";

export default function GaesteverkaufAdminPage() {
  return (
    <MenuEditor
      menu="GAESTEVERKAUF"
      title="Gästeverkauf"
      intro="Speisen zum Mitnehmen. Diese Karte ist von der Speisekarte im Haus getrennt, die Preise sind unabhängig."
      publicHref="/restaurant/gaesteverkauf"
    />
  );
}
