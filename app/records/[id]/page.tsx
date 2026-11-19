import EditRecordPage from "@/Client/views/pages/edit-record";

export const dynamic = "force-dynamic";
export default function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditRecordPage params={params} />;
}
