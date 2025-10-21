import LogClient from "./logClient";

export default async function Page({ params }: { params: Promise<{ plc_id: string }> }) {
  const { plc_id } = await params;
  return <LogClient plc_id={plc_id} />;
}
