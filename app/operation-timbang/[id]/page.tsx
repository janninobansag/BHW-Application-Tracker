import EditRecord from "@/Client/views/pages/edit-record";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Operation Timbang | BHW Records" };

export default function EditTimbangPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditRecord params={params} program="timbang" />;
}
