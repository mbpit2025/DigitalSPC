import McPage from "./LogPage";

export default async function Page({ params }: { params: { plcName: string } }) {

  const {plcName} = await params;
  return <McPage plcName={params.plcName} />;
}
