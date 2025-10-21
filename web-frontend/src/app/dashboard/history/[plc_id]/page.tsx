import LogClient from "./LogClient";

interface LogPageProps {
  params: Promise<{ plc_id: string }>;
}

export default async function LogPage({ params }: LogPageProps) {
  const { plc_id } = await params;
  return <LogClient plcId={plc_id} />;
}
